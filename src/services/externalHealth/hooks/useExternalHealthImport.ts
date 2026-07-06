import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppRole } from '@/src/context/AppRoleProvider';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { getAllMetricDefinitions } from '@/src/metrics/definitions';

import { getExternalHealthAdapter } from '../adapters';
import { runExternalHealthImportExclusive } from '../importLock';
import { importExternalHealthSamples, selectExternalHealthSamplesForImport } from '../importService';
import { getExternalHealthLookbackDaysFromPatientResource } from '../lookback';
import {
    buildExternalHealthRegistry,
    getDefaultExternalHealthMetricIds,
    getRegistryForPlatform,
} from '../registry';
import {
    getExternalHealthPreferences,
    setExternalHealthPreferences,
} from '../preferences';
import type {
    ExternalHealthAvailability,
    ExternalHealthCancellation,
    ExternalHealthImportPreferences,
    ExternalHealthImportProgress,
    ExternalHealthImportResult,
    ExternalHealthRegistryEntry,
} from '../types';

const EXTERNAL_HEALTH_CURSOR_OVERLAP_DAYS = 7;

export type UseExternalHealthImportResult = {
    canUseHealthImport: boolean;
    availability: ExternalHealthAvailability;
    preferences: ExternalHealthImportPreferences;
    registryEntries: ExternalHealthRegistryEntry[];
    selectedMetricIds: string[];
    grantedPermissions: string[];
    isLoading: boolean;
    isSyncing: boolean;
    syncProgress: ExternalHealthImportProgress | null;
    lastResult: ExternalHealthImportResult | null;
    refresh(): Promise<void>;
    setMetricEnabled(metricId: string, enabled: boolean): Promise<void>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    syncNow(): Promise<ExternalHealthImportResult>;
    cancelSync(): void;
};

