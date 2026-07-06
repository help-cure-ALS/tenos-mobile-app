import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'fluid_intake',
    icon: 'drop.fill',
    iconColor: '#007AFF',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '8999-5',
            display: 'Fluid intake 24 hour Measured',
        },
        category: 'survey',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            validation: {
                min: 0,
                max: 5000,
                required: true,
            },
        },
    ],
    defaultUnit: 'ml',
    externalHealth: {
        aggregation: 'daily-sum',
        importPolicy: { mode: 'daily-sum' },
        appleHealthKit: {
            // HealthKit reports water in 'mL'; numerically identical to the canonical 'ml'.
            read: [
                { quantityType: 'HKQuantityTypeIdentifierDietaryWater', unit: 'mL', field: 'value' },
            ],
        },
        healthConnect: {
            read: [
                { recordType: 'Hydration', fieldPath: 'volume.inMilliliters', unit: 'mL', field: 'value' },
            ],
        },
    },
    chart: {
        type: 'bar',
        yAxis: {
            min: 0,
            padding: 0.1,
        },
        referenceLine: {
            value: 1500,
            label: 'Min. empfohlen',
        },
    },
    canPin: true,
    sortOrder: 55,
    category: 'nutrition',
};
