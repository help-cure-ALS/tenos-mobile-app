# Security Policy

TENOS handles sensitive medical data. Please report suspected vulnerabilities privately.

## Reporting

Do not open public GitHub issues for vulnerabilities.

Use GitHub private vulnerability reporting if it is enabled for this repository. If it is not enabled, contact the maintainers through the project's private communication channel.

Please include:

- A concise description.
- Affected screen, component, service, or endpoint.
- Reproduction steps.
- Expected impact.
- Suggested mitigation, if known.

Do not include real patient data, private keys, access tokens, App Store Connect credentials, or production service credentials.

## Scope

In scope:

- Decryption or plaintext exposure risks.
- Sync authorization or revocation bypasses.
- Unsafe logging of sensitive data.
- Pairing and device authorization issues.
- Local secret storage issues.

Out of scope:

- Reports that require a fully compromised device and do not change app or server guarantees.
- Issues in third-party services that are not controlled by this project.
