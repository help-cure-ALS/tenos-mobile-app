export type ALSKingsStageValue = '1' | '2' | '3' | '4A' | '4B' | '4';
export type ALSKingsStageSource = 'manual' | 'suggested_from_exam' | 'suggested_from_alsfrs' | 'suggested_from_care';
export type ALSKingsStageRegion = 'bulbar' | 'upper_limb' | 'lower_limb' | 'thoracic';
export type ALSKingsStage4Reason = 'nutrition' | 'respiratory' | 'both' | 'unspecified';

export type ALSKingsStageEntry = {
    id: string;
    schemaVersion: 'als-kings-stage-v1';
    assessedAt: string;
    recordedByRole: 'doctor' | 'demo';
    stage: ALSKingsStageValue;
    source: ALSKingsStageSource;
    affectedRegions?: ALSKingsStageRegion[];
    stage4Reason?: ALSKingsStage4Reason;
    note?: string;
};

export const ALS_KINGS_STAGE_METRIC_ID = 'als_kings_stage';
export const ALS_KINGS_STAGE_QUESTIONNAIRE_ID = 'als_kings_stage';
export const ALS_KINGS_STAGE_QUESTIONNAIRE_URL = 'https://tenos.health/fhir/Questionnaire/als-kings-stage';
export const ALS_KINGS_STAGE_CODE_SYSTEM = 'https://tenos.health/fhir/CodeSystem/clinical-assessment';
export const ALS_KINGS_STAGE_CODE = 'als-kings-stage';
