/**
 * Shared Observations Cache
 *
 * Single shared cache for all metric data. Pre-warmed on startup
 * so the Home Screen doesn't wait for decryption.
 *
 * Uses per-metric SQL queries with metric_tag filter instead of
 * loading all Observations in one bulk query. This reduces decryptions
 * from ~1000 to ~64 (32 metrics × 2 entries each).
 *
 * Extracted into its own module to avoid require cycles
 * (useMetric → useFhirRepo → useMetric).
 */
import { on } from '@/src/lib/bus';
import { getAllMetricDefinitions, getMetricDefinition } from '../definitions';
import { fhirToMetricEntry } from '../fhir/metricToFhir';
import type { MetricEntry } from '../types';

export type ListFn = (
    resourceType?: string,
    opts?: {
        includeDeleted?: boolean;
        limit?: number;
        tag?: string;
        metricTag?: string;
        orderBy?: 'updated_at' | 'effective_date';
    }
) => Promise<Array<{ resource: any; updated_at: string; deleted: boolean }>>;

export type CountFn = (
    resourceType?: string,
    opts?: { includeDeleted?: boolean; tag?: string; metricTag?: string }
) => Promise<number>;

export type MetricEntriesSummary = {
    entries: MetricEntry[];
    count: number;
};

/** Cache structure: metricId -> entries (for the active patient) */
let observationsCache: Map<string, MetricEntriesSummary> | null = null;

/** Promise for ongoing cache load (to prevent duplicate loads) */
let cacheLoadPromise: Promise<void> | null = null;

/** Patient ID the cache was loaded for */
let cachePatientId: string | null = null;

/** Listeners waiting for cache update */
const cacheListeners = new Set<() => void>();

/**
 * Invalidate the cache (called on fhir:changed)
 */
export function invalidateCache() {
    observationsCache = null;
    cacheLoadPromise = null;
    cachePatientId = null;
    cacheListeners.forEach(listener => listener());
}

// Subscribe to fhir:changed to invalidate cache.
// No patient:switched listener needed — PatientProvider key={activePatientId}
// remounts all consumers, so the cache is naturally rebuilt for the new patient.
on('fhir:changed', invalidateCache);

/**
 * Load latest 2 observations per metric using per-metric SQL queries.
 * 32 parallel queries × limit 2 = ~64 decryptions total.
 */
async function loadObservationsCache(
    patientId: string,
    listFn: ListFn,
    countFn: CountFn
): Promise<Map<string, MetricEntriesSummary>> {
    const allDefinitions = getAllMetricDefinitions();
    const grouped = new Map<string, MetricEntriesSummary>();

    await Promise.all(allDefinitions.map(async (def) => {
        const metricTag = `${def.fhir.code.system}|${def.fhir.code.code}`;
        const [results, count] = await Promise.all([
            listFn('Observation', {
                includeDeleted: false,
                limit: 2,
                metricTag,
                orderBy: 'effective_date',
            }),
            countFn('Observation', {
                includeDeleted: false,
                metricTag,
            }),
        ]);

        const entries: MetricEntry[] = [];
        for (const { resource } of results) {
            const entry = fhirToMetricEntry(resource, def);
            if (entry) entries.push(entry);
        }
        grouped.set(def.id, {
            entries: entries.sort((a, b) => b.date.getTime() - a.date.getTime()),
            count,
        });
    }));

    return grouped;
}

/**
 * Pre-load the observations cache for a patient.
 * Call early (e.g. in useFhirRepo) so the cache is warm when Home Screen mounts.
 */
export function preloadObservationsCache(patientId: string, listFn: ListFn, countFn: CountFn): void {
    if (observationsCache && cachePatientId === patientId) return;
    if (cacheLoadPromise && cachePatientId === patientId) return;

    cachePatientId = patientId;
    cacheLoadPromise = loadObservationsCache(patientId, listFn, countFn).then(cache => {
        if (cachePatientId === patientId) {
            observationsCache = cache;
        }
    });
}

/**
 * Get entries for a specific metric from cache.
 * Loads cache if needed.
 */
export async function getEntriesFromCache(
    metricId: string,
    patientId: string,
    listFn: ListFn,
    countFn: CountFn
): Promise<MetricEntry[]> {
    const summary = await getMetricSummaryFromCache(metricId, patientId, listFn, countFn);
    return summary.entries;
}

/**
 * Get latest entries and total count for a specific metric from cache.
 */
export async function getMetricSummaryFromCache(
    metricId: string,
    patientId: string,
    listFn: ListFn,
    countFn: CountFn
): Promise<MetricEntriesSummary> {
    if (observationsCache && cachePatientId === patientId) {
        return observationsCache.get(metricId) ?? { entries: [], count: 0 };
    }

    if (cacheLoadPromise && cachePatientId === patientId) {
        await cacheLoadPromise;
        return observationsCache?.get(metricId) ?? { entries: [], count: 0 };
    }

    cachePatientId = patientId;
    cacheLoadPromise = loadObservationsCache(patientId, listFn, countFn).then(cache => {
        if (cachePatientId === patientId) {
            observationsCache = cache;
        }
    });

    await cacheLoadPromise;
    return observationsCache?.get(metricId) ?? { entries: [], count: 0 };
}

/**
 * Load all entries for a single metric (for detail views / charts).
 * Direct query, not cached.
 */
export async function loadFullEntries(
    metricId: string,
    listFn: ListFn
): Promise<MetricEntry[]> {
    const def = getMetricDefinition(metricId);
    if (!def) return [];

    const metricTag = `${def.fhir.code.system}|${def.fhir.code.code}`;
    const results = await listFn('Observation', {
        includeDeleted: false,
        limit: 5000,
        metricTag,
        orderBy: 'effective_date',
    });

    return results
        .map(r => fhirToMetricEntry(r.resource, def))
        .filter((e): e is MetricEntry => e !== null);
}

/**
 * Subscribe to cache updates
 */
export function onCacheUpdate(listener: () => void): () => void {
    cacheListeners.add(listener);
    return () => cacheListeners.delete(listener);
}
