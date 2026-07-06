import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'body_temperature',
    icon: 'thermometer.medium',
    iconColor: '#FF6B6B',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '8310-5',
            display: 'Body temperature',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'value',
            inputType: 'decimal',
            decimalPlaces: 1,
            placeholder: '36,5',
            validation: {
                min: 34,
                max: 42,
                required: true,
            },
        },
    ],
    defaultUnit: '°C',
    availableUnits: [
        { value: '°C', label: 'Celsius', measurementSystem: 'metric' },
        {
            value: '°F',
            label: 'Fahrenheit',
            measurementSystem: 'us',
            fromDefault: { multiply: 1.8, add: 32 },
            toDefault: { multiply: 5 / 9, add: -32 * 5 / 9 },
        },
    ],
    externalHealth: {
        aggregation: 'sample',
        importPolicy: { mode: 'daily-latest' },
        appleHealthKit: {
            read: [
                {
                    quantityType: 'HKQuantityTypeIdentifierBodyTemperature',
                    unit: 'degC',
                    field: 'value',
                },
            ],
        },
        healthConnect: {
            read: [
                {
                    recordType: 'BodyTemperature',
                    fieldPath: 'temperature.inCelsius',
                    unit: '°C',
                    field: 'value',
                },
            ],
        },
    },
    chart: {
        type: 'line',
        referenceLine: {
            value: 37.0,
            label: 'Normal',
        },
        yAxis: {
            min: 35,
            max: 40,
            padding: 0.1,
        },
    },
    canPin: true,
    sortOrder: 22,
    category: 'vital-signs',
};
