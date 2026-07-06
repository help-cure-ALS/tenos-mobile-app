import { structuredOptionDescription, structuredOptionLabel } from '@/src/questionnaires/structured/structuredFieldLabels';

import type {
    ALSKingsStage4Reason,
    ALSKingsStageEntry,
    ALSKingsStageRegion,
    ALSKingsStageSource,
    ALSKingsStageValue,
} from './types';

const QUESTIONNAIRE_ID = 'als_kings_stage';

export function stageLabel(value: ALSKingsStageValue | undefined, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'stage', value, language);
}

export function stageDescription(value: ALSKingsStageValue | undefined, language?: string): string {
    return structuredOptionDescription(QUESTIONNAIRE_ID, 'stage', value, language);
}

export function sourceLabel(value: ALSKingsStageSource | undefined, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'source', value, language);
}

export function regionLabel(value: ALSKingsStageRegion, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'affectedRegions', value, language);
}

export function stage4ReasonLabel(value: ALSKingsStage4Reason | undefined, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'stage4Reason', value, language);
}

export function summarizeALSKingsStage(entry: ALSKingsStageEntry, language?: string): string {
    const parts = [
        stageDescription(entry.stage, language),
        entry.affectedRegions && entry.affectedRegions.length > 0
            ? entry.affectedRegions.map((region) => regionLabel(region, language)).join(', ')
            : null,
        entry.stage4Reason ? stage4ReasonLabel(entry.stage4Reason, language) : null,
    ].filter(Boolean);
    return parts.join(' · ');
}
