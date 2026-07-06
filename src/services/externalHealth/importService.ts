import {
    EXTERNAL_HEALTH_SOURCE_URL,
    metricEntryToFhir,
    validateMetricValues,
} from '../../metrics/fhir/metricToFhir';
import { convertMetricValues } from '../../metrics/units';
import type { MetricDefinition, MetricEntry } from '../../metrics/types';

import { buildExternalHealthObservationId } from './dedupe';
import type {
    ExternalHealthImportOptions,
    ExternalHealthImportResult,
    ExternalHealthRawSample,
} from './types';

const RECORDED_BY_ROLE_URL = 'urn:medical-sync-vault:recorded-by-role';

type ImportDeps = {
    activePatientId: string;
    get(resourceType: string, id: string): Promise<{ resource: any; deleted: boolean; updated_at: string } | null>;
    upsert(resourceType: string, id: string, resource: any, updatedAt?: string, tag?: string | null): Promise<void>;
};

export async function importExternalHealthSamples(
    samples: ExternalHealthRawSample[],
    definitions: MetricDefinition[],
    deps: ImportDeps,
    options?: ExternalHealthImportOptions
): Promise<ExternalHealthImportResult> {
    const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
    const result: ExternalHealthImportResult = { imported: 0, updated: 0, unchanged: 0, thinned: 0, skipped: 0, errors: [] };
    const preparedSamples = selectExternalHealthSamplesForImport(samples, definitions);
    result.thinned = samples.length - preparedSamples.length;

    const saveTotal = preparedSamples.length;
    let processed = 0;
    const PROGRESS_INTERVAL = 25;
    for (const sample of preparedSamples) {
        if (options?.cancellation?.cancelled) {
            result.cancelled = true;
            break;
        }
        if (processed % PROGRESS_INTERVAL === 0) {
            options?.onProgress?.(processed, saveTotal);
        }
        processed += 1;
        const definition = definitionsById.get(sample.metricId);
        if (!definition) {
            result.skipped += 1;
            continue;
        }

        try {
            const id = buildExternalHealthObservationId(sample);
            const existing = await deps.get('Observation', id);
            if (existing?.deleted) {
                result.skipped += 1;
                continue;
            }
            if (existing?.resource && !isExternalHealthObservation(existing.resource)) {
                result.skipped += 1;
                result.errors.push(`Skipped ${sample.metricId}: local resource ID collision`);
                continue;
            }

            const canonicalValues = convertMetricValues(
                sample.values,
                sample.unit,
                definition.defaultUnit,
                definition
            );
            const validation = validateMetricValues(canonicalValues, definition);
            if (!validation.valid) {
                result.skipped += 1;
                result.errors.push(`Skipped ${sample.metricId}: ${Object.values(validation.errors).join(', ')}`);
                continue;
            }

            const entry: MetricEntry = {
                id,
                values: canonicalValues,
                date: sample.observedAt,
                unit: definition.defaultUnit,
                source: sample.sourceLabel,
                addedAt: existing?.resource ? parseAddedAt(existing.resource) ?? new Date() : new Date(),
                externalHealth: {
                    platform: sample.platform,
                    externalId: sample.externalId,
                    sourceApp: sample.sourceApp,
                    deviceName: sample.deviceName,
                    importedAt: new Date().toISOString(),
                    adapterVersion: 'v1',
                },
            };

            const fhir = metricEntryToFhir(entry, definition, `Patient/${deps.activePatientId}`);
            if (existing?.resource && isSameExternalHealthObservation(existing.resource, fhir)) {
                result.unchanged += 1;
                continue;
            }

            await deps.upsert('Observation', id, fhir, fhir.meta?.lastUpdated);
            if (existing?.resource) {
                result.updated += 1;
            } else {
                result.imported += 1;
            }
        } catch (error) {
            result.skipped += 1;
            result.errors.push(error instanceof Error ? error.message : String(error));
        }
    }

    options?.onProgress?.(processed, saveTotal);
    return result;
}

