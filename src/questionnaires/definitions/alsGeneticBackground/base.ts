import type { QuestionnaireBaseDefinition } from '../../types';

export const base: QuestionnaireBaseDefinition = {
    id: 'als_genetic_background',
    allowAsMetric: true,
    metricAccessId: 'als_genetic_background',
    customRenderer: 'alsGeneticBackground',
    structuredFields: {
        diseaseForm: {
            id: 'diseaseForm',
            optionValues: ['sporadic', 'familial', 'suspected_familial', 'unclear'],
            required: true,
        },
        familyHistory: {
            id: 'familyHistory',
            optionValues: ['none_known', 'als', 'ftd', 'als_ftd', 'other_mnd', 'other_neurodegenerative'],
            required: true,
        },
        testingStatus: {
            id: 'testingStatus',
            optionValues: ['not_tested', 'planned', 'pending', 'negative', 'vus', 'pathogenic'],
            required: true,
        },
        gene: {
            id: 'gene',
            optionValues: ['C9orf72', 'SOD1', 'FUS', 'TARDBP', 'TBK1', 'OPTN', 'VCP', 'other'],
        },
        source: {
            id: 'source',
            optionValues: ['patient_reported', 'clinician_documented', 'lab_report'],
            required: true,
        },
        counselingStatus: {
            id: 'counselingStatus',
            optionValues: ['completed', 'recommended', 'not_done'],
        },
        otherGene: {
            id: 'otherGene',
        },
        variantText: {
            id: 'variantText',
        },
        testDate: {
            id: 'testDate',
        },
        note: {
            id: 'note',
        },
    },
    sortOrder: 3,
    icon: 'atom',
    iconColor: '#AF52DE',
    displayMode: 'scroll',
    fhir: {
        storageStrategy: 'questionnaireResponse',
        questionnaireUrl: 'https://tenos.health/fhir/Questionnaire/als-genetic-background',
    },
    scoring: {
        maxScore: 0,
        higherIsBetter: true,
        calculateDomainScores: false,
    },
    domains: [
        {
            id: 'structured',
            questions: [
                {
                    id: 'payload',
                    linkId: 'payload',
                    optionValues: [],
                },
            ],
        },
    ],
    highlighted: false,
};
