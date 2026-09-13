/**
 * Maps care-server `Basic` article resources to the app's
 * ContentArticle type. Language-aware: translated field variants
 * (`title-{lang}` etc.) win over the base field; articles published
 * without translation simply show their original language everywhere.
 * Everything is parsed defensively — malformed server data drops the
 * article rather than crashing the tab.
 */

import type { Basic, Extension } from '@medplum/fhirtypes';
import { normalizeLang } from '../studies/fhirMapping';
import type { AlsfrsScale, ArticleRole, ArticleTargeting, ContentArticle } from './types';

const EXT_BASE = 'http://help-cure-als.org/ext';
export const CONTENT_CODE_SYSTEM = 'http://help-cure-als.org/content';

function extValue(extensions: Extension[] | undefined, name: string): string | undefined {
    return extensions?.find((e) => e.url === `${EXT_BASE}/${name}`)?.valueString;
}

function extDate(extensions: Extension[] | undefined, name: string): string | undefined {
    return extensions?.find((e) => e.url === `${EXT_BASE}/${name}`)?.valueDate;
}

function extInt(extensions: Extension[] | undefined, name: string): number | undefined {
    const value = extensions?.find((e) => e.url === `${EXT_BASE}/${name}`)?.valueInteger;
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Translated field with fallback to the base (original language). */
function localized(extensions: Extension[] | undefined, field: string, lang: string): string {
    return extValue(extensions, `${field}-${lang}`) ?? extValue(extensions, field) ?? '';
}

const ALSFRS_SCALES: AlsfrsScale[] = ['total', 'bulbar', 'fine_motor', 'gross_motor', 'respiratory'];
const ARTICLE_ROLES: ArticleRole[] = ['patient', 'caregiver', 'doctor'];

function parseTargeting(raw: string | undefined): ArticleTargeting {
    const none: ArticleTargeting = {
        countries: [],
        roles: [],
        phaseMinMonths: null,
        phaseMaxMonths: null,
        alsfrs: null,
    };
    if (!raw) return none;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return none;
        const countries = Array.isArray(parsed.countries)
            ? parsed.countries.filter((c: unknown): c is string => typeof c === 'string')
            : [];
        const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
        let alsfrs: ArticleTargeting['alsfrs'] = null;
        const a = parsed.alsfrs;
        if (a && typeof a === 'object' && ALSFRS_SCALES.includes(a.scale)) {
            alsfrs = { scale: a.scale, min: num(a.min), max: num(a.max) };
        }
        const roles = Array.isArray(parsed.roles)
            ? parsed.roles.filter((r: unknown): r is ArticleRole =>
                typeof r === 'string' && (ARTICLE_ROLES as string[]).includes(r))
            : [];
        return {
            countries: countries.map((c: string) => c.toUpperCase()),
            roles,
            phaseMinMonths: num(parsed.phase_min_months),
            phaseMaxMonths: num(parsed.phase_max_months),
            alsfrs,
        };
    } catch {
        return none;
    }
}

export function mapFhirArticle(resource: Basic, rawLang: string): ContentArticle | null {
    const lang = normalizeLang(rawLang);
    const ext = resource.extension;

    const articleId = resource.identifier?.find(
        (i) => i.system === `${CONTENT_CODE_SYSTEM}-article`,
    )?.value;
    const title = localized(ext, 'title', lang);
    const startsAt = extDate(ext, 'content-starts-at');
    const endsAt = extDate(ext, 'content-ends-at');
    const source = extValue(ext, 'content-source');
    if (!resource.id || !articleId || !title) return null;
    if (source !== 'hca' && source !== 'clinic') return null;

    const category = extValue(ext, 'content-category') ?? 'news';

    return {
        id: resource.id,
        articleId,
        source,
        clinicId: extValue(ext, 'content-clinic-id'),
        clinicName: extValue(ext, 'content-clinic-name'),
        category,
        categoryLabel: localized(ext, 'category-label', lang) || category,
        title,
        teaser: localized(ext, 'teaser', lang),
        body: localized(ext, 'body', lang),
        linkUrl: extValue(ext, 'content-link'),
        imageRef: extValue(ext, 'content-image'),
        articleDate: extDate(ext, 'content-date') ?? startsAt ?? resource.created ?? '',
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        ...(extInt(ext, 'content-hide-read-days') !== undefined
            ? { hideReadAfterDays: extInt(ext, 'content-hide-read-days') }
            : {}),
        ...(ext?.some((e) => e.url === `${EXT_BASE}/content-pinned` && e.valueBoolean === true)
            ? { pinned: true }
            : {}),
        targeting: parseTargeting(extValue(ext, 'content-targeting')),
    };
}
