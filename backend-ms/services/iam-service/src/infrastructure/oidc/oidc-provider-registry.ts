import { IOidcProviderAdapter, IOidcProviderRegistry } from '../../application/ports/oidc-provider-adapter.port.js';
import { OidcProviderType } from '../../shared/contracts/index.js';
import { GenericOidcAdapter } from './generic-oidc.adapter.js';
import {
  EntraIdOidcAdapter,
  GenericOAuth2Adapter,
  GoogleOidcAdapter,
  KeycloakOidcAdapter,
  MockOidcAdapter,
  OktaOidcAdapter,
  SamlFederationAdapter
} from './provider-presets.adapters.js';

export class OidcProviderRegistry implements IOidcProviderRegistry {
  private readonly adapters = new Map<OidcProviderType, IOidcProviderAdapter>();

  constructor(customAdapters: IOidcProviderAdapter[] = []) {
    this.register(new GenericOidcAdapter());
    this.register(new GenericOAuth2Adapter());
    this.register(new GoogleOidcAdapter());
    this.register(new EntraIdOidcAdapter());
    this.register(new OktaOidcAdapter());
    this.register(new KeycloakOidcAdapter());
    this.register(new SamlFederationAdapter());
    this.register(new MockOidcAdapter());

    for (const adapter of customAdapters) {
      this.register(adapter);
    }
  }

  register(adapter: IOidcProviderAdapter): void {
    this.adapters.set(adapter.providerType, adapter);
  }

  getAdapter(providerType: OidcProviderType): IOidcProviderAdapter {
    return this.adapters.get(providerType) || this.adapters.get('GENERIC_OIDC')!;
  }

  listSupportedTypes(): OidcProviderType[] {
    return Array.from(this.adapters.keys());
  }
}
