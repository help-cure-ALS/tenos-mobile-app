import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'step_count',
    icon: 'figure.walk',
    iconColor: '#34C759',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '55423-8',
            display: 'Number of steps in unspecified time Pedometer',
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
                max: 100000,
                required: true,
            },
        },
    ],
    defaultUnit: 'count',
    showUnit: false,
    externalHealth: {
        aggregation: 'daily-sum',
        importPolicy: { mode: 'daily-sum' },
        appleHealthKit: {
            read: [
                { quantityType: 'HKQuantityTypeIdentifierStepCount', unit: 'count', field: 'value' },
            ],
        },
        healthConnect: {
            read: [
                { recordType: 'Steps', fieldPath: 'count', unit: 'count', field: 'value' },
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
    sortOrder: 52,
    category: 'motor',
};
