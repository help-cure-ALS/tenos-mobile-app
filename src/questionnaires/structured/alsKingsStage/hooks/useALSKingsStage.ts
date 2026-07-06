import * as Crypto from 'expo-crypto';
import { useMemo } from 'react';

import { useAids } from '@/src/aids/hooks/useAids';
import { useNeurologicalExams } from '@/src/questionnaires/structured/neurologicalExam/hooks/useNeurologicalExams';
import { useStructuredQuestionnaire } from '@/src/questionnaires/hooks/useStructuredQuestionnaire';
import { deriveALSKingsStage, type ALSKingsStageDerivedEntry } from '../deriveKingsStage';
import type { ALSKingsStageEntry } from '../types';
import {
    ALS_KINGS_STAGE_QUESTIONNAIRE_ID,
    ALS_KINGS_STAGE_QUESTIONNAIRE_URL,
} from '../types';

export type ALSKingsStageDraft = Omit<ALSKingsStageEntry, 'id' | 'schemaVersion' | 'recordedByRole'> & {
    id?: string;
    recordedByRole?: ALSKingsStageEntry['recordedByRole'];
};

export function useALSKingsStage() {
    const confirmed = useStructuredQuestionnaire<ALSKingsStageDraft, ALSKingsStageEntry>({
        questionnaireId: ALS_KINGS_STAGE_QUESTIONNAIRE_ID,
        questionnaireUrl: ALS_KINGS_STAGE_QUESTIONNAIRE_URL,
        syncReason: 'als kings stage',
        getId: (entry) => entry.id,
        getDate: (entry) => entry.assessedAt,
        buildEntry: (draft) => ({
            ...draft,
            id: draft.id ?? Crypto.randomUUID(),
            schemaVersion: 'als-kings-stage-v1',
            recordedByRole: draft.recordedByRole ?? 'doctor',
            affectedRegions: draft.affectedRegions?.length ? draft.affectedRegions : undefined,
            stage4Reason: draft.stage.startsWith('4') ? draft.stage4Reason : undefined,
            note: draft.note?.trim() || undefined,
        }),
    });
    const {
        entries: neurologicalExams,
        isLoading: neurologicalExamsLoading,
    } = useNeurologicalExams();
    const { aids, isLoading: aidsLoading } = useAids();

    const calculatedEntry = useMemo(
        () => deriveALSKingsStage({ neurologicalExams, aids }),
        [aids, neurologicalExams]
    );
    const latestEntry: ALSKingsStageEntry | ALSKingsStageDerivedEntry | null =
        confirmed.latestEntry ?? calculatedEntry;

    return {
        ...confirmed,
        latestEntry,
        confirmedEntry: confirmed.latestEntry,
        calculatedEntry,
        isLoading: confirmed.isLoading || neurologicalExamsLoading || aidsLoading,
    };
}
