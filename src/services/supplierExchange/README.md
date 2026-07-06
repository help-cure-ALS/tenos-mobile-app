# Supplier Exchange Service

Integration channel for medical supply companies (e.g. medical supply stores,
assistive device providers). No dedicated app role, no key sharing — a separate
channel via a **Partner Proxy** (single global URL, per-integration bearer tokens).
The proxy does not exist yet; development uses mocks throughout.

---

## Architecture Overview

```
+-----------+          +---------------+          +-----------------+
|  HCA App  | <------> | Partner-Proxy | <------> | Supplier App    |
|           |  Bearer   | (global URL)  |          | (Supply Store)  |
+-----------+  Token    +---------------+          +-----------------+
```

Communication between App and Proxy uses a single base URL
(`EXPO_PUBLIC_SUPPLIER_PROXY_URL`).
Authentication via `Authorization: Bearer {token}` — one token per integration.

For new supplier links, the app must also provide the patient's existing
`verification_token_id`. The proxy checks that token against the external
verification-service before creating a new integration.

---

## File Overview

| File                   | Responsibility                                               |
| ---------------------- | ------------------------------------------------------------ |
| `types.ts`             | All TypeScript types (Proposal, Policy, ExchangeState, etc.) |
| `credentialStore.ts`   | SecureStore wrapper for bearer tokens (device-local)         |
| `supplierClient.ts`    | HTTP client for all proxy endpoints                          |
| `exchangeService.ts`   | Event-driven background sync (outbound push + inbound pull)   |
| `proposalMapper.ts`    | Filtering + conversion of proposals to AidItems              |
| `workflowEngine.ts`    | Policy-based status transitions + audit trail                |
| `mock.ts`              | Mock data + mock client for development                      |
| `index.ts`             | Barrel export                                                |

### External Dependencies

| Store / Module                          | What is stored there                          |
| --------------------------------------- | --------------------------------------------- |
| `patientPreferencesStore` (synced)      | Integration metadata + selection policies     |
| `supplierExchangeStore` (local)         | Cursor, lastBundleHash, declinedProposals     |
| `expo-secure-store` (device-local)      | Bearer tokens per integration                 |
| `aids/types.ts` + `aids/fhir/aidToFhir` | Extended AidItem with supplier fields         |

---

## Linking Flows

There are two ways to establish an integration:

### Flow A: Care-Backend Linking (patient-initiated)

```
Patient                          Proxy                         Supplier
  |                                |                              |
  |-- listOrganizations(country) ->|                              |
  |<-- [org-1, org-2, ...] --------|                              |
  |                                |                              |
  |  [Patient selects org]         |                              |
  |  [Patient selects data policy] |                              |
  |                                |                              |
  |-- linkCareOrg(orgId, policy, verificationTokenId) ----------->|
  |<-- { integration_id, token } --|                              |
  |                                |                              |
  |  [Token -> SecureStore]        |                              |
  |  [Metadata -> Preferences]     |                              |
  |  [Integration active]          |                              |
```

**UI Screen:** `app/(tabs)/share/supplierLink.tsx`
**Steps:** Select organization -> Consent (DataSelector) -> Confirm

Prerequisite:

- `patientPreferencesStore.verification.status === 'verified'`
- `patientPreferencesStore.verification.tokenId` vorhanden

### Flow B: Partner-App Linking (supplier-initiated)

```
Supplier                         Proxy                         Patient
  |                                |                              |
  |-- POST link_request ---------->|                              |
  |<-- { token } ------------------|                              |
  |                                |                              |
  |  [Token sent as QR code / deep link to patient]               |
  |                                |                              |
  |                                |<- getRequestDetails(token) --|
  |                                |-- { org_name, TTL, ... } --->|
  |                                |                              |
  |                                |   [Patient selects policy]   |
  |                                |                              |
  |                                |<- acceptPartnerRequest(token, policy, verificationTokenId) --|
  |                                |-- { integration_id, token }->|
  |                                |                              |
  |                                |   [Token -> SecureStore]     |
  |                                |   [Metadata -> Preferences]  |
```

**UI Screen:** `app/(tabs)/share/supplierAccept.tsx`
**Entry point:** QR code scan or deep link (`https://{domain}/link?token=...`)

Auch dieser Flow ist an einen verifizierten ALS-Status gekoppelt. Ohne
`verification.tokenId` bricht die App vor dem Proxy-Request ab und verweist auf
die Verification-Einstellungen.

---

## Data Exchange Cycle