export function selectExternalHealthSamplesForImport(
    samples: ExternalHealthRawSample[],
    definitions: MetricDefinition[]
): ExternalHealthRawSample[] {
    const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
    const samplesByMetricId = new Map<string, ExternalHealthRawSample[]>();
    for (const sample of samples) {
        const existing = samplesByMetricId.get(sample.metricId);
        if (existing) {
            existing.push(sample);
        } else {
            samplesByMetricId.set(sample.metricId, [sample]);
        }
    }

    const selected: ExternalHealthRawSample[] = [];
    for (const [metricId, metricSamples] of samplesByMetricId.entries()) {
        const definition = definitionsById.get(metricId);
        const policy = definition?.externalHealth?.importPolicy ?? {
            mode: definition?.externalHealth?.aggregation === 'latest' ? 'latest' : 'all',
        };

        if (policy.mode === 'latest') {
            const latest = maxByObservedAt(metricSamples);
            if (latest) selected.push(latest);
            continue;
        }

        if (policy.mode === 'daily-latest') {
            for (const daySamples of groupByLocalDay(metricSamples).values()) {
                const latest = maxByObservedAt(daySamples);
                if (latest) selected.push(latest);
            }
            continue;
        }

        if (policy.mode === 'daily-first-and-last') {
            for (const daySamples of groupByLocalDay(metricSamples).values()) {
                const sorted = [...daySamples].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
                const first = sorted[0];
                const last = sorted[sorted.length - 1];
                if (first) selected.push(first);
                if (last && last !== first) selected.push(last);
            }
            continue;
        }

        if (policy.mode === 'daily-sum') {
            for (const [dayKey, daySamples] of groupByLocalDay(metricSamples)) {
                const summed = sumDailySamples(metricId, dayKey, daySamples);
                if (summed) selected.push(summed);
            }
            continue;
        }

        if (policy.mode === 'daily-average') {
            for (const [dayKey, daySamples] of groupByLocalDay(metricSamples)) {
                const averaged = averageDailySamples(metricId, dayKey, daySamples);
                if (averaged) selected.push(averaged);
            }
            continue;
        }

        selected.push(...metricSamples);
    }

    return selected.sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
}

/**
 * Condense one local day of cumulative samples (e.g. dietary energy/water increments)
 * into a single daily total. Uses a stable per-day external id so re-importing the same
 * day deduplicates instead of creating duplicate observations.
 */
function sumDailySamples(
    metricId: string,
    dayKey: string,
    daySamples: ExternalHealthRawSample[]
): ExternalHealthRawSample | undefined {
    const representative = maxByObservedAt(daySamples);
    if (!representative) return undefined;

    const values: Record<string, number> = {};
    for (const sample of daySamples) {
        for (const [field, value] of Object.entries(sample.values)) {
            if (!Number.isFinite(value)) continue;
            values[field] = (values[field] ?? 0) + value;
        }
    }
    if (Object.keys(values).length === 0) return undefined;

    return {
        platform: representative.platform,
        metricId,
        observedAt: representative.observedAt,
        values,
        unit: representative.unit,
        sourceLabel: representative.sourceLabel,
        externalId: `daily-sum:${metricId}:${dayKey}`,
        sourceApp: representative.sourceApp,
    };
}

/**
 * Condense one local day of rate-like samples (e.g. respiratory rate, walking speed)
 * into the daily mean. Stable per-day external id keeps re-imports idempotent.
 */
