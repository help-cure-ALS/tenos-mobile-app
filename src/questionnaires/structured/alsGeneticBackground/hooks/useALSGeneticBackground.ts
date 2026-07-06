import * as Crypto from 'expo-crypto';

import { useStructuredQuestionnaire } from '@/src/questionnaires/hooks/useStructuredQuestionnaire';
import { fhirToALSGeneticBackground } from '../fhir/alsGeneticBackgroundToFhir';
import type { ALSGeneticBackgroundEntry } from '../types';
import {
    ALS_GENETIC_BACKGROUND_METRIC_ID,
    ALS_GENETIC_BACKGROUND_OBSERVATION_CODE,
    ALS_GENETIC_BACKGROUND_OBSERVATION_SYSTEM,
} from '../types';

export type ALSGeneticBackgroundDraft = Omit<ALSGeneticBackgroundEntry, 'id' | 'schemaVersion'> & {
    id?: string;
};

export function useALSGeneticBackground() {
    const metricTag = `${ALS_GENETIC_BACKGROUND_OBSERVATION_SYSTEM}|${ALS_GENETIC_BACKGROUND_OBSERVATION_CODE}`;
    return useStructuredQuestionnaire<ALSGeneticBackgroundDraft, ALSGeneticBackgroundEntry>({
        questionnaireId: ALS_GENETIC_BACKGROUND_METRIC_ID,
        questionnaireUrl: 'https://tenos.health/fhir/Questionnaire/als-genetic-background',
        syncReason: 'als genetic background',
        getId: (entry) => entry.id,
        getDate: (entry) => entry.assessedAt,
        buildEntry: (draft) => ({
            ...draft,
            id: draft.id ?? Crypto.randomUUID(),
            schemaVersion: 'als-genetic-background-v1',
            otherGene: draft.gene === 'other' ? draft.otherGene?.trim() || undefined : undefined,
            variantText: draft.variantText?.trim() || undefined,
            note: draft.note?.trim() || undefined,
        }),
        parseLegacyResource: fhirToALSGeneticBackground,
        legacyMetricTag: metricTag,
    });
}
