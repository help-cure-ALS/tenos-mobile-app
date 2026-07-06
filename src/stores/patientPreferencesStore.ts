/**
 * PatientPreferencesStore - Manages patient-specific app preferences.
 *
 * This data is stored encrypted and synced between all devices of a patient.
 * Includes settings like unit preferences, sharing preferences, and pinned metrics.
 *
 * SYNC: The list is synced as a FHIR Basic resource with code "patient-preferences".
 */
import * as SecureStore from 'expo-secure-store';

function getPatientPrefsKey(patientId: string): string {
    return `patient_preferences_v1_${patientId}`;
}

/** Resource type and ID used for syncing PatientPreferences */
export const PATIENT_PREFS_RESOURCE_TYPE = 'Basic';
// Fixed UUID for patient-preferences (server requires UUID format for entity_id)
export const PATIENT_PREFS_RESOURCE_ID = '00000000-0000-4000-a000-000000000002';
export const PATIENT_PREFS_CODE = 'patient-preferences';

/** Who the metric data can be shared with */
export type ShareTarget = 'nobody' | 'doctor' | 'caregiver' | 'research';

/** Preferred measurement-system setting for unit display/input. */
export type PreferredMeasurementSystem = 'auto' | 'metric' | 'us';

/** Configuration for a single todo item (metric or questionnaire) */
export type TodoItemConfig = {
    enabled: boolean;
    intervalDays: number; // 1 = daily, 7 = weekly, etc.
};

/** Preferences for a single metric */
export type MetricPreferences = {
    /** Preferred unit for display */
    unit?: string;
    /** Who this metric's data is shared with */
    shareWith?: ShareTarget[];
    /** Whether the metric is pinned to home screen */
    pinned?: boolean;
    /** Sort order for pinned metrics (lower = higher in list) */
    pinnedOrder?: number;
};

/** ALS diagnosis verification state */
export type VerificationState = {
    /** Current verification status */
    status: 'pending' | 'verified' | 'rejected' | 'revoked';
    /** 6-digit verification code (shown to patient) */
    code: string;
    /** Verification-service request ID (for polling) */
    requestId: string;
    /** Verification token ID (set after confirmation) */
    tokenId?: string;
    /** Clinic pseudonym (set after confirmation) */
    clinicPseudonym?: string;
    /** FHIR-ID of the chosen careProvider */
    clinicId: string;
    /** Display name of the clinic */
    clinicName: string;
    /** ISO timestamp when created */
    createdAt: string;
    /** ISO timestamp when the code expires */
    expiresAt: string;
    /** ISO timestamp when resolved (verified/rejected) */
    resolvedAt?: string;
};

/** Supplier integration metadata (NO token - that lives in SecureStore) */
export type SupplierIntegrationMeta = {
    id: string;
    organizationId: string;
    organizationName: string;
    linkedAt: string;
    active: boolean;
    address?: string;
    phone?: string;
    email?: string;
    /** Tombstone: set when disconnected, prevents sync from resurrecting deleted integrations */
    removedAt?: string;
};

/** Supplier data selection policy */
export type SupplierSelectionPolicy = {
    integrationId: string;
    metricIds: string[];
    categories: Record<string, boolean>;
    directions: { outbound: boolean; inbound: boolean };
};

/** All patient preferences */
export type PatientPreferences = {
    /** Version for future migrations */
    version: 1;
    /** Preferred measurement system for display units. `auto` derives from patient country. */
    measurementSystem?: PreferredMeasurementSystem;
    /** Per-metric preferences, keyed by metricId */
    metrics: Record<string, MetricPreferences>;
    /** ALS diagnosis verification (optional, patient-only) */
    verification?: VerificationState;
    /** Favorited study IDs */
    studyFavorites?: string[];
    /** Patient nickname for greeting display */
    nickname?: string;
    /** Profile icon (SF Symbol name) */
    profileIcon?: string;
    /** Profile color (hex) */
    profileColor?: string;
    /** Whether the first-launch intro has been shown */
    firstLaunchDone?: boolean;
    /** Sharing settings for non-metric data categories */
    sharing?: {
        medications?: ShareTarget[];
        aids?: ShareTarget[];
        questionnaires?: ShareTarget[];
    };
    /** Todo configuration, key format: "metric:{id}" or "questionnaire:{id}" */
    todos?: Record<string, TodoItemConfig>;
    /** Supplier integration metadata (no tokens!) */
    supplierIntegrations?: SupplierIntegrationMeta[];
    /** Supplier data selection policies */
    supplierPolicies?: SupplierSelectionPolicy[];
    /** When this patient account was first created (ISO timestamp, set once, never overwritten) */
    createdAt?: string;
    /** Last updated timestamp */
    updatedAt: string;
};

