import type { QuestionnaireBaseDefinition } from '../../types';

export const base: QuestionnaireBaseDefinition = {
    id: 'phq9',
    sortOrder: 4,
    icon: 'brain.head.profile',
    iconColor: '#5856D6',
    fhir: {
        storageStrategy: 'hybrid',
        questionnaireUrl: 'http://www.cqaimh.org/PDF/Toolkit/materials/PHQ9.pdf',
        observationCategory: 'survey',
        totalScoreCode: {
            system: 'http://loinc.org',
            code: '44261-6',
            display: 'PHQ-9 total score',
        },
    },
    scoring: {
        maxScore: 27,
        higherIsBetter: false,
        calculateDomainScores: false,
        showScore: false,
        interpretations: [
            { minScore: 0, maxScore: 4, color: '#34C759' },
            { minScore: 5, maxScore: 9, color: '#A8D08D' },
            { minScore: 10, maxScore: 14, color: '#FF9500' },
            { minScore: 15, maxScore: 19, color: '#FF6B00' },
            { minScore: 20, maxScore: 27, color: '#FF3B30' },
        ],
    },
    domains: [
        {
            id: 'depression',
            questions: [
                { id: 'interest', linkId: '1', optionValues: [0, 1, 2, 3] },
                { id: 'mood', linkId: '2', optionValues: [0, 1, 2, 3] },
                { id: 'sleep', linkId: '3', optionValues: [0, 1, 2, 3] },
                { id: 'energy', linkId: '4', optionValues: [0, 1, 2, 3] },
                { id: 'appetite', linkId: '5', optionValues: [0, 1, 2, 3] },
                { id: 'self_esteem', linkId: '6', optionValues: [0, 1, 2, 3] },
                { id: 'concentration', linkId: '7', optionValues: [0, 1, 2, 3] },
                { id: 'psychomotor', linkId: '8', optionValues: [0, 1, 2, 3] },
                {
                    id: 'suicidality',
                    linkId: '9',
                    optionValues: [0, 1, 2, 3],
                    storeAsObservation: true,
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '44260-8',
                        display: 'PHQ-9 item 9 - Thoughts of self-harm',
                    },
                    fhirUnit: '/3',
                },
            ],
        },
    ],
    estimatedMinutes: 3,
    schedule: { frequencyDays: 7, enforced: true, showForDays: 3, availableFrom: '2025-01-01', availableUntil: '2026-02-20' },
    todoByDefault: false,
    highlighted: false,
};
