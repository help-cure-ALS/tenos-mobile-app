export type ALSDiseaseForm =
    | 'unknown'
    | 'sporadic'
    | 'familial'
    | 'suspected_familial'
    | 'unclear';

export type ALSFamilyHistory =
    | 'unknown'
    | 'none_known'
    | 'als'
    | 'ftd'
    | 'als_ftd'
    | 'other_mnd'
    | 'other_neurodegenerative';

export type ALSGeneticTestingStatus =
    | 'unknown'
    | 'not_tested'
    | 'planned'
    | 'pending'
    | 'negative'
    | 'vus'
    | 'pathogenic';

export type ALSKnownGene =
    | 'unknown'
    | 'C9orf72'
    | 'SOD1'
    | 'FUS'
    | 'TARDBP'
    | 'TBK1'
    | 'OPTN'
    | 'VCP'
    | 'other';

export type ALSGeneticSource =
    | 'patient_reported'
    | 'clinician_documented'
    | 'lab_report';

export type ALSGeneticCounselingStatus =
    | 'unknown'
    | 'completed'
    | 'recommended'
    | 'not_done';

export type ALSGeneticBackgroundEntry = {
    id: string;
    schemaVersion: 'als-genetic-background-v1';
    assessedAt: string;
    recordedByRole: 'patient' | 'caregiver' | 'doctor' | 'demo';
    diseaseForm: ALSDiseaseForm;
    familyHistory: ALSFamilyHistory;
    testingStatus: ALSGeneticTestingStatus;
    source: ALSGeneticSource;
    gene?: ALSKnownGene;
    otherGene?: string;
    variantText?: string;
    testDate?: string;
    counselingStatus?: ALSGeneticCounselingStatus;
    note?: string;
};

export const ALS_GENETIC_BACKGROUND_METRIC_ID = 'als_genetic_background';
export const ALS_GENETIC_BACKGROUND_OBSERVATION_SYSTEM = 'https://tenos.health/fhir/CodeSystem/clinical-assessment';
export const ALS_GENETIC_BACKGROUND_OBSERVATION_CODE = 'als-genetic-background';
export const ALS_GENETIC_BACKGROUND_PAYLOAD_EXTENSION_URL = 'https://tenos.health/fhir/StructureDefinition/als-genetic-background-payload';
