# Development

## Requirements

- Node.js compatible with the Expo SDK used by this project.
- npm.
- Xcode for iOS development.
- Android Studio for Android development.
- Expo CLI / EAS CLI as needed for local and cloud builds.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

The example environment uses placeholder service URLs. Point `.env` to your own
vault, care, supplier, and research deployments before running against real
infrastructure.

Run a platform build locally:

```bash
npm run ios
npm run android
```

## Tests

The repository currently includes sync-focused tests:

```bash
npm run test:sync
```

## Dependency Access

`react-native-nice-ui` is installed from GitHub:

```text
git+https://github.com/help-cure-ALS/react-native-nice-ui.git#v1.3.3
```

The tag `v1.3.3` is reachable over HTTPS and resolves to the same commit used by the lockfile at the time this documentation was written.

Avoid SSH-only Git dependencies in public repository configuration.

## Native Projects

The generated native `ios/` and `android/` folders are ignored by Git. Use Expo prebuild / run commands to regenerate local native projects when needed.

## Expo, EAS, and App Store Configuration

The public `app.json` intentionally keeps account-specific build metadata out of
the static Expo config. The dynamic `app.config.js` provides official TENOS
defaults for the EAS owner, EAS project ID, Expo Updates URL, iOS bundle ID, and
Android package so official builds work without extra local setup.

Forks can override these values from environment variables:

```bash
TENOS_EXPO_OWNER=
TENOS_EAS_PROJECT_ID=
TENOS_UPDATES_URL=
TENOS_APPLE_TEAM_ID=
TENOS_IOS_BUNDLE_IDENTIFIER=app.tenos.als
TENOS_ANDROID_PACKAGE=app.tenos.als
```

If `TENOS_UPDATES_URL` is empty, the config uses the standard Expo Updates URL
for the active EAS project ID. Forks should set their own `TENOS_EXPO_OWNER` and
`TENOS_EAS_PROJECT_ID`, or edit `app.config.js`, before publishing builds.

Fastlane reads App Store account details from environment variables:

```bash
APP_IDENTIFIER=app.tenos.als
FASTLANE_APPLE_ID=
FASTLANE_TEAM_ID=
ASC_KEY_ID=
ASC_ISSUER_ID=
ASC_KEY_PATH=./fastlane/AuthKey.p8
```

For local metadata work, copy `fastlane/.env.example` to `fastlane/.env`.
The App Store Connect private key file is ignored by Git and must be provided
locally or by CI.

## Documentation Language

Repository documentation and source comments should be English. User-facing app copy is managed through the i18n locale files and can be multilingual.
