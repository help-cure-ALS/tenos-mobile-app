import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'blood_oxygen',
    icon: 'lungs.fill',
    iconColor: '#30D158',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '2708-6',
            display: 'Oxygen saturation in Arterial blood',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            validation: {
                min: 70,
                max: 100,
                required: true,
            },
        },
    ],
    defaultUnit: '%',
    externalHealth: {
        aggregation: 'sample',
        importPolicy: { mode: 'daily-latest' },
        appleHealthKit: {
            read: [
                {
                    quantityType: 'HKQuantityTypeIdentifierOxygenSaturation',
                    unit: '%',
                    field: 'value',
                },
            ],
        },
        healthConnect: {
            read: [
                {
                    recordType: 'OxygenSaturation',
                    fieldPath: 'percentage',
                    unit: '%',
                    field: 'value',
                },
            ],
        },
    },
    chart: {
        type: 'range',
        showRange: true,
        showLastMeasurement: true,
        yAxis: {
            min: 85,
            max: 100,
            padding: 0,
        },
    },
    canPin: true,
    sortOrder: 25,
    category: 'vital-signs',
};
