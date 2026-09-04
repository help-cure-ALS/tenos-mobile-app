/**
 * Research Donation Service — Orchestrates the donation cycle.
 *
 * Flow per cycle:
 * 1. Check verification status (must be 'verified')
 * 2. Build the default batch from research sharing preferences
 *    (goes to the open default project, resolved client- or server-side)
 * 3. Build one batch per ACTIVE closed-project participation, restricted
 *    to the confirmed instrument selection (or all data for collectAll),
 *    with project-scoped resource ids and high-water marks. Without
 *    shareHistory consent only data from the consent date onward is sent.
 * 4. A revoked grant (403 grant_revoked) marks the participation as
 *    revoked and stops future project batches.
 *
 * Triggered by 'sync:completed' event, throttled to every 6 hours.
 */
import { deriveAnonymousResearchId } from './anonymousId';
import { anonymizeObservation, anonymizeQuestionnaireResponse } from './anonymize';
import { buildTransactionBundle } from './bundle';
import { fetchResearchProjects, sendToProxy } from './proxyClient';
import { buildResearchSelection } from './selection';
import { buildExportBundle } from '@/src/lib/fhir-export/buildExportBundle';
import type { ExportSelection } from '@/src/lib/fhir-export/types';
import { getAllMetricDefinitions } from '@/src/metrics/definitions';
import { getAllQuestionnaireDefinitions } from '@/src/questionnaires/definitions';
import type { PatientFhirStore } from '@/src/stores/patientFhirStore';
import type { DonationTrackingStore } from '@/src/stores/donationTrackingStore';
import type { PatientPreferencesStore, ResearchProjectParticipation } from '@/src/stores/patientPreferencesStore';
import { getActiveParticipations } from '@/src/lib/researchProjectTodos';
import { emit, on } from '@/src/lib/bus';
import { includesTokenRevoked } from '@/src/lib/medical-sync-vault/util';

const MIN_DONATION_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_BATCH_SIZE = 200; // Max resources per donation batch
const DEFAULT_PROJECT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let lastDonationAttempt = 0;
let donationInProgress = false;
let cachedDefaultProjectId: string | null = null;
let cachedDefaultProjectAt = 0;

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
 * Resolve the open default project of the domain (cached for 24h).
 * Returns undefined on any failure — the proxy then resolves the default
 * project server-side, so donations are never blocked by this lookup.
 */
async function resolveDefaultProjectId(clinicId?: string): Promise<string | undefined> {
    const now = Date.now();
    if (cachedDefaultProjectId && now - cachedDefaultProjectAt < DEFAULT_PROJECT_CACHE_TTL_MS) {
        return cachedDefaultProjectId;
    }

    try {
        const projects = await fetchResearchProjects(clinicId);
        const openProject = projects.find((project) => project.participation_mode === 'open');
        if (openProject) {
            cachedDefaultProjectId = openProject.id;
            cachedDefaultProjectAt = now;
            return openProject.id;
        }
    } catch (err) {
        console.warn('Default research project lookup failed (server will resolve):', err);
    }

    return undefined;
}

/**
 * Export selection for a closed-project participation: the confirmed
 * instrument choice, or the full standard set for collectAll.
 * Returns null when nothing is enabled.
 */
function buildParticipationSelection(
    participation: ResearchProjectParticipation,
): { selection: ExportSelection; allowedQuestionnaireIds: Set<string> | null } | null {
    if (participation.collectAll) {
        return {
            selection: {
                metricIds: getAllMetricDefinitions().map((def) => def.id),
                categories: { medications: false, aids: false, questionnaires: true },
            },
            allowedQuestionnaireIds: null, // all
        };
    }

    const instruments = Object.values(participation.instruments ?? {}).filter((i) => i.enabled);
    const metricIds = instruments.filter((i) => i.type === 'metric').map((i) => i.instrumentId);
    const questionnaireIds = instruments.filter((i) => i.type === 'questionnaire').map((i) => i.instrumentId);

    if (metricIds.length === 0 && questionnaireIds.length === 0) return null;

    return {
        selection: {
            metricIds,
            categories: { medications: false, aids: false, questionnaires: questionnaireIds.length > 0 },
        },
        allowedQuestionnaireIds: questionnaireIds.length > 0 ? new Set(questionnaireIds) : new Set<string>(),
    };
}

