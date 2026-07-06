import { base } from './base';
import { mergeDefinition, type QuestionnaireDefinition, type QuestionnaireLocale } from '../../types';

import deLocale from './locales/de.json';
import enLocale from './locales/en.json';
import frLocale from './locales/fr.json';
import esLocale from './locales/es.json';
import itLocale from './locales/it.json';
import ptLocale from './locales/pt.json';
import nlLocale from './locales/nl.json';
import plLocale from './locales/pl.json';
import jaLocale from './locales/ja.json';
import zhLocale from './locales/zh.json';
import roLocale from './locales/ro.json';
import trLocale from './locales/tr.json';

const locales: Record<string, QuestionnaireLocale> = {
    de: deLocale as QuestionnaireLocale,
    en: enLocale as QuestionnaireLocale,
    fr: frLocale as QuestionnaireLocale,    es: esLocale as QuestionnaireLocale,
    it: itLocale as QuestionnaireLocale,
    pt: ptLocale as QuestionnaireLocale,
    nl: nlLocale as QuestionnaireLocale,
    pl: plLocale as QuestionnaireLocale,
    ja: jaLocale as QuestionnaireLocale,
    zh: zhLocale as QuestionnaireLocale,
    ro: roLocale as QuestionnaireLocale,
    tr: trLocale as QuestionnaireLocale,
};

export function getDefinition(language: string): QuestionnaireDefinition {
    return mergeDefinition(base, locales[language] ?? locales.en);
}

export const alsKingsStageQuestionnaire = getDefinition('de');

export { base };
