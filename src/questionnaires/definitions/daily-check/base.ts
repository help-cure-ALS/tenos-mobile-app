/**
 * Daily Symptom Check - Base Definition
 *
 * Technical fields only (language-neutral).
 * Quick daily check-in for pain, fatigue, sleep quality, and mood.
 * Score range: 0-34 (lower = better)
 *
 * Storage: HYBRID
 * - QuestionnaireResponse for complete record
 * - Individual Observations for pain, fatigue, sleep (for trending with existing metrics)
 */

import type { QuestionnaireBaseDefinition } from '../../types';

export const base: QuestionnaireBaseDefinition = {
    id: 'daily-check',
    sortOrder: 1,
    icon: 'waveform.badge.checkmark',
    iconColor: '#8956d6',
    fhir: {
        storageStrategy: 'hybrid',
        questionnaireUrl: 'https://example.org/questionnaire/daily-symptom-check',
        observationCategory: 'survey',
    },
    scoring: {
        maxScore: 34,
        higherIsBetter: false,
        calculateDomainScores: true,
        showScore: false,
        interpretations: [
            { minScore: 0, maxScore: 7, color: '#34C759' },
            { minScore: 8, maxScore: 14, color: '#5856D6' },
            { minScore: 15, maxScore: 22, color: '#FF9500' },
            { minScore: 23, maxScore: 34, color: '#FF3B30' },
        ],
    },
    domains: [
        {
            id: 'symptoms',
            questions: [
                {
                    id: 'pain',
                    linkId: '1',
                    optionValues: [0, 1, 2, 3, 4],
                    inputType: 'list',
                    storeAsObservation: true,
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '54834-7',
                        display: 'Pain severity verbal descriptor scale',
                    },
                    fhirUnit: '/4',
                },
                {
                    id: 'fatigue',
                    linkId: '2',
                    optionValues: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                    inputType: 'slider',
                    defaultValue: 0,
                    storeAsObservation: true,
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '68858-0',
                        display: 'Fatigue assessment',
                    },
                    fhirUnit: '/10',
                },
            ],
        },
        {
            id: 'sleep',
            questions: [
                {
                    id: 'sleep_quality',
                    linkId: '3',
                    optionValues: [0, 2, 4, 6, 8, 10],
                    inputType: 'list',
                    storeAsObservation: true,
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '65968-0',
                        display: 'Sleep quality verbal rating scale',
                    },
                    fhirUnit: '/10',
                },
            ],
        },
        {
            id: 'mood',
            questions: [
                {
                    id: 'mood',
                    linkId: '4',
                    optionValues: [0, 2, 4, 6, 8, 10],
                    inputType: 'chips',
                    storeAsObservation: false,
                },
            ],
        },
    ],
    estimatedMinutes: 1,
    schedule: { frequencyDays: 1, enforced: false },
    highlighted: true,
};
