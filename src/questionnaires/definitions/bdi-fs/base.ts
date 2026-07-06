import type { QuestionnaireBaseDefinition } from '../../types';

export const base: QuestionnaireBaseDefinition = {
    id: 'bdi-fs',
    sortOrder: 5,
    icon: 'brain',
    iconColor: '#5856D6',
    fhir: {
        storageStrategy: 'hybrid',
        questionnaireUrl: 'https://example.org/questionnaire/bdi-fs',
        observationCategory: 'survey',
        totalScoreCode: {
            system: 'http://loinc.org',
            code: '89208-3',
            display: 'BDI-FS total score',
        },
    },
    scoring: {
        maxScore: 21,
        higherIsBetter: false,
        calculateDomainScores: false,
        showScore: false,
        interpretations: [
            { minScore: 0, maxScore: 3, color: '#34C759' },
            { minScore: 4, maxScore: 8, color: '#5856D6' },
            { minScore: 9, maxScore: 12, color: '#FF9500' },
            { minScore: 13, maxScore: 21, color: '#FF3B30' },
        ],
    },
    domains: [
        {
            id: 'cognitive',
            questions: [
                { id: 'sadness', linkId: '1', optionValues: [0, 1, 2, 3], inputType: 'list' },
                { id: 'pessimism', linkId: '2', optionValues: [0, 1, 2, 3], inputType: 'list' },
                { id: 'past_failure', linkId: '3', optionValues: [0, 1, 2, 3], inputType: 'list' },
                { id: 'loss_of_pleasure', linkId: '4', optionValues: [0, 1, 2, 3], inputType: 'list' },
                { id: 'self_dislike', linkId: '5', optionValues: [0, 1, 2, 3], inputType: 'list' },
                { id: 'self_criticalness', linkId: '6', optionValues: [0, 1, 2, 3], inputType: 'list' },
                {
                    id: 'suicidal_thoughts',
                    linkId: '7',
                    optionValues: [0, 1, 2, 3],
                    inputType: 'list',
                    storeAsObservation: true,
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '39482-4',
                        display: 'Suicidal ideation',
                    },
                    fhirUnit: '/3',
                },
            ],
        },
    ],
    estimatedMinutes: 3,
    schedule: { frequencyDays: 14, enforced: true, showForDays: 3, startAfterDays: 14 },
    highlighted: true,
};
