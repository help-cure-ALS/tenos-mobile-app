import { structuredOptionLabel } from '@/src/questionnaires/structured/structuredFieldLabels';

import type {
    ALSDiseaseForm,
    ALSFamilyHistory,
    ALSGeneticBackgroundEntry,
    ALSGeneticCounselingStatus,
    ALSGeneticSource,
    ALSGeneticTestingStatus,
    ALSKnownGene,
} from './types';

const QUESTIONNAIRE_ID = 'als_genetic_background';

export function diseaseFormLabel(value: ALSDiseaseForm | undefined, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'diseaseForm', value, language);
}

export function familyHistoryLabel(value: ALSFamilyHistory | undefined, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'familyHistory', value, language);
}

export function testingStatusLabel(value: ALSGeneticTestingStatus | undefined, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'testingStatus', value, language);
}

export function sourceLabel(value: ALSGeneticSource | undefined, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'source', value, language);
}

export function counselingStatusLabel(value: ALSGeneticCounselingStatus | undefined, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'counselingStatus', value, language);
}

export function geneLabel(entry: Pick<ALSGeneticBackgroundEntry, 'gene' | 'otherGene'> | null | undefined, language?: string): string {
    if (!entry?.gene) return '';
    if (entry.gene === 'other') return entry.otherGene?.trim() || structuredOptionLabel(QUESTIONNAIRE_ID, 'gene', 'other', language);
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'gene', entry.gene, language);
}

export function summarizeALSGeneticBackground(entry: ALSGeneticBackgroundEntry, language?: string): string {
    const isDE = language === 'de';
    const form = diseaseFormLabel(entry.diseaseForm, language);
    const testing = testingStatusLabel(entry.testingStatus, language);
    const gene = entry.testingStatus === 'pathogenic' || entry.testingStatus === 'vus'
        ? geneLabel(entry, language)
        : null;
    const source = sourceLabel(entry.source, language);

    if (gene) {
        return isDE
            ? `${form}, ${testing}, ${gene}, Quelle: ${source}.`
            : `${form}, ${testing}, ${gene}, source: ${source}.`;
    }
    return isDE
        ? `${form}, ${testing}, Quelle: ${source}.`
        : `${form}, ${testing}, source: ${source}.`;
}

export function formatALSGeneticHeadline(entry: ALSGeneticBackgroundEntry, language?: string): string {
    const form = diseaseFormLabel(entry.diseaseForm, language);
    if (entry.testingStatus === 'pathogenic' || entry.testingStatus === 'vus') {
        const gene = geneLabel(entry, language);
        return `${form} · ${gene}`;
    }
    return `${form} · ${testingStatusLabel(entry.testingStatus, language)}`;
}

export type { ALSKnownGene };
