/**
 * DonationTrackingStore - Tracks which data has been donated to research.
 *
 * This data is stored encrypted and synced between all devices of a patient.
 * Uses high-water marks per metric type to track donation progress.
 *
 * SYNC: The state is synced as a FHIR Basic resource with code "donation-tracking".
 */
import * as SecureStore from 'expo-secure-store';

function getDonationTrackingKey(patientId: string): string {
    return `donation_tracking_v1_${patientId}`;
}

/** Resource type and ID used for syncing DonationTracking */
export const DONATION_TRACKING_RESOURCE_TYPE = 'Basic';
// Fixed UUID for donation-tracking (server requires UUID format for entity_id)
export const DONATION_TRACKING_RESOURCE_ID = '00000000-0000-4000-a000-000000000004';
export const DONATION_TRACKING_CODE = 'donation-tracking';

/** Donation tracking state */
export type DonationTrackingState = {
    /** Version for future migrations */
    version: 1;
    /** High-water marks per bucket. Key: "Observation:<loinc>" or "QR:<questionnaire_id>" */
    highWaterMarks: Record<string, string>; // Value = ISO timestamp
    /** Cached anonymous research ID */
    anonymousResearchId?: string;
    /** Total number of donated resources (for UI) */
    totalDonated: number;
    /** ISO timestamp of last successful donation */
    lastDonatedAt?: string;
    /** Last updated timestamp */
    updatedAt: string;
};

/** Callback for syncing changes */
export type DonationTrackingSyncCallback = (state: DonationTrackingState) => Promise<void>;

export type DonationTrackingStore = {
    /** Get full tracking state */
    getState(): Promise<DonationTrackingState>;

    /** Get high-water mark for a specific bucket */
    getHighWaterMark(bucket: string): Promise<string | undefined>;

    /** Update high-water mark for a specific bucket */
    setHighWaterMark(bucket: string, timestamp: string): Promise<void>;

    /** Update multiple high-water marks at once */
    setHighWaterMarks(marks: Record<string, string>): Promise<void>;

    /** Get or set the cached anonymous research ID */
    getAnonymousResearchId(): Promise<string | undefined>;
    setAnonymousResearchId(id: string): Promise<void>;

    /** Record a successful donation */
    recordDonation(count: number): Promise<void>;

    /** Clear all tracking data */
    clear(): Promise<void>;

    /** Import state (for sync - merges with existing) */
    importState(state: DonationTrackingState): Promise<void>;

    /** Export state (for sync) */
    exportState(): Promise<DonationTrackingState>;

    /** Set callback to be called when state changes (for sync) */
    setSyncCallback(callback: DonationTrackingSyncCallback | null): void;

    /** Convert state to FHIR Basic resource */
    toFhirResource(): Promise<any>;

    /** Import from FHIR Basic resource */
    fromFhirResource(resource: any): Promise<void>;
};

/**
 * Creates a donation tracking store backed by SecureStore.
 * When patientId is provided, uses a per-patient SecureStore key.
 * Data arrives via FHIR sync — no local migration needed.
 */
