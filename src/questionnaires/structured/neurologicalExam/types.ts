import type { OpmMotorNeuronCode } from '@/src/questionnaires/structured/alsSubtype/types';

export type BodyRegion = 'head' | 'left_arm' | 'right_arm' | 'trunk' | 'left_leg' | 'right_leg';
export type ClinicalRegion = 'bulbar' | 'cervical' | 'thoracic' | 'lumbosacral';
export type FindingSeverity = 'absent' | 'mild' | 'moderate' | 'severe' | 'not_tested';
export type ReflexGrade = '0' | '1+' | '2+' | '3+' | '4+' | 'not_tested';
export type ToneGrade = 'normal' | 'increased' | 'spastic' | 'reduced' | 'not_tested';
export type ExamSide = 'left' | 'right';
export type SignPresence = 'absent' | 'present' | 'not_tested';
export type MrcGrade = '0' | '1' | '2' | '3' | '4-' | '4' | '4+' | '5' | 'not_tested';
export type MrcMuscleGroup =
    | 'shoulder_abduction'
    | 'elbow_flexion'
    | 'elbow_extension'
    | 'wrist_extension'
    | 'finger_abduction'
    | 'hip_flexion'
    | 'knee_extension'
    | 'ankle_dorsiflexion'
    | 'toe_extension';
export type ReflexName = 'biceps' | 'triceps' | 'brachioradialis' | 'patellar' | 'achilles';
export type PathologicalSignName = 'babinski' | 'hoffmann' | 'palmomental';
export type LmnSignName = 'atrophy' | 'fasciculations';
export type BulbarSignName = 'tongue_atrophy' | 'tongue_fasciculations' | 'dysarthria' | 'dysphagia';

export type MuscleStrength = {
    muscleGroup: string;
    side?: 'left' | 'right' | 'midline';
    mrcGrade?: 0 | 1 | 2 | 3 | 4 | 5;
    notTested?: boolean;
};

export type RegionMotorNeuronFindings = {
    region: BodyRegion;
    umnSigns: {
        slowedPoorlyCoordinatedMovement?: FindingSeverity;
        hyperreflexia?: FindingSeverity;
        pathologicalReflexes?: FindingSeverity;
        spasticity?: FindingSeverity;
        pseudobulbarAffect?: FindingSeverity;
    };
    lmnSigns: {
        weakness?: FindingSeverity;
        atrophy?: FindingSeverity;
        fasciculations?: FindingSeverity;
        reducedOrAbsentReflexes?: FindingSeverity;
    };
    strength?: MuscleStrength[];
    reflexes?: Array<{ name: string; grade: ReflexGrade; side?: 'left' | 'right' }>;
    tone?: Array<{ region: BodyRegion; grade: ToneGrade }>;
    note?: string;
};

export type ClinicalRegionFinding = {
    region: ClinicalRegion;
    umnBurden: FindingSeverity;
    lmnBurden: FindingSeverity;
};

export type BilateralMrcFinding = {
    muscleGroup: MrcMuscleGroup;
    left: MrcGrade;
    right: MrcGrade;
};

export type BilateralReflexFinding = {
    name: ReflexName;
    left: ReflexGrade;
    right: ReflexGrade;
};

export type BilateralSignFinding<TName extends string = string> = {
    name: TName;
    left: SignPresence;
    right: SignPresence;
};

export type BulbarSignFinding = {
    name: BulbarSignName;
    value: SignPresence;
};

export type NeurologicalExamEntry = {
    id: string;
    examVersion: 'als-motor-exam-v1' | 'als-neurological-exam-v2';
    assessedAt: string;
    examinerName?: string;
    recordedByRole: 'doctor' | 'demo';
    regions: RegionMotorNeuronFindings[];
    clinicalRegions?: ClinicalRegionFinding[];
    mrcStrength?: BilateralMrcFinding[];
    reflexes?: BilateralReflexFinding[];
    pathologicalSigns?: BilateralSignFinding<PathologicalSignName>[];
    lmnSideSigns?: BilateralSignFinding<LmnSignName>[];
    bulbarSigns?: BulbarSignFinding[];
    overallUmnBurden?: 'none' | 'mild' | 'moderate' | 'severe';
    overallLmnBurden?: 'none' | 'mild' | 'moderate' | 'severe';
    suggestedMotorNeuronCode?: OpmMotorNeuronCode;
    summary?: string;
    note?: string;
};

export const ALS_NEUROLOGICAL_EXAM_METRIC_ID = 'als_neurological_exam';
export const ALS_NEUROLOGICAL_EXAM_OBSERVATION_SYSTEM = 'https://tenos.health/fhir/CodeSystem/clinical-assessment';
export const ALS_NEUROLOGICAL_EXAM_OBSERVATION_CODE = 'als-neurological-motor-exam';
export const ALS_NEUROLOGICAL_EXAM_PAYLOAD_EXTENSION_URL = 'https://tenos.health/fhir/StructureDefinition/als-neurological-motor-exam-payload';
