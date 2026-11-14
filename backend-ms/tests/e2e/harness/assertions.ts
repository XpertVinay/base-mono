/**
 * tests/e2e/harness/assertions.ts
 * Standard Domain & Envelope Assertions
 */

import assert from 'node:assert/strict';
import type { HttpResponse } from './client.js';

export function assertTenantMismatch(res: HttpResponse): void {
  res.assertStatus(403);
  const errCode = res.data?.error?.code || res.data?.errors?.[0]?.code;
  assert.strictEqual(errCode, 'TENANT_MISMATCH', `Expected TENANT_MISMATCH, got ${errCode}`);
}

export function assertRateLimited(res: HttpResponse): void {
  res.assertStatus(429);
  assert.ok(
    res.headers['retry-after'] || res.rawText.includes('rate') || res.rawText.includes('429'),
    'Expected rate limiting indication in headers or body'
  );
}

export function assertUnauthorized(res: HttpResponse): void {
  res.assertStatus(401);
}

export function assertForbidden(res: HttpResponse): void {
  res.assertStatus(403);
}

export function assertNotFound(res: HttpResponse): void {
  res.assertStatus(404);
}

export function assertStandardEnvelope(res: HttpResponse): void {
  assert.ok(res.data && typeof res.data === 'object', 'Response data must be an object');
  assert.ok('status' in res.data || 'success' in res.data, 'Response must contain "status" or "success" property');
}

export function assertTenantBoundary(resA: HttpResponse, resB: HttpResponse): void {
  assertStandardEnvelope(resA);
  assertStandardEnvelope(resB);
  const textA = JSON.stringify(resA.data);
  const textB = JSON.stringify(resB.data);
  assert.notStrictEqual(textA, textB, 'Tenant A and Tenant B data must not be identical');
}
