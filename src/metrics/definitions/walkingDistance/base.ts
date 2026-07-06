import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'walking_distance',
    icon: 'figure.walk',
    iconColor: '#34C759',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '64098-7',
            display: 'Six minute walk test',
        },
        category: 'activity',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            validation: {
                min: 0,
                max: 1000,
                required: true,
            },
        },
    ],
    defaultUnit: 'm',
    availableUnits: [
        { value: 'm', label: 'Meter', measurementSystem: 'metric' },
        {
            value: 'ft',
            label: 'Feet',
            measurementSystem: 'us',
            fromDefault: { multiply: 3.280839895 },
            toDefault: { multiply: 0.3048 },
        },
    ],
    externalHealth: {
        aggregation: 'sample',
        importPolicy: { mode: 'daily-latest' },
        appleHealthKit: {
            // Apple's estimated six-minute walk distance, mapped onto the manual 6MWT metric.
            read: [
                { quantityType: 'HKQuantityTypeIdentifierSixMinuteWalkTestDistance', unit: 'm', field: 'value' },
            ],
        },
        // No Health Connect equivalent: import is iOS-only. Stays manually enterable on both.
    },
    chart: {
        type: 'bar',
        yAxis: {
            min: 0,
            padding: 0.15,
        },
    },
    canPin: true,
    sortOrder: 50,
    category: 'motor',
};
