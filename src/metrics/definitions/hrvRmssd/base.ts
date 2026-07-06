import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'hrv_rmssd',
    icon: 'bolt.heart.fill',
    iconColor: '#FF2D55',
    fhir: {
        code: {
            system: 'https://tenos.health/fhir/CodeSystem/device-metric',
            code: 'heart-rate-variability-rmssd',
            display: 'Heart rate variability (RMSSD)',
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
    // Android-only: Health Connect exposes HRV as RMSSD. iOS uses a different measure (SDNN),
    // handled by the separate hrv_sdnn metric, so this one is hidden on iOS.
    platforms: ['android'],
    externalHealth: {
        aggregation: 'daily-average',
        importPolicy: { mode: 'daily-average' },
        healthConnect: {
            read: [
                { recordType: 'HeartRateVariabilityRmssd', fieldPath: 'heartRateVariabilityMillis', unit: 'ms', field: 'value' },
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
