import type { Permission, RecordType } from 'react-native-health-connect';

import type { ExternalHealthAdapter, ExternalHealthAuthorizationError, ExternalHealthAvailability, ExternalHealthRawSample, ExternalHealthRegistryEntry } from '../types';

const SOURCE_LABEL = 'Health Connect';
const MAX_SAMPLES_PER_TYPE = 5000;
const HEALTH_CONNECT_PAGE_SIZE = 500;

export const healthConnectAdapter: ExternalHealthAdapter = {
    platform: 'health_connect',
    async getAvailability(): Promise<ExternalHealthAvailability> {
        try {
            const healthConnect = await import('react-native-health-connect');
            const status = await healthConnect.getSdkStatus();
            if (status === healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
            if (status === healthConnect.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'provider_update_required';
            return 'unavailable';
        } catch {
            return 'not_configured';
        }
    },
    async requestPermissions(entries) {
        const healthConnect = await import('react-native-health-connect');
        const initialized = await healthConnect.initialize();
        if (!initialized) return [];
        const permissions = getPermissions(entries);
        const granted = await healthConnect.requestPermission(permissions);
        return granted
            .filter((permission) => isReadRecordPermission(permission))
            .map((permission) => permission.recordType);
    },
    async getGrantedPermissions(entries) {
        const healthConnect = await import('react-native-health-connect');
        const initialized = await healthConnect.initialize();
        if (!initialized) return [];
        const expected = new Set(getPermissions(entries).map((permission) => permission.recordType));
        const granted = await healthConnect.getGrantedPermissions();
        return granted
            .filter((permission) => isReadRecordPermission(permission) && expected.has(permission.recordType))
            .map((permission) => permission.recordType);
    },
    async readSamples(entries, lookbackDays, startDateByMetricId, options) {
        const healthConnect = await import('react-native-health-connect');
        const initialized = await healthConnect.initialize();
        if (!initialized) return { samples: [], authorizationErrors: [] };

        const globalStartDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
        const endTime = new Date().toISOString();
        const samples: ExternalHealthRawSample[] = [];
        const authorizationErrors: ExternalHealthAuthorizationError[] = [];

        const total = entries.length;
        let completed = 0;
        for (const entry of entries) {
            if (options?.cancellation?.cancelled) break;
            options?.onProgress?.(completed, total, entry.metricId);
            if (!entry.healthConnect) { completed += 1; continue; }
            const startTime = getStartDateForMetric(entry.metricId, globalStartDate, startDateByMetricId).toISOString();

            for (const recordType of entry.healthConnect.recordTypes) {
                let pageToken: string | undefined;
                let loaded = 0;

                try {
                do {
                    const result = await healthConnect.readRecords(recordType as RecordType, {
                        timeRangeFilter: {
                            operator: 'between',
                            startTime,
                            endTime,
                        },
                        ascendingOrder: false,
                        pageSize: entry.aggregation === 'latest'
                            ? 1
                            : Math.min(HEALTH_CONNECT_PAGE_SIZE, MAX_SAMPLES_PER_TYPE - loaded),
                        pageToken,
                    });
                    const recordCount = result.records.length;
                    loaded += recordCount;

                    for (const record of result.records as any[]) {
                        // Series records (e.g. Speed) carry values inside a `samples[]` array,
                        // each with its own `time`; instantaneous/interval records carry values at
                        // the record root. Normalize both to a list of value carriers so field
                        // paths resolve against the right object.
                        const carriers: { observedAt: Date | null; source: any; externalId?: string }[] =
                            Array.isArray(record.samples)
                                ? (record.samples as any[]).map((innerSample) => ({
                                    observedAt: toDate(innerSample.time),
                                    source: innerSample,
                                }))
                                : [{
                                    observedAt: toDate(record.time ?? record.endTime ?? record.startTime),
                                    source: record,
                                    externalId: record.metadata?.id ?? record.metadata?.clientRecordId,
                                }];

                        for (const carrier of carriers) {
                            if (!carrier.observedAt) continue;
                            const values: Record<string, number> = {};

                            for (const field of entry.healthConnect.fields) {
                                if (!field.sourceField.startsWith(`${recordType}.`)) continue;
                                const path = field.sourceField.slice(recordType.length + 1);
                                const value = normalizeValue(entry.metricId, getByPath(carrier.source, path));
                                if (Number.isFinite(value)) {
                                    values[field.metricField] = value;
                                }
                            }

                            if (!entry.definition.fields.every((field) => values[field.key] !== undefined)) continue;

                            samples.push({
                                platform: 'health_connect',
                                metricId: entry.metricId,
                                observedAt: carrier.observedAt,
                                values,
                                unit: normalizeUnitForEntry(entry),
                                sourceLabel: SOURCE_LABEL,
                                externalId: carrier.externalId,
                                sourceApp: record.metadata?.dataOrigin,
                                deviceName: formatDevice(record.metadata?.device),
                            });
                        }
                    }

                    pageToken = entry.aggregation === 'latest' || recordCount === 0 || loaded >= MAX_SAMPLES_PER_TYPE
                        ? undefined
                        : result.pageToken;
                } while (pageToken);
                } catch (error) {
                    // Missing Health Connect permission (or a transient read error) for
                    // this record type: record it and keep importing the rest.
                    authorizationErrors.push({
                        metricId: entry.metricId,
                        readType: recordType,
                        reason: error instanceof Error ? error.message : String(error),
                    });
                }
            }

            completed += 1;
        }
        options?.onProgress?.(completed, total, '');

        return { samples, authorizationErrors };
    },
};

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

function getPermissions(entries: ExternalHealthRegistryEntry[]): Permission[] {
    return Array.from(new Set(entries.flatMap((entry) => entry.healthConnect?.recordTypes ?? [])))
        .map((recordType) => ({
            accessType: 'read',
            recordType: recordType as RecordType,
        }));
}

function isReadRecordPermission(permission: any): permission is Permission {
    return permission?.accessType === 'read' &&
        typeof permission.recordType === 'string' &&
        permission.recordType !== 'BackgroundAccessPermission' &&
        permission.recordType !== 'ReadHealthDataHistory';
}

function getByPath(value: any, path: string): number {
    const result = path.split('.').reduce((current, key) => current?.[key], value);
    return typeof result === 'number' ? result : Number.NaN;
}

function normalizeUnitForEntry(entry: ExternalHealthRegistryEntry): string {
    const first = entry.healthConnect?.fields[0]?.sourceUnit;
    if (first === 'celsius') return '°C';
    return first ?? entry.definition.defaultUnit;
}

function normalizeValue(metricId: string, value: number): number {
    if ((metricId === 'blood_oxygen' || metricId === 'body_fat') && value <= 1.5) {
        return value * 100;
    }
    return value;
}

function formatDevice(device: any): string | undefined {
    if (!device) return undefined;
    return [device.manufacturer, device.model].filter(Boolean).join(' ') || undefined;
}

function toDate(value: unknown): Date | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
