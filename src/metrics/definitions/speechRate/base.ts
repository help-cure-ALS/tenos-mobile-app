import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'speech_rate',
    icon: 'waveform',
    iconColor: '#5856D6',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '89016-0',
            display: 'Speech Assessment',
        },
        category: 'survey',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            validation: {
                min: 10,
                max: 250,
                required: true,
            },
        },
    ],
    defaultUnit: 'wpm',
    chart: {
        type: 'line',
    },
    canPin: true,
    sortOrder: 60,
    category: 'bulbar',
};
