import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'fvc_percent',
    icon: 'wind',
    iconColor: '#5AC8FA',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '19870-5',
            display: 'Forced vital capacity [Volume] Respiratory system by Spirometry --predicted',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            validation: {
                min: 10,
                max: 150,
                required: true,
            },
        },
    ],
    defaultUnit: '%',
    chart: {
        type: 'line',
        yAxis: {
            max: 120,
            padding: 0.1,
        },
        referenceLine: {
            value: 80,
            label: 'Normal',
        },
    },
    canPin: true,
    sortOrder: 31,
    category: 'respiratory',
};
