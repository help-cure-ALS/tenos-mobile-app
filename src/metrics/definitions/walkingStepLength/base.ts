import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'walking_step_length',
    icon: 'figure.walk',
    iconColor: '#5856D6',
    fhir: {
        code: {
            system: 'https://tenos.health/fhir/CodeSystem/device-metric',
            code: 'walking-step-length',
            display: 'Walking step length',
        },
        category: 'activity',
    },
    fields: [
        {
            key: 'value',
            inputType: 'decimal',
            decimalPlaces: 2,
            placeholder: '0,00',
            validation: {
                min: 0,
                max: 2,
                required: true,
            },
        },
    ],
    defaultUnit: 'm',
    platforms: ['ios'],
    externalHealth: {
        aggregation: 'daily-average',
        importPolicy: { mode: 'daily-average' },
        appleHealthKit: {
            read: [
                { quantityType: 'HKQuantityTypeIdentifierWalkingStepLength', unit: 'm', field: 'value' },
            ],
        },
    },
    chart: {
        type: 'line',
        yAxis: {
            min: 0,
            padding: 0.15,
        },
    },
    canPin: true,
    sortOrder: 53,
    category: 'motor',
};
