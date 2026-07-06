import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'cold_sensitivity',
    icon: 'snowflake',
    iconColor: '#5AC8FA',
    fhir: {
        code: {
            system: 'http://example.org/fhir/CodeSystem/als-metrics',
            code: 'cold-sensitivity',
            display: 'Cold sensitivity severity',
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
    sortOrder: 64,
    category: 'symptoms',
};
