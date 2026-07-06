import type { QuestionnaireBaseDefinition } from '../../types';

export const base: QuestionnaireBaseDefinition = {
    id: 'pdq5',
    sortOrder: 6,
    icon: 'lightbulb.slash',
    iconColor: '#FF9500',
    fhir: {
        storageStrategy: 'questionnaireResponse',
        questionnaireUrl: 'https://example.org/questionnaire/pdq-5',
        totalScoreCode: {
            system: 'http://loinc.org',
            code: '71946-2',
            display: 'PDQ-5 total score',
        },
    },
    scoring: {
        maxScore: 20,
        higherIsBetter: false,
        calculateDomainScores: false,
        showScore: false,
        interpretations: [
            { minScore: 0, maxScore: 4, color: '#34C759' },
            { minScore: 5, maxScore: 9, color: '#5856D6' },
            { minScore: 10, maxScore: 14, color: '#FF9500' },
            { minScore: 15, maxScore: 20, color: '#FF3B30' },
        ],
    },
    domains: [
        {
            id: 'cognitive',
            questions: [
                { id: 'attention', linkId: '1', optionValues: [0, 1, 2, 3, 4], inputType: 'list' },
                { id: 'memory_conversation', linkId: '2', optionValues: [0, 1, 2, 3, 4], inputType: 'list' },
                { id: 'prospective_memory', linkId: '3', optionValues: [0, 1, 2, 3, 4], inputType: 'list' },
                { id: 'organization', linkId: '4', optionValues: [0, 1, 2, 3, 4], inputType: 'list' },
                { id: 'concentration', linkId: '5', optionValues: [0, 1, 2, 3, 4], inputType: 'list' },
            ],
        },
    ],
    estimatedMinutes: 1,
    schedule: { frequencyDays: 7, enforced: true, showForDays: 3, startAfterDays: 7 },
    todoByDefault: false,
    highlighted: true,
};
