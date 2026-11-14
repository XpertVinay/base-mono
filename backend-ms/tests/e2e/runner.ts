/**
 * tests/e2e/runner.ts
 * Master Test Runner for E2E Test Suite Across All 4 Tiers
 *
 * Usage:
 *   NODE_PATH=./services/api-gateway/node_modules ./services/api-gateway/node_modules/.bin/tsx tests/e2e/runner.ts
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

interface TierSuite {
  tier: string;
  name: string;
  files: string[];
}

const SUITES: TierSuite[] = [
  {
    tier: 'Tier 1',
    name: 'Feature Coverage (F1 - F25)',
    files: [
      'tests/e2e/tier1-features/f01-f05-core.test.ts',
      'tests/e2e/tier1-features/f06-f10-gateway.test.ts',
      'tests/e2e/tier1-features/f11-f14-backoffice.test.ts',
      'tests/e2e/tier1-features/f15-f18-contracts.test.ts',
      'tests/e2e/tier1-features/f19-f25-security-perf.test.ts'
    ]
  },
  {
    tier: 'Tier 2',
    name: 'Boundary & Perimeter Defense',
    files: [
      'tests/e2e/tier2-boundary/auth-perimeter.test.ts',
      'tests/e2e/tier2-boundary/tenant-isolation.test.ts',
      'tests/e2e/tier2-boundary/payload-validation.test.ts'
    ]
  },
  {
    tier: 'Tier 3',
    name: 'Cross-Feature Distributed Sagas',
    files: [
      'tests/e2e/tier3-cross-feature/order-inventory-saga.test.ts',
      'tests/e2e/tier3-cross-feature/distributed-workflows.test.ts'
    ]
  },
  {
    tier: 'Tier 4',
    name: 'Real-World Enterprise Scenarios',
    files: [
      'tests/e2e/tier4-application/real-world-scenarios.test.ts'
    ]
  },
  {
    tier: 'Tier 5',
    name: 'Adversarial Stress & Hardening',
    files: [
      'tests/e2e/tier5-adversarial/adversarial-stress.test.ts'
    ]
  }
];

function runTestFile(file: string): Promise<{ file: string; code: number; stdout: string; stderr: string; passCount: number; failCount: number }> {
  return new Promise((resolve) => {
    const tsxPath = path.resolve(rootDir, 'services/api-gateway/node_modules/.bin/tsx');
    const child = spawn(tsxPath, ['--test', file], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_PATH: path.resolve(rootDir, 'services/api-gateway/node_modules')
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      // Parse node:test output for pass/fail counts
      const passMatch = stdout.match(/ℹ pass (\d+)/);
      const failMatch = stdout.match(/ℹ fail (\d+)/);
      const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
      const failCount = failMatch ? parseInt(failMatch[1], 10) : 0;

      resolve({
        file,
        code: code || 0,
        stdout,
        stderr,
        passCount,
        failCount
      });
    });
  });
}

async function main() {
  console.log('='.repeat(80));
  console.log('   ENTERPRISE MULTI-TENANT BACKEND MICROSERVICES — E2E MASTER RUNNER');
  console.log('   Topology: API Gateway (Port 4000) + 12 Microservices + In-Process Dispatch');
  console.log('='.repeat(80));
  console.log('');

  const startTime = Date.now();
  let totalPass = 0;
  let totalFail = 0;
  const results: { tier: string; name: string; file: string; pass: number; fail: number; status: string }[] = [];

  for (const suite of SUITES) {
    console.log(`\n▶ Executing ${suite.tier}: ${suite.name}...`);
    for (const file of suite.files) {
      process.stdout.write(`  • ${file} ... `);
      const res = await runTestFile(file);
      totalPass += res.passCount;
      totalFail += res.failCount;

      const isOk = res.code === 0 && res.failCount === 0;
      const statusStr = isOk ? 'PASS' : 'FAIL';
      console.log(`${statusStr} (${res.passCount} passed, ${res.failCount} failed)`);

      results.push({
        tier: suite.tier,
        name: suite.name,
        file,
        pass: res.passCount,
        fail: res.failCount,
        status: statusStr
      });

      if (!isOk) {
        console.error(`\n[ERROR IN ${file}]:\n${res.stdout}\n${res.stderr}`);
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(80));
  console.log('   MASTER TEST EXECUTION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Test Suites Executed: ${results.length}`);
  console.log(`Total Tests Passed:         ${totalPass}`);
  console.log(`Total Tests Failed:         ${totalFail}`);
  console.log(`Execution Duration:         ${duration}s`);
  console.log('-'.repeat(80));

  console.log('\nTier Breakdown:');
  for (const suite of SUITES) {
    const tierResults = results.filter((r) => r.tier === suite.tier);
    const tierPass = tierResults.reduce((acc, r) => acc + r.pass, 0);
    const tierFail = tierResults.reduce((acc, r) => acc + r.fail, 0);
    const tierStatus = tierFail === 0 ? '✓ ALL PASS' : '✖ FAILURES DETECTED';
    console.log(`  ${suite.tier.padEnd(8)} | ${suite.name.padEnd(36)} | ${tierPass.toString().padStart(3)} passed | ${tierFail.toString().padStart(2)} failed | ${tierStatus}`);
  }

  console.log('\n' + '='.repeat(80));
  if (totalFail === 0) {
    console.log(`  🏆 SUCCESS: 100% PASS RATE ACROSS ALL TIERS (${totalPass} TEST CASES)`);
    console.log('='.repeat(80) + '\n');
    process.exit(0);
  } else {
    console.error(`  ❌ FAILURE: ${totalFail} TESTS FAILED`);
    console.log('='.repeat(80) + '\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
