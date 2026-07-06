import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'pain_level',
    icon: 'bolt.fill',
    iconColor: '#FF3B30',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '54834-7',
            display: 'Pain severity verbal descriptor scale',
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
                { value: 4 },
            ],
            validation: {
                min: 0,
                max: 4,
                required: true,
            },
        },
    ],
    defaultUnit: '/4',
    showUnit: false,
    chart: {
        type: 'line',
        yAxis: {
            min: 0,
            max: 4,
            padding: 0,
        },
    },
    canPin: true,
    sortOrder: 40,
    category: 'symptoms',
};
