import type { QuestionnaireBaseDefinition } from '../../types';

export const base: QuestionnaireBaseDefinition = {
    id: 'als_neurological_exam',
    allowAsMetric: true,
    metricAccessId: 'als_neurological_exam',
    customRenderer: 'neurologicalExam',
    structuredFields: {
        bodyRegion: {
            id: 'bodyRegion',
            optionValues: ['head', 'left_arm', 'right_arm', 'trunk', 'left_leg', 'right_leg'],
            required: true,
        },
        clinicalRegion: {
            id: 'clinicalRegion',
            optionValues: ['bulbar', 'cervical', 'thoracic', 'lumbosacral'],
            required: true,
        },
        examSide: {
            id: 'examSide',
            optionValues: ['left', 'right'],
            required: true,
        },
        findingSeverity: {
            id: 'findingSeverity',
            optionValues: ['absent', 'mild', 'moderate', 'severe', 'not_tested'],
            required: true,
        },
        signPresence: {
            id: 'signPresence',
            optionValues: ['absent', 'present', 'not_tested'],
            required: true,
        },
        mrcGrade: {
            id: 'mrcGrade',
            optionValues: ['5', '4+', '4', '4-', '3', '2', '1', '0', 'not_tested'],
            required: true,
        },
        mrcMuscleGroup: {
            id: 'mrcMuscleGroup',
            optionValues: [
                'shoulder_abduction',
                'elbow_flexion',
                'elbow_extension',
                'wrist_extension',
                'finger_abduction',
                'hip_flexion',
                'knee_extension',
                'ankle_dorsiflexion',
                'toe_extension',
            ],
            required: true,
        },
        reflexName: {
            id: 'reflexName',
            optionValues: ['biceps', 'triceps', 'brachioradialis', 'patellar', 'achilles'],
            required: true,
        },
        reflexGrade: {
            id: 'reflexGrade',
            optionValues: ['0', '1+', '2+', '3+', '4+', 'not_tested'],
            required: true,
        },
        pathologicalSignName: {
            id: 'pathologicalSignName',
            optionValues: ['babinski', 'hoffmann', 'palmomental'],
            required: true,
        },
        lmnSignName: {
            id: 'lmnSignName',
            optionValues: ['atrophy', 'fasciculations'],
            required: true,
        },
        bulbarSignName: {
            id: 'bulbarSignName',
            optionValues: ['tongue_atrophy', 'tongue_fasciculations', 'dysarthria', 'dysphagia'],
            required: true,
        },
        burden: {
            id: 'burden',
            optionValues: ['none', 'mild', 'moderate', 'severe'],
            required: true,
        },
        motorNeuronCode: {
            id: 'motorNeuronCode',
            optionValues: ['M0', 'M1d', 'M1p', 'M2d', 'M2p', 'M3'],
            required: true,
        },
        clinicalRegions: {
            id: 'clinicalRegions',
            required: true,
        },
        mrcStrength: {
            id: 'mrcStrength',
            required: true,
        },
        reflexes: {
            id: 'reflexes',
            required: true,
        },
        pathologicalSigns: {
            id: 'pathologicalSigns',
            required: true,
        },
        lmnSideSigns: {
            id: 'lmnSideSigns',
            required: true,
        },
        bulbarSigns: {
            id: 'bulbarSigns',
            required: true,
        },
        lmnWeakness: {
            id: 'lmnWeakness',
            required: true,
        },
        lmnAtrophy: {
            id: 'lmnAtrophy',
            required: true,
        },
        lmnFasciculations: {
            id: 'lmnFasciculations',
            required: true,
        },
        umnHyperreflexia: {
            id: 'umnHyperreflexia',
            required: true,
        },
        umnPathologicalReflexes: {
            id: 'umnPathologicalReflexes',
            required: true,
        },
        umnSpasticity: {
            id: 'umnSpasticity',
            required: true,
        },
        umnSlowedMovement: {
            id: 'umnSlowedMovement',
            required: true,
        },
        overallUmnBurden: {
            id: 'overallUmnBurden',
            required: true,
        },
        overallLmnBurden: {
            id: 'overallLmnBurden',
            required: true,
        },
        note: {
            id: 'note',
        },
    },
    sortOrder: 2,
    icon: 'stethoscope',
    iconColor: '#145C9E',
    displayMode: 'scroll',
    fhir: {
        storageStrategy: 'questionnaireResponse',
        questionnaireUrl: 'https://tenos.health/fhir/Questionnaire/als-neurological-exam',
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
