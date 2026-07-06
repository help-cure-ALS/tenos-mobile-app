/**
 * Research Donation Service — Orchestrates the donation cycle.
 *
 * Flow:
 * 1. Check verification status (must be 'verified')
 * 2. Build fail-closed export selection from research sharing preferences
 * 3. Derive anonymous research ID
 * 4. Collect selected resources via canonical export builder
 * 5. Filter by high-water marks
 * 6. Anonymize resources
 * 7. Build FHIR transaction bundle
 * 8. Send to research proxy
 * 9. Update high-water marks
 *
 * Triggered by 'sync:completed' event, throttled to every 6 hours.
 */
import { deriveAnonymousResearchId } from './anonymousId';
import { anonymizeObservation, anonymizeQuestionnaireResponse } from './anonymize';
import { buildTransactionBundle } from './bundle';
import { sendToProxy } from './proxyClient';
import { buildResearchSelection } from './selection';
import { buildExportBundle } from '@/src/lib/fhir-export/buildExportBundle';
import { getAllMetricDefinitions } from '@/src/metrics/definitions';
import { getAllQuestionnaireDefinitions } from '@/src/questionnaires/definitions';
import type { PatientFhirStore } from '@/src/stores/patientFhirStore';
import type { DonationTrackingStore } from '@/src/stores/donationTrackingStore';
import type { PatientPreferencesStore } from '@/src/stores/patientPreferencesStore';
import { emit, on } from '@/src/lib/bus';
import { includesTokenRevoked } from '@/src/lib/medical-sync-vault/util';

const MIN_DONATION_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_BATCH_SIZE = 200; // Max resources per donation batch

let lastDonationAttempt = 0;
let donationInProgress = false;

export type DonationDeps = {
    patientFhirStore: PatientFhirStore;
    donationTrackingStore: DonationTrackingStore;
    patientPreferencesStore: PatientPreferencesStore;
    getSubjectId: () => Promise<string | null>;
};

function getErrorText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

async function markVerificationRevoked(patientPreferencesStore: PatientPreferencesStore): Promise<void> {
    const prefs = await patientPreferencesStore.getAll();
    const verification = prefs.verification;
    if (verification?.status !== 'verified') {
        return;
    }

    await patientPreferencesStore.setVerification({
        ...verification,
        status: 'revoked',
    });
    emit('verification:changed');
}

/**
 * Execute a donation cycle.
 * Collects, anonymizes, and sends research-shared data to the proxy.
 */
export async function executeDonationCycle(deps: DonationDeps): Promise<void> {
    const {
        patientFhirStore,
        donationTrackingStore,
        patientPreferencesStore,
        getSubjectId,
    } = deps;

    if (donationInProgress) return;
    donationInProgress = true;

    try {
        // 1. Check verification status
        const prefs = await patientPreferencesStore.getAll();
        if (prefs.verification?.status !== 'verified') {
            return;
        }
        const verificationTokenId = prefs.verification.tokenId;
        if (!verificationTokenId) {
            console.warn('Research donation skipped: missing verification token');
            return;
        }

        // 2. Get subject ID
        const subjectId = await getSubjectId();
        if (!subjectId) return;

        // 3. Build fail-closed export selection from sharing preferences
        const selection = buildResearchSelection(prefs);
        if (!selection) return;

        // 4. Derive anonymous research ID (deterministic, stable across devices)
        const trackingState = await donationTrackingStore.getState();
        let anonymousResearchId = trackingState.anonymousResearchId;
        if (!anonymousResearchId) {
            anonymousResearchId = await deriveAnonymousResearchId(subjectId);
            await donationTrackingStore.setAnonymousResearchId(anonymousResearchId);
        }

        // 5. Collect selected resources via canonical export selection
        const metricDefinitions = getAllMetricDefinitions();
        const questionnaireDefinitions = getAllQuestionnaireDefinitions();
        const selectedBundle = await buildExportBundle(
            patientFhirStore,
            subjectId,
            selection,
            metricDefinitions,
            questionnaireDefinitions,
        );

        const toDonate: any[] = [];
        const newHighWaterMarks: Record<string, string> = {};

        for (const entry of selectedBundle.entry ?? []) {
            if (toDonate.length >= MAX_BATCH_SIZE) {
                break;
            }
            const resource = entry?.resource;
            if (!resource || typeof resource !== 'object') continue;

            if (resource.resourceType === 'Observation') {
                const obs = resource;
                const loincCode = obs.code?.coding?.[0]?.code;
                const effectiveDateTime = obs.effectiveDateTime;
                if (!loincCode || !effectiveDateTime) continue;

                const bucket = `Observation:${loincCode}`;
                const hwm = trackingState.highWaterMarks[bucket];
                if (hwm && effectiveDateTime <= hwm) continue;

                const anonymized = await anonymizeObservation(obs, anonymousResearchId);
                toDonate.push(anonymized);

                if (!newHighWaterMarks[bucket] || effectiveDateTime > newHighWaterMarks[bucket]) {
                    newHighWaterMarks[bucket] = effectiveDateTime;
                }
                continue;
            }

            if (resource.resourceType === 'QuestionnaireResponse') {
                const qr = resource;
                const authored = qr.authored;
                if (!authored) continue;

                const questionnaireUrl = qr.questionnaire ?? 'unknown';
                const bucket = `QR:${questionnaireUrl}`;
                const hwm = trackingState.highWaterMarks[bucket];
                if (hwm && authored <= hwm) continue;

                const anonymized = await anonymizeQuestionnaireResponse(qr, anonymousResearchId);
                toDonate.push(anonymized);

                if (!newHighWaterMarks[bucket] || authored > newHighWaterMarks[bucket]) {
                    newHighWaterMarks[bucket] = authored;
                }
            }
        }

        // 6. Nothing to donate
        if (toDonate.length === 0) return;

        // Throttle network send attempts (but do not block readiness checks above)
        const now = Date.now();
        if (now - lastDonationAttempt < MIN_DONATION_INTERVAL_MS) return;
        lastDonationAttempt = now;

        // 7. Build FHIR transaction bundle
        const bundle = buildTransactionBundle(toDonate);

        // 8. Send to research proxy
        const result = await sendToProxy(anonymousResearchId, bundle, verificationTokenId);

        // 9. Update high-water marks on success
        if (result.ok) {
            await donationTrackingStore.setHighWaterMarks(newHighWaterMarks);
            await donationTrackingStore.recordDonation(result.accepted);
            console.log(`Research donation: ${result.accepted} resources donated successfully`);
        }
    } catch (err) {
        if (includesTokenRevoked(getErrorText(err))) {
            await markVerificationRevoked(patientPreferencesStore);
            return;
        }

        console.warn('Research donation cycle failed:', err);
    } finally {
        donationInProgress = false;
    }
}

/**
 * Register the donation service to listen for sync:completed events.
 * Returns an unsubscribe function.
 */
export function registerDonationService(deps: DonationDeps): () => void {
    return on('sync:completed', () => {
        executeDonationCycle(deps).catch((err) => {
            console.warn('Donation cycle error:', err);
        });
    });
}