export function useExternalHealthImport(): UseExternalHealthImportResult {
    const { i18n } = useTranslation();
    const { role, isDemo } = useAppRole();
    const { syncEnabled, fullSync } = useAppSync();
    const fhirRepo = useFhirRepo();
    const adapter = useMemo(() => getExternalHealthAdapter(), []);
    const canUseHealthImport = role === 'patient' && !isDemo;
    const registryEntries = useMemo(() => {
        const all = buildExternalHealthRegistry(getAllMetricDefinitions(i18n.language));
        return adapter ? getRegistryForPlatform(all, adapter.platform) : [];
    }, [adapter, i18n.language]);
    const defaultMetricIds = useMemo(() => getDefaultExternalHealthMetricIds(registryEntries), [registryEntries]);

    const [availability, setAvailability] = useState<ExternalHealthAvailability>('unsupported_platform');
    const [preferences, setPreferences] = useState<ExternalHealthImportPreferences>({
        enabled: false,
        enabledMetricIds: [],
    });
    const [grantedPermissions, setGrantedPermissions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<ExternalHealthImportProgress | null>(null);
    const cancellationRef = useRef<ExternalHealthCancellation | null>(null);
    const [lastResult, setLastResult] = useState<ExternalHealthImportResult | null>(null);
    const selectedMetricIds = useMemo(() => {
        return resolveSelectedMetricIds(registryEntries, defaultMetricIds, preferences);
    }, [defaultMetricIds, preferences.enabledMetricIds, registryEntries]);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const prefs = await getExternalHealthPreferences();
            setPreferences(prefs);

            if (!adapter || !canUseHealthImport) {
                setAvailability(adapter ? 'not_configured' : 'unsupported_platform');
                setGrantedPermissions([]);
                return;
            }

            const nextAvailability = await adapter.getAvailability();
            setAvailability(nextAvailability);
            if (nextAvailability === 'available') {
                setGrantedPermissions(await adapter.getGrantedPermissions(registryEntries));
            } else {
                setGrantedPermissions([]);
            }
        } finally {
            setIsLoading(false);
        }
    }, [adapter, canUseHealthImport, registryEntries]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const setMetricEnabled = useCallback(async (metricId: string, enabled: boolean) => {
        const nextMetricIds = enabled
            ? Array.from(new Set([...selectedMetricIds, metricId]))
            : selectedMetricIds.filter((id) => id !== metricId);
        const nextPrefs = {
            ...preferences,
            enabled: preferences.enabled && nextMetricIds.length > 0,
            enabledMetricIds: nextMetricIds,
        };
        await setExternalHealthPreferences(nextPrefs);
        setPreferences(nextPrefs);
    }, [preferences, selectedMetricIds]);

    const connect = useCallback(async () => {
        if (!adapter || !canUseHealthImport) {
            throw new Error('health_import_not_available');
        }
        if (selectedMetricIds.length === 0) {
            throw new Error('health_import_no_metrics');
        }

        const nextAvailability = await adapter.getAvailability();
        setAvailability(nextAvailability);
        if (nextAvailability !== 'available') {
            throw new Error(nextAvailability);
        }

        const selectedEntries = registryEntries.filter((entry) => selectedMetricIds.includes(entry.metricId));
        const granted = await adapter.requestPermissions(selectedEntries);
        // Keep every metric the user selected enabled. HealthKit/Health Connect do
        // not reliably report per-type read grants, so we never drop a selection based
        // on a guessed permission status — the import is best-effort and reports back
        // which metrics had no permission (see syncNow). This also fixes multi-type
        // metrics like blood pressure that were previously dropped here.
        const enabledMetricIds = [...selectedMetricIds];
        const nextPrefs = {
            enabled: enabledMetricIds.length > 0,
            enabledMetricIds,
            authorizedReadTypes: granted,
            lastImportedAt: preferences.lastImportedAt,
            lastObservedAtByMetricId: preferences.lastObservedAtByMetricId,
            metricsWithoutPermission: preferences.metricsWithoutPermission,
        };
        await setExternalHealthPreferences(nextPrefs);
        setPreferences(nextPrefs);
        setGrantedPermissions(granted);
    }, [adapter, canUseHealthImport, preferences.lastImportedAt, preferences.lastObservedAtByMetricId, preferences.metricsWithoutPermission, registryEntries, selectedMetricIds]);

    const disconnect = useCallback(async () => {
        const nextPrefs = {
            enabled: false,
            enabledMetricIds: selectedMetricIds,
            authorizedReadTypes: preferences.authorizedReadTypes,
            lastImportedAt: preferences.lastImportedAt,
            lastObservedAtByMetricId: preferences.lastObservedAtByMetricId,
        };
        await setExternalHealthPreferences(nextPrefs);
        setPreferences(nextPrefs);
    }, [preferences.authorizedReadTypes, preferences.lastImportedAt, preferences.lastObservedAtByMetricId, selectedMetricIds]);

    const syncNow = useCallback(async (): Promise<ExternalHealthImportResult> => {
        if (!adapter || !canUseHealthImport || !fhirRepo.activePatientId) {
            throw new Error('health_import_not_available');
        }
        const activePatientId = fhirRepo.activePatientId;
        const cancellation: ExternalHealthCancellation = { cancelled: false };
        cancellationRef.current = cancellation;
        setSyncProgress({ phase: 'reading', completed: 0, total: 0 });
        setIsSyncing(true);
        try {
            const importResult = await runExternalHealthImportExclusive(async () => {
                const activePreferences = await getExternalHealthPreferences();
                if (!activePreferences.enabled) {
                    throw new Error('health_import_disabled');
                }

                const activeSelectedMetricIds = resolveSelectedMetricIds(registryEntries, defaultMetricIds, activePreferences);
                const enabled = registryEntries.filter((entry) => activeSelectedMetricIds.includes(entry.metricId));
                if (enabled.length === 0) {
                    throw new Error('health_import_no_metrics');
                }

                const patientRow = await fhirRepo.get('Patient', activePatientId);
                const lookbackDays = getExternalHealthLookbackDaysFromPatientResource(patientRow?.resource);
                const startDateByMetricId = getStartDateByMetricId(
                    enabled.map((entry) => entry.metricId),
                    activePreferences.lastObservedAtByMetricId,
                    lookbackDays
                );
                // Best-effort read: import everything that is permitted; collect the
                // metrics that yielded no data because of a missing OS permission so we
                // can report them instead of aborting the whole import.
                setSyncProgress({ phase: 'reading', completed: 0, total: enabled.length });
                const { samples: rawSamples, authorizationErrors } = await adapter.readSamples(
                    enabled,
                    lookbackDays,
                    startDateByMetricId,
                    {
                        cancellation,
                        onProgress: (completed, total, metricId) =>
                            setSyncProgress({ phase: 'reading', completed, total, metricId: metricId || undefined }),
                    }
                );
                const preparedSamples = selectExternalHealthSamplesForImport(
                    rawSamples,
                    enabled.map((entry) => entry.definition)
                );
                setSyncProgress({ phase: 'saving', completed: 0, total: preparedSamples.length });
                const result = await importExternalHealthSamples(
                    rawSamples,
                    enabled.map((entry) => entry.definition),
                    {
                        activePatientId,
                        get: fhirRepo.get,
                        upsert: fhirRepo.upsert,
                    },
                    {
                        cancellation,
                        onProgress: (completed, total) =>
                            setSyncProgress({ phase: 'saving', completed, total }),
                    }
                );
                result.cancelled = result.cancelled || cancellation.cancelled;
                const rawSampleCountByMetricId = countSamplesByMetricId(rawSamples);
                const processedSampleCountByMetricId = countSamplesByMetricId(preparedSamples);
                const diagnostics = {
                    lookbackDays,
                    requestedMetricIds: enabled.map((entry) => entry.metricId),
                    rawSampleCount: rawSamples.length,
                    rawSampleCountByMetricId,
                    processedSampleCount: preparedSamples.length,
                    processedSampleCountByMetricId,
                };
                result.diagnostics = diagnostics;
                // A metric counts as "without permission" if it hit an authorization
                // error and produced no samples at all. Metrics that returned data are
                // never flagged, even if one of several read types failed.
                const metricsWithoutPermission = Array.from(new Set(
                    authorizationErrors
                        .map((authorizationError) => authorizationError.metricId)
                        .filter((metricId) => (rawSampleCountByMetricId[metricId] ?? 0) === 0)
                )).sort();
                result.metricsWithoutPermission = metricsWithoutPermission;
                const nextPrefs = {
                    ...activePreferences,
                    enabledMetricIds: activeSelectedMetricIds,
                    lastImportedAt: new Date().toISOString(),
                    lastObservedAtByMetricId: mergeLastObservedAtByMetricId(
                        activePreferences.lastObservedAtByMetricId,
                        rawSamples
                    ),
                    metricsWithoutPermission: metricsWithoutPermission.length > 0 ? metricsWithoutPermission : undefined,
                };
                await setExternalHealthPreferences(nextPrefs);
                setPreferences(nextPrefs);
                setLastResult(result);

                if (syncEnabled && (result.imported > 0 || result.updated > 0)) {
                    fullSync('external health import').catch(() => undefined);
                }

                return result;
            });
            setLastResult(importResult);
            setPreferences(await getExternalHealthPreferences());
            return importResult;
        } finally {
            setIsSyncing(false);
            setSyncProgress(null);
            cancellationRef.current = null;
        }
    }, [adapter, canUseHealthImport, defaultMetricIds, fhirRepo.activePatientId, fhirRepo.get, fhirRepo.upsert, fullSync, registryEntries, syncEnabled]);

    const cancelSync = useCallback(() => {
        if (cancellationRef.current) {
            cancellationRef.current.cancelled = true;
        }
    }, []);

    return {
        canUseHealthImport,
        availability,
        preferences,
        registryEntries,
        selectedMetricIds,
        grantedPermissions,
        isLoading,
        isSyncing,
        syncProgress,
        lastResult,
        refresh,
        setMetricEnabled,
        connect,
        disconnect,
        syncNow,
        cancelSync,
    };
}