/** Callback for syncing changes */
export type PatientPreferencesSyncCallback = (prefs: PatientPreferences) => Promise<void>;

export type PatientPreferencesStore = {
    /** Get all preferences */
    getAll(): Promise<PatientPreferences>;

    /** Get preferences for a specific metric */
    getMetricPreferences(metricId: string): Promise<MetricPreferences>;

    /** Get preferred measurement system */
    getMeasurementSystem(): Promise<PreferredMeasurementSystem>;

    /** Set preferred measurement system */
    setMeasurementSystem(system: PreferredMeasurementSystem): Promise<void>;

    /** Set preferences for a specific metric */
    setMetricPreferences(metricId: string, prefs: MetricPreferences): Promise<void>;

    /** Update partial preferences for a specific metric */
    updateMetricPreferences(metricId: string, updates: Partial<MetricPreferences>): Promise<void>;

    /** Get preferred unit for a metric */
    getUnit(metricId: string): Promise<string | undefined>;

    /** Set preferred unit for a metric */
    setUnit(metricId: string, unit: string): Promise<void>;

    /** Get share settings for a metric */
    getShareWith(metricId: string): Promise<ShareTarget[]>;

    /** Set share settings for a metric */
    setShareWith(metricId: string, shareWith: ShareTarget[]): Promise<void>;

    /** Check if a metric is pinned */
    isPinned(metricId: string): Promise<boolean>;

    /** Set pinned state for a metric */
    setPinned(metricId: string, pinned: boolean): Promise<void>;

    /** Get all pinned metric IDs */
    getPinnedMetricIds(): Promise<string[]>;

    /** Get all favorited study IDs */
    getStudyFavorites(): Promise<string[]>;

    /** Check if a study is favorited */
    isStudyFavorite(studyId: string): Promise<boolean>;

    /** Toggle favorite state for a study, returns new state */
    toggleStudyFavorite(studyId: string): Promise<boolean>;

    /** Get patient nickname */
    getNickname(): Promise<string | undefined>;

    /** Set patient nickname */
    setNickname(nickname: string | undefined): Promise<void>;

    /** Get profile icon */
    getProfileIcon(): Promise<string | undefined>;

    /** Set profile icon */
    setProfileIcon(icon: string | undefined): Promise<void>;

    /** Get profile color */
    getProfileColor(): Promise<string | undefined>;

    /** Set profile color */
    setProfileColor(color: string | undefined): Promise<void>;

    /** Check if first-launch intro has been shown */
    isFirstLaunchDone(): Promise<boolean>;

    /** Mark first-launch intro as shown */
    setFirstLaunchDone(): Promise<void>;

    /** Get account creation date (ISO timestamp) */
    getCreatedAt(): Promise<string | undefined>;

    /** Get all todo configurations */
    getTodoConfigs(): Promise<Record<string, TodoItemConfig>>;

    /** Set or remove a todo configuration (null = remove) */
    setTodoConfig(key: string, config: TodoItemConfig | null): Promise<void>;

    /** Get sharing settings for a non-metric category */
    getCategorySharing(category: 'medications' | 'aids' | 'questionnaires'): Promise<ShareTarget[]>;

    /** Set sharing settings for a non-metric category */
    setCategorySharing(category: 'medications' | 'aids' | 'questionnaires', targets: ShareTarget[]): Promise<void>;

    /** Batch-update sharing for a role across all given metrics and categories in a single save */
    batchSetSharing(
        role: ShareTarget,
        enabled: boolean,
        metricIds: string[],
        categories: ('medications' | 'aids' | 'questionnaires')[],
    ): Promise<void>;

    /** Set or clear verification state */
    setVerification(state: VerificationState | undefined): Promise<void>;

    /** Get all supplier integrations */
    getSupplierIntegrations(): Promise<SupplierIntegrationMeta[]>;

    /** Add or update a supplier integration */
    setSupplierIntegration(integration: SupplierIntegrationMeta): Promise<void>;

    /** Remove a supplier integration */
    removeSupplierIntegration(integrationId: string): Promise<void>;

    /** Get supplier selection policy for an integration */
    getSupplierPolicy(integrationId: string): Promise<SupplierSelectionPolicy | undefined>;

    /** Set supplier selection policy */
    setSupplierPolicy(policy: SupplierSelectionPolicy): Promise<void>;

    /** Remove supplier selection policy */
    removeSupplierPolicy(integrationId: string): Promise<void>;

    /** Clear all preferences */
    clear(): Promise<void>;

    /** Import preferences (for sync - merges with existing) */
    importPreferences(prefs: PatientPreferences): Promise<void>;

    /** Export preferences (for sync) */
    exportPreferences(): Promise<PatientPreferences>;

    /** Set callback to be called when preferences change (for sync) */
    setSyncCallback(callback: PatientPreferencesSyncCallback | null): void;

    /** Convert preferences to FHIR Basic resource */
    toFhirResource(): Promise<any>;

    /** Import from FHIR Basic resource */
    fromFhirResource(resource: any): Promise<void>;
};

