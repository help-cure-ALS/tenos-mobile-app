# Architecture

TENOS is an offline-first Expo and React Native app for encrypted medical data capture and synchronization.

## Layers

```text
UI screens
  app/
        |
        v
React context providers
  src/context/
        |
        v
Feature hooks and repositories
  src/hooks/
  src/stores/
        |
        v
FHIR-shaped local resources
  op-sqlite + SQLCipher
        |
        v
Outbox and encrypted sync
  src/lib/medical-sync-vault/
        |
        v
TENOS Sync Vault
  ciphertext only
```

## Roles

The app supports:

- patient
- caregiver
- doctor

Caregivers and doctors can manage multiple patient scopes. The active patient and role are held in app context and drive which local stores and sync identity are used.

## Local Data

Patient data is represented as FHIR-shaped resources in local app stores. Local storage uses SQLCipher through `@op-engineering/op-sqlite`.

Security-relevant key material is stored through Expo SecureStore.

## Health Metrics

Health metrics are described by a data-driven registry under `src/metrics/`. Each metric definition declares its FHIR coding, units, validation, charting, scheduling, and localized text, and is the single source consumed by every UI surface (catalog, pinning, charts, sharing and research selectors, todo list). See [src/metrics/README.md](../src/metrics/README.md) and [src/metrics/METRICS.md](../src/metrics/METRICS.md).

A metric may also be marked as available only on specific platforms, in which case it is hidden entirely on unsupported operating systems rather than shown as an empty card.

## External Health Import

The app can import selected metrics **read-only** from the operating system's health store — Apple HealthKit on iOS and Android Health Connect on Android. Import is opt-in per metric through an `externalHealth` mapping on the metric definition, and per-source through explicit user permission grants.

- Import is one-directional: TENOS never writes data back to Apple Health or Health Connect.
- Imported readings become the same FHIR-shaped local observations as manual entries, then follow the normal encrypted-sync path.
- Aggregation policies (latest, daily latest, daily first/last, daily sum, daily average) reduce raw samples to clinically meaningful daily entries, with stable external identifiers so re-import is idempotent.
- Some health data types exist on only one platform, so the corresponding metrics import on that platform only.

The import pipeline (platform adapters, definition-to-permission registry, dedupe, and the import service) lives in `src/services/externalHealth/`.

## Sync Model

Sync uses the TENOS Sync Vault protocol:

- Ed25519 proof-of-possession for transport authorization.
- JWT transport capabilities.
- Per-device identities for recipient devices.
- Encrypted event payloads using the patient transport key.
- Append-only event push and pull.

The Vault stores ciphertext and routing metadata. Medical plaintext remains on trusted devices.

## Sharing Model

Patients can authorize doctor and caregiver devices. Recipient devices use their own Ed25519 identity and receive wrapped transport-key material through the pairing flow.

Revocation is enforced by the Vault device registry. The app reacts to revoked or deleted access by leaving the active patient context and wiping the local granted patient state.

## Remote Services

The app can integrate with:

- Sync Vault for encrypted sync.
- Verification service for doctor and patient verification flows.
- Care service for studies and clinic data.
- Supplier proxy for assistive-aid workflows.
- Research service for remote definitions and donation flows.

These service URLs are client configuration. Server-side authorization remains the responsibility of each backend.
