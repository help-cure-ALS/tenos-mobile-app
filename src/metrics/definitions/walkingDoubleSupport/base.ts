import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'walking_double_support',
    icon: 'figure.walk',
    iconColor: '#FF2D55',
    fhir: {
        code: {
            system: 'https://tenos.health/fhir/CodeSystem/device-metric',
            code: 'walking-double-support',
            display: 'Walking double support time',
        },
        category: 'activity',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            validation: {
                min: 0,
                max: 100,
                required: true,
            },
        },
    ],
    defaultUnit: '%',
    platforms: ['ios'],
    externalHealth: {
        aggregation: 'daily-average',
        importPolicy: { mode: 'daily-average' },
        appleHealthKit: {
            read: [
                { quantityType: 'HKQuantityTypeIdentifierWalkingDoubleSupportPercentage', unit: '%', field: 'value' },
            ],
        },
    },
    chart: {
        type: 'line',
        yAxis: {
            min: 0,
            max: 100,
            padding: 0.1,
        },
    },
    canPin: true,
    sortOrder: 55,
    category: 'motor',
};
