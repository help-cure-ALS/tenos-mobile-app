import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'fatigue',
    icon: 'battery.25percent',
    iconColor: '#8E8E93',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '68858-0',
            display: 'Fatigue assessment',
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
                { value: 5 },
                { value: 6 },
                { value: 7 },
                { value: 8 },
                { value: 9 },
                { value: 10 },
            ],
            validation: {
                min: 0,
                max: 10,
                required: true,
            },
        },
    ],
    defaultUnit: '/10',
    showUnit: false,
    chart: {
        type: 'line',
        yAxis: {
            min: 0,
            max: 10,
            padding: 0,
        },
    },
    canPin: true,
    sortOrder: 41,
    category: 'symptoms',
};
