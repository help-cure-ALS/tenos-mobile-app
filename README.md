# TENOS Mobile App

TENOS is a privacy-first mobile health companion for people living with ALS and other neurodegenerative diseases.

The app helps patients, caregivers, and doctors record health data, manage medication, complete clinical questionnaires, and synchronize encrypted data across devices.

TENOS is built by [help cure ALS e.V.](https://help-cure-als.org/) as part of the [TENOS](https://tenos.app/) project.

## Features

- Health metrics and questionnaires for ALS-focused care.
- Read-only health import from Apple Health (HealthKit) and Android Health Connect.
- Medication tracking with local reminders.
- Multi-role flows for patients, caregivers, and doctors.
- Multi-patient support for caregiver and doctor roles.
- End-to-end encrypted sync through the TENOS Sync Vault.
- Patient-controlled sharing and device revocation.
- Offline-first local storage.
- Research donation and study discovery integrations.
- Internationalized app UI.

## Architecture

The app uses Expo Router, React Native, encrypted local SQLite storage, SecureStore-backed key material, FHIR-shaped local resources, and a custom zero-knowledge sync protocol. Health metrics are defined by a data-driven metric registry; many metrics can also be imported read-only from the device health store (Apple HealthKit / Android Health Connect) with no write-back.

See [docs/architecture.md](./docs/architecture.md) for the public architecture overview, [src/metrics/README.md](./src/metrics/README.md) for the metric system, and [docs/privacy-and-security.md](./docs/privacy-and-security.md) for the security model.

## Tech Stack

- Expo 56
- React Native 0.85
- React 19
- TypeScript 6
- Expo Router
- `@op-engineering/op-sqlite` with SQLCipher
- Expo SecureStore
- TweetNaCl
- Medplum FHIR types and client libraries
- `@kingstinct/react-native-healthkit` (Apple Health import)
- `react-native-health-connect` / `expo-health-connect` (Android Health Connect import)
- i18next
- react-native-nice-ui

## Repository Structure

```text
app/                 Expo Router screens
assets/              App icons, splash images, animations, SVG assets
docs/                Public project documentation
fastlane/            App Store metadata tooling
src/                 Application source
tests/               Sync and behavior tests
```

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Start Expo:

```bash
npm start
```

Run on iOS:

```bash
npm run ios
```

Run on Android:

```bash
npm run android
```

## Environment

The app reads runtime configuration from Expo public environment variables. Values prefixed with `EXPO_PUBLIC_` are embedded in the client bundle and must be treated as public client configuration.

See [.env.example](./.env.example). The example file intentionally uses placeholder service URLs so forks do not accidentally connect to TENOS production infrastructure.

Important groups:

- Sync Vault: `EXPO_PUBLIC_VAULT_BASE_URL`, `EXPO_PUBLIC_VAULT_APP_ISSUE_TOKEN`
- Sync repair/debug toggles
- Verification service
- Care data service
- Supplier proxy
- Research donation and definition services

Server-side services must not rely on mobile app configuration values as the only security boundary.

Official EAS, Expo Updates, Apple team, and Fastlane account settings are injected from environment variables. See [docs/development.md](./docs/development.md#expo-eas-and-app-store-configuration).

## Development

See [docs/development.md](./docs/development.md).

## Deployment

See [docs/deployment.md](./docs/deployment.md) for the full release checklist
(version bump, EAS build, metadata upload, App Store / Play Store submission).

## App Store Metadata

Fastlane metadata is kept in `fastlane/metadata/`.

Local App Store Connect credentials are intentionally ignored:

- `fastlane/.env`
- `fastlane/AuthKey.p8`

Use:

```bash
bundle exec fastlane ios metadata
```

## Security

Please do not report security issues in public GitHub issues. See [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) (c) [help cure ALS e.V.](https://help-cure-als.org/)
