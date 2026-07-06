export type ALSSubtypeCertainty = 'preliminary' | 'confirmed' | 'uncertain';

export type OpmOnsetCode =
    | 'O1'
    | 'O2d'
    | 'O2p'
    | 'O2x'
    | 'O3r'
    | 'O3a'
    | 'O4d'
    | 'O4p'
    | 'O4x';

export type OpmPropagationStatus = 'P0' | 'P1';
export type OpmMotorNeuronCode = 'M0' | 'M1d' | 'M1p' | 'M2d' | 'M2p' | 'M3';

export type ALSSubtypeEntry = {
    id: string;
    opmVersion: '3.3';
    onsetCode: OpmOnsetCode;
    propagationStatus: OpmPropagationStatus;
    propagationMonths?: number;
    propagationTimingUnknown?: boolean;
    motorNeuronCode: OpmMotorNeuronCode;
    classificationCode: string;
    certainty: ALSSubtypeCertainty;
    note?: string;
    assessedAt: string;
    recordedByRole: 'doctor' | 'demo';
    recordedByDeviceId?: string;
    linkedNeurologicalExamId?: string;
};

export const ALS_SUBTYPE_METRIC_ID = 'als_subtype';
export const ALS_SUBTYPE_OBSERVATION_SYSTEM = 'https://tenos.health/fhir/CodeSystem/clinical-assessment';
export const ALS_SUBTYPE_OBSERVATION_CODE = 'als-opm-classification';
export const ALS_OPM_CODE_SYSTEM = 'https://tenos.health/fhir/CodeSystem/als-opm';
export const ALS_SUBTYPE_PAYLOAD_EXTENSION_URL = 'https://tenos.health/fhir/StructureDefinition/als-opm-payload';