function averageDailySamples(
    metricId: string,
    dayKey: string,
    daySamples: ExternalHealthRawSample[]
): ExternalHealthRawSample | undefined {
    const representative = maxByObservedAt(daySamples);
    if (!representative) return undefined;

    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const sample of daySamples) {
        for (const [field, value] of Object.entries(sample.values)) {
            if (!Number.isFinite(value)) continue;
            sums[field] = (sums[field] ?? 0) + value;
            counts[field] = (counts[field] ?? 0) + 1;
        }
    }

    const values: Record<string, number> = {};
    for (const field of Object.keys(sums)) {
        if (counts[field] > 0) values[field] = sums[field] / counts[field];
    }
    if (Object.keys(values).length === 0) return undefined;

    return {
        platform: representative.platform,
        metricId,
        observedAt: representative.observedAt,
        values,
        unit: representative.unit,
        sourceLabel: representative.sourceLabel,
        externalId: `daily-avg:${metricId}:${dayKey}`,
        sourceApp: representative.sourceApp,
    };
}

function groupByLocalDay(samples: ExternalHealthRawSample[]): Map<string, ExternalHealthRawSample[]> {
    const groups = new Map<string, ExternalHealthRawSample[]>();
    for (const sample of samples) {
        const key = [
            sample.observedAt.getFullYear(),
            String(sample.observedAt.getMonth() + 1).padStart(2, '0'),
            String(sample.observedAt.getDate()).padStart(2, '0'),
        ].join('-');
        const existing = groups.get(key);
        if (existing) {
            existing.push(sample);
        } else {
            groups.set(key, [sample]);
        }
    }
    return groups;
}

function maxByObservedAt(samples: ExternalHealthRawSample[]): ExternalHealthRawSample | undefined {
    return samples.reduce<ExternalHealthRawSample | undefined>((latest, sample) => {
        if (!latest || sample.observedAt.getTime() > latest.observedAt.getTime()) {
            return sample;
        }
        return latest;
    }, undefined);
}

function isExternalHealthObservation(resource: any): boolean {
    const extensions = resource?.meta?.extension;
    if (!Array.isArray(extensions)) return false;
    return extensions.some((extension: any) => extension?.url === EXTERNAL_HEALTH_SOURCE_URL);
}

function parseAddedAt(resource: any): Date | undefined {
    const extensions = resource?.meta?.extension;
    if (!Array.isArray(extensions)) return undefined;
    const raw = extensions.find((extension: any) => extension?.url === 'http://example.org/fhir/StructureDefinition/added-at')?.valueDateTime;
    return raw ? new Date(raw) : undefined;
}

function isSameExternalHealthObservation(existing: any, candidate: any): boolean {
    return stableStringify(normalizeExternalObservationForComparison(existing)) ===
        stableStringify(normalizeExternalObservationForComparison(candidate));
}

function normalizeExternalObservationForComparison(resource: any): any {
    const clone = deepClone(resource);
    if (clone?.meta) {
        delete clone.meta.lastUpdated;
        if (Array.isArray(clone.meta.extension)) {
            clone.meta.extension = clone.meta.extension
                .filter((extension: any) => extension?.url !== RECORDED_BY_ROLE_URL)
                .map(normalizeMetaExtensionForComparison)
                .sort((a: any, b: any) => String(a.url).localeCompare(String(b.url)));
        }
    }
    return clone;
}

function normalizeMetaExtensionForComparison(extension: any): any {
    if (extension?.url !== EXTERNAL_HEALTH_SOURCE_URL || typeof extension.valueString !== 'string') {
        return extension;
    }

    try {
        const parsed = JSON.parse(extension.valueString);
        delete parsed.importedAt;
        return {
            ...extension,
            valueString: stableStringify(parsed),
        };
    } catch {
        return extension;
    }
}

function deepClone(value: any): any {
    return JSON.parse(JSON.stringify(value));
}

function stableStringify(value: any): string {
    return JSON.stringify(sortObject(value));
}

function sortObject(value: any): any {
    if (Array.isArray(value)) {
        return value.map(sortObject);
    }
    if (!value || typeof value !== 'object') {
        return value;
    }

    return Object.keys(value)
        .sort()
        .reduce<Record<string, any>>((acc, key) => {
            acc[key] = sortObject(value[key]);
            return acc;
        }, {});
}
