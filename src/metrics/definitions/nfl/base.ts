import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'nfl',
    icon: 'drop.fill',
    iconColor: '#FF9500',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '94505-5',
            display: 'Neurofilament light chain [Mass/volume] in Serum or Plasma',
        },
        category: 'laboratory',
    },
    fields: [
        {
            key: 'value',
            inputType: 'decimal',
            decimalPlaces: 1,
            placeholder: '0,0',
            validation: {
                min: 0,
                max: 10000,
                required: true,
            },
        },
    ],
    defaultUnit: 'pg/ml',
    chart: {
        type: 'line',
        referenceLine: {
            value: 20,
            label: 'Referenz',
        },
    },
    canPin: true,
    sortOrder: 30,
    category: 'biomarker',
};
