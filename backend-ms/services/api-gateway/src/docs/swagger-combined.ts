import { swaggerRestDoc } from './swagger-rest.js';
import { swaggerGrpcDoc } from './swagger-grpc.js';

export const swaggerCombinedDoc = {
  openapi: '3.0.3',
  info: {
    title: 'Enterprise Microservices Platform - Unified API & gRPC Gateway',
    version: '1.0.0',
    description: `Complete platform specification unifying HTTP REST APIs and gRPC inter-service contracts.
    
All operations strictly use the standard response format:
\`\`\`json
{
  "status": true | false,
  "message": "Success or error message",
  "data": { ... },
  "errors": [],
  "meta_data": {
    "requestId": "req-...",
    "timestamp": "ISO-8601",
    "debug": { "service": "...", "env": "..." },
    "pagination": { "page": 1, "limit": 20, "total": 100 },
    "further_steps": ["..."]
  }
}
\`\`\`
`,
    contact: {
      name: 'Platform Engineering Team',
      email: 'dev@enterprise.local'
    }
  },
  servers: [
    ...swaggerRestDoc.servers,
    ...swaggerGrpcDoc.servers
  ],
  tags: [
    ...swaggerRestDoc.tags,
    ...swaggerGrpcDoc.tags
  ],
  components: {
    securitySchemes: swaggerRestDoc.components.securitySchemes,
    schemas: {
      ...swaggerRestDoc.components.schemas,
      ...swaggerGrpcDoc.components.schemas
    }
  },
  paths: {
    ...swaggerRestDoc.paths,
    ...swaggerGrpcDoc.paths
  }
};
