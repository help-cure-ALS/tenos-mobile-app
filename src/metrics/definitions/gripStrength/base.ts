import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'grip_strength',
    icon: 'hand.raised.fill',
    iconColor: '#FF9F0A',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '83193-4',
            display: 'Grip strength panel',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'left',
            inputType: 'decimal',
            decimalPlaces: 1,
            placeholder: '0,0',
            fhirComponentCode: {
                system: 'http://loinc.org',
                code: '83191-8',
                display: 'Grip strength Hand - left Dynamometer',
            },
            validation: {
                min: 0,
                max: 100,
                required: true,
            },
        },
        {
            key: 'right',
            inputType: 'decimal',
            decimalPlaces: 1,
            placeholder: '0,0',
            fhirComponentCode: {
                system: 'http://loinc.org',
                code: '83189-2',
                display: 'Grip strength Hand - right Dynamometer',
            },
            validation: {
                min: 0,
                max: 100,
                required: true,
            },
        },
    ],
    defaultUnit: 'kg',
    availableUnits: [
        { value: 'kg', label: 'Kilogramm', measurementSystem: 'metric' },
        {
            value: 'lb',
            label: 'Pfund',
            measurementSystem: 'us',
            fromDefault: { multiply: 2.20462262185 },
            toDefault: { multiply: 0.45359237 },
        },
    ],
    chart: {
        type: 'scatter',
        primaryField: 'right',
        secondaryField: 'left',
        yAxis: {
            padding: 0.15,
        },
    },
    canPin: true,
    sortOrder: 35,
    category: 'motor',
};
