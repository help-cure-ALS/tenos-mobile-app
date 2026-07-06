import type { MetricBaseDefinition } from '../../types';

// NOTE: this folder is still named `hrv` for sandbox reasons; it now hosts the iOS-only
// SDNN metric. Rename the folder to `hrvSdnn` on commit if desired (update the import in
// ../index.ts accordingly).
export const base: MetricBaseDefinition = {
    id: 'hrv_sdnn',
    icon: 'bolt.heart.fill',
    iconColor: '#FF2D55',
    fhir: {
        code: {
            system: 'https://tenos.health/fhir/CodeSystem/device-metric',
            code: 'heart-rate-variability-sdnn',
            display: 'Heart rate variability (SDNN)',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            validation: {
                min: 0,
                max: 300,
                required: true,
            },
        },
    ],
    defaultUnit: 'ms',
    // iOS-only: Apple Health exposes HRV as SDNN. Android uses a different measure (RMSSD),
    // handled by the separate hrv_rmssd metric, so this one is hidden on Android.
    platforms: ['ios'],
    externalHealth: {
        aggregation: 'daily-average',
        importPolicy: { mode: 'daily-average' },
        appleHealthKit: {
            read: [
                { quantityType: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', unit: 'ms', field: 'value' },
            ],
        },
    },
    chart: {
        type: 'line',
        yAxis: {
            padding: 0.15,
        },
    },
    canPin: true,
    sortOrder: 13,
    category: 'vital-signs',
};
