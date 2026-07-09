/**
 * Metric Types
 *
 * Defines the structure for configurable health metrics like weight, blood pressure, etc.
 * Each metric definition describes how to capture, display, and store data in FHIR format.
 */

import type { TodoCondition } from '../types/todoRules';

/** FHIR Coding structure */
export type FhirCoding = {
    system: string;
    code: string;
    display: string;
};

/** Preferred measurement-system presets used to pick default display units. */
export type MeasurementSystem = 'metric' | 'us';

/** Linear unit conversion: target = source * multiply + add */
export type UnitLinearConversion = {
    multiply: number;
    add?: number;
};

/** Unit option for metrics that support multiple units */
export type UnitOption = {
    /** Unit code (e.g., 'kg', 'lb') */
    value: string;
    /** Display label (e.g., 'Kilogramm') */
    label: string;
    /** Measurement system this unit belongs to. Used for country-based defaults. */
    measurementSystem?: MeasurementSystem;
    /**
     * Legacy conversion factor from the default unit to this unit.
     * Prefer `fromDefault` and `toDefault` for new definitions.
     */
    conversionFactor?: number;
    /** Convert a value in the default/canonical unit to this display unit. */
    fromDefault?: UnitLinearConversion;
    /** Convert a value in this display unit to the default/canonical unit. */
    toDefault?: UnitLinearConversion;
};

/** How external health-store samples should be imported into a TENOS metric. */
export type ExternalHealthAggregation = 'sample' | 'latest' | 'daily-sum' | 'daily-average';

/** How imported external health-store samples should be reduced before storage. */
export type ExternalHealthImportPolicy = {
    /**
     * all: store every valid sample.
     * latest: store only the newest sample in the import batch.
     * daily-latest: store only the newest sample per local day.
     * daily-first-and-last: store the first and newest sample per local day.
     * daily-sum: sum all samples of a local day into one daily total (cumulative metrics).
     * daily-average: average all samples of a local day into one daily mean (rate-like metrics).
     */
    mode: 'all' | 'latest' | 'daily-latest' | 'daily-first-and-last' | 'daily-sum' | 'daily-average';
};

/** Apple HealthKit quantity sample mapping for a metric field. */
export type ExternalHealthKitQuantityMapping = {
    /** HealthKit quantity type identifier. */
    quantityType: string;
    correlationType?: never;
    categoryType?: never;
    /** Unit requested from HealthKit. */
    unit: string;
    /** TENOS field that receives the imported value. */
    field: string;
};

/** Apple HealthKit correlation mapping for a metric field, e.g. blood pressure. */
export type ExternalHealthKitCorrelationMapping = {
    /** HealthKit correlation type identifier. */
    correlationType: string;
    /** HealthKit quantity type identifier inside the correlation. */
    quantityType: string;
    categoryType?: never;
    /** Unit requested from HealthKit. */
    unit: string;
    /** TENOS field that receives the imported value. */
    field: string;
};

/** Apple HealthKit category mapping for a metric field, e.g. number of times fallen. */
export type ExternalHealthKitCategoryMapping = {
    /** HealthKit category type identifier. */
    categoryType: string;
    quantityType?: never;
    correlationType?: never;
    /** Unit label stored with the imported value (category samples carry a raw number). */
    unit: string;
    /** TENOS field that receives the imported value. */
    field: string;
};

export type ExternalHealthKitMapping =
    | ExternalHealthKitQuantityMapping
    | ExternalHealthKitCorrelationMapping
    | ExternalHealthKitCategoryMapping;

/** Android Health Connect record-field mapping for a metric field. */
export type ExternalHealthConnectMapping = {
    /** Health Connect record type, e.g. Weight or BloodPressure. */
    recordType: string;
    /** Field path in the Health Connect record result. */
    fieldPath: string;
    /** Unit expected after adapter normalization. */
    unit: string;
    /** TENOS field that receives the imported value. */
    field: string;
};

