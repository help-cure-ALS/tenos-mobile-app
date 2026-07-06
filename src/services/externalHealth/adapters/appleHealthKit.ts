import * as Device from 'expo-device';

import type { ExternalHealthAdapter, ExternalHealthAvailability, ExternalHealthFieldMapping, ExternalHealthRawSample, ExternalHealthRegistryEntry } from '../types';

const SOURCE_LABEL = 'Apple Health';
const MAX_SAMPLES_PER_TYPE = 5000;

export const appleHealthKitAdapter: ExternalHealthAdapter = {
    platform: 'apple_health',
    async getAvailability(): Promise<ExternalHealthAvailability> {
        if (!Device.isDevice) {
            return 'unavailable';
        }

        try {
            const healthkit = await import('@kingstinct/react-native-healthkit');
            return (await healthkit.isHealthDataAvailable()) ? 'available' : 'unavailable';
        } catch {
            return 'not_configured';
        }
    },
    async requestPermissions(entries) {
        if (!Device.isDevice) return [];

        const healthkit = await import('@kingstinct/react-native-healthkit');
        const readTypes = getAvailableReadTypes(healthkit, entries);
        if (readTypes.length === 0) return [];

        await healthkit.getRequestStatusForAuthorization({
            toShare: [],
            toRead: readTypes as any,
        });

        const granted = await healthkit.requestAuthorization({
            toShare: [],
            toRead: readTypes as any,
        });
        return granted ? readTypes : [];
    },
    async getGrantedPermissions(entries) {
        // HealthKit does not expose a reliable "read permission granted" status for all data types.
        // After a successful request we treat configured types as readable and handle empty reads gracefully.
        if (!Device.isDevice) return [];

        try {
            const healthkit = await import('@kingstinct/react-native-healthkit');
            const readTypes = getAvailableReadTypes(healthkit, entries);
            return readTypes;
        } catch {
            return [];
        }
    },
    async readSamples(entries, lookbackDays, startDateByMetricId, options) {
        if (!Device.isDevice) {
            return { samples: [], authorizationErrors: [] };
        }

        const healthkit = await import('@kingstinct/react-native-healthkit');
        const globalStartDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
        const samples: ExternalHealthRawSample[] = [];
        const authorizationErrors: Array<{ metricId: string; readType: string; reason: string }> = [];

        const total = entries.length;
        let completed = 0;
        for (const entry of entries) {
            if (options?.cancellation?.cancelled) break;
            options?.onProgress?.(completed, total, entry.metricId);
            if (!entry.appleHealthKit) { completed += 1; continue; }
            const startDate = getStartDateForMetric(entry.metricId, globalStartDate, startDateByMetricId);

            const quantityFields = entry.appleHealthKit.fields.filter((field) => field.sourceKind !== 'correlation');
            const fieldsByQuantityType = new Map(quantityFields.map((field) => [field.sourceField, field]));
            const sampleBuckets = new Map<string, ExternalHealthRawSample>();

            for (const quantityType of entry.appleHealthKit.quantityTypes) {
                const field = fieldsByQuantityType.get(quantityType);
                if (!field) continue;

                const result = await queryQuantitySamplesSafely(healthkit, quantityType, {
                    limit: entry.aggregation === 'latest' ? 1 : MAX_SAMPLES_PER_TYPE,
                    ascending: false,
                    unit: field.sourceUnit as any,
                    filter: {
                        date: {
                            startDate,
                        },
                    },
                }, (readType, error) => {
                    authorizationErrors.push({
                        metricId: entry.metricId,
                        readType,
                        reason: getErrorText(error),
                    });
                });

                for (const sample of result as any[]) {
                    const observedAt = toDate(sample.startDate ?? sample.endDate);
                    if (!observedAt) continue;
                    const value = normalizeValue(entry.metricId, Number(sample.quantity));
                    if (!Number.isFinite(value)) continue;

                    const bucketKey = quantityFields.length > 1
                        ? observedAt.toISOString()
                        : `${quantityType}:${sample.uuid ?? observedAt.toISOString()}`;
                    const existing = sampleBuckets.get(bucketKey);
                    const sourceApp = sample.sourceRevision?.source?.name ?? sample.sourceRevision?.source?.bundleIdentifier;
                    const deviceName = sample.device?.name ?? sample.device?.model;

                    sampleBuckets.set(bucketKey, {
                        platform: 'apple_health',
                        metricId: entry.metricId,
                        observedAt,
                        values: {
                            ...(existing?.values ?? {}),
                            [field.metricField]: value,
                        },
                        unit: normalizeUnit(field.sourceUnit),
                        sourceLabel: SOURCE_LABEL,
                        externalId: existing?.externalId ?? sample.uuid,
                        sourceApp: existing?.sourceApp ?? sourceApp,
                        deviceName: existing?.deviceName ?? deviceName,
                    });
                }
            }

            for (const sample of sampleBuckets.values()) {
                if (entry.definition.fields.every((field) => sample.values[field.key] !== undefined)) {
                    samples.push(sample);
                }
            }

            for (const correlationType of entry.appleHealthKit.correlationTypes) {
                const correlationFields = entry.appleHealthKit.fields.filter(
                    (field) => field.sourceKind === 'correlation' && field.sourceGroup === correlationType
                );
                if (correlationFields.length === 0) continue;

                const result = await queryCorrelationSamplesSafely(healthkit, correlationType, {
                    limit: entry.aggregation === 'latest' ? 1 : MAX_SAMPLES_PER_TYPE,
                    ascending: false,
                    filter: {
                        date: {
                            startDate,
                        },
                    },
                }, (readType, error) => {
                    authorizationErrors.push({
                        metricId: entry.metricId,
                        readType,
                        reason: getErrorText(error),
                    });
                });

                for (const sample of result as any[]) {
                    const normalized = normalizeCorrelationSample(entry, correlationType, correlationFields, sample);
                    if (normalized) {
                        samples.push(normalized);
                    }
                }

                if (result.length === 0) {
                    const fallbackSamples = await queryCorrelationQuantityFallbackSamples(
                        healthkit,
                        entry,
                        correlationType,
                        correlationFields,
                        startDate,
                        (readType, error) => {
                            authorizationErrors.push({
                                metricId: entry.metricId,
                                readType,
                                reason: getErrorText(error),
                            });
                        }
                    );
                    samples.push(...fallbackSamples);
                }
            }

            for (const categoryType of entry.appleHealthKit.categoryTypes) {
                const field = entry.appleHealthKit.fields.find(
                    (candidateField) => candidateField.sourceKind === 'category' && candidateField.sourceField === categoryType
                );
                if (!field) continue;

                const result = await queryCategorySamplesSafely(healthkit, categoryType, {
                    limit: entry.aggregation === 'latest' ? 1 : MAX_SAMPLES_PER_TYPE,
                    ascending: false,
                    filter: {
                        date: {
                            startDate,
                        },
                    },
                }, (readType, error) => {
                    authorizationErrors.push({
                        metricId: entry.metricId,
                        readType,
                        reason: getErrorText(error),
                    });
                });

                for (const sample of result as any[]) {
                    const observedAt = toDate(sample.startDate ?? sample.endDate);
                    if (!observedAt) continue;
                    // Category samples carry a raw numeric `value` (e.g. NumberOfTimesFallen = count).
                    const value = normalizeValue(entry.metricId, Number(sample.value));
                    if (!Number.isFinite(value)) continue;

                    const values: Record<string, number> = { [field.metricField]: value };
                    if (!entry.definition.fields.every((definitionField) => values[definitionField.key] !== undefined)) continue;

                    samples.push({
                        platform: 'apple_health',
                        metricId: entry.metricId,
                        observedAt,
                        values,
                        unit: normalizeUnit(field.sourceUnit),
                        sourceLabel: SOURCE_LABEL,
                        externalId: sample.uuid,
                        sourceApp: sample.sourceRevision?.source?.name ?? sample.sourceRevision?.source?.bundleIdentifier,
                        deviceName: sample.device?.name ?? sample.device?.model,
                    });
                }
            }

            completed += 1;
        }
        options?.onProgress?.(completed, total, '');

        // Best-effort: never abort the whole import because some types were not
        // granted. Return what we read plus the per-type authorization failures so
        // the caller can report which metrics could not be imported.
        return { samples, authorizationErrors };
    },
};

