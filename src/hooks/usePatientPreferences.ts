/**
 * usePatientPreferences Hook
 *
 * Provides access to patient-specific app preferences.
 * Data is synced across devices via the PatientPreferencesStore.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { emit, on } from '@/src/lib/bus';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import type {
    MetricPreferences,
    ShareTarget,
    VerificationState,
} from '@/src/stores/patientPreferencesStore';
import type { BadgeVariant } from 'react-native-nice-ui';

type UsePatientPreferencesReturn = {
    /** Get preferences for a specific metric */
    getMetricPreferences: (metricId: string) => Promise<MetricPreferences>;
    /** Update preferences for a specific metric */
    updateMetricPreferences: (metricId: string, updates: Partial<MetricPreferences>) => Promise<void>;
    /** Get preferred unit for a metric */
    getUnit: (metricId: string) => Promise<string | undefined>;
    /** Set preferred unit for a metric */
    setUnit: (metricId: string, unit: string) => Promise<void>;
    /** Get share settings for a metric */
    getShareWith: (metricId: string) => Promise<ShareTarget[]>;
    /** Set share settings for a metric */
    setShareWith: (metricId: string, shareWith: ShareTarget[]) => Promise<void>;
    /** Check if a metric is pinned */
    isPinned: (metricId: string) => Promise<boolean>;
    /** Set pinned state for a metric */
    setPinned: (metricId: string, pinned: boolean) => Promise<void>;
    /** Get all pinned metric IDs */
    getPinnedMetricIds: () => Promise<string[]>;
};

/**
 * Hook for accessing patient preferences.
 */
export function usePatientPreferences(): UsePatientPreferencesReturn {
    const { patientPreferencesStore: store } = usePatientStores();

    const getMetricPreferences = useCallback(
        (metricId: string) => {
            if (!store) return Promise.resolve({} as MetricPreferences);
            return store.getMetricPreferences(metricId);
        },
        [store]
    );

    const updateMetricPreferences = useCallback(
        (metricId: string, updates: Partial<MetricPreferences>) => {
            if (!store) return Promise.resolve();
            return store.updateMetricPreferences(metricId, updates);
        },
        [store]
    );

    const getUnit = useCallback(
        (metricId: string) => {
            if (!store) return Promise.resolve(undefined);
            return store.getUnit(metricId);
        },
        [store]
    );

    const setUnit = useCallback(
        (metricId: string, unit: string) => {
            if (!store) return Promise.resolve();
            return store.setUnit(metricId, unit);
        },
        [store]
    );

    const getShareWith = useCallback(
        (metricId: string) => {
            if (!store) return Promise.resolve([] as ShareTarget[]);
            return store.getShareWith(metricId);
        },
        [store]
    );

    const setShareWith = useCallback(
        (metricId: string, shareWith: ShareTarget[]) => {
            if (!store) return Promise.resolve();
            return store.setShareWith(metricId, shareWith);
        },
        [store]
    );

    const isPinned = useCallback(
        (metricId: string) => {
            if (!store) return Promise.resolve(false);
            return store.isPinned(metricId);
        },
        [store]
    );

    const setPinned = useCallback(
        (metricId: string, pinned: boolean) => {
            if (!store) return Promise.resolve();
            return store.setPinned(metricId, pinned);
        },
        [store]
    );

    const getPinnedMetricIds = useCallback(
        () => {
            if (!store) return Promise.resolve([] as string[]);
            return store.getPinnedMetricIds();
        },
        [store]
    );

    return {
        getMetricPreferences,
        updateMetricPreferences,
        getUnit,
        setUnit,
        getShareWith,
        setShareWith,
        isPinned,
        setPinned,
        getPinnedMetricIds,
    };
}

/**
 * Hook for a specific metric's preferences with reactive state.
 */
