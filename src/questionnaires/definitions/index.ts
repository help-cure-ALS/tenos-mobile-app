/**
 * Questionnaire Definitions Registry
 *
 * Central registry for all questionnaire definitions.
 * Supports dynamic language switching via getDefinition(id, language).
 */

import type { QuestionnaireDefinition } from '../types';
import { getCurrentLanguage } from '../../i18n';

// Import getDefinition functions from each questionnaire
import { getDefinition as getAlsfrsrDef, alsfrsr } from './alsfrs-r';
import { getDefinition as getAlsGeneticBackgroundDef, alsGeneticBackgroundQuestionnaire } from './alsGeneticBackground';
import { getDefinition as getAlsKingsStageDef, alsKingsStageQuestionnaire } from './alsKingsStage';
import { getDefinition as getAlsNeurologicalExamDef, alsNeurologicalExamQuestionnaire } from './alsNeurologicalExam';
import { getDefinition as getAlsSubtypeDef, alsSubtypeQuestionnaire } from './alsSubtype';
import { getDefinition as getBdifsDef, bdifs } from './bdi-fs';
import { getDefinition as getDailyCheckDef, dailyCheck } from './daily-check';
import { getDefinition as getPdq5Def, pdq5 } from './pdq5';
import { getDefinition as getPesDef, pes } from './pes';
import { getDefinition as getPhq9Def, phq9 } from './phq9';
import { getDefinition as getWho5Def, who5 } from './who5';
import { getDefinition as getKessDef, kess } from './kess';
import { getDefinition as getRespCareDef, respiratoryCare } from './respiratory-care';

/** Map of questionnaire IDs to their getDefinition functions */
const definitionGetters: Record<string, (language: string) => QuestionnaireDefinition> = {
    'alsfrs-r': getAlsfrsrDef,
    'als_subtype': getAlsSubtypeDef,
    'als_neurological_exam': getAlsNeurologicalExamDef,
    'als_genetic_background': getAlsGeneticBackgroundDef,
    'als_kings_stage': getAlsKingsStageDef,
    'bdi-fs': getBdifsDef,
    'daily-check': getDailyCheckDef,
    'pdq5': getPdq5Def,
    'pes': getPesDef,
    'phq9': getPhq9Def,
    'who5': getWho5Def,
    'kess': getKessDef,
    'respiratory-care': getRespCareDef,
};

/** Remote questionnaire definitions (already merged + localized). */
let remoteDefinitions = new Map<string, QuestionnaireDefinition>();

function isEnabled(definition: QuestionnaireDefinition | undefined): definition is QuestionnaireDefinition {
    return definition !== undefined && definition.enabled !== false;
}

function isLocallyDisabled(id: string, language: string): boolean {
    const getter = definitionGetters[id];
    return getter ? getter(language).enabled === false : false;
}

function isRemoteEnabled(id: string, definition: QuestionnaireDefinition, language: string): boolean {
    if (definition.enabled !== undefined) return definition.enabled;
    return !isLocallyDisabled(id, language);
}

/** List of all questionnaire IDs (in display order) */
const questionnaireIds = [
    'alsfrs-r',
    'als_subtype',
    'als_neurological_exam',
    'als_genetic_background',
    'als_kings_stage',
    'bdi-fs',
    'daily-check',
    'pdq5',
    'pes',
    'phq9',
    'who5',
    'kess',
    'respiratory-care',
];

// =============================================================================
// Dynamic (language-aware) API
// =============================================================================

/**
 * Get a questionnaire definition by ID in the specified language.
 * Falls back to English if the language is not available.
 */
export function getQuestionnaireDefinition(
    id: string,
    language?: string
): QuestionnaireDefinition | undefined {
    const lang = language ?? getCurrentLanguage();
    const remote = remoteDefinitions.get(id);
    if (remote) return isRemoteEnabled(id, remote, lang) ? remote : undefined;

    const getter = definitionGetters[id];
    if (!getter) return undefined;
    const local = getter(lang);
    return isEnabled(local) ? local : undefined;
}

/**
 * Get all questionnaire definitions in the specified language.
 * Falls back to English if the language is not available.
 */
export function getAllQuestionnaireDefinitions(
    language?: string
): QuestionnaireDefinition[] {
    const lang = language ?? getCurrentLanguage();
    const local = questionnaireIds
        .map(id => definitionGetters[id](lang))
        .filter(isEnabled)
        .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity));

    const byId = new Map<string, QuestionnaireDefinition>(local.map((d) => [d.id, d]));
    for (const [id, def] of remoteDefinitions.entries()) {
        if (isRemoteEnabled(id, def, lang)) {
            byId.set(id, def);
        } else {
            byId.delete(id);
        }
    }

    return Array.from(byId.values())
        .filter(isEnabled)
        .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity));
}

/**
 * Get a questionnaire definition by ID using the current app language.
 * This is a convenience function that uses the current i18n language.
 */
export function getLocalizedQuestionnaireDefinition(
    id: string
): QuestionnaireDefinition | undefined {
    return getQuestionnaireDefinition(id, getCurrentLanguage());
}

/**
 * Get all questionnaire definitions using the current app language.
 * This is a convenience function that uses the current i18n language.
 */
export function getAllLocalizedQuestionnaireDefinitions(): QuestionnaireDefinition[] {
    return getAllQuestionnaireDefinitions(getCurrentLanguage());
}

// =============================================================================
// Legacy API (deprecated, for backwards compatibility)
// =============================================================================

/**
 * @deprecated Use getAllQuestionnaireDefinitions(language) instead.
 * This static array uses German locale and doesn't update with language changes.
 */
export const questionnaireDefinitions: QuestionnaireDefinition[] = [
    alsfrsr,
    alsSubtypeQuestionnaire,
    alsNeurologicalExamQuestionnaire,
    alsGeneticBackgroundQuestionnaire,
    alsKingsStageQuestionnaire,
    bdifs,
    dailyCheck,
    pdq5,
    pes,
    phq9,
    who5,
    kess,
    respiratoryCare,
].filter(isEnabled);

/**
 * @deprecated Use getQuestionnaireDefinition(id, language) instead.
 * This static map uses German locale and doesn't update with language changes.
 */
export const questionnaireRegistry = new Map<string, QuestionnaireDefinition>(
    questionnaireDefinitions.map((def) => [def.id, def])
);

/**
 * Set remote questionnaire definitions.
 * Remote definitions override local defaults by ID.
 */
export function setRemoteQuestionnaireDefinitions(definitions: QuestionnaireDefinition[]): void {
    remoteDefinitions = new Map(definitions.map((d) => [d.id, d]));
}

/** Clear all remote questionnaire definition overrides. */
export function clearRemoteQuestionnaireDefinitions(): void {
    remoteDefinitions = new Map();
}

// Re-export individual questionnaires for direct imports (deprecated)
export { alsfrsr } from './alsfrs-r';
export { alsGeneticBackgroundQuestionnaire } from './alsGeneticBackground';
export { alsKingsStageQuestionnaire } from './alsKingsStage';
export { alsNeurologicalExamQuestionnaire } from './alsNeurologicalExam';
export { alsSubtypeQuestionnaire } from './alsSubtype';
export { bdifs } from './bdi-fs';
export { dailyCheck } from './daily-check';
export { pdq5 } from './pdq5';
export { pes } from './pes';
export { phq9 } from './phq9';
export { who5 } from './who5';
export { kess } from './kess';
export { respiratoryCare } from './respiratory-care';
