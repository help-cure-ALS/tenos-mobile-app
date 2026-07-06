import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'suicidality',
    icon: 'exclamationmark.triangle.fill',
    iconColor: '#FF3B30',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '44260-8',
            display: 'PHQ-9 item 9 - Thoughts of self-harm',
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
        yAxis: {
            min: 0,
            max: 3,
            padding: 0,
        },
    },
    canPin: true,
    sortOrder: 99,
    category: 'symptoms',
};