### Automatic Background Sync

```
[sync:completed event]
        |
        v
  exchangeService.ts
  (push on sync + pull throttle, default 1 min)
        |
        v
  For each active integration:
        |
        +-- Policy exists?
        |       no  -> skip (fail-closed)
        |       yes -> continue
        |
        +-- Token exists? (SecureStore)
        |       no  -> skip
        |       yes -> continue
        |
        +-- outbound=true ?
        |       yes -> buildExportBundle(policy) -> hash compare -> pushBundle(if changed)
        |
        +-- inbound=true and pull-window open ?
                yes -> pullProposals(integrationId, cursor) -> cache + cursor advance
```

**Registration:** In `AppSyncProvider.tsx`, analogous to the `donationService`:
```typescript
useEffect(() => {
    const unsubscribe = registerSupplierExchangeService({
        patientPreferencesStore,
        supplierExchangeStore,
        patientId: activePatientId,
    });
    return unsubscribe;
}, [patientPreferencesStore, supplierExchangeStore, activePatientId]);
```

### Manual Pull (Inbox)

The inbox screen (`supplierInbox.tsx`) performs its own pull so proposals are
visible immediately when opened (independent of background pull throttling).

### Pull Interval Configuration

Background inbound pulls are throttled per patient with:

- `EXPO_PUBLIC_SUPPLIER_PULL_INTERVAL_MS` (optional, milliseconds)
- Default: `60000` (1 minute)
- Clamp: minimum `15000`, maximum `1800000`

If the variable is missing or invalid, the default is used.

---

## Proposal Lifecycle

```
[Proxy: proposal created]
        |
        v  Pull (background or inbox)
[Proposal in app]
        |
        +-- filterNewProposals() filters against:
        |     - existing AidItems (by supplierProposalId)
        |     - declinedProposals (from supplierExchangeStore)
        |
        v
[Inbox display]
        |
        +------ "Adopt" ----------->  proposalToAidInput()
        |                              -> createAidDraft()
        |                              -> AidItem { status: 'suggested' }
        |                              -> sendDecision('accepted')
        |
        +------ "Decline" --------->  supplierExchangeStore.addDeclinedProposal()
                                       -> sendDecision('declined')
```

**Important:** Proposals are NOT FHIR resources. They only exist as proxy
responses and are filtered locally. Only upon "Adopt" is an actual AidItem
created (stored as a FHIR DeviceRequest).

---

## Workflow Engine (Status Chain)

```
suggested  -->  requested  -->  approved
                           -->  rejected
```

All status names in code are English. The UI shows localized labels via i18n.

### Policy-Driven Model

The `WorkflowPolicy` comes from the proxy (country-specific) and defines:

```typescript
{
    country: 'DE',
    transitions: [
        { from: 'suggested', to: 'requested', allowed_roles: ['patient', 'caregiver', 'doctor'] },
        { from: 'requested', to: 'approved',  allowed_roles: ['patient', 'caregiver', 'doctor'] },
        { from: 'requested', to: 'rejected',  allowed_roles: ['patient', 'caregiver', 'doctor'] },
    ],
    notify_provider_on: ['approved'],
}
```

**No hardcoded role gates in app code.** The functions in `workflowEngine.ts`
check exclusively against the policy:

| Function                    | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `canTransition()`           | Is this role allowed to perform this transition?          |
| `getAvailableTransitions()` | Which target statuses are possible for role + current status? |
| `executeTransition()`       | Executes the transition and appends an audit record       |
| `shouldNotifyProvider()`    | Should the proxy be notified about this transition?       |
| `buildTransitionTicket()`   | Builds the payload for the proxy notification             |

### Audit Trail

Every transition is stored as an `AidTransitionRecord` in the AidItem:

```typescript
{
    from: 'suggested',
    to: 'requested',
    role: 'patient',
    deviceId: 'device-abc-123',
    timestamp: '2026-03-08T14:30:00Z'
}
```

The transition history is visible in the aid detail screen.

---

## Token and Credential Handling

