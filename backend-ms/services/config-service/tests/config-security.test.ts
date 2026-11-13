import { test } from 'node:test';
import assert from 'node:assert';
import { ConfigSetting } from '../src/domain/entities/config.entity.js';
import { IConfigRepository } from '../src/domain/repositories/config-repository.interface.js';
import { GetConfigQuery, SetConfigUseCase, ListConfigsQuery } from '../src/application/use-cases/config.use-cases.js';

class MockConfigRepository implements IConfigRepository {
  public settings = new Map<string, ConfigSetting>();

  private key(k: string, tenantId?: string): string {
    return `${tenantId || 'default'}:${k}`;
  }

  async getByKey(key: string, tenantId?: string): Promise<ConfigSetting | null> {
    const tid = tenantId || 'default';
    // 1. Look for tenant override
    const tenantSpecific = this.settings.get(this.key(key, tid));
    if (tenantSpecific) return tenantSpecific;

    // 2. Fallback to default
    if (tid !== 'default') {
      const defaultSetting = this.settings.get(this.key(key, 'default'));
      if (defaultSetting) return defaultSetting;
    }

    return null;
  }

  async getAll(tenantId?: string): Promise<ConfigSetting[]> {
    const tid = tenantId || 'default';
    const result = new Map<string, ConfigSetting>();

    // Defaults first
    for (const s of this.settings.values()) {
      if (s.tenantId === 'default') {
        result.set(s.key, s);
      }
    }

    // Tenant overrides
    if (tid !== 'default') {
      for (const s of this.settings.values()) {
        if (s.tenantId === tid) {
          result.set(s.key, s);
        }
      }
    }

    return Array.from(result.values());
  }

  async save(setting: ConfigSetting): Promise<void> {
    this.settings.set(this.key(setting.key, setting.tenantId), setting);
  }

  async delete(key: string, tenantId?: string): Promise<boolean> {
    return this.settings.delete(this.key(key, tenantId));
  }
}

test('Config Service: AES-256-GCM encryption, masking, and multi-tenant override resolution', async () => {
  const repo = new MockConfigRepository();
  const setUseCase = new SetConfigUseCase(repo);
  const getQuery = new GetConfigQuery(repo);
  const listQuery = new ListConfigsQuery(repo);

  // 1. Save sensitive API key with encryption enabled for default tenant
  const setRes = await setUseCase.execute({
    key: 'STRIPE_SECRET_KEY',
    value: 'sk_live_very_secret_production_key_12345',
    isEncrypted: true,
    tenantId: 'default'
  });

  assert.strictEqual(setRes.isSuccess, true);
  // DTO output must be masked
  assert.strictEqual(setRes.getValue().value, '********');

  // Stored value in repository MUST be encrypted with enc:v1 prefix
  const rawStored = await repo.getByKey('STRIPE_SECRET_KEY', 'default');
  assert.ok(rawStored !== null);
  assert.match(rawStored.value, /^v1:/);
  assert.doesNotMatch(rawStored.value, /sk_live/);

  // 2. Query without decrypt flag -> Returns masked string
  const maskedGet = await getQuery.execute({
    key: 'STRIPE_SECRET_KEY',
    tenantId: 'default',
    decrypt: false
  });
  assert.strictEqual(maskedGet.getValue().value, '********');

  // 3. Authorized query with decrypt=true -> Successfully decrypts to original plaintext
  const decryptedGet = await getQuery.execute({
    key: 'STRIPE_SECRET_KEY',
    tenantId: 'default',
    decrypt: true
  });
  assert.strictEqual(decryptedGet.getValue().value, 'sk_live_very_secret_production_key_12345');

  // 4. Multi-tenant inheritance: Tenant Acme inherits default setting
  const acmeInherited = await getQuery.execute({
    key: 'STRIPE_SECRET_KEY',
    tenantId: 'tenant-acme',
    decrypt: true
  });
  assert.strictEqual(acmeInherited.getValue().value, 'sk_live_very_secret_production_key_12345');

  // 5. Tenant Acme sets its own custom override
  await setUseCase.execute({
    key: 'STRIPE_SECRET_KEY',
    value: 'sk_live_acme_isolated_account_key_99999',
    isEncrypted: true,
    tenantId: 'tenant-acme'
  });

  // Querying Acme returns Acme's isolated override
  const acmeCustom = await getQuery.execute({
    key: 'STRIPE_SECRET_KEY',
    tenantId: 'tenant-acme',
    decrypt: true
  });
  assert.strictEqual(acmeCustom.getValue().value, 'sk_live_acme_isolated_account_key_99999');

  // Querying default still returns original default
  const defaultCheck = await getQuery.execute({
    key: 'STRIPE_SECRET_KEY',
    tenantId: 'default',
    decrypt: true
  });
  assert.strictEqual(defaultCheck.getValue().value, 'sk_live_very_secret_production_key_12345');

  // 6. List configs masks all encrypted items
  const listRes = await listQuery.execute({ tenantId: 'tenant-acme' });
  const items = listRes.getValue();
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].value, '********');
});
