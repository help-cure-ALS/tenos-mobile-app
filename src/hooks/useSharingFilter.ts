import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { on } from '@/src/lib/bus';
import { useActivePatientOwnerAccess } from '@/src/hooks/useActivePatientOwnerAccess';
import type { PatientPreferences, ShareTarget } from '@/src/stores/patientPreferencesStore';
import { isSharingCategoryEnabled, type SharingCategory } from '@/src/features/assistiveAidsFeature';
import { getAllMetricDefinitions } from '@/src/metrics/definitions';

// Backward compatibility for older metric IDs that may still exist in synced preferences.
const METRIC_ID_ALIASES: Record<string, string[]> = {
    'alsfrs-r': ['alsfrsr', 'alsfrs_r'],
    tdee: ['energy-requirement', 'energy_requirement', 'energyRequirement']
};

const BACKFILL_IF_BROADLY_SHARED_METRIC_IDS = new Set([
    'als_subtype',
    'als_neurological_exam',
]);

export type UseSharingFilterReturn = {
    isFiltering: boolean;
    isLoaded: boolean;
    canSeeMetric: (metricId: string) => boolean;
    canSeeCategory: (cat: SharingCategory) => boolean;
    filterMetrics: <T extends { id: string }>(metrics: T[]) => T[];
};

const DENY_ALL: UseSharingFilterReturn = {
    isFiltering: true,
    isLoaded: false,
    canSeeMetric: () => false,
    canSeeCategory: () => false,
    filterMetrics: () => []
};

export function useSharingFilter(roleOverride?: ShareTarget): UseSharingFilterReturn {
    const { role, isLoading: roleLoading } = useAppRole();
    const { patientPreferencesStore: prefsStore } = usePatientStores();
    const { hasOwnerAccess, isLoaded: ownerAccessLoaded } = useActivePatientOwnerAccess();
    const [prefs, setPrefs] = useState<PatientPreferences | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const prevStoreRef = useRef(prefsStore);
    const prefsSnapshotRef = useRef<string | null>(null);

    const effectiveRole = roleOverride ?? role;
    const needsFilter = effectiveRole === 'doctor' || effectiveRole === 'caregiver';
    const shouldUseOwnerAccess = role === 'caregiver' && hasOwnerAccess;

    // Reset when store changes (patient switch) or role changes
    useEffect(() => {
        if (prevStoreRef.current !== prefsStore) {
            setPrefs(null);
            setIsLoaded(false);
            prefsSnapshotRef.current = null;
            prevStoreRef.current = prefsStore;
        }
    }, [prefsStore]);

    const loadPrefs = useCallback(async () => {
        if (!prefsStore || !needsFilter || shouldUseOwnerAccess) {
            return;
        }
        const p = await prefsStore.getAll();
        const snapshot = JSON.stringify(p);
        if (snapshot !== prefsSnapshotRef.current) {
            prefsSnapshotRef.current = snapshot;
            setPrefs(p);
        }
        setIsLoaded(true);
    }, [prefsStore, needsFilter, shouldUseOwnerAccess]);

    useEffect(() => {
        if (!needsFilter) {
            // Only mark loaded once role is actually determined
            if (!roleLoading) {
                setIsLoaded(true);
            }
            return;
        }
        // Reset before loading new prefs
        setIsLoaded(false);
        loadPrefs();
        const offFhir = on('fhir:changed', loadPrefs);
        const offPrefs = on('preferences:changed', loadPrefs);
        return () => {
            offFhir();
            offPrefs();
        };
    }, [loadPrefs, needsFilter, roleLoading]);

    const shareTarget = (needsFilter ? effectiveRole : null) as ShareTarget | null;

    const canSeeMetric = useCallback((metricId: string): boolean => {
        if (!prefs || !shareTarget) {
            return false;
        }

        const candidateIds = [metricId, ...(METRIC_ID_ALIASES[metricId] ?? [])];
        for (const id of candidateIds) {
            const shareWith = prefs.metrics[id]?.shareWith;
            if (shareWith?.includes(shareTarget)) {
                return true;
            }
        }
        if (canBackfillMetricAccess(prefs, shareTarget, metricId)) {
            return true;
        }
        return false;
    }, [prefs, shareTarget]);

    const canSeeCategory = useCallback((cat: SharingCategory): boolean => {
        if (!isSharingCategoryEnabled(cat, role)) {
            return false;
        }
        if (!prefs || !shareTarget) {
            return false;
        }
        return prefs.sharing?.[cat]?.includes(shareTarget) ?? false;
    }, [prefs, role, shareTarget]);

    const filterMetrics = useCallback(<T extends { id: string }>(metrics: T[]): T[] => {
        if (!prefs || !shareTarget) {
            return [];
        }
        return metrics.filter(m => canSeeMetric(m.id));
    }, [prefs, shareTarget, canSeeMetric]);

    // Role still loading → fail-closed
    if (roleLoading) {
        return DENY_ALL;
    }

    const canSeeEnabledCategory = useCallback(
        (cat: SharingCategory) => isSharingCategoryEnabled(cat, role),
        [role]
    );

    const allowAllVisibleCategories = useMemo<UseSharingFilterReturn>(() => ({
        isFiltering: false,
        isLoaded: true,
        canSeeMetric: () => true,
        canSeeCategory: canSeeEnabledCategory,
        filterMetrics: <T extends { id: string }>(m: T[]) => m
    }), [canSeeEnabledCategory]);

    // Patient/demo → allow all enabled categories
    if (!needsFilter) {
        return allowAllVisibleCategories;
    }

    if (role === 'caregiver' && !ownerAccessLoaded) {
        return DENY_ALL;
    }

    // A caregiver-created patient is owned by this device. Owner access is a capability,
    // not a regular caregiver share grant, so it bypasses the sharing filter.
    if (shouldUseOwnerAccess) {
        return allowAllVisibleCategories;
    }

    // Doctor/caregiver but prefs not loaded yet → fail-closed
    if (!isLoaded) {
        return DENY_ALL;
    }

    return {
        isFiltering: true,
        isLoaded: true,
        canSeeMetric,
        canSeeCategory,
        filterMetrics,
    };
}

function canBackfillMetricAccess(prefs: PatientPreferences, shareTarget: ShareTarget, metricId: string): boolean {
    if (shareTarget === 'research') {
        return false;
    }
    if (!BACKFILL_IF_BROADLY_SHARED_METRIC_IDS.has(metricId)) {
        return false;
    }
    if (prefs.metrics[metricId]?.shareWith !== undefined) {
        return false;
    }

    const baselineIds = getAllMetricDefinitions()
        .map((def) => def.id)
        .filter((id) => !BACKFILL_IF_BROADLY_SHARED_METRIC_IDS.has(id));

    return baselineIds.length > 0 && baselineIds.every((id) => prefs.metrics[id]?.shareWith?.includes(shareTarget));
}
