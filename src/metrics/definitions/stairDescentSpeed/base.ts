import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'stair_descent_speed',
    icon: 'arrow.down',
    iconColor: '#5AC8FA',
    fhir: {
        code: {
            system: 'https://tenos.health/fhir/CodeSystem/device-metric',
            code: 'stair-descent-speed',
            display: 'Stair descent speed',
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
                max: 3,
                required: true,
            },
        },
    ],
    defaultUnit: 'm/s',
    platforms: ['ios'],
    externalHealth: {
        aggregation: 'daily-average',
        importPolicy: { mode: 'daily-average' },
        appleHealthKit: {
            read: [
                { quantityType: 'HKQuantityTypeIdentifierStairDescentSpeed', unit: 'm/s', field: 'value' },
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
    sortOrder: 56,
    category: 'motor',
};
