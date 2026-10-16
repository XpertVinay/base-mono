# Enterprise Mobile Security Architecture

## 1. Storage & Credential Isolation

- **Sensitive Data (Tokens)**: Stored strictly using `ExpoSecureStore` (`Keychain` on iOS, `KeyStore` on Android with AES encryption).
- **Non-Sensitive Data (Preferences)**: Stored in `AsyncStorage` (active tenant slug, theme preference, locale).
- **Cross-Platform Safety**: On web or during unit test execution where SecureStore is unavailable, a safe memory fallback is used to prevent unhandled crashes.

---

## 2. API Security & Tenant Header Injection

Every outbound HTTP request made through `ApiClient` automatically injects:
1. `Authorization: Bearer <accessToken>` (unless `skipAuth: true`).
2. `X-Tenant-ID: <activeTenantId>`
3. `X-Tenant-Slug: <activeTenantSlug>`

```ts
// Centralized header injection in ApiClient
const requestHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Tenant-ID': tenant.tenantId,
  'X-Tenant-Slug': tenant.tenantSlug,
  ...headers,
};

if (!skipAuth) {
  const token = await SessionManager.getAccessToken();
  if (token) requestHeaders['Authorization'] = `Bearer ${token}`;
}
```

---

## 3. Trusted Host Validation

The mobile application **never** allows arbitrary tenant configurations from untrusted sources to override API base URLs or security policies. Base URLs are resolved from predefined, validated configurations.

---

## 4. Session Teardown & Cache Hygiene

When a user logs out (`SessionManager.clearSession()`) or changes tenants:
1. Access and refresh tokens are removed from SecureStore.
2. User profile is cleared from disk.
3. In-memory Zustand auth store is reset to unauthenticated state.
4. TanStack Query cache is wiped, ensuring no cached data from Tenant A leaks into Tenant B.
