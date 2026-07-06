/**
 * Atemversorgung / Respiratory Care - Base Definition
 *
 * Tracks symptoms that may indicate nighttime non-invasive ventilation (NIV)
 * is becoming insufficient. Monitors hypercapnia-related symptoms such as
 * morning headaches, dizziness, daytime sleepiness, concentration problems,
 * sleep quality, and daytime breathlessness.
 *
 * 6 questions, 5-point frequency scale (0-4), reference period: last few days.
 * Not a validated clinical instrument — designed for patient self-monitoring
 * and sharing with care team.
 *
 * Storage: questionnaireResponse (pure survey, no individual observations)
 */

import type { QuestionnaireBaseDefinition } from '../../types';

export const base: QuestionnaireBaseDefinition = {
    id: 'respiratory-care',
    sortOrder: 13,
    icon: 'lungs.fill',
    iconColor: '#007AFF',
    fhir: {
        storageStrategy: 'questionnaireResponse',
        questionnaireUrl: 'https://example.org/questionnaire/respiratory-care',
        observationCategory: 'survey',
    },
    scoring: {
        maxScore: 24,
        higherIsBetter: false,
        calculateDomainScores: false,
        showScore: false,
        interpretations: [
            { minScore: 0, maxScore: 8, color: '#34C759' },
            { minScore: 9, maxScore: 16, color: '#FF9500' },
            { minScore: 17, maxScore: 24, color: '#FF3B30' },
        ],
    },
    domains: [
        {
            id: 'symptoms',
            questions: [
                {
                    id: 'morning_headaches',
                    linkId: '1',
                    optionValues: [0, 1, 2, 3, 4],
                    inputType: 'list',
                },
                {
                    id: 'dizziness',
                    linkId: '2',
                    optionValues: [0, 1, 2, 3, 4],
                    inputType: 'list',
                },
                {
                    id: 'daytime_sleepiness',
                    linkId: '3',
                    optionValues: [0, 1, 2, 3, 4],
                    inputType: 'list',
                },
                {
                    id: 'concentration',
                    linkId: '4',
                    optionValues: [0, 1, 2, 3, 4],
                    inputType: 'list',
                },
                {
                    id: 'sleep_quality',
                    linkId: '5',
                    optionValues: [0, 1, 2, 3, 4],
                    inputType: 'list',
                },
                {
                    id: 'daytime_breathlessness',
                    linkId: '6',
                    optionValues: [0, 1, 2, 3, 4],
                    inputType: 'list',
                },
            ],
        },
    ],
    estimatedMinutes: 2,
    schedule: { frequencyDays: 3, enforced: false },
    todoByDefault: false,
    todoRules: [
        {
            type: 'questionnaireDomainScore',
            questionnaireId: 'alsfrs-r',
            domainId: 'respiratory',
            operator: 'lte',
            value: 8,
        },
    ],
    highlighted: true,
};
