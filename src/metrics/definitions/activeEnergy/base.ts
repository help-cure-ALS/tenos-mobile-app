import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'active_energy',
    icon: 'flame.fill',
    iconColor: '#FF9500',
    fhir: {
        code: {
            system: 'https://tenos.health/fhir/CodeSystem/device-metric',
            code: 'active-energy-burned',
            display: 'Active energy burned',
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
                max: 10000,
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
                { quantityType: 'HKQuantityTypeIdentifierActiveEnergyBurned', unit: 'kcal', field: 'value' },
            ],
        },
        healthConnect: {
            read: [
                { recordType: 'ActiveCaloriesBurned', fieldPath: 'energy.inKilocalories', unit: 'kcal', field: 'value' },
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
    sortOrder: 57,
    category: 'nutrition',
};
