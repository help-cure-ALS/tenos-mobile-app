import type { Basic, Questionnaire } from '@medplum/fhirtypes';
import type { MetricBaseDefinition, MetricLocale } from '@/src/metrics/types';
import type { QuestionnaireBaseDefinition, QuestionnaireLocale } from '@/src/questionnaires/types';

const METRIC_BASE_EXT_URL = 'urn:hca:metric:base';
const METRIC_LOCALE_EXT_PREFIX = 'urn:hca:metric:locale:';

const QUESTIONNAIRE_BASE_EXT_URL = 'urn:hca:questionnaire:base';
const QUESTIONNAIRE_LOCALE_EXT_PREFIX = 'urn:hca:questionnaire:locale:';

function parseJson<T>(value: string | undefined): T | null {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

function findValueString(
    extensions: Array<{ url?: string; valueString?: string }> | undefined,
    url: string
): string | undefined {
    return extensions?.find((e) => e.url === url)?.valueString;
}

function findLocale<T>(
    extensions: Array<{ url?: string; valueString?: string }> | undefined,
    prefix: string,
    language: string
): T | null {
    const exact = findValueString(extensions, `${prefix}${language}`);
    const fallbackEn = findValueString(extensions, `${prefix}en`);
    const fallbackDe = findValueString(extensions, `${prefix}de`);
    return parseJson<T>(exact ?? fallbackEn ?? fallbackDe);
}

export function mapMetricDefinition(
    resource: Basic,
    language: string
): { id: string; version: string; base: MetricBaseDefinition; locale: MetricLocale } | null {
    const extensions = resource.extension as Array<{ url?: string; valueString?: string }> | undefined;

    const base = parseJson<MetricBaseDefinition>(findValueString(extensions, METRIC_BASE_EXT_URL));
    const locale = findLocale<MetricLocale>(extensions, METRIC_LOCALE_EXT_PREFIX, language);
    if (!base || !locale) return null;

    const metricId =
        resource.identifier?.find((i) => i.system === 'urn:hca:metric-id')?.value ??
        base.id;
    const version =
        resource.identifier?.find((i) => i.system === 'urn:hca:metric-version')?.value ??
        '1.0.0';

    if (!metricId) return null;

    return {
        id: metricId,
        version,
        base,
        locale,
    };
}

export function mapQuestionnaireDefinition(
    resource: Questionnaire,
    language: string
): { id: string; version: string; base: QuestionnaireBaseDefinition; locale: QuestionnaireLocale } | null {
    const extensions = resource.extension as Array<{ url?: string; valueString?: string }> | undefined;

    const base = parseJson<QuestionnaireBaseDefinition>(findValueString(extensions, QUESTIONNAIRE_BASE_EXT_URL));
    const locale = findLocale<QuestionnaireLocale>(extensions, QUESTIONNAIRE_LOCALE_EXT_PREFIX, language);
    if (!base || !locale) return null;

    const definitionId =
        resource.extension?.find((e) => e.url === 'urn:hca:questionnaire:id')?.valueString ??
        base.id ??
        resource.name ??
        resource.id;

    if (!definitionId) return null;

    return {
        id: definitionId,
        version: resource.version ?? '1.0.0',
        base,
        locale,
    };
}
