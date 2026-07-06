import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'walking_speed',
    icon: 'figure.walk',
    iconColor: '#34C759',
    fhir: {
        code: {
            system: 'https://tenos.health/fhir/CodeSystem/device-metric',
            code: 'walking-speed',
            display: 'Walking speed',
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
    externalHealth: {
        aggregation: 'daily-average',
        importPolicy: { mode: 'daily-average' },
        appleHealthKit: {
            read: [
                { quantityType: 'HKQuantityTypeIdentifierWalkingSpeed', unit: 'm/s', field: 'value' },
            ],
        },
        healthConnect: {
            // SpeedRecord is a series record; the HC adapter expands `samples[].speed`.
            read: [
                { recordType: 'Speed', fieldPath: 'speed.inMetersPerSecond', unit: 'm/s', field: 'value' },
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
    sortOrder: 51,
    category: 'motor',
};
