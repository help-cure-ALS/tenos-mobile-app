import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'swallowing_time',
    icon: 'mouth.fill',
    iconColor: '#FF6B9D',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '72106-8',
            display: 'Swallowing function',
        },
        category: 'survey',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            validation: {
                min: 1,
                max: 300,
                required: true,
            },
        },
    ],
    defaultUnit: 'sek',
    chart: {
        type: 'line',
    },
    canPin: true,
    sortOrder: 61,
    category: 'bulbar',
};
