import * as Crypto from 'expo-crypto';

import { useStructuredQuestionnaire } from '@/src/questionnaires/hooks/useStructuredQuestionnaire';
import { fhirToALSSubtype } from '../fhir/alsSubtypeToFhir';
import { buildClassificationCode } from '../opmCodes';
import type { ALSSubtypeEntry } from '../types';
import { ALS_SUBTYPE_METRIC_ID, ALS_SUBTYPE_OBSERVATION_CODE, ALS_SUBTYPE_OBSERVATION_SYSTEM } from '../types';

export type ALSSubtypeDraft = Omit<ALSSubtypeEntry, 'id' | 'opmVersion' | 'classificationCode' | 'recordedByRole'> & {
    id?: string;
    recordedByRole?: ALSSubtypeEntry['recordedByRole'];
};

export function useALSSubtype() {
    const metricTag = `${ALS_SUBTYPE_OBSERVATION_SYSTEM}|${ALS_SUBTYPE_OBSERVATION_CODE}`;
    return useStructuredQuestionnaire<ALSSubtypeDraft, ALSSubtypeEntry>({
        questionnaireId: ALS_SUBTYPE_METRIC_ID,
        questionnaireUrl: 'https://tenos.health/fhir/Questionnaire/als-subtype',
        syncReason: 'als subtype',
        getId: (entry) => entry.id,
        getDate: (entry) => entry.assessedAt,
        buildEntry: (draft) => ({
            ...draft,
            id: draft.id ?? Crypto.randomUUID(),
            opmVersion: '3.3',
            classificationCode: buildClassificationCode(draft),
            recordedByRole: draft.recordedByRole ?? 'doctor',
        }),
        parseLegacyResource: fhirToALSSubtype,
        legacyMetricTag: metricTag,
    });
}
