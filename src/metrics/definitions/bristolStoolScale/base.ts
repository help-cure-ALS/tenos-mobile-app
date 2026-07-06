import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'bristol_stool_scale',
    icon: 'toilet.fill',
    iconColor: '#8E8E93',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '11029-8',
            display: 'Bristol stool scale',
        },
        category: 'survey',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '4',
            valueLabels: [
                { value: 1 },
                { value: 2 },
                { value: 3 },
                { value: 4 },
                { value: 5 },
                { value: 6 },
                { value: 7 },
            ],
            validation: {
                min: 1,
                max: 7,
                required: true,
            },
        },
    ],
    defaultUnit: '/7',
    showUnit: false,
    chart: {
        type: 'line',
        referenceLine: {
            value: 4,
            label: 'Ideal',
        },
        showAverage: false,
        yAxis: {
            min: 1,
            max: 7,
            padding: 0,
        },
    },
    canPin: true,
    sortOrder: 65,
    category: 'digestion',
};
