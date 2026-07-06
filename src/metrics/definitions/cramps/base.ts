import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'cramps',
    icon: 'bolt.horizontal.fill',
    iconColor: '#FF9500',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '80323-0',
            display: 'Muscle cramp',
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
                max: 100,
                required: true,
            },
        },
    ],
    defaultUnit: '/Tag',
    chart: {
        type: 'bar',
        yAxis: {
            min: 0,
            padding: 0.2,
        },
        showAverage: false,
    },
    canPin: true,
    sortOrder: 63,
    category: 'symptoms',
};
