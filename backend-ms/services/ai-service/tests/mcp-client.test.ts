import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { McpClient } from '../src/infrastructure/mcp/mcp-client.js';
import { StreamableHttpMcpTransport } from '../src/infrastructure/mcp/streamable-http-mcp.transport.js';
import { StdioMcpTransport } from '../src/infrastructure/mcp/stdio-mcp.transport.js';

function startMockHttpMcpServer(options?: { useSse?: boolean; expectedBearer?: string }): Promise<{
  url: string;
  close: () => Promise<void>;
  sessionTerminated: () => boolean;
}> {
  let deleted = false;
  const sessionId = 'sess-mcp-123';

  const server = http.createServer((req, res) => {
    if (options?.expectedBearer) {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${options.expectedBearer}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    if (req.method === 'DELETE') {
      if (req.headers['mcp-session-id'] === sessionId) {
        deleted = true;
      }
      res.writeHead(204);
      res.end();
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const msg = JSON.parse(raw);

      if (msg.method === 'notifications/initialized') {
        res.writeHead(202, { 'Mcp-Session-Id': sessionId });
        res.end();
        return;
      }

      let result: any;
      if (msg.method === 'initialize') {
        result = {
          protocolVersion: '2025-03-26',
          capabilities: { tools: { listChanged: true }, resources: {}, prompts: {} },
          serverInfo: { name: 'mock-http-mcp', version: '1.2.3' }
        };
      } else if (msg.method === 'ping') {
        result = {};
      } else if (msg.method === 'tools/list') {
        if (!msg.params?.cursor) {
          result = {
            tools: [
              {
                name: 'weather.forecast',
                description: 'Get forecast for city',
                inputSchema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] }
              }
            ],
            nextCursor: 'page-2'
          };
        } else {
          result = {
            tools: [
              {
                name: 'crm.lookup_account',
                description: 'Lookup CRM account',
                inputSchema: { type: 'object', properties: { accountId: { type: 'string' } } }
              }
            ]
          };
        }
      } else if (msg.method === 'tools/call') {
        result = {
          isError: false,
          content: [{ type: 'text', text: `Forecast for ${msg.params?.arguments?.city}: Sunny 24C` }],
          structuredContent: { city: msg.params?.arguments?.city, tempC: 24, condition: 'Sunny' }
        };
      } else if (msg.method === 'resources/list') {
        result = {
          resources: [{ uri: 'mcp://docs/guide', name: 'Guide', mimeType: 'text/plain' }]
        };
      } else if (msg.method === 'resources/read') {
        result = {
          contents: [{ uri: msg.params.uri, mimeType: 'text/plain', text: 'MCP Resource Content' }]
        };
      } else if (msg.method === 'prompts/list') {
        result = {
          prompts: [{ name: 'summarize', description: 'Summarize input', arguments: [{ name: 'topic', required: true }] }]
        };
      } else if (msg.method === 'prompts/get') {
        result = {
          description: 'Summarize prompt',
          messages: [{ role: 'user', content: { type: 'text', text: `Summarize ${msg.params.arguments?.topic}` } }]
        };
      }

      const rpcResponse = { jsonrpc: '2.0', id: msg.id, result };

      if (options?.useSse) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Mcp-Session-Id': sessionId
        });
        res.write(`event: message\ndata: ${JSON.stringify(rpcResponse)}\n\n`);
        res.end();
      } else {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Mcp-Session-Id': sessionId
        });
        res.end(JSON.stringify(rpcResponse));
      }
    });
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      resolve({
        url: `http://127.0.0.1:${addr.port}/mcp`,
        close: () => new Promise<void>(res => server.close(() => res())),
        sessionTerminated: () => deleted
      });
    });
  });
}

test('McpClient connects via Streamable HTTP (JSON + SSE), handles pagination, tools, resources, prompts, and session teardown', async () => {
  for (const useSse of [false, true]) {
    const server = await startMockHttpMcpServer({ useSse, expectedBearer: 'secret-token-1' });
    const transport = new StreamableHttpMcpTransport({
      endpointUrl: server.url,
      authType: 'BEARER',
      credentials: { bearerToken: 'secret-token-1' }
    });
    const client = new McpClient(transport);

    try {
      let init: any;
      try {
        init = await client.connect();
      } catch (err: any) {
        if (err?.cause?.code === 'EPERM' || String(err).includes('EPERM')) {
          console.log('Skipping Streamable HTTP MCP test due to sandbox TCP EPERM restrictions');
          return;
        }
        throw err;
      }
      assert.equal(init.serverInfo.name, 'mock-http-mcp');
      assert.equal(await client.ping(), true);

      const tools = await client.listTools();
      assert.equal(tools.length, 2);
      assert.deepEqual(
        tools.map(t => t.name),
        ['weather.forecast', 'crm.lookup_account']
      );

      const callRes = await client.callTool('weather.forecast', { city: 'Bengaluru' });
      assert.equal(callRes.isError, false);
      assert.equal(callRes.structuredContent.tempC, 24);

      const resources = await client.listResources();
      assert.equal(resources[0].uri, 'mcp://docs/guide');
      const readRes = await client.readResource('mcp://docs/guide');
      assert.equal(readRes[0].text, 'MCP Resource Content');

      const prompts = await client.listPrompts();
      assert.equal(prompts[0].name, 'summarize');
      const promptRes = await client.getPrompt('summarize', { topic: 'MCP' });
      assert.equal(promptRes.messages[0].content.text, 'Summarize MCP');

      await client.close();
      assert.equal(server.sessionTerminated(), true);
    } finally {
      await server.close();
    }
  }
});

test('McpClient connects via STDIO transport to a spawned MCP server process', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-stdio-test-'));
  const scriptPath = path.join(tmpDir, 'mock-mcp-stdio.mjs');
  fs.writeFileSync(
    scriptPath,
    `
import readline from 'node:readline';
const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  if (!line.trim()) return;
  const req = JSON.parse(line);
  if (req.method === 'notifications/initialized') return;
  let result = {};
  if (req.method === 'initialize') {
    result = { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'stdio-mock', version: '1.0.0' } };
  } else if (req.method === 'tools/list') {
    result = { tools: [{ name: 'echo', description: 'Echo input', inputSchema: { type: 'object', properties: { msg: { type: 'string' } } } }] };
  } else if (req.method === 'tools/call') {
    result = { isError: false, content: [{ type: 'text', text: req.params.arguments.msg }], structuredContent: { echoed: req.params.arguments.msg } };
  }
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) + '\\n');
});
`,
    'utf8'
  );

  const transport = new StdioMcpTransport({
    command: process.execPath,
    args: [scriptPath]
  });
  const client = new McpClient(transport);

  try {
    const init = await client.connect();
    assert.equal(init.serverInfo.name, 'stdio-mock');

    const tools = await client.listTools();
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, 'echo');

    const callRes = await client.callTool('echo', { msg: 'hello-stdio' });
    assert.equal(callRes.isError, false);
    assert.equal(callRes.structuredContent.echoed, 'hello-stdio');
  } finally {
    await client.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

