import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'caloric_intake',
    icon: 'fork.knife',
    iconColor: '#FF9F0A',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '9052-2',
            display: 'Caloric intake total 24 hour',
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
                max: 6000,
                required: true,
            },
        },
    ],
    defaultUnit: 'kcal',
    externalHealth: {
        aggregation: 'daily-sum',
        importPolicy: { mode: 'daily-sum' },
        appleHealthKit: {
            read: [
                { quantityType: 'HKQuantityTypeIdentifierDietaryEnergyConsumed', unit: 'kcal', field: 'value' },
            ],
        },
        healthConnect: {
            read: [
                { recordType: 'Nutrition', fieldPath: 'energy.inKilocalories', unit: 'kcal', field: 'value' },
            ],
        },
    },
    chart: {
        type: 'bar',
        yAxis: {
            min: 0,
            padding: 0.1,
        },
    },
    canPin: true,
    sortOrder: 56,
    category: 'nutrition',
};
