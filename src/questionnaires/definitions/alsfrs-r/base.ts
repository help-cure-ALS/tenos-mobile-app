/**
 * ALSFRS-R Base Definition (language-neutral)
 *
 * Contains only technical fields: id, fhir, scoring, structure.
 * Text content is loaded from locale files and merged at runtime.
 */

import type { QuestionnaireBaseDefinition } from '../../types';

export const base: QuestionnaireBaseDefinition = {
    id: 'alsfrs-r',
    allowAsMetric: true,
    metricAccessId: 'alsfrs-r',
    sortOrder: 2,
    icon: 'waveform.path.ecg',
    iconColor: '#007AFF',
    displayMode: 'paged',

    fhir: {
        storageStrategy: 'observations',
        observationCategory: 'survey',
        totalScoreCode: {
            system: 'http://loinc.org',
            code: '67740-5',
            display: 'ALSFRS-R total score',
        },
    },

    scoring: {
        maxScore: 48,
        higherIsBetter: true,
        calculateDomainScores: true,
        showScore: false,
        interpretations: [
            { minScore: 37, maxScore: 48, color: '#34C759' },
            { minScore: 25, maxScore: 36, color: '#FF9500' },
            { minScore: 13, maxScore: 24, color: '#FF6B00' },
            { minScore: 0, maxScore: 12, color: '#FF3B30' },
        ],
    },

    domains: [
        {
            id: 'bulbar',
            questions: [
                {
                    id: 'speech',
                    linkId: '1',
                    optionValues: [4, 3, 2, 1, 0],
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '67741-3',
                        display: 'ALSFRS-R Speech score',
                    },
                },
                {
                    id: 'salivation',
                    linkId: '2',
                    optionValues: [4, 3, 2, 1, 0],
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '67742-1',
                        display: 'ALSFRS-R Salivation score',
                    },
                },
                {
                    id: 'swallowing',
                    linkId: '3',
                    optionValues: [4, 3, 2, 1, 0],
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '67743-9',
                        display: 'ALSFRS-R Swallowing score',
                    },
                },
            ],
        },
        {
            id: 'fine_motor',
            questions: [
                {
                    id: 'handwriting',
                    linkId: '4',
                    optionValues: [4, 3, 2, 1, 0],
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '67744-7',
                        display: 'ALSFRS-R Handwriting score',
                    },
                },
                {
                    id: 'cutting_food',
                    linkId: '5',
                    optionValues: [4, 3, 2, 1, 0],
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '67745-4',
                        display: 'ALSFRS-R Cutting food score',
                    },
                },
                {
                    id: 'dressing',
                    linkId: '6',
                    optionValues: [4, 3, 2, 1, 0],
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '67746-2',
                        display: 'ALSFRS-R Dressing and hygiene score',
                    },
                },
            ],
        },
        {
            id: 'gross_motor',
            questions: [
                {
                    id: 'turning_in_bed',
                    linkId: '7',
                    optionValues: [4, 3, 2, 1, 0],
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '67747-0',
                        display: 'ALSFRS-R Turning in bed score',
                    },
                },
                {
                    id: 'walking',
                    linkId: '8',
                    optionValues: [4, 3, 2, 1, 0],
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '67748-8',
                        display: 'ALSFRS-R Walking score',
                    },
                },
                {
                    id: 'climbing_stairs',
                    linkId: '9',
                    optionValues: [4, 3, 2, 1, 0],
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '67749-6',
                        display: 'ALSFRS-R Climbing stairs score',
                    },
                },
            ],
        },
        {
            id: 'respiratory',
            questions: [
                {
                    id: 'dyspnea',
                    linkId: '10',
                    optionValues: [4, 3, 2, 1, 0],
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '67750-4',
                        display: 'ALSFRS-R Dyspnea score',
                    },
                },
                {
                    id: 'orthopnea',
                    linkId: '11',
                    optionValues: [4, 3, 2, 1, 0],
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '67751-2',
                        display: 'ALSFRS-R Orthopnea score',
                    },
                },
                {
                    id: 'respiratory_insufficiency',
                    linkId: '12',
                    optionValues: [4, 3, 2, 1, 0],
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '67752-0',
                        display: 'ALSFRS-R Respiratory insufficiency score',
                    },
                },
            ],
        },
    ],

    estimatedMinutes: 5,

    schedule: {
        frequencyDays: 12,
        enforced: false,
        showForDays: 3,
        gracePeriodDays: 5,
    },

    trendPeriodDays: 30,

    highlighted: true,
};
