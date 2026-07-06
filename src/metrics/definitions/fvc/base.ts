import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'fvc',
    icon: 'wind',
    iconColor: '#5AC8FA',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '19868-9',
            display: 'Forced vital capacity [Volume] Respiratory system by Spirometry',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'value',
            inputType: 'decimal',
            decimalPlaces: 2,
            placeholder: '0,00',
            validation: {
                min: 0.5,
                max: 8.0,
                required: true,
            },
        },
    ],
    defaultUnit: 'L',
    externalHealth: {
        aggregation: 'sample',
        importPolicy: { mode: 'daily-latest' },
        appleHealthKit: {
            read: [
                { quantityType: 'HKQuantityTypeIdentifierForcedVitalCapacity', unit: 'L', field: 'value' },
            ],
        },
        // No Health Connect equivalent: FVC import is iOS-only. The metric stays
        // manually enterable on both platforms.
    },
    chart: {
        type: 'line',
        yAxis: {
            padding: 0.15,
        },
    },
    canPin: true,
    sortOrder: 30,
    category: 'respiratory',
    schedule: { frequencyDays: 7, showForDays: 3 },
    todoByDefault: false,
    todoRules: [
        {
            type: 'questionnaireDomainScore',
            questionnaireId: 'alsfrs-r',
            domainId: 'respiratory',
            operator: 'lt',
            value: 8,
        },
    ],
};
