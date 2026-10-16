import { describe, it, expect } from 'vitest';
import { resolveTenant } from '../core/tenant/resolver';

describe('Tenant Resolution Service', () => {
  it('should resolve tenant via query parameter override in dev mode', async () => {
    const result = await resolveTenant({
      search: '?tenant=nexus-logistics',
      isDev: true,
    });

    expect(result.status).toBe('resolved');
    expect(result.source).toBe('dev_override');
    expect(result.tenant?.identity.slug).toBe('nexus-logistics');
  });

  it('should resolve tenant via path pattern /t/:slug', async () => {
    const result = await resolveTenant({
      pathname: '/t/aura-fintech',
      isDev: true,
    });

    expect(result.status).toBe('resolved');
    expect(result.source).toBe('path');
    expect(result.tenant?.identity.slug).toBe('aura-fintech');
  });

  it('should resolve tenant via subdomain', async () => {
    const result = await resolveTenant({
      hostname: 'apex-health.example.com',
      isDev: false,
    });

    expect(result.status).toBe('resolved');
    expect(result.source).toBe('subdomain');
    expect(result.tenant?.identity.slug).toBe('apex-health');
  });

  it('should fallback to default tenant in development when no domain matches', async () => {
    const result = await resolveTenant({
      hostname: 'localhost',
      isDev: true,
    });

    expect(result.status).toBe('resolved');
    expect(result.source).toBe('default');
    expect(result.tenant?.identity.slug).toBe('apex-health');
  });

  it('should return unknown status in production when hostname does not match any tenant', async () => {
    const result = await resolveTenant({
      hostname: 'unregistered-domain.com',
      isDev: false,
    });

    expect(result.status).toBe('unknown');
    expect(result.tenant).toBeNull();
  });
});