/** Optional external health-store import mapping attached to metric definitions. */
export type ExternalHealthMapping = {
    appleHealthKit?: {
        read: ExternalHealthKitMapping[];
    };
    healthConnect?: {
        read: ExternalHealthConnectMapping[];
    };
    aggregation?: ExternalHealthAggregation;
    importPolicy?: ExternalHealthImportPolicy;
    enabledByDefault?: boolean;
};

/** Input field type */
export type MetricInputType = 'integer' | 'decimal';

/** Label for a discrete value (used for scales like 0-3) */
export type ValueLabel = {
    /** The numeric value */
    value: number;
    /** Display label (e.g., "Selten", "Häufig") - German default */
    label: string;
    /** i18n translation key for the label (e.g., 'metrics.painLevel.valueLabels.0') */
    labelKey?: string;
};

/** A single input field within a metric */
export type MetricField = {
    /** Unique key within the metric (e.g., 'value', 'systolic', 'diastolic') */
    key: string;

    /** Display label (e.g., 'Gewicht', 'Systolisch') - German default */
    label: string;

    /** i18n translation key for the field label (e.g., 'metrics.painLevel.fieldLabel') */
    labelKey?: string;

    /** Unit for this specific field (overrides metric's defaultUnit if set) */
    unit?: string;

    /** Input type */
    inputType: MetricInputType;

    /** Decimal places for 'decimal' input type */
    decimalPlaces?: number;

    /** Placeholder text */
    placeholder?: string;

    /**
     * Labels for discrete values (e.g., for scales 0-3).
     * When set, the label is shown instead of the raw number in displays.
     * Can also be used to render a picker instead of text input.
     */
    valueLabels?: ValueLabel[];

    /**
     * FHIR component code for multi-value observations.
     * Required when metric has multiple fields (e.g., blood pressure).
     */
    fhirComponentCode?: FhirCoding;

    /** Validation */
    validation?: {
        min?: number;
        max?: number;
        required?: boolean;
    };
};

/** Chart configuration */
export type MetricChartConfig = {
    /** Chart type */
    type: 'line' | 'bar' | 'scatter' | 'range';

    /** For multi-value metrics: which field to show as primary in chart */
    primaryField?: string;

    /** For multi-value metrics: which field to show as secondary */
    secondaryField?: string;

    /** Show reference line (e.g., target weight, normal range) */
    referenceLine?: {
        value: number;
        label: string;
    };

    /**
     * Y-axis configuration for better visualization.
     * If not set, the chart auto-scales based on data with default padding.
     */
    yAxis?: {
        /** Fixed minimum value (e.g., 0 for counts, 70 for SpO2) */
        min?: number;
        /** Fixed maximum value (e.g., 100 for percentages) */
        max?: number;
        /**
         * Padding as percentage of data range (0-1).
         * Applied above max and below min of actual data.
         * Default: 0.15 (15%)
         */
        padding?: number;
    };

    /**
     * Whether this metric should show a chart at all.
     * Set to false for metrics with very limited scales (0-3).
     * Default: true
     */
    showChart?: boolean;

    /**
     * Whether to show average value in chart header.
     * Set to false for counts (falls, cramps) or discrete scales.
     * Default: true
     */
    showAverage?: boolean;

    /**
     * Whether to show "BEREICH" (range) header above the chart instead of "AKTUELL".
     * When enabled and no bar is selected: shows min–max range + date period.
     * When a bar is selected: shows the selected value + date.
     * Useful for metrics with multiple measurements per day (SpO2, heart rate).
     * Default: false
     */
    showRange?: boolean;

    /**
     * Whether to show a "Letzte Messung" (last measurement) row below the chart.
     * Tapping it selects (highlights) the last bar in the chart.
     * Useful for metrics with frequent measurements (vital signs).
     * Default: false
     */
    showLastMeasurement?: boolean;
};

/** FHIR observation category */
export type ObservationCategory =
    | 'vital-signs'
    | 'laboratory'
    | 'survey'
    | 'activity';

