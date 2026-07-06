import type { QuestionnaireBaseDefinition } from '../../types';

export const base: QuestionnaireBaseDefinition = {
    id: 'als_subtype',
    allowAsMetric: true,
    metricAccessId: 'als_subtype',
    customRenderer: 'alsSubtype',
    structuredFields: {
        onsetCode: {
            id: 'onsetCode',
            optionValues: ['O1', 'O2d', 'O2p', 'O2x', 'O3r', 'O3a', 'O4d', 'O4p', 'O4x'],
            required: true,
        },
        propagationStatus: {
            id: 'propagationStatus',
            optionValues: ['P0', 'P1'],
            required: true,
        },
        propagationPattern: {
            id: 'propagationPattern',
            optionValues: ['P0n', 'P1n', 'P1x'],
            required: true,
        },
        motorNeuronCode: {
            id: 'motorNeuronCode',
            optionValues: ['M0', 'M1d', 'M1p', 'M2d', 'M2p', 'M3'],
            required: true,
        },
        certainty: {
            id: 'certainty',
            optionValues: ['preliminary', 'confirmed', 'uncertain'],
            required: true,
        },
        propagationMonths: {
            id: 'propagationMonths',
        },
        note: {
            id: 'note',
        },
    },
    sortOrder: 1,
    icon: 'figure.mind.and.body',
    iconColor: '#145C9E',
    displayMode: 'scroll',
    fhir: {
        storageStrategy: 'questionnaireResponse',
        questionnaireUrl: 'https://tenos.health/fhir/Questionnaire/als-subtype',
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
