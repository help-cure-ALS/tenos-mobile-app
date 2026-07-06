import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'nocturnal_spo2',
    icon: 'moon.fill',
    iconColor: '#5E5CE6',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '59408-5',
            display: 'Oxygen saturation in Arterial blood by Pulse oximetry',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            validation: {
                min: 60,
                max: 100,
                required: true,
            },
        },
    ],
    defaultUnit: '%',
    chart: {
        type: 'range',
        yAxis: {
            min: 80,
            max: 100,
            padding: 0,
        },
    },
    canPin: true,
    sortOrder: 26,
    category: 'vital-signs',
};
