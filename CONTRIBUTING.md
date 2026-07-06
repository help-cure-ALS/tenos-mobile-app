# Contributing

Thank you for helping improve TENOS.

## Ground Rules

- Keep repository documentation and source comments in English.
- Keep user-facing app copy in the i18n locale files.
- Do not commit `.env`, private keys, provisioning profiles, generated native projects, build output, or local tool state.
- Keep patient data handling local-first and encrypted.
- Use existing app patterns before adding new abstractions.

## Checks

Before opening a pull request:

- Run the relevant app or test flow locally.
- Run `npm run test:sync` when sync behavior changes.
- Update public docs when architecture, setup, or security behavior changes.
- Add or update translations for user-facing strings.

## Security

Do not include real patient data, private keys, access tokens, App Store Connect credentials, or production service credentials in issues, pull requests, logs, screenshots, or test fixtures.
