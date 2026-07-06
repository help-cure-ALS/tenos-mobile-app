# Privacy and Security Model

TENOS is designed around local-first handling of sensitive medical data.

## Core Principles

- Medical data is encrypted before it is synchronized.
- The Sync Vault does not receive medical plaintext.
- Device pairing is explicit and patient-controlled.
- Recipient devices use their own device identity.
- Revocation is enforced through the server-side device registry.
- Local secrets are stored with Expo SecureStore.

## Local Storage

Local patient data is stored in SQLCipher-backed SQLite.

The local database key is device-local. It is not shared through patient/caregiver/doctor pairing.

## Sync Encryption

FHIR-shaped payloads are encrypted before upload. The Sync Vault stores ciphertext events and metadata required for sync ordering and authorization.

The app keeps medical interpretation and decryption on the device.

## Health Store Import

The app can import selected metrics from Apple HealthKit (iOS) or Android Health Connect, subject to the explicit per-source permission the user grants in the operating system.

- The integration is read-only: TENOS reads approved data types and never writes back to the health store.
- Imported readings are stored as the same encrypted, FHIR-shaped local observations as manually entered data and follow the same local-first and sync rules.
- Granting or revoking access is handled by the operating system's health permission UI and can be changed by the user at any time.

## Public Client Configuration

Expo variables prefixed with `EXPO_PUBLIC_` are embedded in the app bundle. Treat them as public client configuration.

This does not mean every such value is automatically unsafe. It means backend services must validate authorization and scope server-side and must not rely on a bundled client value as the only trust boundary.

## Reporting Vulnerabilities

Do not open public issues for suspected vulnerabilities. Use the process described in [../SECURITY.md](../SECURITY.md).
