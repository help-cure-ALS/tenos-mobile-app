import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'body_fat',
    icon: 'percent',
    iconColor: '#FF9500',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '41982-0',
            display: 'Percentage body fat Measured',
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
                min: 1,
                max: 70,
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
                    quantityType: 'HKQuantityTypeIdentifierBodyFatPercentage',
                    unit: '%',
                    field: 'value',
                },
            ],
        },
        healthConnect: {
            read: [
                {
                    recordType: 'BodyFat',
                    fieldPath: 'percentage',
                    unit: '%',
                    field: 'value',
                },
            ],
        },
    },
    chart: {
        type: 'line',
        yAxis: {
            min: 0,
            max: 50,
            padding: 0.1,
        },
    },
    canPin: true,
    sortOrder: 15,
    category: 'body',
};
