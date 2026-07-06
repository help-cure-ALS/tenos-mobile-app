import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'bmi',
    icon: 'figure.arms.open',
    iconColor: '#AF52DE',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '39156-5',
            display: 'Body mass index (BMI) [Ratio]',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'value',
            inputType: 'decimal',
            decimalPlaces: 1,
            placeholder: '0,0',
            validation: {
                min: 10,
                max: 60,
                required: true,
            },
        },
    ],
    defaultUnit: 'kg/m²',
    chart: {
        type: 'line',
        referenceLine: {
            value: 25,
            label: 'Normalgewicht',
        },
    },
    canPin: true,
    sortOrder: 15,
    category: 'body',
};
