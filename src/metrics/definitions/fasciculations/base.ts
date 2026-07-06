import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'fasciculations',
    icon: 'bolt.fill',
    iconColor: '#FFCC00',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '89261-2',
            display: 'Symptom severity score',
        },
        category: 'survey',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            valueLabels: [
                { value: 0 },
                { value: 1 },
                { value: 2 },
                { value: 3 },
            ],
            validation: {
                min: 0,
                max: 3,
                required: true,
            },
        },
    ],
    defaultUnit: '/3',
    showUnit: false,
    chart: {
        type: 'line',
        showChart: false,
        showAverage: false,
        yAxis: {
            min: 0,
            max: 3,
            padding: 0,
        },
    },
    canPin: true,
    sortOrder: 66,
    category: 'symptoms',
};