/** App-specific metric category for grouping in UI */
export type MetricCategory =
    | 'assessment'  // Funktionsstatus & Scores
    | 'body'        // Körper & Gewicht
    | 'vital-signs' // Vitalzeichen
    | 'respiratory' // Atemfunktion
    | 'motor'       // Motorik & Kraft
    | 'symptoms'    // Symptome
    | 'bulbar'      // Bulbäre Funktion
    | 'nutrition'   // Ernährung
    | 'digestion'   // Verdauung
    | 'biomarker';  // Biomarker

/** Category metadata for display */
export type MetricCategoryInfo = {
    id: MetricCategory;
    name: string;
    icon: string;
    iconColor: string;
};

/** All category metadata (sorted alphabetically by name) */
export const metricCategoryInfos: MetricCategoryInfo[] = [
    { id: 'respiratory', name: 'Atemfunktion', icon: 'lungs.fill', iconColor: '#00C7BE' },
    { id: 'biomarker', name: 'Biomarker', icon: 'drop.fill', iconColor: '#007AFF' },
    { id: 'bulbar', name: 'Bulbäre Funktion', icon: 'mouth.fill', iconColor: '#FF3B30' },
    { id: 'nutrition', name: 'Ernährung', icon: 'fork.knife', iconColor: '#34C759' },
    { id: 'assessment', name: 'Funktionsstatus', icon: 'waveform.path.ecg', iconColor: '#5856D6' },
    { id: 'body', name: 'Körper & Gewicht', icon: 'figure', iconColor: '#5856D6' },
    { id: 'motor', name: 'Motorik & Kraft', icon: 'figure.walk', iconColor: '#FF9500' },
    { id: 'symptoms', name: 'Symptome', icon: 'list.clipboard.fill', iconColor: '#AF52DE' },
    { id: 'digestion', name: 'Verdauung', icon: 'toilet.fill', iconColor: '#FF9500' },
    { id: 'vital-signs', name: 'Vitalzeichen', icon: 'heart.fill', iconColor: '#FF2D55' },
];

/** Get category info by ID */
export function getCategoryInfo(id: MetricCategory): MetricCategoryInfo | undefined {
    return metricCategoryInfos.find(c => c.id === id);
}

/** Get the display label for a value, or undefined if no label exists */
export function getValueLabel(field: Pick<MetricField, 'valueLabels'>, value: number): string | undefined {
    return field.valueLabels?.find(vl => vl.value === value)?.label;
}