/**
 * Creates a patient preferences store backed by SecureStore.
 * When patientId is provided, uses a per-patient SecureStore key.
 * Data arrives via FHIR sync — no local migration needed.
 */
export function createPatientPreferencesStore(patientId: string): PatientPreferencesStore {
    let syncCallback: PatientPreferencesSyncCallback | null = null;
    const storageKey = getPatientPrefsKey(patientId);

    async function loadPreferences(): Promise<PatientPreferences> {
        try {
            const json = await SecureStore.getItemAsync(storageKey);
            if (!json) {
                const now = new Date().toISOString();
                return {
                    version: 1,
                    metrics: {},
                    createdAt: now,
                    updatedAt: now,
                };
            }
            const prefs = JSON.parse(json) as PatientPreferences;
            // Backfill createdAt for existing patients (use updatedAt as best approximation)
            if (!prefs.createdAt) {
                prefs.createdAt = prefs.updatedAt;
            }
            return prefs;
        } catch {
            const now = new Date().toISOString();
            return {
                version: 1,
                metrics: {},
                createdAt: now,
                updatedAt: now,
            };
        }
    }

    async function savePreferences(prefs: PatientPreferences, triggerSync = true): Promise<void> {
        prefs.updatedAt = new Date().toISOString();
        await SecureStore.setItemAsync(storageKey, JSON.stringify(prefs), {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });

        // Trigger sync callback if set
        if (triggerSync && syncCallback) {
            try {
                await syncCallback(prefs);
            } catch (e) {
                console.warn('PatientPreferencesStore sync callback failed:', e);
            }
        }
    }

    async function getAll(): Promise<PatientPreferences> {
        return loadPreferences();
    }

    async function getMetricPreferences(metricId: string): Promise<MetricPreferences> {
        const prefs = await loadPreferences();
        return prefs.metrics[metricId] ?? {};
    }

    async function getMeasurementSystem(): Promise<PreferredMeasurementSystem> {
        const prefs = await loadPreferences();
        return prefs.measurementSystem ?? 'auto';
    }

    async function setMeasurementSystem(system: PreferredMeasurementSystem): Promise<void> {
        const prefs = await loadPreferences();
        prefs.measurementSystem = system;
        await savePreferences(prefs);
    }

    async function setMetricPreferences(metricId: string, metricPrefs: MetricPreferences): Promise<void> {
        const prefs = await loadPreferences();
        prefs.metrics[metricId] = metricPrefs;
        await savePreferences(prefs);
    }

    async function updateMetricPreferences(metricId: string, updates: Partial<MetricPreferences>): Promise<void> {
        const prefs = await loadPreferences();
        prefs.metrics[metricId] = {
            ...prefs.metrics[metricId],
            ...updates,
        };
        await savePreferences(prefs);
    }

    async function getUnit(metricId: string): Promise<string | undefined> {
        const metricPrefs = await getMetricPreferences(metricId);
        return metricPrefs.unit;
    }

    async function setUnit(metricId: string, unit: string): Promise<void> {
        await updateMetricPreferences(metricId, { unit });
    }

    async function getShareWith(metricId: string): Promise<ShareTarget[]> {
        const metricPrefs = await getMetricPreferences(metricId);
        return metricPrefs.shareWith ?? [];
    }

    async function setShareWith(metricId: string, shareWith: ShareTarget[]): Promise<void> {
        await updateMetricPreferences(metricId, { shareWith });
    }

    async function isPinned(metricId: string): Promise<boolean> {
        const metricPrefs = await getMetricPreferences(metricId);
        return metricPrefs.pinned ?? false;
    }

    async function setPinned(metricId: string, pinned: boolean): Promise<void> {
        await updateMetricPreferences(metricId, { pinned });
    }

    async function getPinnedMetricIds(): Promise<string[]> {
        const prefs = await loadPreferences();
        return Object.entries(prefs.metrics)
            .filter(([_, metricPrefs]) => metricPrefs.pinned)
            .map(([metricId]) => metricId);
    }

    async function getStudyFavorites(): Promise<string[]> {
        const prefs = await loadPreferences();
        return prefs.studyFavorites ?? [];
    }

    async function isStudyFavorite(studyId: string): Promise<boolean> {
        const favorites = await getStudyFavorites();
        return favorites.includes(studyId);
    }

    async function toggleStudyFavorite(studyId: string): Promise<boolean> {
        const prefs = await loadPreferences();
        const favorites = prefs.studyFavorites ?? [];
        const isFav = favorites.includes(studyId);
        prefs.studyFavorites = isFav
            ? favorites.filter(id => id !== studyId)
            : [...favorites, studyId];
        await savePreferences(prefs);
        return !isFav;
    }

    async function getNickname(): Promise<string | undefined> {
        const prefs = await loadPreferences();
        return prefs.nickname;
    }

    async function setNickname(nickname: string | undefined): Promise<void> {
        const prefs = await loadPreferences();
        prefs.nickname = nickname;
        await savePreferences(prefs);
    }

    async function getProfileIcon(): Promise<string | undefined> {
        const prefs = await loadPreferences();
        return prefs.profileIcon;
    }

    async function setProfileIcon(icon: string | undefined): Promise<void> {
        const prefs = await loadPreferences();
        prefs.profileIcon = icon;
        await savePreferences(prefs);
    }

    async function getProfileColor(): Promise<string | undefined> {
        const prefs = await loadPreferences();
        return prefs.profileColor;
    }

    async function setProfileColor(color: string | undefined): Promise<void> {
        const prefs = await loadPreferences();
        prefs.profileColor = color;
        await savePreferences(prefs);
    }

    async function isFirstLaunchDone(): Promise<boolean> {
        const prefs = await loadPreferences();
        return prefs.firstLaunchDone ?? false;
    }

    async function setFirstLaunchDone(): Promise<void> {
        const prefs = await loadPreferences();
        prefs.firstLaunchDone = true;
        await savePreferences(prefs);
    }

    async function getCreatedAt(): Promise<string | undefined> {
        const prefs = await loadPreferences();
        return prefs.createdAt;
    }

    async function getTodoConfigs(): Promise<Record<string, TodoItemConfig>> {
        const prefs = await loadPreferences();
        return prefs.todos ?? {};
    }

    async function setTodoConfig(key: string, config: TodoItemConfig | null): Promise<void> {
        const prefs = await loadPreferences();
        if (!prefs.todos) prefs.todos = {};
        if (config === null) {
            delete prefs.todos[key];
        } else {
            prefs.todos[key] = config;
        }
        await savePreferences(prefs);
    }

    async function getCategorySharing(category: 'medications' | 'aids' | 'questionnaires'): Promise<ShareTarget[]> {
        const prefs = await loadPreferences();
        return prefs.sharing?.[category] ?? [];
    }

    async function setCategorySharing(category: 'medications' | 'aids' | 'questionnaires', targets: ShareTarget[]): Promise<void> {
        const prefs = await loadPreferences();
        if (!prefs.sharing) prefs.sharing = {};
        prefs.sharing[category] = targets;
        await savePreferences(prefs);
    }

    async function batchSetSharing(
        role: ShareTarget,
        enabled: boolean,
        metricIds: string[],
        categories: ('medications' | 'aids' | 'questionnaires')[],
    ): Promise<void> {
        const prefs = await loadPreferences();

        for (const id of metricIds) {
            const current = prefs.metrics[id]?.shareWith ?? [];
            if (!prefs.metrics[id]) prefs.metrics[id] = {};
            prefs.metrics[id].shareWith = enabled
                ? [...current.filter(t => t !== role), role]
                : current.filter(t => t !== role);
        }

        if (!prefs.sharing) prefs.sharing = {};
        for (const cat of categories) {
            const current = prefs.sharing[cat] ?? [];
            prefs.sharing[cat] = enabled
                ? [...current.filter(t => t !== role), role]
                : current.filter(t => t !== role);
        }

        await savePreferences(prefs);
    }

    async function setVerification(state: VerificationState | undefined): Promise<void> {
        const prefs = await loadPreferences();
        prefs.verification = state;
        await savePreferences(prefs);
    }

    async function getSupplierIntegrations(): Promise<SupplierIntegrationMeta[]> {
        const prefs = await loadPreferences();
        return (prefs.supplierIntegrations ?? []).filter(i => !i.removedAt);
    }

    async function setSupplierIntegration(integration: SupplierIntegrationMeta): Promise<void> {
        const prefs = await loadPreferences();
        const list = prefs.supplierIntegrations ?? [];
        const idx = list.findIndex(i => i.id === integration.id);
        const clean = { ...integration };
        delete clean.removedAt;
        if (idx >= 0) {
            list[idx] = clean;
        } else {
            list.push(clean);
        }
        prefs.supplierIntegrations = list;
        await savePreferences(prefs);
    }

    async function removeSupplierIntegration(integrationId: string): Promise<void> {
        const prefs = await loadPreferences();
        const list = prefs.supplierIntegrations ?? [];
        const idx = list.findIndex(i => i.id === integrationId);
        if (idx >= 0) {
            list[idx] = { ...list[idx], active: false, removedAt: new Date().toISOString() };
        }
        prefs.supplierIntegrations = list;
        prefs.supplierPolicies = (prefs.supplierPolicies ?? []).filter(p => p.integrationId !== integrationId);
        await savePreferences(prefs);
    }

    async function getSupplierPolicy(integrationId: string): Promise<SupplierSelectionPolicy | undefined> {
        const prefs = await loadPreferences();
        return (prefs.supplierPolicies ?? []).find(p => p.integrationId === integrationId);
    }

    async function setSupplierPolicy(policy: SupplierSelectionPolicy): Promise<void> {
        const prefs = await loadPreferences();
        const list = prefs.supplierPolicies ?? [];
        const idx = list.findIndex(p => p.integrationId === policy.integrationId);
        if (idx >= 0) {
            list[idx] = policy;
        } else {
            list.push(policy);
        }
        prefs.supplierPolicies = list;
        await savePreferences(prefs);
    }

    async function removeSupplierPolicy(integrationId: string): Promise<void> {
        const prefs = await loadPreferences();
        prefs.supplierPolicies = (prefs.supplierPolicies ?? []).filter(p => p.integrationId !== integrationId);
        await savePreferences(prefs);
    }

    async function clear(): Promise<void> {
        await SecureStore.deleteItemAsync(storageKey);
    }

    async function importPreferences(incoming: PatientPreferences): Promise<void> {
        const existing = await loadPreferences();
        const merged = mergePreferences(existing, incoming);
        // Don't trigger sync since this is called FROM sync
        await savePreferences(merged, false);
    }

    async function exportPreferences(): Promise<PatientPreferences> {
        return loadPreferences();
    }

    function setSyncCallback(callback: PatientPreferencesSyncCallback | null): void {
        syncCallback = callback;
    }

    async function toFhirResource(): Promise<any> {
        const prefs = await loadPreferences();
        return {
            resourceType: PATIENT_PREFS_RESOURCE_TYPE,
            id: PATIENT_PREFS_RESOURCE_ID,
            meta: {
                lastUpdated: prefs.updatedAt,
            },
            code: {
                coding: [{
                    system: 'urn:medical-sync-vault',
                    code: PATIENT_PREFS_CODE,
                }],
            },
            // Store the actual preferences in an extension
            extension: [{
                url: 'urn:medical-sync-vault:patient-preferences',
                valueString: JSON.stringify(prefs),
            }],
        };
    }

    async function fromFhirResource(resource: any): Promise<void> {
        if (resource?.resourceType !== PATIENT_PREFS_RESOURCE_TYPE) return;
        if (resource?.code?.coding?.[0]?.code !== PATIENT_PREFS_CODE) return;

        const ext = resource.extension?.find(
            (e: any) => e.url === 'urn:medical-sync-vault:patient-preferences'
        );
        if (!ext?.valueString) return;

        try {
            const prefs = JSON.parse(ext.valueString) as PatientPreferences;
            await importPreferences(prefs);
        } catch (e) {
            console.warn('Failed to parse PatientPreferences from FHIR resource:', e);
        }
    }

    return {
        getAll,
        getMetricPreferences,
        getMeasurementSystem,
        setMeasurementSystem,
        setMetricPreferences,
        updateMetricPreferences,
        getUnit,
        setUnit,
        getShareWith,
        setShareWith,
        isPinned,
        setPinned,
        getPinnedMetricIds,
        getCategorySharing,
        setCategorySharing,
        batchSetSharing,
        getCreatedAt,
        getTodoConfigs,
        setTodoConfig,
        getStudyFavorites,
        isStudyFavorite,
        toggleStudyFavorite,
        getNickname,
        setNickname,
        getProfileIcon,
        setProfileIcon,
        getProfileColor,
        setProfileColor,
        isFirstLaunchDone,
        setFirstLaunchDone,
        setVerification,
        getSupplierIntegrations,
        setSupplierIntegration,
        removeSupplierIntegration,
        getSupplierPolicy,
        setSupplierPolicy,
        removeSupplierPolicy,
        clear,
        importPreferences,
        exportPreferences,
        setSyncCallback,
        toFhirResource,
        fromFhirResource,
    };
}