```
+-------------------------------+-------------------------------------------+
| Storage location              | What                                      |
+-------------------------------+-------------------------------------------+
| expo-secure-store             | Bearer token (per integration, per device)|
|   Key: supplier_token_{id}    | WHEN_UNLOCKED_THIS_DEVICE_ONLY            |
|   NOT synced                  | On disconnect: deleteToken()              |
+-------------------------------+-------------------------------------------+
| PatientPreferences (synced)   | Integration metadata:                     |
|   supplierIntegrations[]      |   id, organizationName, linkedAt, active  |
|   supplierPolicies[]          | Selection policies:                       |
|                               |   metricIds, categories, directions       |
+-------------------------------+-------------------------------------------+
| supplierExchangeStore (local) | Exchange state:                           |
|   AsyncStorage                |   cursor, lastBundleHash, lastRunAt       |
|   NOT synced                  | Declined proposals: proposal_id[]         |
+-------------------------------+-------------------------------------------+
```

**Security principle:** Sensitive data (tokens) never leave SecureStore and
are never synced. Only metadata (name, timestamp, active/inactive) goes into
the synced preferences.

---

## Mock Strategy

Since the proxy does not exist yet, `supplierClient.ts` automatically
switches to mocks:

```typescript
const USE_MOCKS = __DEV__ || !PROXY_URL;
```

The mocks in `mock.ts` provide:
- **3 organizations** (Sanitaetshaus Mueller, RehaTeam Nord, MedTech Sued)
- **3 proposals** (electric wheelchair, communication aid, shower wheelchair)
- **1 workflow policy** (DE, all roles have equal rights)
- **Simulated latency** (500ms per call)

For production: set `EXPO_PUBLIC_SUPPLIER_PROXY_URL` and mocks are
automatically disabled.

---

## Roles and Permissions

| Role       | Linking | Manage | Inbox | Transitions | Implementation     |
| ---------- | ------- | ------ | ----- | ----------- | ------------------ |
| Patient    | Yes     | Yes    | Yes   | Per policy  | Policy-driven      |
| Caregiver  | Yes     | Yes    | Yes   | Per policy  | Policy-driven      |
| Doctor     | Yes     | Yes    | Yes   | Per policy  | Policy-driven      |
| Demo       | No      | No     | No    | No          | Hardcoded alert    |

Demo is the only hardcoded guard. All other permissions are fully defined
by the `WorkflowPolicy`.

---

## UI Screens

| Screen                 | Path                                     | Purpose                        |
| ---------------------- | ---------------------------------------- | ------------------------------ |
| Share Tab Section      | `app/(tabs)/share/index.tsx`             | Integration list + "New" link  |
| Supplier Link          | `app/(tabs)/share/supplierLink.tsx`      | Care-backend linking flow      |
| Supplier Accept        | `app/(tabs)/share/supplierAccept.tsx`    | Partner-app token acceptance   |
| Supplier Manage        | `app/(tabs)/share/supplierManage.tsx`    | Integration management         |
| Supplier Inbox         | `app/(tabs)/share/supplierInbox.tsx`     | Proposal inbox                 |
| Aid Detail (extended)  | `app/(tabs)/(metric)/aids/[aidId].tsx`   | Supplier info + history        |

---

## Proxy API Reference

All endpoints under `EXPO_PUBLIC_SUPPLIER_PROXY_URL`:

| Method | Path                                           | Auth       | Purpose                       |
| ------ | ---------------------------------------------- | ---------- | ----------------------------- |
| GET    | `/v1/organizations?country={cc}`               | `X-App-Token` (optional) | List linkable organizations   |
| GET    | `/v1/provider-links/requests/{token}`          | `X-App-Token` (optional) | Link request details + TTL    |
| POST   | `/v1/provider-links/care-org`                  | `X-App-Token` (optional) | Care-backend linking          |
| POST   | `/v1/provider-links/partner-app/accept`        | `X-App-Token` (optional) | Accept partner request        |
| POST   | `/v1/provider-exchange/{id}/push`              | Bearer     | Push FHIR bundle              |
| GET    | `/v1/provider-exchange/{id}/pull`              | Bearer     | Pull proposals                |
| POST   | `/v1/provider-exchange/{id}/proposals/{pid}/decision` | Bearer | Send accept/decline     |
| POST   | `/v1/provider-exchange/{id}/transitions`       | Bearer     | Report status transition      |
| GET    | `/v1/workflow-policy?country={cc}`             | None       | Country-specific policy       |

---

## FHIR Integration

Supplier AidItems are stored as standard FHIR DeviceRequest resources.
The supplier-specific fields (`source`, `supplierIntegrationId`,
`supplierProposalId`, `supplierReason`, `transitions`) are stored inside
the existing `urn:medical-sync-vault:aid-meta` JSON payload.

**Backward-compatible:** Older clients ignore the unknown fields.
`fhirToAid()` sets missing supplier fields to `undefined`.
