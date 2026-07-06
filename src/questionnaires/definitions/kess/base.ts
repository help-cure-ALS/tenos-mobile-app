/**
 * Verdauungs-Check (angelehnt an KESS) - Base Definition
 *
 * Patientenfreundliche Adaption des Knowles-Eccersley-Scott Symptom Score.
 * 11 Fragen, Score 0-39 (lower = better), Bezugszeitraum: letzte 4 Wochen.
 *
 * Wesentliche Änderungen gegenüber dem Original-KESS:
 * - Q1: "Dauer der Verstopfung" ersetzt durch aktuelle Beschwerdelast (Schweregrad)
 * - Alle Prozentangaben ("25-50 % der Zeit") durch Häufigkeitswörter ersetzt
 * - Alle Monatszähler ("< 1× pro Monat") durch einfache Frequenzbegriffe ersetzt
 * - Q11: Stuhlkonsistenz als Bristol Stool Scale (1-7) mit storeAsObservation
 * - Thematische Gruppierung in 4 Domains
 * - Bezugszeitraum: "In den letzten 4 Wochen"
 *
 * Storage: HYBRID
 * - QuestionnaireResponse for complete record
 * - Individual Observation for stool_consistency (Bristol Stool Scale, for metric trending)
 */

import type { QuestionnaireBaseDefinition } from '../../types';

/**
 * Map Bristol Stool Scale value (1-7) to KESS constipation score (0-3).
 * Bristol 1 (hard lumps) = 3 points (worst)
 * Bristol 2 (lumpy)      = 2 points
 * Bristol 3 (cracked)    = 1 point
 * Bristol 4-7 (normal+)  = 0 points
 */
function bristolToKessScore(bristolValue: number): number {
    if (bristolValue <= 1) return 3;
    if (bristolValue <= 2) return 2;
    if (bristolValue <= 3) return 1;
    return 0;
}

export const base: QuestionnaireBaseDefinition = {
    id: 'kess',
    sortOrder: 12,
    icon: 'digestion',
    iconColor: '#AF52DE',
    fhir: {
        storageStrategy: 'hybrid',
        questionnaireUrl: 'https://example.org/questionnaire/kess',
        observationCategory: 'survey',
    },
    scoring: {
        maxScore: 39,
        higherIsBetter: false,
        calculateDomainScores: true,
        showScore: false,
        calculateScore: (answers: Record<string, number>) => {
            let score = 0;
            for (const [id, value] of Object.entries(answers)) {
                if (value === undefined || value === null) continue;
                if (id === 'stool_consistency') {
                    score += bristolToKessScore(value);
                } else {
                    score += value;
                }
            }
            return score;
        },
        interpretations: [
            { minScore: 0, maxScore: 10, color: '#34C759' },
            { minScore: 11, maxScore: 24, color: '#FF9500' },
            { minScore: 25, maxScore: 39, color: '#FF3B30' },
        ],
    },
    domains: [
        {
            id: 'general',
            questions: [
                {
                    id: 'constipation_severity',
                    linkId: '1',
                    optionValues: [0, 1, 2, 3, 4],
                    inputType: 'list',
                },
                {
                    id: 'laxatives',
                    linkId: '2',
                    optionValues: [0, 1, 2, 3],
                    inputType: 'list',
                },
                {
                    id: 'frequency',
                    linkId: '3',
                    optionValues: [0, 1, 2, 3],
                    inputType: 'list',
                },
            ],
        },
        {
            id: 'defecation',
            questions: [
                {
                    id: 'unsuccessful_attempts',
                    linkId: '4',
                    optionValues: [0, 1, 2, 3],
                    inputType: 'list',
                },
                {
                    id: 'incomplete_evacuation',
                    linkId: '5',
                    optionValues: [0, 1, 2, 3, 4],
                    inputType: 'list',
                },
                {
                    id: 'painful_evacuation',
                    linkId: '6',
                    optionValues: [0, 1, 2, 3, 4],
                    inputType: 'list',
                },
            ],
        },
        {
            id: 'abdominal',
            questions: [
                {
                    id: 'abdominal_pain',
                    linkId: '7',
                    optionValues: [0, 1, 2, 3, 4],
                    inputType: 'list',
                },
                {
                    id: 'bloating',
                    linkId: '8',
                    optionValues: [0, 1, 2, 3, 4],
                    inputType: 'list',
                },
            ],
        },
        {
            id: 'aids_and_stool',
            questions: [
                {
                    id: 'enemas_digitation',
                    linkId: '9',
                    optionValues: [0, 1, 2, 3, 4],
                    inputType: 'list',
                },
                {
                    id: 'evacuation_time',
                    linkId: '10',
                    optionValues: [0, 1, 2, 3],
                    inputType: 'list',
                },
                {
                    id: 'stool_consistency',
                    linkId: '11',
                    optionValues: [1, 2, 3, 4, 5, 6, 7],
                    inputType: 'slider',
                    storeAsObservation: true,
                    fhirCode: {
                        system: 'http://loinc.org',
                        code: '11029-8',
                        display: 'Bristol stool scale',
                    },
                    fhirUnit: '/7',
                },
            ],
        },
    ],
    estimatedMinutes: 4,
    schedule: { frequencyDays: 28, enforced: false },
    todoByDefault: false,
    todoRules: [
        {
            type: 'questionnaireDomainScore',
            questionnaireId: 'alsfrs-r',
            domainId: 'gross_motor',
            operator: 'lte',
            value: 8,
        },
    ],
    highlighted: true,
};
