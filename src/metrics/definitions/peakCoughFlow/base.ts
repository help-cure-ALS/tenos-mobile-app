import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'peak_cough_flow',
    icon: 'arrow.up.forward.circle.fill',
    iconColor: '#AF52DE',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '33452-4',
            display: 'Peak inspiratory flow rate',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            validation: {
                min: 50,
                max: 720,
                required: true,
            },
        },
    ],
    defaultUnit: 'L/min',
    chart: {
        type: 'line',
    },
    canPin: true,
    sortOrder: 32,
    category: 'respiratory',
};