export function useMetricPreferences(metricId: string) {
    const { patientPreferencesStore: store } = usePatientStores();
    const [preferences, setPreferences] = useState<MetricPreferences>({});
    const [isLoading, setIsLoading] = useState(true);

    const loadPreferences = useCallback(async () => {
        if (!store) { setPreferences({}); setIsLoading(false); return; }
        const prefs = await store.getMetricPreferences(metricId);
        setPreferences(prefs);
        setIsLoading(false);
    }, [store, metricId]);

    useEffect(() => {
        loadPreferences();

        // Reload when FHIR data changes (sync from other device)
        const off = on('fhir:changed', loadPreferences);
        return () => off();
    }, [loadPreferences]);

    const updatePreferences = useCallback(
        async (updates: Partial<MetricPreferences>) => {
            if (!store) return;
            await store.updateMetricPreferences(metricId, updates);
            setPreferences((prev) => ({ ...prev, ...updates }));
        },
        [store, metricId]
    );

    const setUnit = useCallback(
        async (unit: string) => {
            if (!store) return;
            await store.setUnit(metricId, unit);
            setPreferences((prev) => ({ ...prev, unit }));
        },
        [store, metricId]
    );

    const setShareWith = useCallback(
        async (shareWith: ShareTarget[]) => {
            if (!store) return;
            await store.setShareWith(metricId, shareWith);
            setPreferences((prev) => ({ ...prev, shareWith }));
        },
        [store, metricId]
    );

    const setPinned = useCallback(
        async (pinned: boolean) => {
            if (!store) return;
            await store.setPinned(metricId, pinned);
            setPreferences((prev) => ({ ...prev, pinned }));
            emit('preferences:changed');
        },
        [store, metricId]
    );

    return {
        preferences,
        isLoading,
        updatePreferences,
        unit: preferences.unit,
        setUnit,
        shareWith: preferences.shareWith ?? [],
        setShareWith,
        pinned: preferences.pinned ?? false,
        setPinned,
    };
}

/**
 * Reactive hook for the patient nickname.
 * Returns current nickname and setter.
 */
export function useNickname() {
    const { patientPreferencesStore: store } = usePatientStores();
    const [nickname, setNicknameState] = useState<string | undefined>(undefined);
    const [profileIcon, setProfileIconState] = useState<string | undefined>(undefined);
    const [profileColor, setProfileColorState] = useState<string | undefined>(undefined);

    const load = useCallback(async () => {
        if (!store) { setNicknameState(undefined); setProfileIconState(undefined); setProfileColorState(undefined); return; }
        const prefs = await store.getAll();
        setNicknameState(prefs.nickname);
        setProfileIconState(prefs.profileIcon);
        setProfileColorState(prefs.profileColor);
    }, [store]);

    useEffect(() => {
        load();
        const offFhir = on('fhir:changed', load);
        const offPrefs = on('preferences:changed', load);
        return () => { offFhir(); offPrefs(); };
    }, [load]);

    const setNickname = useCallback(async (name: string | undefined) => {
        if (!store) return;
        await store.setNickname(name);
        setNicknameState(name);
        emit('preferences:changed');
    }, [store]);

    const setProfileIcon = useCallback(async (icon: string | undefined) => {
        if (!store) return;
        await store.setProfileIcon(icon);
        setProfileIconState(icon);
        emit('preferences:changed');
    }, [store]);

    const setProfileColor = useCallback(async (color: string | undefined) => {
        if (!store) return;
        await store.setProfileColor(color);
        setProfileColorState(color);
        emit('preferences:changed');
    }, [store]);

    return { nickname, setNickname, profileIcon, setProfileIcon, profileColor, setProfileColor };
}

const VERIFICATION_VARIANT: Record<VerificationState['status'], BadgeVariant> = {
    pending: 'warning',
    verified: 'success',
    rejected: 'error',
    revoked: 'error',
};

/**
 * Reactive hook for the ALS diagnosis verification status.
 * Returns badge-ready props (label, variant) for display.
 * Defaults to 'pending' when no verification exists yet.
 */
export function useVerification() {
    const { patientPreferencesStore: store } = usePatientStores();
    const { t } = useTranslation();
    const [status, setStatus] = useState<VerificationState['status'] | null>(null);

    const load = useCallback(async () => {
        if (!store) { setStatus(null); return; }
        const prefs = await store.getAll();
        const verification = prefs.verification;
        if (!verification) { setStatus(null); return; }

        setStatus(verification.status);
    }, [store]);

    useEffect(() => {
        load();
        const offFhir = on('fhir:changed', load);
        const offVerification = on('verification:changed', load);
        return () => { offFhir(); offVerification(); };
    }, [load]);

    const effectiveStatus = status ?? 'pending';

    const label =
        effectiveStatus === 'pending'  ? t('verification.statusPending') :
        effectiveStatus === 'verified' ? t('verification.statusVerified') :
        effectiveStatus === 'revoked'  ? t('verification.statusRevoked') :
        t('verification.statusRejected');

    return { status: effectiveStatus, label, variant: VERIFICATION_VARIANT[effectiveStatus], refresh: load };
}
