import { base } from './base';
import { mergeMetricDefinition, type MetricDefinition, type MetricLocale } from '../../types';
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

const locales: Record<string, MetricLocale> = {
    de: deLocale as MetricLocale,
    en: enLocale as MetricLocale,
    fr: frLocale as MetricLocale,    es: esLocale as MetricLocale,
    it: itLocale as MetricLocale,
    pt: ptLocale as MetricLocale,
    nl: nlLocale as MetricLocale,
    pl: plLocale as MetricLocale,
    ja: jaLocale as MetricLocale,
    zh: zhLocale as MetricLocale,
    ro: roLocale as MetricLocale,
    tr: trLocale as MetricLocale,
};

export function getDefinition(language: string): MetricDefinition {
    const locale = locales[language] ?? locales.en;
    return mergeMetricDefinition(base, locale);
}

/** @deprecated Use getDefinition(language) */
export const painMoodMetric = getDefinition('de');

export { base };
