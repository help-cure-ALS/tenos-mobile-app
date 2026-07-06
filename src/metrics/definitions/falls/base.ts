import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'falls',
    icon: 'figure.fall',
    iconColor: '#FF9500',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '52552-7',
            display: 'Falls in the past year',
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
                max: 50,
                required: true,
            },
        },
    ],
    defaultUnit: '',
    showUnit: false,
    externalHealth: {
        aggregation: 'daily-sum',
        importPolicy: { mode: 'daily-sum' },
        appleHealthKit: {
            // NumberOfTimesFallen is a HealthKit *quantity* type (unit: count), not a
            // category type — there is no HKCategoryTypeIdentifierNumberOfTimesFallen.
            read: [
                { quantityType: 'HKQuantityTypeIdentifierNumberOfTimesFallen', unit: 'count', field: 'value' },
            ],
        },
        // No Health Connect equivalent: import is iOS-only. The metric stays manually
        // enterable on both platforms, so no `platforms` restriction.
    },
    chart: {
        type: 'bar',
        yAxis: {
            min: 0,
            padding: 0.2,
        },
        showAverage: false,
    },
    canPin: true,
    sortOrder: 45,
    category: 'motor',
};