function countSamplesByMetricId(samples: Array<{ metricId: string }>): Record<string, number> {
    return samples.reduce<Record<string, number>>((counts, sample) => {
        counts[sample.metricId] = (counts[sample.metricId] ?? 0) + 1;
        return counts;
    }, {});
}

function resolveSelectedMetricIds(
    registryEntries: ExternalHealthRegistryEntry[],
    defaultMetricIds: string[],
    preferences: ExternalHealthImportPreferences
): string[] {
    const available = new Set(registryEntries.map((entry) => entry.metricId));
    const configured = preferences.enabledMetricIds.length > 0 ? preferences.enabledMetricIds : defaultMetricIds;
    return configured.filter((metricId) => available.has(metricId));
}

function getStartDateByMetricId(
    metricIds: string[],
    lastObservedAtByMetricId: Record<string, string> | undefined,
    lookbackDays: number,
    now = new Date()
): Record<string, string> | undefined {
    const baseStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const result: Record<string, string> = {};

    for (const metricId of metricIds) {
        const lastObservedAt = parseDate(lastObservedAtByMetricId?.[metricId]);
        if (!lastObservedAt) continue;

        const cursorStart = new Date(lastObservedAt.getTime() - EXTERNAL_HEALTH_CURSOR_OVERLAP_DAYS * 24 * 60 * 60 * 1000);
        if (cursorStart.getTime() > baseStart.getTime()) {
            result[metricId] = cursorStart.toISOString();
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

function mergeLastObservedAtByMetricId(
    previous: Record<string, string> | undefined,
    samples: Array<{ metricId: string; observedAt: Date }>
): Record<string, string> | undefined {
    const result: Record<string, string> = { ...(previous ?? {}) };

    for (const sample of samples) {
        const existing = parseDate(result[sample.metricId]);
        if (!existing || sample.observedAt.getTime() > existing.getTime()) {
            result[sample.metricId] = sample.observedAt.toISOString();
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

function parseDate(value: string | undefined): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}
