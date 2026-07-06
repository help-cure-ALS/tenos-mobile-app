import type { QuestionnaireBaseDefinition } from '../../types';

export const base: QuestionnaireBaseDefinition = {
    id: 'who5',
    enabled: false,
    sortOrder: 2,
    icon: 'heart.fill',
    iconColor: '#AF52DE',
    fhir: {
        storageStrategy: 'questionnaireResponse',
        questionnaireUrl: 'http://www.who.int/mental_health/who-5',
    },
    scoring: {
        maxScore: 25,
        higherIsBetter: true,
        calculateDomainScores: false,
        showScore: false,
        interpretations: [
            { minScore: 13, maxScore: 25, color: '#34C759' },
            { minScore: 7, maxScore: 12, color: '#FF9500' },
            { minScore: 0, maxScore: 6, color: '#FF3B30' },
        ],
    },
    domains: [
        {
            id: 'wellbeing',
            questions: [
                { id: 'cheerful', linkId: '1', optionValues: [5, 4, 3, 2, 1, 0] },
                { id: 'calm', linkId: '2', optionValues: [5, 4, 3, 2, 1, 0] },
                { id: 'active', linkId: '3', optionValues: [5, 4, 3, 2, 1, 0] },
                { id: 'rested', linkId: '4', optionValues: [5, 4, 3, 2, 1, 0] },
                { id: 'interesting', linkId: '5', optionValues: [5, 4, 3, 2, 1, 0] },
            ],
        },
    ],
    estimatedMinutes: 2,
    schedule: { frequencyDays: 14, enforced: true, showForDays: 3, startAfterDays: 14 },
    todoByDefault: false,
    highlighted: false,
};
