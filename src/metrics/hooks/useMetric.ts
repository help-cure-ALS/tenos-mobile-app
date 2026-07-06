/**
 * useMetric Hook
 *
 * Main hook for working with metric data.
 * Provides CRUD operations and computed values for a specific metric.
 * Data is persisted via FHIR and synchronized across devices.
 *
 * Uses activePatientId from AppRoleProvider via useFhirRepo,
 * so it works correctly for all roles (patient, caregiver, doctor).
 *
 * PERFORMANCE: Uses a shared cache to avoid multiple DB queries when
 * multiple useMetric hooks are rendered (e.g., on the overview page).
 */

import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppSync } from '@/src/context/AppSyncProvider';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { emit, on } from '@/src/lib/bus';

import { getMetricDefinition } from '../definitions';
import {
    fhirToMetricEntry,
    metricEntryToFhir,
    validateMetricValues,
} from '../fhir/metricToFhir';
import type { MetricDefinition, MetricEntry, MetricWithData } from '../types';
import {
    convertMetricDelta,
    convertMetricValues,
    createDisplayDefinition,
    deriveMeasurementSystemFromCountry,
    getDisplayUnit,
    toDisplayEntry,
} from '../units';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { getMetricSummaryFromCache, loadFullEntries, invalidateCache, onCacheUpdate } from './observationsCache';

// =============================================================================
// Types
// =============================================================================

/** Hook options */
type UseMetricOptions = {
    /** Metric ID to load */
    metricId: string;
    /**
     * Loading mode:
     * - 'latest': Only loads the 2 most recent entries (fast, for cards/overview)
     * - 'full': Loads all entries (for detail views, charts, history)
     * Default: 'latest'
     */
    mode?: 'latest' | 'full';
};

/** Hook return type */
type UseMetricReturn = {
    /** Metric definition */
    definition: MetricDefinition | undefined;
    /** All entries for this metric */
    entries: MetricEntry[];
    /** Total number of entries for this metric */
    entryCount: number;
    /** Most recent entry */
    latestEntry: MetricEntry | null;
    /** Loading state */
    isLoading: boolean;
    /** Error state */
    error: Error | null;
    /** User's preferred unit for this metric */
    preferredUnit: string | null;
    /** Effective unit currently used for display/input. */
    displayUnit: string | null;
    /** Metric definition adjusted for display/input unit. */
    displayDefinition: MetricDefinition | undefined;
    /** Entries converted to display unit. */
    displayEntries: MetricEntry[];
    /** Latest entry converted to display unit. */
    latestDisplayEntry: MetricEntry | null;
    /** Set the user's preferred unit */
    setUnitPreference: (unit: string) => Promise<void>;
    /** Get a single entry by ID */
    getEntry: (id: string) => Promise<MetricEntry | null>;
    /** Add a new entry */
    addEntry: (
        values: Record<string, number>,
        unit?: string,
        date?: Date
    ) => Promise<void>;
    /** Update an existing entry */
    updateEntry: (
        id: string,
        values: Record<string, number>,
        unit?: string
    ) => Promise<void>;
    /** Delete an entry */
    deleteEntry: (id: string) => Promise<void>;
    /** Validate values before submission */
    validate: (
        values: Record<string, number>,
        unit?: string
    ) => { valid: boolean; errors: Record<string, string> };
    /** Refresh data */
    refresh: () => Promise<void>;
    /** Computed statistics */
    stats: MetricStats | null;
    /** Computed statistics converted to display unit. */
    displayStats: MetricStats | null;
};

/** Computed statistics for a metric */
type MetricStats = {
    /** Number of entries */
    count: number;
    /** Average value (for single-value metrics) */
    average: number | null;
    /** Minimum value */
    min: number | null;
    /** Maximum value */
    max: number | null;
    /** Trend direction */
    trend: 'up' | 'down' | 'stable' | null;
    /** Change from previous entry */
    changeFromPrevious: number | null;
    /** Percentage change from previous */
    percentChangeFromPrevious: number | null;
};

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for working with a specific metric
 */
