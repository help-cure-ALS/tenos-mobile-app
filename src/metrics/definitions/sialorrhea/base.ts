import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'sialorrhea',
    icon: 'drop.triangle.fill',
    iconColor: '#64D2FF',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '67535-5',
            display: 'Sialorrhea severity',
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
    sortOrder: 62,
    category: 'bulbar',
};
