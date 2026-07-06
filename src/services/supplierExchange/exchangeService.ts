// Exchange service - orchestrates outbound push + inbound pull with supplier proxy.
// Triggered by sync:completed. Pull is throttled, push is hash-deduped.

import * as Crypto from 'expo-crypto';
import { on } from '@/src/lib/bus';
import { buildExportBundle } from '@/src/lib/fhir-export/buildExportBundle';
import type { ExportSelection, FhirBundle } from '@/src/lib/fhir-export/types';
import { getAllMetricDefinitions } from '@/src/metrics/definitions/index';
import { getAllQuestionnaireDefinitions } from '@/src/questionnaires/definitions/index';
import type { MetricDefinition } from '@/src/metrics/types';
import type { QuestionnaireDefinition } from '@/src/questionnaires/types';
import { getPatientFhirStore } from '@/src/stores/patientFhirStore';
import type { SupplierExchangeStore } from '@/src/stores/supplierExchangeStore';
import type {
    PatientPreferencesStore,
    SupplierIntegrationMeta,
    SupplierSelectionPolicy,
} from '@/src/stores/patientPreferencesStore';
import { supplierClient } from './supplierClient';
import { deleteToken, getToken } from './credentialStore';

const PROXY_URL = process.env.EXPO_PUBLIC_SUPPLIER_PROXY_URL?.trim();
const REAL_PROXY_MODE = !!PROXY_URL;
const DEFAULT_PULL_INTERVAL_MS = 60 * 1000; // 1 minute
const MIN_PULL_INTERVAL_MS = 15 * 1000; // 15 seconds guardrail
const MAX_PULL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes safety cap

function resolvePullIntervalMs(): number {
    const raw = process.env.EXPO_PUBLIC_SUPPLIER_PULL_INTERVAL_MS?.trim();
    if (!raw) return DEFAULT_PULL_INTERVAL_MS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_PULL_INTERVAL_MS;
    const rounded = Math.floor(parsed);
    return Math.max(MIN_PULL_INTERVAL_MS, Math.min(MAX_PULL_INTERVAL_MS, rounded));
}

const PULL_INTERVAL_MS = resolvePullIntervalMs();

// Per-patient state
const lastPullAttemptPerPatient = new Map<string, number>();
const inProgressPerPatient = new Set<string>();
const missingPolicyWarned = new Set<string>();

const patientFhirStore = getPatientFhirStore();

export type ExchangeDeps = {
    patientPreferencesStore: PatientPreferencesStore;
    supplierExchangeStore: SupplierExchangeStore;
    patientId: string;
};

function nowIso(): string {
    return new Date().toISOString();
}

function looksLikeMockIntegrationId(integrationId: string): boolean {
    return integrationId.startsWith('int-');
}

function looksLikeMockToken(token: string): boolean {
    return token.startsWith('mock-token-');
}

async function removeLegacyMockIntegration(
    deps: ExchangeDeps,
    integration: SupplierIntegrationMeta,
    reason: string,
): Promise<void> {
    await deleteToken(integration.id).catch(() => {});
    await deps.supplierExchangeStore.removeIntegrationData(integration.id).catch(() => {});
    await deps.patientPreferencesStore.removeSupplierIntegration(integration.id).catch(() => {});
    missingPolicyWarned.delete(integration.id);
    console.warn(`Supplier exchange removed legacy mock integration ${integration.id}: ${reason}`);
}

function toExportSelection(policy: SupplierSelectionPolicy): ExportSelection {
    const categories = policy.categories ?? {};
    return {
        metricIds: policy.metricIds ?? [],
        categories: {
            medications: categories.medications === true,
            aids: categories.aids === true,
            questionnaires: categories.questionnaires === true,
        },
    };
}

function resourceKey(resource: any): string {
    const type = typeof resource?.resourceType === 'string' ? resource.resourceType : '';
    const id = typeof resource?.id === 'string' ? resource.id : '';
    return `${type}/${id}`;
}

async function computeBundleHash(bundle: FhirBundle): Promise<string> {
    const orderedResources = (bundle.entry ?? [])
        .map((entry) => entry.resource)
        .filter((resource) => resource && typeof resource === 'object')
        .sort((a, b) => resourceKey(a).localeCompare(resourceKey(b)));
    const payload = JSON.stringify(orderedResources);
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
}

