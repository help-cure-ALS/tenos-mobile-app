# medical-sync-vault (Client Library)

A client-side TypeScript / React Native library for **secure device syncing** using:

- per-subject cryptographic identity (Ed25519)
- Proof-of-Possession (PoP) authentication
- cursor-based event sync
- offline-first storage (Expo SecureStore by default)

This library is designed to be used by **medical and privacy-sensitive apps** where:
- the backend must never see plaintext data
- multiple devices may join the same subject scope
- identity loss and server resets must be recoverable

---

## Core Concepts

### Subject
A **subject** represents one sync scope (e.g. one patient / dataset).

- Identified by a `subject_id` (UUID)
- Has exactly **one Ed25519 keypair**
- Can be used by multiple devices

### Device
Each device has:
- its own `device_id`
- its own JWT (issued via PoP)
- no shared secrets except the subject keypair

### QR / Clipboard secret transfer

The app supports explicit cross-device transfer of the full Vault secret bundle.
That flow is intentionally high-trust: a fresh bundle can transfer full subject
access to another device.

The protection model is:
- bundles are encrypted as `nacl-sb-v1`
- the bundle-cipher key is fetched from the Vault at runtime
- the key is not stored as a build-time `EXPO_PUBLIC_*` secret anymore
- bundle freshness is enforced separately by the app during import

Runtime key bootstrap:
- `GET /bundle-cipher/current`
- `GET /bundle-cipher/:kid`
- header: `X-App-Token: <EXPO_PUBLIC_VAULT_APP_ISSUE_TOKEN>`

Important operational detail:
- creating a QR bundle requires Vault reachability
- opening a QR bundle also requires Vault reachability
- the library only caches the resolved key in memory, not in persistent storage

### Identity Model

| Stored locally | Shared with server | Shared between devices |
|---------------|--------------------|------------------------|
| subject_id    | subject_id         | subject_id             |
| device_id     | device_id          | ❌                     |
| Ed25519 keys  | public key only    | private key (explicit) |
| JWT           | ❌                  | ❌                     |

---

## Installation

This library is currently intended to be **vendored** into your project.

```
src/lib/medical-sync-vault/
```

Dependencies:

```sh
expo install expo-secure-store expo-crypto
npm install tweetnacl tweetnacl-util
```

---

## Basic Usage

### Create a client

```ts
import { createVaultClient } from "@/src/lib/medical-sync-vault";

const client = createVaultClient({
  baseUrl: "https://your-vault-backend.example",
  appIssueToken: "APP_ISSUE_TOKEN_FROM_BACKEND",
});
```

---

### Initialize identity (required once)

```ts
await client.ensureIdentity();
```

---

## Authentication

Authentication is handled automatically.

```ts
await client.ensureToken();
```

---

## Event Sync

### Pull events

```ts
const cursor = await client.cursor.get();

const { events, next } = await client.pull({
  cursor,
  limit: 500,
});

if (next) {
  await client.cursor.set(next);
}
```

---

### Push events

```ts
await client.push(events);
```

---

## Health Check

```ts
await client.health();
```

---

## QR bundle behavior

Current behavior in the vendored implementation:

- new bundles include a `kid`
- if an old bundle does not include a `kid`, the app first tries the current key
  and then falls back to `previous_kid` announced by the Vault
- unknown `kid` is treated as an expired/rotated bundle and should be recreated

Required mobile env:

- `EXPO_PUBLIC_VAULT_BASE_URL`
- `EXPO_PUBLIC_VAULT_APP_ISSUE_TOKEN`

There is intentionally no `EXPO_PUBLIC_BUNDLE_CIPHER_KEY` anymore.

---

## License

MIT
