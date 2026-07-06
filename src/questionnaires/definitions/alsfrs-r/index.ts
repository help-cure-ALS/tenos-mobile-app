/**
 * ALSFRS-R Questionnaire Definition
 *
 * Merges base (technical) definition with locale (text) content.
 */

import { base } from './base';
import { mergeDefinition, type QuestionnaireDefinition, type QuestionnaireLocale } from '../../types';

// Import locale files
import deLocale from './locales/de.json';
import enLocale from './locales/en.json';
import frLocale from './locales/fr.json';
import esLocale from './locales/es.json';
import roLocale from './locales/ro.json';
import trLocale from './locales/tr.json';

const locales: Record<string, QuestionnaireLocale> = {
    de: deLocale as QuestionnaireLocale,
    en: enLocale as QuestionnaireLocale,
    fr: frLocale as QuestionnaireLocale,
    es: esLocale as QuestionnaireLocale,
    ro: roLocale as QuestionnaireLocale,
    tr: trLocale as QuestionnaireLocale,
};

/**
 * Get the ALSFRS-R definition for a specific language.
 */
export function getDefinition(language: string): QuestionnaireDefinition {
    const locale = locales[language] ?? locales.en;
    return mergeDefinition(base, locale);
}

/**
 * Get the ALSFRS-R definition using the current app language.
 */
export function getLocalizedDefinition(getLanguage: () => string): QuestionnaireDefinition {
    return getDefinition(getLanguage());
}

/**
 * Default export using German locale.
 * @deprecated Use getDefinition(language) for proper i18n support.
 */
export const alsfrsr = getDefinition('de');

// Re-export base for direct access if needed
export { base };