function getReadTypes(entries: ExternalHealthRegistryEntry[]): string[] {
    return Array.from(new Set(entries.flatMap((entry) => entry.appleHealthKit?.readTypes ?? [])));
}

function getStartDateForMetric(
    metricId: string,
    fallback: Date,
    startDateByMetricId?: Record<string, string>
): Date {
    const raw = startDateByMetricId?.[metricId];
    if (!raw) return fallback;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function getAvailableReadTypes(
    healthkit: Pick<typeof import('@kingstinct/react-native-healthkit'), 'areObjectTypesAvailable'>,
    entries: ExternalHealthRegistryEntry[]
): string[] {
    const readTypes = getReadTypes(entries);
    if (readTypes.length === 0) return [];

    const availability = healthkit.areObjectTypesAvailable(readTypes as any);
    return readTypes.filter((readType) => availability[readType] !== false);
}

async function queryQuantitySamplesSafely(
    healthkit: Pick<
        typeof import('@kingstinct/react-native-healthkit'),
        'queryQuantitySamples'
    >,
    quantityType: string,
    options: Parameters<typeof import('@kingstinct/react-native-healthkit')['queryQuantitySamples']>[1],
    onAuthorizationError?: (readType: string, error: unknown) => void
): Promise<readonly unknown[]> {
    try {
        return await healthkit.queryQuantitySamples(quantityType as any, options as any);
    } catch (error) {
        if (isRecoverableHealthKitReadAuthorizationError(error)) {
            onAuthorizationError?.(quantityType, error);
            return [];
        }
        throw error;
    }
}

async function queryCategorySamplesSafely(
    healthkit: Pick<
        typeof import('@kingstinct/react-native-healthkit'),
        'queryCategorySamples'
    >,
    categoryType: string,
    options: Parameters<typeof import('@kingstinct/react-native-healthkit')['queryCategorySamples']>[1],
    onAuthorizationError?: (readType: string, error: unknown) => void
): Promise<readonly unknown[]> {
    try {
        return await healthkit.queryCategorySamples(categoryType as any, options as any);
    } catch (error) {
        if (isRecoverableHealthKitReadAuthorizationError(error)) {
            onAuthorizationError?.(categoryType, error);
            return [];
        }
        throw error;
    }
}

async function queryCorrelationSamplesSafely(
    healthkit: Pick<
        typeof import('@kingstinct/react-native-healthkit'),
        'queryCorrelationSamples'
    >,
    correlationType: string,
    options: Parameters<typeof import('@kingstinct/react-native-healthkit')['queryCorrelationSamples']>[1],
    onAuthorizationError?: (readType: string, error: unknown) => void
): Promise<readonly unknown[]> {
    try {
        return await healthkit.queryCorrelationSamples(correlationType as any, options as any);
    } catch (error) {
        if (isRecoverableHealthKitReadAuthorizationError(error)) {
            onAuthorizationError?.(correlationType, error);
            return [];
        }
        throw error;
    }
}

function normalizeCorrelationSample(
    entry: ExternalHealthRegistryEntry,
    correlationType: string,
    fields: ExternalHealthFieldMapping[],
    sample: any
): ExternalHealthRawSample | undefined {
    const observedAt = toDate(sample.startDate ?? sample.endDate);
    if (!observedAt) return undefined;

    const fieldsByQuantityType = new Map(fields.map((field) => [field.sourceField, field]));
    const values: Record<string, number> = {};
    for (const object of sample.objects ?? []) {
        const field = fieldsByQuantityType.get(object?.quantityType);
        if (!field) continue;
        const value = normalizeValue(entry.metricId, Number(object.quantity));
        if (Number.isFinite(value)) {
            values[field.metricField] = value;
        }
    }

    if (!fields.every((field) => values[field.metricField] !== undefined)) return undefined;

    const sourceApp = sample.sourceRevision?.source?.name ?? sample.sourceRevision?.source?.bundleIdentifier;
    const deviceName = sample.device?.name ?? sample.device?.model;
    return {
        platform: 'apple_health',
        metricId: entry.metricId,
        observedAt,
        values,
        unit: normalizeUnit(fields[0]?.sourceUnit ?? entry.definition.defaultUnit),
        sourceLabel: SOURCE_LABEL,
        externalId: sample.uuid ?? `${correlationType}:${observedAt.toISOString()}`,
        sourceApp,
        deviceName,
    };
}

async function queryCorrelationQuantityFallbackSamples(
    healthkit: Pick<
        typeof import('@kingstinct/react-native-healthkit'),
        'queryQuantitySamples'
    >,
    entry: ExternalHealthRegistryEntry,
    correlationType: string,
    fields: ExternalHealthFieldMapping[],
    startDate: Date,
    onAuthorizationError?: (readType: string, error: unknown) => void
): Promise<ExternalHealthRawSample[]> {
    const sampleBuckets = new Map<string, ExternalHealthRawSample>();

    for (const field of fields) {
        const result = await queryQuantitySamplesSafely(healthkit, field.sourceField, {
            limit: entry.aggregation === 'latest' ? 1 : MAX_SAMPLES_PER_TYPE,
            ascending: false,
            unit: field.sourceUnit as any,
            filter: {
                date: {
                    startDate,
                },
            },
        }, onAuthorizationError);

        for (const sample of result as any[]) {
            const observedAt = toDate(sample.startDate ?? sample.endDate);
            if (!observedAt) continue;
            const value = normalizeValue(entry.metricId, Number(sample.quantity));
            if (!Number.isFinite(value)) continue;

            const bucketTime = new Date(Math.floor(observedAt.getTime() / 60000) * 60000);
            const bucketKey = bucketTime.toISOString();
            const existing = sampleBuckets.get(bucketKey);
            const sourceApp = sample.sourceRevision?.source?.name ?? sample.sourceRevision?.source?.bundleIdentifier;
            const deviceName = sample.device?.name ?? sample.device?.model;

            sampleBuckets.set(bucketKey, {
                platform: 'apple_health',
                metricId: entry.metricId,
                observedAt: existing?.observedAt ?? observedAt,
                values: {
                    ...(existing?.values ?? {}),
                    [field.metricField]: value,
                },
                unit: normalizeUnit(field.sourceUnit),
                sourceLabel: SOURCE_LABEL,
                externalId: existing?.externalId ?? sample.uuid ?? `${correlationType}:${bucketKey}`,
                sourceApp: existing?.sourceApp ?? sourceApp,
                deviceName: existing?.deviceName ?? deviceName,
            });
        }
    }

    const completeSamples = Array.from(sampleBuckets.values())
        .filter((sample) => fields.every((field) => sample.values[field.metricField] !== undefined));

    return completeSamples;
}

function normalizeUnit(unit: string): string {
    if (unit === 'degC') return '°C';
    if (unit === 'count/min') return 'bpm';
    return unit;
}

function normalizeValue(metricId: string, value: number): number {
    if ((metricId === 'blood_oxygen' || metricId === 'body_fat') && value <= 1.5) {
        return value * 100;
    }
    return value;
}

function getErrorText(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

function isRecoverableHealthKitReadAuthorizationError(error: unknown): boolean {
    const text = getErrorText(error);
    return text.includes('com.apple.healthkit') &&
        (
            text.includes('Code=4') ||
            text.includes('Code=5') ||
            text.includes('Authorization denied') ||
            text.includes('Authorization not determined')
        );
}

function toDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}