/** Complete metric definition */
export type MetricDefinition = {
    /** Unique identifier (e.g., 'weight', 'blood_pressure', 'nfl') */
    id: string;

    /**
     * Whether this metric is available in the app.
     * Defaults to true. Set to false to keep the definition in code or on the
     * definitions server without exposing it in UI, todos, export, or lookup APIs.
     */
    enabled?: boolean;

    /** Display name (e.g., 'Gewicht', 'Blutdruck') - German default */
    name: string;

    /** i18n translation key for name (e.g., 'metrics.painLevel.name') */
    nameKey?: string;

    /** Short name for compact display - German default */
    shortName?: string;

    /** i18n translation key for short name (e.g., 'metrics.painLevel.shortName') */
    shortNameKey?: string;

    /** SF Symbol icon name */
    icon: string;

    /** Icon color (hex) */
    iconColor: string;

    /** Description title shown on overview screen - German default */
    descriptionTitle?: string;

    /** i18n translation key for description title (e.g., 'metrics.painLevel.descriptionTitle') */
    descriptionTitleKey?: string;

    /** Description text shown on overview screen - German default */
    description: string;

    /** i18n translation key for description (e.g., 'metrics.painLevel.description') */
    descriptionKey?: string;

    /** Short description optimised for PDF export. Falls back to `description` when absent. */
    exportDescription?: string;

    /** FHIR mapping configuration */
    fhir: {
        /** Primary code for the observation */
        code: FhirCoding;
        /** Observation category */
        category: ObservationCategory;
    };

    /** Input fields (1 for simple values, multiple for blood pressure etc.) */
    fields: MetricField[];

    /** Default unit */
    defaultUnit: string;

    /**
     * Whether to show the unit in the UI (cards, lists, detail views).
     * Set to false for metrics where the unit doesn't add value (e.g., counts, scales like /10).
     * Default: true
     */
    showUnit?: boolean;

    /** Available unit options (if metric supports unit switching) */
    availableUnits?: UnitOption[];

    /** Optional Apple HealthKit / Android Health Connect import mapping. */
    externalHealth?: ExternalHealthMapping;

    /** Chart configuration */
    chart: MetricChartConfig;

    /** Whether this metric can be pinned to the home overview */
    canPin?: boolean;

    /** Whether this metric is pinned by default for new users */
    defaultPinned?: boolean;

    /** Default sort order for pinned metrics (lower = higher in list) */
    defaultPinnedOrder?: number;

    /** Sort order in metric list */
    sortOrder?: number;

    /** App category for grouping in search/browse UI */
    category: MetricCategory;

    /**
     * OSes on which this metric is available. Absent = all platforms.
     * Set only for metrics that are exclusively fed by a platform-specific passive
     * source with no manual entry (e.g. iOS-only Apple "Mobility" gait metrics);
     * such metrics are hidden entirely on the unsupported OS.
     */
    platforms?: Array<'ios' | 'android'>;

    /**
     * Whether this metric is computed live rather than having stored entries.
     * Computed metrics calculate their value from other data sources (e.g., TDEE from patient data + ALSFRS-R).
     * They don't have historical entries and use a custom card component for display.
     */
    computed?: boolean;

    /** Optional tracking schedule. Metrics with schedule appear in todo list by default. */
    schedule?: {
        frequencyDays: number;
        /** How many days a due item stays visible before hiding until next cycle */
        showForDays?: number;
        /** Delay in days before this metric first appears in the todo list (relative to account creation) */
        startAfterDays?: number;
    };

    /**
     * Whether this metric appears in the todo list by default.
     * Only relevant for metrics with a schedule.
     * Default: true (all scheduled metrics appear in todo list).
     * Set to false to hide from todo list unless the user explicitly enables it.
     */
    todoByDefault?: boolean;

    /**
     * Conditional rules for showing this metric in the todo list.
     * Only evaluated when todoByDefault is false and user hasn't explicitly configured.
     * AND-logic: all conditions must match for the item to appear.
     */
    todoRules?: TodoCondition[];
};

/** A captured metric entry (parsed from FHIR) */
export type ExternalHealthSourceMetadata = {
    platform: 'apple_health' | 'health_connect';
    externalId?: string;
    sourceApp?: string;
    deviceName?: string;
    importedAt?: string;
    adapterVersion?: string;
};

export type MetricEntry = {
    /** FHIR resource ID */
    id: string;

    /** Captured values keyed by field key */
    values: Record<string, number>;

    /** Timestamp of the measurement */
    date: Date;

    /** Unit used */
    unit: string;

    /** Source of the data */
    source?: string;

    /** Structured source metadata for imported Apple Health / Health Connect data. */
    externalHealth?: ExternalHealthSourceMetadata;

    /** When the entry was added to the system */
    addedAt?: Date;

    /** Role that recorded this entry (patient, caregiver, doctor) */
    recordedByRole?: string;
};

/** Metric with its entries */
export type MetricWithData = {
    definition: MetricDefinition;
    entries: MetricEntry[];
    latestEntry: MetricEntry | null;
};

// =============================================================================
// Base Definition Types (language-neutral)
// =============================================================================

/**
 * Base value label (without text).
 */
export type BaseValueLabel = {
    value: number;
};

/**
 * Base field definition (without text labels).
 */
export type BaseMetricField = {
    key: string;
    unit?: string;
    inputType: MetricInputType;
    decimalPlaces?: number;
    placeholder?: string;
    valueLabels?: BaseValueLabel[];
    fhirComponentCode?: FhirCoding;
    validation?: {
        min?: number;
        max?: number;
        required?: boolean;
    };
};

/**
 * Language-neutral metric base definition.
 * Contains only technical fields: id, fhir, fields structure, chart config.
 */
