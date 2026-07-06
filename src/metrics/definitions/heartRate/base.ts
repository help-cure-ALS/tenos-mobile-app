import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'heart_rate',
    icon: 'heart.fill',
    iconColor: '#FF3B30',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            validation: {
                min: 30,
                max: 250,
                required: true,
            },
        },
    ],
    defaultUnit: 'bpm',
    externalHealth: {
        aggregation: 'sample',
        importPolicy: { mode: 'daily-latest' },
        appleHealthKit: {
            read: [
                {
                    quantityType: 'HKQuantityTypeIdentifierRestingHeartRate',
                    unit: 'count/min',
                    field: 'value',
                },
            ],
        },
        healthConnect: {
            read: [
                {
                    recordType: 'RestingHeartRate',
                    fieldPath: 'beatsPerMinute',
                    unit: 'bpm',
                    field: 'value',
                },
            ],
        },
    },
    chart: {
        type: 'range',
        yAxis: {
            min: 40,
            max: 140,
            padding: 0.1,
        },
    },
    canPin: true,
    defaultPinned: false,
    defaultPinnedOrder: 20,
    sortOrder: 20,
    category: 'vital-signs',
};