export function useMetric({ metricId, mode = 'latest' }: UseMetricOptions): UseMetricReturn {
    const { i18n, t } = useTranslation();
    const { syncEnabled, fullSync } = useAppSync();
    const { patientPreferencesStore: prefsStore } = usePatientStores();
    const fhirRepo = useFhirRepo();
    const { list, count, upsert, markDeleted, get, activePatientId } = fhirRepo;

    const [entries, setEntries] = useState<MetricEntry[]>([]);
    const [entryCount, setEntryCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [preferredUnit, setPreferredUnit] = useState<string | null>(null);

    const definition = useMemo(
        () => getMetricDefinition(metricId, i18n.language),
        [metricId, i18n.language]
    );

    // Load entries: cache for 'latest' mode, direct query for 'full' mode.
    // No stale-load guard needed — PatientProvider key={activePatientId}
    // remounts this hook on patient switch, so closures are always fresh.
    const loadEntries = useCallback(async () => {
        if (!definition || !activePatientId) {
            setEntries([]);
            setEntryCount(0);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            let loaded: MetricEntry[];
            if (mode === 'latest') {
                const summary = await getMetricSummaryFromCache(metricId, activePatientId, list, count);
                loaded = summary.entries;
                setEntryCount(summary.count);
            } else {
                loaded = await loadFullEntries(metricId, list);
                setEntryCount(loaded.length);
            }
            setEntries(loaded);
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            setError(err);
            console.error('useMetric loadEntries error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [definition, list, count, metricId, activePatientId, mode]);

    // Load unit preference from PatientPreferencesStore
    const loadUnitPreference = useCallback(async () => {
        if (!definition) {
            setPreferredUnit(null);
            return;
        }

        try {
            if (!prefsStore) {
                setPreferredUnit(definition.defaultUnit);
                return;
            }
            const prefs = await prefsStore.getAll();
            const unit = prefs.metrics[metricId]?.unit;
            const measurementSystemPref = prefs.measurementSystem;
            const patientRow = activePatientId ? await get('Patient', activePatientId) : undefined;
            const patientCountry = (patientRow?.resource as any)?.address?.[0]?.country;
            const measurementSystem = measurementSystemPref && measurementSystemPref !== 'auto'
                ? measurementSystemPref
                : deriveMeasurementSystemFromCountry(patientCountry);

            setPreferredUnit(getDisplayUnit(definition, unit, measurementSystem));
        } catch (e) {
            console.error('useMetric loadUnitPreference error:', e);
            setPreferredUnit(definition.defaultUnit);
        }
    }, [metricId, definition, prefsStore, activePatientId, get]);

    // Set unit preference via PatientPreferencesStore
    const setUnitPreference = useCallback(
        async (unit: string) => {
            if (!definition || !prefsStore) return;

            try {
                await prefsStore.setUnit(metricId, unit);
                setPreferredUnit(unit);
                emit('preferences:changed');
            } catch (e) {
                const err = e instanceof Error ? e : new Error(String(e));
                setError(err);
                console.error('useMetric setUnitPreference error:', e);
                throw err;
            }
        },
        [metricId, definition, prefsStore]
    );

    // Initial load and subscribe to changes
    useEffect(() => {
        loadEntries();
        loadUnitPreference();

        // Subscribe to cache invalidation
        const offCache = onCacheUpdate(() => {
            loadEntries();
            loadUnitPreference();
        });
        const offPrefs = on('preferences:changed', () => {
            loadUnitPreference();
        });

        return () => {
            offCache();
            offPrefs();
        };
    }, [loadEntries, loadUnitPreference]);

    // Sort entries by date (newest first)
    const sortedEntries = useMemo(
        () =>
            [...entries].sort(
                (a, b) => b.date.getTime() - a.date.getTime()
            ),
        [entries]
    );

    const latestEntry = useMemo(
        () => (sortedEntries.length > 0 ? sortedEntries[0] : null),
        [sortedEntries]
    );

    const displayUnit = preferredUnit ?? definition?.defaultUnit ?? null;

    const displayDefinition = useMemo(
        () => definition && displayUnit
            ? createDisplayDefinition(definition, displayUnit)
            : definition,
        [definition, displayUnit]
    );

    const displayEntries = useMemo(
        () => definition && displayUnit
            ? sortedEntries.map((entry) => toDisplayEntry(entry, definition, displayUnit))
            : sortedEntries,
        [definition, displayUnit, sortedEntries]
    );

    const latestDisplayEntry = useMemo(
        () => (displayEntries.length > 0 ? displayEntries[0] : null),
        [displayEntries]
    );

    // Compute statistics
    const stats = useMemo((): MetricStats | null => {
        if (!definition || entries.length === 0) return null;

        const primaryField = definition.fields[0];
        const values = entries
            .map((e) => e.values[primaryField.key])
            .filter((v) => v !== undefined && v !== null);

        if (values.length === 0) return null;

        // In 'latest' mode we only have 2 entries — min/max/avg aren't meaningful
        const isFullMode = mode === 'full';
        const sum = isFullMode ? values.reduce((a, b) => a + b, 0) : 0;
        const average = isFullMode ? sum / values.length : null;
        const min = isFullMode ? Math.min(...values) : null;
        const max = isFullMode ? Math.max(...values) : null;

        // Trend only needs the last 2 entries — works in both modes
        let trend: MetricStats['trend'] = null;
        let changeFromPrevious: number | null = null;
        let percentChangeFromPrevious: number | null = null;

        if (sortedEntries.length >= 2) {
            const current = sortedEntries[0].values[primaryField.key];
            const previous = sortedEntries[1].values[primaryField.key];

            if (current !== undefined && previous !== undefined) {
                changeFromPrevious = current - previous;
                percentChangeFromPrevious =
                    previous !== 0
                        ? (changeFromPrevious / previous) * 100
                        : null;

                const changePercent = Math.abs(percentChangeFromPrevious ?? 0);
                if (changePercent < 1) {
                    trend = 'stable';
                } else {
                    trend = changeFromPrevious > 0 ? 'up' : 'down';
                }
            }
        }

        return {
            count: entryCount,
            average,
            min,
            max,
            trend,
            changeFromPrevious,
            percentChangeFromPrevious,
        };
    }, [definition, entries, entryCount, sortedEntries, mode]);

    const displayStats = useMemo((): MetricStats | null => {
        if (!stats || !definition || !displayUnit) return stats;
        if (displayUnit === definition.defaultUnit) return stats;

        const convertStat = (value: number | null) => {
            if (value === null) return null;
            return convertMetricValues({ value }, definition.defaultUnit, displayUnit, definition).value;
        };
        const convertChange = (value: number | null) => {
            if (value === null) return null;
            return convertMetricDelta(value, definition.defaultUnit, displayUnit, definition);
        };

        return {
            ...stats,
            average: convertStat(stats.average),
            min: convertStat(stats.min),
            max: convertStat(stats.max),
            changeFromPrevious: convertChange(stats.changeFromPrevious),
        };
    }, [stats, definition, displayUnit]);

    // Validate values
    const validate = useCallback(
        (values: Record<string, number>, unit?: string) => {
            if (!definition) {
                return {
                    valid: false,
                    errors: { _form: t('metric.metricNotFound') },
                };
            }
            const canonicalValues = convertMetricValues(
                values,
                unit ?? displayUnit ?? definition.defaultUnit,
                definition.defaultUnit,
                definition
            );
            const canonicalValidation = validateMetricValues(canonicalValues, definition);
            if (canonicalValidation.valid) return canonicalValidation;

            const validationUnit = unit ?? displayUnit ?? definition.defaultUnit;
            const validationDefinition = createDisplayDefinition(definition, validationUnit);
            return validateMetricValues(values, validationDefinition);
        },
        [definition, displayUnit, t]
    );

    // Get a single entry by ID
    const getEntry = useCallback(
        async (id: string): Promise<MetricEntry | null> => {
            if (!definition || !activePatientId) {
                return null;
            }

            try {
                const result = await get('Observation', id);

                if (!result?.resource || result.deleted) {
                    return null;
                }

                return fhirToMetricEntry(result.resource, definition);
            } catch (e) {
                console.error('useMetric getEntry error:', e);
                return null;
            }
        },
        [definition, get, activePatientId]
    );

    // Add a new entry
    const addEntry = useCallback(
        async (
            values: Record<string, number>,
            unit?: string,
            date?: Date
        ) => {
            if (!activePatientId) {
                throw new Error(t('metric.noPatientSelected'));
            }
            if (!definition) {
                throw new Error(t('metric.metricNotFound'));
            }

            const finalUnit = unit ?? preferredUnit ?? definition.defaultUnit;
            const canonicalValues = convertMetricValues(values, finalUnit, definition.defaultUnit, definition);
            const validation = validateMetricValues(canonicalValues, definition);
            if (!validation.valid) {
                throw new Error(Object.values(validation.errors).join(', '));
            }

            try {
                const id = Crypto.randomUUID();

                const entry: MetricEntry = {
                    id,
                    values: canonicalValues,
                    date: date ?? new Date(),
                    unit: definition.defaultUnit,
                    source: 'app',
                    addedAt: new Date(),
                };

                const fhir = metricEntryToFhir(
                    entry,
                    definition,
                    `Patient/${activePatientId}`
                );

                await upsert('Observation', id, fhir, fhir.meta?.lastUpdated);

                // Notify other listeners about the change (also invalidates cache)
                emit('fhir:changed');

                // Sync in background (don't block UI)
                if (syncEnabled) {
                    fullSync('metric add').catch(console.error);
                }
            } catch (e) {
                const err = e instanceof Error ? e : new Error(String(e));
                setError(err);
                console.error('useMetric addEntry error:', e);
                throw err;
            }
        },
        [activePatientId, definition, preferredUnit, upsert, syncEnabled, fullSync, t]
    );

    // Update an existing entry
    const updateEntry = useCallback(
        async (id: string, values: Record<string, number>, unit?: string) => {
            if (!activePatientId) {
                throw new Error(t('metric.noPatientSelected'));
            }
            if (!definition) {
                throw new Error(t('metric.metricNotFound'));
            }

            const finalUnit = unit ?? preferredUnit ?? definition.defaultUnit;
            const canonicalValues = convertMetricValues(values, finalUnit, definition.defaultUnit, definition);
            const validation = validateMetricValues(canonicalValues, definition);
            if (!validation.valid) {
                throw new Error(Object.values(validation.errors).join(', '));
            }

            // Find existing entry to preserve date and unit
            const existing = entries.find((e) => e.id === id);
            if (!existing) {
                throw new Error('Eintrag nicht gefunden');
            }

            try {
                const entry: MetricEntry = {
                    id,
                    values: canonicalValues,
                    date: existing.date,
                    unit: definition.defaultUnit,
                    source: existing.source,
                    externalHealth: existing.externalHealth,
                    addedAt: existing.addedAt,
                };

                const fhir = metricEntryToFhir(
                    entry,
                    definition,
                    `Patient/${activePatientId}`
                );

                await upsert('Observation', id, fhir, fhir.meta?.lastUpdated);

                // Notify other listeners about the change (also invalidates cache)
                emit('fhir:changed');

                // Sync in background (don't block UI)
                if (syncEnabled) {
                    fullSync('metric update').catch(console.error);
                }
            } catch (e) {
                const err = e instanceof Error ? e : new Error(String(e));
                setError(err);
                console.error('useMetric updateEntry error:', e);
                throw err;
            }
        },
        [activePatientId, definition, preferredUnit, entries, upsert, syncEnabled, fullSync, t]
    );

    // Delete an entry
    const deleteEntry = useCallback(
        async (id: string) => {
            try {
                await markDeleted('Observation', id);

                // Notify other listeners about the change (also invalidates cache)
                emit('fhir:changed');

                // Sync in background (don't block UI)
                if (syncEnabled) {
                    fullSync('metric delete').catch(console.error);
                }
            } catch (e) {
                const err = e instanceof Error ? e : new Error(String(e));
                setError(err);
                console.error('useMetric deleteEntry error:', e);
                throw err;
            }
        },
        [markDeleted, syncEnabled, fullSync]
    );

    // Refresh data
    const refresh = useCallback(async () => {
        invalidateCache(); // Force reload
        await loadEntries();
        await loadUnitPreference();
    }, [loadEntries, loadUnitPreference]);

    return {
        definition,
        entries: sortedEntries,
        entryCount,
        latestEntry,
        isLoading,
        error,
        preferredUnit,
        displayUnit,
        displayDefinition,
        displayEntries,
        latestDisplayEntry,
        setUnitPreference,
        getEntry,
        addEntry,
        updateEntry,
        deleteEntry,
        validate,
        refresh,
        stats,
        displayStats,
    };
}

/**
 * Hook to get metric with data (compatible with MetricWithData type)
 */
export function useMetricWithData(metricId: string): MetricWithData | null {
    const { definition, entries, latestEntry } = useMetric({ metricId, mode: 'full' });

    if (!definition) return null;

    return {
        definition,
        entries,
        latestEntry,
    };
}