export function createDonationTrackingStore(patientId: string): DonationTrackingStore {
    let syncCallback: DonationTrackingSyncCallback | null = null;
    const storageKey = getDonationTrackingKey(patientId);

    async function loadState(): Promise<DonationTrackingState> {
        try {
            const json = await SecureStore.getItemAsync(storageKey);
            if (!json) {
                return {
                    version: 1,
                    highWaterMarks: {},
                    totalDonated: 0,
                    updatedAt: new Date().toISOString(),
                };
            }
            return JSON.parse(json) as DonationTrackingState;
        } catch {
            return {
                version: 1,
                highWaterMarks: {},
                totalDonated: 0,
                updatedAt: new Date().toISOString(),
            };
        }
    }

    async function saveState(state: DonationTrackingState, triggerSync = true): Promise<void> {
        state.updatedAt = new Date().toISOString();
        await SecureStore.setItemAsync(storageKey, JSON.stringify(state), {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });

        if (triggerSync && syncCallback) {
            try {
                await syncCallback(state);
            } catch (e) {
                console.warn('DonationTrackingStore sync callback failed:', e);
            }
        }
    }

    async function getState(): Promise<DonationTrackingState> {
        return loadState();
    }

    async function getHighWaterMark(bucket: string): Promise<string | undefined> {
        const state = await loadState();
        return state.highWaterMarks[bucket];
    }

    async function setHighWaterMark(bucket: string, timestamp: string): Promise<void> {
        const state = await loadState();
        state.highWaterMarks[bucket] = timestamp;
        await saveState(state);
    }

    async function setHighWaterMarks(marks: Record<string, string>): Promise<void> {
        const state = await loadState();
        for (const [bucket, timestamp] of Object.entries(marks)) {
            state.highWaterMarks[bucket] = timestamp;
        }
        await saveState(state);
    }

    async function getAnonymousResearchId(): Promise<string | undefined> {
        const state = await loadState();
        return state.anonymousResearchId;
    }

    async function setAnonymousResearchId(id: string): Promise<void> {
        const state = await loadState();
        state.anonymousResearchId = id;
        await saveState(state);
    }

    async function recordDonation(count: number): Promise<void> {
        const state = await loadState();
        state.totalDonated += count;
        state.lastDonatedAt = new Date().toISOString();
        await saveState(state);
    }

    async function clear(): Promise<void> {
        await SecureStore.deleteItemAsync(storageKey);
    }

    async function importState(incoming: DonationTrackingState): Promise<void> {
        const existing = await loadState();
        const merged = mergeState(existing, incoming);
        // Don't trigger sync since this is called FROM sync
        await saveState(merged, false);
    }

    async function exportState(): Promise<DonationTrackingState> {
        return loadState();
    }

    function setSyncCallback(callback: DonationTrackingSyncCallback | null): void {
        syncCallback = callback;
    }

    async function toFhirResource(): Promise<any> {
        const state = await loadState();
        return {
            resourceType: DONATION_TRACKING_RESOURCE_TYPE,
            id: DONATION_TRACKING_RESOURCE_ID,
            meta: {
                lastUpdated: state.updatedAt,
            },
            code: {
                coding: [{
                    system: 'urn:medical-sync-vault',
                    code: DONATION_TRACKING_CODE,
                }],
            },
            extension: [{
                url: 'urn:medical-sync-vault:donation-tracking',
                valueString: JSON.stringify(state),
            }],
        };
    }

    async function fromFhirResource(resource: any): Promise<void> {
        if (resource?.resourceType !== DONATION_TRACKING_RESOURCE_TYPE) return;
        if (resource?.code?.coding?.[0]?.code !== DONATION_TRACKING_CODE) return;

        const ext = resource.extension?.find(
            (e: any) => e.url === 'urn:medical-sync-vault:donation-tracking'
        );
        if (!ext?.valueString) return;

        try {
            const state = JSON.parse(ext.valueString) as DonationTrackingState;
            await importState(state);
        } catch (e) {
            console.warn('Failed to parse DonationTrackingState from FHIR resource:', e);
        }
    }

    return {
        getState,
        getHighWaterMark,
        setHighWaterMark,
        setHighWaterMarks,
        getAnonymousResearchId,
        setAnonymousResearchId,
        recordDonation,
        clear,
        importState,
        exportState,
        setSyncCallback,
        toFhirResource,
        fromFhirResource,
    };
}

/**
 * Merges two tracking states. Per bucket: take the later timestamp (max).
 * For counters and timestamps: take the larger/later value.
 */
function mergeState(local: DonationTrackingState, incoming: DonationTrackingState): DonationTrackingState {
    const merged: DonationTrackingState = {
        version: 1,
        highWaterMarks: { ...local.highWaterMarks },
        anonymousResearchId: incoming.anonymousResearchId ?? local.anonymousResearchId,
        totalDonated: Math.max(local.totalDonated, incoming.totalDonated),
        lastDonatedAt: maxTimestamp(local.lastDonatedAt, incoming.lastDonatedAt),
        updatedAt: maxTimestamp(local.updatedAt, incoming.updatedAt) ?? new Date().toISOString(),
    };

    // Per bucket: take the later high-water mark
    for (const [bucket, timestamp] of Object.entries(incoming.highWaterMarks)) {
        const existing = merged.highWaterMarks[bucket];
        merged.highWaterMarks[bucket] = maxTimestamp(existing, timestamp) ?? timestamp;
    }

    return merged;
}

function maxTimestamp(a?: string, b?: string): string | undefined {
    if (!a) return b;
    if (!b) return a;
    return new Date(a) >= new Date(b) ? a : b;
}

/** Delete per-patient data from SecureStore (for cleanup on patient removal) */
export async function deleteDonationTrackingData(patientId: string): Promise<void> {
    await SecureStore.deleteItemAsync(getDonationTrackingKey(patientId));
}
