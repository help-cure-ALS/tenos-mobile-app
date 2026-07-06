import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'walking_asymmetry',
    icon: 'figure.walk',
    iconColor: '#FF9500',
    fhir: {
        code: {
            system: 'https://tenos.health/fhir/CodeSystem/device-metric',
            code: 'walking-asymmetry',
            display: 'Walking asymmetry',
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
                { quantityType: 'HKQuantityTypeIdentifierWalkingAsymmetryPercentage', unit: '%', field: 'value' },
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
    sortOrder: 54,
    category: 'motor',
};
