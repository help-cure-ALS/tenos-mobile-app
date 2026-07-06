import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'pain_mood',
    icon: 'face.dashed',
    iconColor: '#AF52DE',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '75263-0',
            display: 'Pain interference with mood',
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
    sortOrder: 44,
    category: 'symptoms',
};