export type MetricBaseDefinition = {
    id: string;
    enabled?: boolean;
    icon: string;
    iconColor: string;
    fhir: {
        code: FhirCoding;
        category: ObservationCategory;
    };
    fields: BaseMetricField[];
    defaultUnit: string;
    showUnit?: boolean;
    availableUnits?: UnitOption[];
    externalHealth?: ExternalHealthMapping;
    chart: MetricChartConfig;
    canPin?: boolean;
    defaultPinned?: boolean;
    defaultPinnedOrder?: number;
    sortOrder?: number;
    category: MetricCategory;
    /** OSes on which this metric is available. Absent = all platforms. */
    platforms?: Array<'ios' | 'android'>;
    computed?: boolean;

    /** Optional tracking schedule. Metrics with schedule appear in todo list by default. */
    schedule?: {
        frequencyDays: number;
        /** How many days a due item stays visible before hiding until next cycle */
        showForDays?: number;
        /** Delay in days before this metric first appears in the todo list (relative to account creation) */
        startAfterDays?: number;
    };

    /**
     * Whether this metric appears in the todo list by default.
     * Only relevant for metrics with a schedule.
     * Default: true (all scheduled metrics appear in todo list).
     * Set to false to hide from todo list unless the user explicitly enables it.
     */
    todoByDefault?: boolean;

    /**
     * Conditional rules for showing this metric in the todo list.
     * Only evaluated when todoByDefault is false and user hasn't explicitly configured.
     * AND-logic: all conditions must match for the item to appear.
     */
    todoRules?: TodoCondition[];
};

// =============================================================================
// Locale Types (text content only)
// =============================================================================

/**
 * Value label text content.
 */
export type ValueLabelLocale = {
    label: string;
};

/**
 * Field text content.
 */
export type FieldLocale = {
    label: string;
    valueLabels?: Record<string, string>;
};

/**
 * Locale content for a metric.
 */
export type MetricLocale = {
    name: string;
    shortName?: string;
    descriptionTitle?: string;
    description: string;
    /** Short description optimised for PDF export. Falls back to `description` when absent. */
    exportDescription?: string;
    fields: Record<string, FieldLocale>;
};

// =============================================================================
// Merge Function
// =============================================================================

/**
 * Merge a base definition with locale texts to create a full MetricDefinition.
 */
export function mergeMetricDefinition(
    base: MetricBaseDefinition,
    locale: MetricLocale
): MetricDefinition {
    return {
        id: base.id,
        enabled: base.enabled,
        name: locale.name,
        shortName: locale.shortName,
        icon: base.icon,
        iconColor: base.iconColor,
        descriptionTitle: locale.descriptionTitle,
        description: locale.description,
        exportDescription: locale.exportDescription,
        fhir: base.fhir,
        fields: base.fields.map(baseField => {
            const fieldLocale = locale.fields[baseField.key];
            return {
                key: baseField.key,
                label: fieldLocale?.label ?? baseField.key,
                unit: baseField.unit,
                inputType: baseField.inputType,
                decimalPlaces: baseField.decimalPlaces,
                placeholder: baseField.placeholder,
                valueLabels: baseField.valueLabels?.map(vl => ({
                    value: vl.value,
                    label: fieldLocale?.valueLabels?.[String(vl.value)] ?? String(vl.value),
                })),
                fhirComponentCode: baseField.fhirComponentCode,
                validation: baseField.validation,
            };
        }),
        defaultUnit: base.defaultUnit,
        showUnit: base.showUnit,
        availableUnits: base.availableUnits,
        externalHealth: base.externalHealth,
        chart: base.chart,
        canPin: base.canPin,
        defaultPinned: base.defaultPinned,
        defaultPinnedOrder: base.defaultPinnedOrder,
        sortOrder: base.sortOrder,
        category: base.category,
        platforms: base.platforms,
        computed: base.computed,
        schedule: base.schedule,
        todoByDefault: base.todoByDefault,
        todoRules: base.todoRules,
    };
}
