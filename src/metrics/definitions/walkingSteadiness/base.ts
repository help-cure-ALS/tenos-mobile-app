import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'walking_steadiness',
    icon: 'figure.fall',
    iconColor: '#FF9500',
    fhir: {
        code: {
            // No standard LOINC for Apple Walking Steadiness; use a TENOS code system.
            system: 'https://tenos.health/fhir/CodeSystem/device-metric',
            code: 'apple-walking-steadiness',
            display: 'Apple Walking Steadiness',
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
                max: 100,
                required: true,
            },
        },
    ],
    defaultUnit: '%',
    // iOS-only: derived passively from Apple "Mobility" data, no Android source and no
    // realistic manual entry. Hidden entirely on Android via the platforms filter.
    platforms: ['ios'],
    externalHealth: {
        aggregation: 'sample',
        importPolicy: { mode: 'daily-latest' },
        appleHealthKit: {
            read: [
                { quantityType: 'HKQuantityTypeIdentifierAppleWalkingSteadiness', unit: '%', field: 'value' },
            ],
        },
    },
    chart: {
        type: 'line',
        yAxis: {
            min: 0,
            max: 100,
            padding: 0.1,
        },
    },
    canPin: true,
    sortOrder: 53,
    category: 'motor',
};