/**
 * Merges two preference sets. Per-metric: newer wins based on updatedAt.
 * If timestamps are equal, incoming wins (remote has priority).
 */
function mergePreferences(local: PatientPreferences, incoming: PatientPreferences): PatientPreferences {
    // Never short-circuit by device clock timestamps.
    // Cross-device clocks can drift, which would otherwise drop valid remote updates
    // (for example todo config changes from another device).
    // Instead, always merge deterministically and prefer incoming values on conflicts.
    const localFavs = local.studyFavorites ?? [];
    const incomingFavs = incoming.studyFavorites ?? [];
    const mergedFavorites = [...new Set([...localFavs, ...incomingFavs])];

    // Merge todos: incoming wins conflicts
    const localTodos = local.todos ?? {};
    const incomingTodos = incoming.todos ?? {};
    const mergedTodos = { ...localTodos, ...incomingTodos };

    // createdAt: keep the earliest value (original account creation)
    const mergedCreatedAt = local.createdAt && incoming.createdAt
        ? (new Date(local.createdAt) < new Date(incoming.createdAt) ? local.createdAt : incoming.createdAt)
        : local.createdAt ?? incoming.createdAt;

    // Merge sharing categories: incoming wins conflicts
    const localSharing = local.sharing ?? {};
    const incomingSharing = incoming.sharing ?? {};
    const mergedSharing = { ...localSharing, ...incomingSharing };

    // Merge supplier integrations: tombstone-aware (removedAt beats linkedAt)
    const localIntegrations = local.supplierIntegrations ?? [];
    const incomingIntegrations = incoming.supplierIntegrations ?? [];
    const integrationMap = new Map(localIntegrations.map(i => [i.id, i]));
    for (const inc of incomingIntegrations) {
        const loc = integrationMap.get(inc.id);
        if (!loc) {
            integrationMap.set(inc.id, inc);
        } else if (loc.removedAt && !inc.removedAt) {
            // Local tombstoned — keep if removal is newer than incoming link
            if (!(loc.removedAt > inc.linkedAt)) integrationMap.set(inc.id, inc);
        } else if (!loc.removedAt && inc.removedAt) {
            // Incoming tombstoned — apply if removal is newer than local link
            if (inc.removedAt > loc.linkedAt) integrationMap.set(inc.id, inc);
        } else if (loc.removedAt && inc.removedAt) {
            // Both tombstoned — keep newer removal
            if (inc.removedAt > loc.removedAt) integrationMap.set(inc.id, inc);
        } else {
            // Neither tombstoned — incoming wins
            integrationMap.set(inc.id, inc);
        }
    }
    const mergedIntegrations = [...integrationMap.values()];

    // Merge supplier policies: incoming wins conflicts (by integrationId)
    // Drop policies for tombstoned integrations
    const tombstonedIds = new Set(mergedIntegrations.filter(i => i.removedAt).map(i => i.id));
    const localPolicies = local.supplierPolicies ?? [];
    const incomingPolicies = incoming.supplierPolicies ?? [];
    const policyMap = new Map(localPolicies.map(p => [p.integrationId, p]));
    for (const p of incomingPolicies) policyMap.set(p.integrationId, p);
    for (const id of tombstonedIds) policyMap.delete(id);
    const mergedPolicies = [...policyMap.values()];

    const merged: PatientPreferences = {
        version: 1,
        measurementSystem: incoming.measurementSystem ?? local.measurementSystem,
        metrics: { ...local.metrics },
        verification: incoming.verification ?? local.verification,
        sharing: Object.keys(mergedSharing).length > 0 ? mergedSharing : undefined,
        studyFavorites: mergedFavorites.length > 0 ? mergedFavorites : undefined,
        nickname: incoming.nickname ?? local.nickname,
        profileIcon: incoming.profileIcon ?? local.profileIcon,
        profileColor: incoming.profileColor ?? local.profileColor,
        firstLaunchDone: local.firstLaunchDone || incoming.firstLaunchDone,
        todos: Object.keys(mergedTodos).length > 0 ? mergedTodos : undefined,
        supplierIntegrations: mergedIntegrations.length > 0 ? mergedIntegrations : undefined,
        supplierPolicies: mergedPolicies.length > 0 ? mergedPolicies : undefined,
        createdAt: mergedCreatedAt,
        updatedAt: incoming.updatedAt,
    };

    for (const [metricId, incomingPrefs] of Object.entries(incoming.metrics)) {
        merged.metrics[metricId] = {
            ...merged.metrics[metricId],
            ...incomingPrefs,
        };
    }

    return merged;
}

/** Delete per-patient data from SecureStore (for cleanup on patient removal) */
export async function deletePatientPreferencesData(patientId: string): Promise<void> {
    await SecureStore.deleteItemAsync(getPatientPrefsKey(patientId));
}
