import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'respiratory_rate',
    icon: 'lungs.fill',
    iconColor: '#5AC8FA',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '9279-1',
            display: 'Respiratory rate',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            validation: {
                min: 4,
                max: 60,
                required: true,
            },
        },
    ],
    defaultUnit: 'count/min',
    externalHealth: {
        aggregation: 'daily-average',
        importPolicy: { mode: 'daily-average' },
        appleHealthKit: {
            read: [
                { quantityType: 'HKQuantityTypeIdentifierRespiratoryRate', unit: 'count/min', field: 'value' },
            ],
        },
        healthConnect: {
            read: [
                { recordType: 'RespiratoryRate', fieldPath: 'rate', unit: 'count/min', field: 'value' },
            ],
        },
    },
    chart: {
        type: 'line',
        yAxis: {
            padding: 0.15,
        },
    },
    canPin: true,
    sortOrder: 34,
    category: 'respiratory',
};
