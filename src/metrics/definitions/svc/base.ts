import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'svc',
    icon: 'wind',
    iconColor: '#5AC8FA',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '98088-8',
            display: 'Vital capacity/predicted VC Respiratory system by Spirometry',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'value',
            inputType: 'integer',
            placeholder: '0',
            validation: {
                min: 10,
                max: 150,
                required: true,
            },
        },
    ],
    defaultUnit: '%',
    // No externalHealth block: neither HealthKit nor Health Connect offer a
    // (slow) vital capacity type. The metric is manually enterable on both
    // platforms.
    chart: {
        type: 'line',
        yAxis: {
            max: 120,
            padding: 0.1,
        },
        referenceLine: {
            value: 80,
            label: 'Normal',
        },
    },
    canPin: true,
    sortOrder: 31,
    category: 'respiratory',
    schedule: { frequencyDays: 7, showForDays: 3 },
    todoByDefault: false,
    todoRules: [
        // Doctor-only: SVC is measured with spirometry equipment that
        // patients do not have at home — never suggest it as a patient todo
        {
            roles: ['doctor'],
            conditions: [
                {
                    type: 'questionnaireDomainScore',
                    questionnaireId: 'alsfrs-r',
                    domainId: 'respiratory',
                    operator: 'lt',
                    value: 8,
                },
            ],
        },
    ],
};
