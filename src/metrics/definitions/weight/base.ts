import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'weight',
    icon: 'scalemass.fill',
    iconColor: '#FF6B9D',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '29463-7',
            display: 'Body weight',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'value',
            inputType: 'decimal',
            decimalPlaces: 1,
            placeholder: '0,0',
            validation: {
                min: 20,
                max: 300,
                required: true,
            },
        },
    ],
    defaultUnit: 'kg',
    availableUnits: [
        { value: 'kg', label: 'Kilogramm', measurementSystem: 'metric' },
        {
            value: 'lb',
            label: 'Pfund',
            measurementSystem: 'us',
            fromDefault: { multiply: 2.20462262185 },
            toDefault: { multiply: 0.45359237 },
        },
    ],
    externalHealth: {
        aggregation: 'sample',
        importPolicy: { mode: 'daily-latest' },
        appleHealthKit: {
            read: [
                {
                    quantityType: 'HKQuantityTypeIdentifierBodyMass',
                    unit: 'kg',
                    field: 'value',
                },
            ],
        },
        healthConnect: {
            read: [
                {
                    recordType: 'Weight',
                    fieldPath: 'weight.inKilograms',
                    unit: 'kg',
                    field: 'value',
                },
            ],
        },
    },
    chart: {
        type: 'line',
        yAxis: {
            padding: 1,
        },
    },
    canPin: true,
    defaultPinned: true,
    defaultPinnedOrder: 10,
    sortOrder: 10,
    category: 'body',
    schedule: { frequencyDays: 4, showForDays: 2 },
};
