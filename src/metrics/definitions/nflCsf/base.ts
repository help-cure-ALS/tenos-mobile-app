import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'nfl_csf',
    icon: 'drop.fill',
    iconColor: '#AF52DE',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '94677-2',
            display: 'Neurofilament light chain [Mass/volume] in Cerebral spinal fluid',
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
                max: 50000,
                required: true,
            },
        },
    ],
    defaultUnit: 'pg/ml',
    chart: {
        type: 'line',
        referenceLine: {
            value: 1000,
            label: 'Referenz',
        },
    },
    canPin: true,
    sortOrder: 71,
    category: 'biomarker',
};
