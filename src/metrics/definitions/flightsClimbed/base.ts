import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'flights_climbed',
    icon: 'arrow.up',
    iconColor: '#34C759',
    fhir: {
        code: {
            // No standard LOINC for flights climbed; use a TENOS code system.
            system: 'https://tenos.health/fhir/CodeSystem/device-metric',
            code: 'flights-climbed',
            display: 'Flights climbed',
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
    defaultUnit: 'count',
    showUnit: false,
    externalHealth: {
        aggregation: 'daily-sum',
        importPolicy: { mode: 'daily-sum' },
        appleHealthKit: {
            read: [
                { quantityType: 'HKQuantityTypeIdentifierFlightsClimbed', unit: 'count', field: 'value' },
            ],
        },
        healthConnect: {
            read: [
                { recordType: 'FloorsClimbed', fieldPath: 'floors', unit: 'count', field: 'value' },
            ],
        },
    },
    chart: {
        type: 'bar',
        yAxis: {
            min: 0,
            padding: 0.1,
        },
    },
    canPin: true,
    sortOrder: 55,
    category: 'motor',
};
