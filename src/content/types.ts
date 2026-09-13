/**
 * Editorial content (news tab) — app-facing types.
 *
 * Articles are mirrored to the care server by the clinic portal;
 * the app reads them anonymously and evaluates the targeting
 * locally (see targeting.ts) — no health data leaves the device.
 */

export type AlsfrsScale = 'total' | 'bulbar' | 'fine_motor' | 'gross_motor' | 'respiratory';
export type ArticleRole = 'patient' | 'caregiver' | 'doctor';

export interface ArticleTargeting {
    /** ISO country codes; empty = all countries. */
    countries: string[];
    /**
     * App roles the article is meant for. Empty = the regular
     * audience (patient/caregiver); doctors only ever see articles
     * that list 'doctor' explicitly.
     */
    roles: ArticleRole[];
    /** Months since symptom onset, inclusive bounds; null = open. */
    phaseMinMonths: number | null;
    phaseMaxMonths: number | null;
    /** ALSFRS-R filter on the total or a domain score; null = none. */
    alsfrs: { scale: AlsfrsScale; min: number | null; max: number | null } | null;
}

export interface ContentArticle {
    /** Care-server resource id. */
    id: string;
    /** Editorial article id (stable across republishes). */
    articleId: string;
    source: 'hca' | 'clinic';
    clinicId?: string;
    clinicName?: string;
    category: string;
    categoryLabel: string;
    title: string;
    teaser: string;
    /** Markdown body (may be empty when the article is link-only). */
    body: string;
    linkUrl?: string;
    /** Care-server Binary reference ("Binary/<id>") for the cover image. */
    imageRef?: string;
    /** Editorial date (YYYY-MM-DD) — sort order of the news list. */
    articleDate: string;
    /** ISO dates (YYYY-MM-DD); missing = unbounded on that side. */
    startsAt?: string;
    endsAt?: string;
    /** Hide n days after the reader opened the article; missing = never. */
    hideReadAfterDays?: number;
    /** Pinned articles sort before all others in the news list. */
    pinned?: boolean;
    targeting: ArticleTargeting;
}

/** Local data the targeting is evaluated against — built on device. */
export interface ContentAudience {
    /** ISO country code from the patient profile, if recorded. */
    country?: string;
    monthsSinceOnset?: number;
    alsfrsTotal?: number;
    /** Latest ALSFRS-R domain scores keyed by domain id. */
    alsfrsDomains?: Record<string, number>;
    /** Clinic the patient is verified with (clinic articles). */
    verifiedClinicId?: string;
    /** Current app role ('demo' counts as patient). */
    role?: ArticleRole;
}
