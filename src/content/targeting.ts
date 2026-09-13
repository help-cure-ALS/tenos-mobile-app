/**
 * On-device article targeting.
 *
 * Deliberate asymmetry (product decision): MISSING patient data never
 * hides an article — someone without a recorded symptom onset or
 * ALSFRS-R sees everything, the filters only narrow things down once
 * the data exists. The clinic binding is the one exception: clinic
 * articles are only for patients verified with that clinic, so a
 * missing verification hides them.
 */

import type { ContentArticle, ContentAudience } from './types';

function inRange(value: number, min: number | null, max: number | null): boolean {
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
}

/** YYYY-MM-DD of "now" in local time — article windows are dates. */
export function localIsoDate(now: Date = new Date()): string {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function isArticleVisible(
    article: ContentArticle,
    audience: ContentAudience,
    today: string = localIsoDate(),
): boolean {
    // Visibility window (server sweeps expired articles too, but the
    // app must not rely on that). Missing bound = unbounded.
    if (article.startsAt && article.startsAt > today) return false;
    if (article.endsAt && article.endsAt < today) return false;

    // Clinic articles: only for patients verified with that clinic.
    if (article.source === 'clinic') {
        if (!article.clinicId || article.clinicId !== audience.verifiedClinicId) return false;
    }

    const t = article.targeting;

    // Role targeting. Doctors are opt-in: they only see articles that
    // list 'doctor' explicitly — an empty roles array addresses the
    // regular audience (patient/caregiver), keeping the tab hidden in
    // doctor mode unless an article is meant for doctors.
    if (audience.role === 'doctor') {
        if (!t.roles.includes('doctor')) return false;
    } else if (t.roles.length > 0 && audience.role) {
        if (!t.roles.includes(audience.role)) return false;
    }

    if (t.countries.length > 0 && audience.country) {
        if (!t.countries.includes(audience.country.toUpperCase())) return false;
    }

    if (
        (t.phaseMinMonths !== null || t.phaseMaxMonths !== null)
        && audience.monthsSinceOnset !== undefined
    ) {
        if (!inRange(audience.monthsSinceOnset, t.phaseMinMonths, t.phaseMaxMonths)) return false;
    }

    if (t.alsfrs) {
        const value = t.alsfrs.scale === 'total'
            ? audience.alsfrsTotal
            : audience.alsfrsDomains?.[t.alsfrs.scale];
        if (value !== undefined && !inRange(value, t.alsfrs.min, t.alsfrs.max)) return false;
    }

    return true;
}

/**
 * True when the article should be hidden because the reader opened it
 * at least `hideReadAfterDays` days ago (per-article editorial option).
 * Unread articles or articles without the option never expire.
 */
export function isReadExpired(
    article: ContentArticle,
    readAtIso: string | undefined,
    today: string = localIsoDate(),
): boolean {
    if (article.hideReadAfterDays === undefined || !readAtIso) return false;
    const readAt = new Date(readAtIso.slice(0, 10));
    const now = new Date(today);
    if (Number.isNaN(readAt.getTime()) || Number.isNaN(now.getTime())) return false;
    const days = Math.floor((now.getTime() - readAt.getTime()) / 86400000);
    return days >= article.hideReadAfterDays;
}

export function visibleArticles(
    articles: ContentArticle[],
    audience: ContentAudience,
    today: string = localIsoDate(),
): ContentArticle[] {
    return articles.filter((a) => isArticleVisible(a, audience, today));
}
