import type { QuestionnaireBaseDefinition } from '../../types';

export const base: QuestionnaireBaseDefinition = {
    id: 'als_kings_stage',
    allowAsMetric: true,
    metricAccessId: 'als_kings_stage',
    customRenderer: 'alsKingsStage',
    structuredFields: {
        stage: {
            id: 'stage',
            optionValues: ['1', '2', '3', '4A', '4B', '4'],
            required: true,
        },
        affectedRegions: {
            id: 'affectedRegions',
            optionValues: ['bulbar', 'upper_limb', 'lower_limb', 'thoracic'],
            multiple: true,
        },
        source: {
            id: 'source',
            optionValues: ['manual', 'suggested_from_exam', 'suggested_from_alsfrs', 'suggested_from_care'],
            required: true,
        },
        stage4Reason: {
            id: 'stage4Reason',
            optionValues: ['nutrition', 'respiratory', 'both', 'unspecified'],
        },
        note: {
            id: 'note',
        },
    },
    sortOrder: 4,
    icon: 'chart.bar.doc.horizontal',
    iconColor: '#FF9500',
    displayMode: 'scroll',
    fhir: {
        storageStrategy: 'questionnaireResponse',
        questionnaireUrl: 'https://tenos.health/fhir/Questionnaire/als-kings-stage',
    },
    scoring: {
        maxScore: 4,
        higherIsBetter: false,
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
