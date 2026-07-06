import { fhirToStructuredQuestionnairePayload } from '@/src/questionnaires/fhir/structuredQuestionnaireToFhir';
import type { ALSKingsStageEntry } from '../types';
import { ALS_KINGS_STAGE_QUESTIONNAIRE_ID } from '../types';

export function fhirToALSKingsStage(resource: any): ALSKingsStageEntry | null {
    return fhirToStructuredQuestionnairePayload<ALSKingsStageEntry>(
        resource,
        ALS_KINGS_STAGE_QUESTIONNAIRE_ID
    );
}