async function pushOutboundIfNeeded(
    integration: SupplierIntegrationMeta,
    policy: SupplierSelectionPolicy,
    store: SupplierExchangeStore,
    patientId: string,
    metricDefinitions: MetricDefinition[],
    questionnaireDefinitions: QuestionnaireDefinition[],
): Promise<void> {
    if (!policy.directions?.outbound) return;

    const state = await store.getExchangeState(integration.id);
    const selection = toExportSelection(policy);

    const bundle = await buildExportBundle(
        patientFhirStore,
        patientId,
        selection,
        metricDefinitions,
        questionnaireDefinitions,
    );

    const bundleHash = await computeBundleHash(bundle);
    if (bundleHash === state?.lastBundleHash) {
        return;
    }

    await supplierClient.pushBundle(integration.id, bundle);
    await store.setExchangeState({
        integrationId: integration.id,
        cursor: state?.cursor,
        lastBundleHash: bundleHash,
        lastRunAt: nowIso(),
    });
}

async function pullInboundIfEnabled(
    integration: SupplierIntegrationMeta,
    policy: SupplierSelectionPolicy,
    store: SupplierExchangeStore,
): Promise<void> {
    if (!policy.directions?.inbound) return;

    const state = await store.getExchangeState(integration.id);
    const result = await supplierClient.pullProposals(integration.id, state?.cursor);

    // Persist proposals before advancing cursor so none are lost on app crash.
    if (result.proposals.length > 0) {
        await store.cacheProposals(integration.id, result.proposals);
    }

    await store.setExchangeState({
        integrationId: integration.id,
        cursor: result.cursor ?? state?.cursor,
        lastBundleHash: state?.lastBundleHash,
        lastRunAt: nowIso(),
    });
}

async function executeExchangeCycle(deps: ExchangeDeps): Promise<void> {
    const { patientId } = deps;
    if (inProgressPerPatient.has(patientId)) return;

    inProgressPerPatient.add(patientId);
    try {
        const prefs = await deps.patientPreferencesStore.getAll();
        const integrations = prefs.supplierIntegrations ?? [];
        const policyMap = new Map(
            (prefs.supplierPolicies ?? []).map((policy) => [policy.integrationId, policy]),
        );
        const metricDefinitions = getAllMetricDefinitions();
        const questionnaireDefinitions = getAllQuestionnaireDefinitions();

        const now = Date.now();
        const lastPull = lastPullAttemptPerPatient.get(patientId) ?? 0;
        const shouldPullNow = now - lastPull >= PULL_INTERVAL_MS;
        let pullAttempted = false;

        for (const integration of integrations) {
            if (!integration.active) continue;
            const token = await getToken(integration.id);
            if (!token) continue;

            if (
                REAL_PROXY_MODE
                && (looksLikeMockIntegrationId(integration.id) || looksLikeMockToken(token))
            ) {
                await removeLegacyMockIntegration(deps, integration, 'mock_id_or_token_in_real_mode');
                continue;
            }

            const policy = policyMap.get(integration.id);
            if (!policy) {
                if (!missingPolicyWarned.has(integration.id)) {
                    missingPolicyWarned.add(integration.id);
                    console.warn(`Supplier exchange skipped for ${integration.id}: missing policy`);
                }
                continue;
            }

            try {
                await pushOutboundIfNeeded(
                    integration,
                    policy,
                    deps.supplierExchangeStore,
                    patientId,
                    metricDefinitions,
                    questionnaireDefinitions,
                );

                if (shouldPullNow) {
                    await pullInboundIfEnabled(integration, policy, deps.supplierExchangeStore);
                    if (policy.directions?.inbound) {
                        pullAttempted = true;
                    }
                }
            } catch (err: any) {
                const msg = String(err?.message ?? err ?? '');
                if (REAL_PROXY_MODE && msg.includes('Supplier proxy 401') && msg.includes('"invalid_token"')) {
                    // Keep integration metadata, but stop noisy retries until user relinks/rotates credentials.
                    await deleteToken(integration.id).catch(() => {});
                    await deps.supplierExchangeStore.removeExchangeState(integration.id).catch(() => {});
                    console.warn(
                        `Supplier exchange paused for ${integration.id}: invalid token (token removed, relink required)`,
                    );
                    continue;
                }
                console.warn(`Supplier exchange failed for ${integration.id}:`, err);
            }
        }

        if (pullAttempted) {
            lastPullAttemptPerPatient.set(patientId, now);
        }
    } catch (err) {
        console.warn('Supplier exchange cycle failed:', err);
    } finally {
        inProgressPerPatient.delete(patientId);
    }
}

// Register the exchange service to listen for sync:completed events.
export function registerSupplierExchangeService(deps: ExchangeDeps): () => void {
    return on('sync:completed', () => {
        executeExchangeCycle(deps).catch((err) => {
            console.warn('Supplier exchange cycle error:', err);
        });
    });
}