function questionnaireAllowed(questionnaireRef: string, allowed: Set<string> | null): boolean {
    if (allowed === null) return true;
    for (const id of allowed) {
        if (questionnaireRef === id || questionnaireRef.endsWith(`/${id}`)) return true;
    }
    return false;
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

        // 2. Determine what to send: general research sharing and/or projects
        const defaultSelection = buildResearchSelection(prefs);
        const participations = getActiveParticipations(prefs.researchProjects);
        if (!defaultSelection && participations.length === 0) return;

        // 3. Get subject ID + anonymous research id
        const subjectId = await getSubjectId();
        if (!subjectId) return;

        const trackingState = await donationTrackingStore.getState();
        let anonymousResearchId = trackingState.anonymousResearchId;
        if (!anonymousResearchId) {
            anonymousResearchId = await deriveAnonymousResearchId(subjectId);
            await donationTrackingStore.setAnonymousResearchId(anonymousResearchId);
        }

        const metricDefinitions = getAllMetricDefinitions();
        const questionnaireDefinitions = getAllQuestionnaireDefinitions();

        // Throttle network send attempts (but do not block readiness checks above)
        const now = Date.now();
        if (now - lastDonationAttempt < MIN_DONATION_INTERVAL_MS) return;
        lastDonationAttempt = now;

        /**
         * Build, anonymize and send one batch. Returns the number of
         * accepted resources (0 = nothing new to donate).
         */
        const donateBatch = async (options: {
            selection: ExportSelection;
            researchProjectId?: string;
            hwmPrefix: string;
            idScope: string;
            minDate: Date | null;
            allowedQuestionnaireIds: Set<string> | null;
            /** Partner account ref (partner_account forwarding projects) */
            partnerAccountRef?: string;
        }): Promise<number> => {
            const { selection, researchProjectId, hwmPrefix, idScope, minDate, allowedQuestionnaireIds, partnerAccountRef } = options;

            const selectedBundle = await buildExportBundle(
                patientFhirStore,
                subjectId,
                selection,
                metricDefinitions,
                questionnaireDefinitions,
            );

            const state = await donationTrackingStore.getState();
            const toDonate: any[] = [];
            const newHighWaterMarks: Record<string, string> = {};

            for (const entry of selectedBundle.entry ?? []) {
                if (toDonate.length >= MAX_BATCH_SIZE) break;
                const resource = entry?.resource;
                if (!resource || typeof resource !== 'object') continue;

                if (resource.resourceType === 'Observation') {
                    const obs = resource;
                    const loincCode = obs.code?.coding?.[0]?.code;
                    const effectiveDateTime = obs.effectiveDateTime;
                    if (!loincCode || !effectiveDateTime) continue;
                    if (minDate && new Date(effectiveDateTime).getTime() < minDate.getTime()) continue;

                    const bucket = `${hwmPrefix}Observation:${loincCode}`;
                    const hwm = state.highWaterMarks[bucket];
                    if (hwm && effectiveDateTime <= hwm) continue;

                    const anonymized = await anonymizeObservation(obs, anonymousResearchId, idScope);
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
                    if (minDate && new Date(authored).getTime() < minDate.getTime()) continue;

                    const questionnaireUrl = qr.questionnaire ?? 'unknown';
                    if (!questionnaireAllowed(String(questionnaireUrl), allowedQuestionnaireIds)) continue;

                    const bucket = `${hwmPrefix}QR:${questionnaireUrl}`;
                    const hwm = state.highWaterMarks[bucket];
                    if (hwm && authored <= hwm) continue;

                    const anonymized = await anonymizeQuestionnaireResponse(qr, anonymousResearchId, idScope);
                    toDonate.push(anonymized);

                    if (!newHighWaterMarks[bucket] || authored > newHighWaterMarks[bucket]) {
                        newHighWaterMarks[bucket] = authored;
                    }
                }
            }

            if (toDonate.length === 0) return 0;

            const bundle = buildTransactionBundle(toDonate);
            const result = await sendToProxy(anonymousResearchId, bundle, verificationTokenId, researchProjectId, partnerAccountRef);

            if (result.ok) {
                await donationTrackingStore.setHighWaterMarks(newHighWaterMarks);
                await donationTrackingStore.recordDonation(result.accepted);
            }
            return result.accepted;
        };

        // 4. Default batch (general research sharing → open default project)
        if (defaultSelection) {
            const defaultProjectId = await resolveDefaultProjectId(prefs.verification.clinicId);
            const accepted = await donateBatch({
                selection: defaultSelection,
                researchProjectId: defaultProjectId,
                hwmPrefix: '',
                idScope: '',
                minDate: null,
                allowedQuestionnaireIds: null,
            });
            if (accepted > 0) {
                console.log(`Research donation: ${accepted} resources donated successfully`);
            }
        }

        // 5. One batch per active closed-project participation
        for (const participation of participations) {
            const participationSelection = buildParticipationSelection(participation);
            if (!participationSelection) continue;

            // Without shareHistory consent, only data from the consent date on
            const minDate = !participation.shareHistory && participation.consentedAt
                ? new Date(participation.consentedAt)
                : null;

            try {
                const accepted = await donateBatch({
                    selection: participationSelection.selection,
                    researchProjectId: participation.projectId,
                    hwmPrefix: `p:${participation.projectId}:`,
                    idScope: `p:${participation.projectId}:`,
                    minDate,
                    allowedQuestionnaireIds: participationSelection.allowedQuestionnaireIds,
                    partnerAccountRef: participation.partnerAccountRef,
                });
                if (accepted > 0) {
                    console.log(`Research donation (${participation.title}): ${accepted} resources donated`);
                }
            } catch (err) {
                const errorText = getErrorText(err);
                if (errorText.includes('grant_revoked') || errorText.includes('grant_not_found')) {
                    await patientPreferencesStore.setResearchProjectParticipation({
                        ...participation,
                        status: 'revoked',
                        updatedAt: new Date().toISOString(),
                    });
                    emit('researchProjects:changed');
                    console.warn(`Research project participation revoked: ${participation.title}`);
                    continue;
                }
                if (errorText.includes('project_not_active')) {
                    await patientPreferencesStore.setResearchProjectParticipation({
                        ...participation,
                        status: 'completed',
                        updatedAt: new Date().toISOString(),
                    });
                    emit('researchProjects:changed');
                    console.log(`Research project ended: ${participation.title}`);
                    continue;
                }
                throw err;
            }
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
