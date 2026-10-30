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
4. `X-Device-Fingerprint: <hardwareIsolatedDeviceFingerprint>`

```ts
// Centralized header injection in ApiClient
const deviceFingerprint = await DeviceSecurity.getDeviceFingerprint();

const requestHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Tenant-ID': tenant.tenantId,
  'X-Tenant-Slug': tenant.tenantSlug,
  'X-Device-Fingerprint': deviceFingerprint,
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

---

## 5. Hardware-Backed Device Binding & Anti-Session Hijacking

- **Device Fingerprint Generation**: Generated cryptographically on first application launch and stored permanently in hardware-backed storage (`SecureStore`).
- **Binding in Token Payloads**: The backend API HMAC hashes this fingerprint into the token payload (`fgp`).
- **Protection**: If an attacker copies tokens off a device, replaying them from another machine or device is rejected with HTTP 401 Unauthorized (`Session hijacking detected`).

---

## 6. Certificate Pinning & Runtime Integrity

- **Certificate Pinning**: `DeviceSecurity.getCertificatePins()` provides SPKI hashes to validate backend TLS certificates against MITM proxy tools.
- **Integrity Probing**: `DeviceSecurity.checkDeviceIntegrity()` evaluates jailbreak/root indicators and debugger presence before sensitive operations.
