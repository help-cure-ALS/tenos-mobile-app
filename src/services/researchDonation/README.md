# Research Donation

The mobile app can donate selected, anonymized health data to a research proxy after a patient explicitly enables research sharing for individual metrics.

## When Donation Runs

Donation is event-driven. After a successful sync cycle, the app emits `sync:completed`; the donation service reacts to that event.

Runtime guards:

- The active patient must be verified.
- At least one metric must be shared with `research` in patient preferences.
- Donation is throttled to one attempt per six hours.
- A mutex prevents overlapping donation runs.

## Flow

1. Check verification status, research sharing preferences, throttle state, and mutex.
2. Load or derive the anonymous research ID from the active patient subject.
3. Collect new local FHIR resources from `patientFhirStore`.
4. Keep only resources for metrics/questionnaires shared with research.
5. Anonymize resources in `anonymize.ts`.
6. Build an idempotent FHIR transaction bundle.
7. POST the bundle to the research proxy with app-device authentication.
8. On success, update high-water marks. On failure, keep marks unchanged so the next run can retry.

## Anonymization

| Field | Action |
| --- | --- |
| `id` | Replaced with a deterministic hash |
| `subject.reference` | Replaced with the anonymous research patient ID |
| Clinical values | Preserved |
| Dates | Preserved where needed for longitudinal analysis |
| Vault extensions | Removed |
| Device details | Removed |
| Internal vault metadata | Removed |
| `meta.tag` | Adds research and domain tags |
| `identifier` | Adds deterministic research identifier |

## High-Water Marks

High-water marks track the newest donated timestamp per bucket, for example per LOINC code or Questionnaire URL.

They are stored locally and synced between the patient's devices as a FHIR `Basic` resource. The merge strategy keeps the latest timestamp per bucket.

## Idempotency

Each donated resource receives a deterministic identifier:

- Observations: hash of anonymous patient ID, LOINC code, and effective date/time.
- QuestionnaireResponses: hash of anonymous patient ID, Questionnaire URL, and authored timestamp.

The server receives conditional creates, so resubmitting the same clinical data is expected to be harmless.

## Files

| File | Purpose |
| --- | --- |
| `donationService.ts` | Orchestration, throttling, event listener |
| `anonymize.ts` | FHIR anonymization |
| `anonymousId.ts` | Deterministic anonymous research ID |
| `proxyClient.ts` | HTTP client for the research proxy |
| `bundle.ts` | FHIR transaction bundle creation |

## Configuration

Configure the research proxy URL in the app environment:

```bash
EXPO_PUBLIC_RESEARCH_PROXY_URL=https://research.example.org/donate
```
