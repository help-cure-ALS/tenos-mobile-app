/**
 * Studies Module
 *
 * Clinical trials and research studies for ALS patients
 */

// Types
export type {
    Study,
    StudyEnrollment,
    StudyStatus,
    ParticipantStatus,
    StudyPhase,
    StudyType,
    StudyCenter,
    StudySponsor,
    StudyTask,
    EligibilityCriterion,
    StudyWithEnrollment,
} from './types';

export {
    getStudyStatusInfo,
    getParticipantStatusInfo,
    getPhaseLabel,
    getStudyTypeLabel,
} from './types';

// Live data from care server
export { StudiesProvider, useStudies } from './useStudies';
export type { ClinicStudyInfo } from './useStudies';
export { mapFhirStudy } from './fhirMapping';
export { getCareClient, resetCareClient } from './careClient';

// Components
export { StudyCard } from './components/StudyCard';
export { StudyStatusBadge } from './components/StudyStatusBadge';
