import type { ExternalHealthAggregation, ExternalHealthImportPolicy, ExternalHealthMapping, MetricDefinition, MetricEntry } from '../../metrics/types';

export type ExternalHealthPlatform = 'apple_health' | 'health_connect';

export type ExternalHealthAvailability =
    | 'available'
    | 'unavailable'
    | 'provider_update_required'
    | 'unsupported_platform'
    | 'not_configured';

export type ExternalHealthFieldMapping = {
    metricField: string;
    sourceField: string;
    sourceUnit: string;
    sourceKind?: 'quantity' | 'correlation' | 'category';
    sourceGroup?: string;
};

export type ExternalHealthRegistryEntry = {
    metricId: string;
    definition: MetricDefinition;
    aggregation: ExternalHealthAggregation;
    importPolicy: ExternalHealthImportPolicy;
    appleHealthKit?: {
        quantityTypes: string[];
        correlationTypes: string[];
        categoryTypes: string[];
        readTypes: string[];
        fields: ExternalHealthFieldMapping[];
    };
    healthConnect?: {
        recordTypes: string[];
        fields: ExternalHealthFieldMapping[];
    };
};

export type ExternalHealthImportPreferences = {
    enabled: boolean;
    enabledMetricIds: string[];
    authorizedReadTypes?: string[];
    lastImportedAt?: string;
    lastObservedAtByMetricId?: Record<string, string>;
    /** Metric ids that were enabled but had no OS health-store permission at the
     *  last import. Used to flag those rows in the UI. Cleared as data arrives. */
    metricsWithoutPermission?: string[];
};

export type ExternalHealthRawSample = {
    platform: ExternalHealthPlatform;
    metricId: string;
    observedAt: Date;
    values: Record<string, number>;
    unit: string;
    sourceLabel: string;
    externalId?: string;
    sourceApp?: string;
    deviceName?: string;
};

export type ExternalHealthAuthorizationError = {
    metricId: string;
    readType: string;
    reason: string;
};

export type ExternalHealthReadResult = {
    samples: ExternalHealthRawSample[];
    /** Per-read-type authorization failures gathered during a best-effort read.
     *  Reads continue past these; the import is never aborted because of them. */
    authorizationErrors: ExternalHealthAuthorizationError[];
};

/** Mutable cancellation token. Set `cancelled = true` to stop a running import as
 *  soon as the pipeline reaches its next checkpoint (between metrics / sample batches). */
export type ExternalHealthCancellation = { cancelled: boolean };

export type ExternalHealthReadOptions = {
    cancellation?: ExternalHealthCancellation;
    /** Called before each metric is read: how many are already done, the total, and the metric about to be read. */
    onProgress?: (completed: number, total: number, metricId: string) => void;
};

export type ExternalHealthImportOptions = {
    cancellation?: ExternalHealthCancellation;
    /** Called periodically while saving: samples written so far and the total to write. */
    onProgress?: (completed: number, total: number) => void;
};

export type ExternalHealthImportProgress = {
    phase: 'reading' | 'saving';
    completed: number;
    total: number;
    metricId?: string;
};

export type ExternalHealthImportResult = {
    imported: number;
    updated: number;
    unchanged: number;
    thinned: number;
    skipped: number;
    errors: string[];
    /** Metric ids that produced no data and hit an authorization error — i.e. the
     *  data type is enabled in TENOS but not granted in the OS health store. */
    metricsWithoutPermission?: string[];
    /** True if the user cancelled the import before it finished. Whatever was read
     *  up to that point is still saved (idempotent), so cancelling never corrupts. */
    cancelled?: boolean;
    diagnostics?: {
        lookbackDays: number;
        requestedMetricIds: string[];
        rawSampleCount: number;
        rawSampleCountByMetricId: Record<string, number>;
        processedSampleCount: number;
        processedSampleCountByMetricId: Record<string, number>;
    };
};

export type ExternalHealthAdapter = {
    platform: ExternalHealthPlatform;
    getAvailability(): Promise<ExternalHealthAvailability>;
    requestPermissions(entries: ExternalHealthRegistryEntry[]): Promise<string[]>;
    getGrantedPermissions(entries: ExternalHealthRegistryEntry[]): Promise<string[]>;
    readSamples(
        entries: ExternalHealthRegistryEntry[],
        lookbackDays: number,
        startDateByMetricId?: Record<string, string>,
        options?: ExternalHealthReadOptions
    ): Promise<ExternalHealthReadResult>;
};

export type ExternalHealthStoredEntry = MetricEntry & {
    externalHealth: NonNullable<MetricEntry['externalHealth']>;
};

export function hasExternalHealthMapping(definition: MetricDefinition): definition is MetricDefinition & { externalHealth: ExternalHealthMapping } {
    return Boolean(definition.externalHealth);
}
