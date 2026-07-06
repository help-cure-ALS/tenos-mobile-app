import * as Crypto from 'expo-crypto';

import { useStructuredQuestionnaire } from '@/src/questionnaires/hooks/useStructuredQuestionnaire';
import { fhirToNeurologicalExam } from '../fhir/neurologicalExamToFhir';
import type { NeurologicalExamEntry } from '../types';
import {
    ALS_NEUROLOGICAL_EXAM_METRIC_ID,
    ALS_NEUROLOGICAL_EXAM_OBSERVATION_CODE,
    ALS_NEUROLOGICAL_EXAM_OBSERVATION_SYSTEM,
} from '../types';

export type NeurologicalExamDraft = Omit<NeurologicalExamEntry, 'id' | 'examVersion' | 'recordedByRole'> & {
    id?: string;
    recordedByRole?: NeurologicalExamEntry['recordedByRole'];
};

export function useNeurologicalExams() {
    const metricTag = `${ALS_NEUROLOGICAL_EXAM_OBSERVATION_SYSTEM}|${ALS_NEUROLOGICAL_EXAM_OBSERVATION_CODE}`;
    return useStructuredQuestionnaire<NeurologicalExamDraft, NeurologicalExamEntry>({
        questionnaireId: ALS_NEUROLOGICAL_EXAM_METRIC_ID,
        questionnaireUrl: 'https://tenos.health/fhir/Questionnaire/als-neurological-exam',
        syncReason: 'neurological exam',
        getId: (entry) => entry.id,
        getDate: (entry) => entry.assessedAt,
        buildEntry: (draft) => ({
            ...draft,
            id: draft.id ?? Crypto.randomUUID(),
            examVersion: 'als-neurological-exam-v2',
            recordedByRole: draft.recordedByRole ?? 'doctor',
        }),
        parseLegacyResource: fhirToNeurologicalExam,
        legacyMetricTag: metricTag,
    });
}
