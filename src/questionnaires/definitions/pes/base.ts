import type { QuestionnaireBaseDefinition } from '../../types';

export const base: QuestionnaireBaseDefinition = {
    id: 'pes',
    sortOrder: 3,
    icon: 'bolt.heart.fill',
    iconColor: '#FF3B30',
    fhir: {
        storageStrategy: 'hybrid',
        questionnaireUrl: 'https://example.org/questionnaire/mos-pain-effects-scale',
        observationCategory: 'survey',
    },
    scoring: {
        maxScore: 60,
        higherIsBetter: false,
        calculateDomainScores: true,
        showScore: false,
        interpretations: [
            { minScore: 0, maxScore: 10, color: '#34C759' },
            { minScore: 11, maxScore: 25, color: '#5856D6' },
            { minScore: 26, maxScore: 40, color: '#FF9500' },
            { minScore: 41, maxScore: 60, color: '#FF3B30' },
        ],
    },
    domains: [
        {
            id: 'daily_activities',
            questions: [
                {
                    id: 'sleep',
                    linkId: '1',
                    optionValues: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                    inputType: 'slider',
                    defaultValue: 0,
                    storeAsObservation: true,
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '75261-4',
                        display: 'Pain interference with sleep',
                    },
                    fhirUnit: '/10',
                },
                {
                    id: 'mobility',
                    linkId: '2',
                    optionValues: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                    inputType: 'slider',
                    defaultValue: 0,
                    storeAsObservation: true,
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '75262-2',
                        display: 'Pain interference with mobility',
                    },
                    fhirUnit: '/10',
                },
                {
                    id: 'mood',
                    linkId: '3',
                    optionValues: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                    inputType: 'slider',
                    defaultValue: 0,
                    storeAsObservation: true,
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '75263-0',
                        display: 'Pain interference with mood',
                    },
                    fhirUnit: '/10',
                },
            ],
        },
        {
            id: 'other_areas',
            questions: [
                {
                    id: 'work',
                    linkId: '4',
                    optionValues: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                    inputType: 'slider',
                    defaultValue: 0,
                    storeAsObservation: false,
                },
                {
                    id: 'recreation',
                    linkId: '5',
                    optionValues: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                    inputType: 'slider',
                    defaultValue: 0,
                    storeAsObservation: false,
                },
                {
                    id: 'enjoyment',
                    linkId: '6',
                    optionValues: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                    inputType: 'slider',
                    defaultValue: 0,
                    storeAsObservation: false,
                },
            ],
        },
    ],
    estimatedMinutes: 2,
    schedule: { frequencyDays: 7, enforced: true, showForDays: 3, startAfterDays: 7 },
    todoByDefault: false,
    highlighted: true,
};
