/**
 * FHIR ResearchStudy → App Study Type Mapping
 *
 * Converts FHIR R4 ResearchStudy resources (from the care server)
 * to the app's Study type for display.
 */

import type { ResearchStudy } from '@medplum/fhirtypes';
import type { Study, StudyStatus, StudyPhase, StudyType, StudyCenter, EligibilityCriterion } from './types';

/** Map FHIR R4 ResearchStudy status to app StudyStatus */
function mapStatus(fhirStatus: string): StudyStatus {
    switch (fhirStatus) {
        case 'active':
            return 'recruiting';
        case 'approved':
        case 'in-review':
            return 'enrolling';
        case 'closed-to-accrual':
        case 'closed-to-accrual-and-intervention':
            return 'active';
        case 'completed':
        case 'administratively-completed':
            return 'completed';
        case 'temporarily-closed-to-accrual':
        case 'temporarily-closed-to-accrual-and-intervention':
            return 'paused';
        case 'disapproved':
        case 'withdrawn':
            return 'withdrawn';
        default:
            return 'active';
    }
}

/** Map FHIR phase code to app StudyPhase */
function mapPhase(phaseCode?: string): StudyPhase | undefined {
    switch (phaseCode) {
        case 'early-phase-1':
        case 'phase-1':
        case 'phase-1-phase-2':
            return 'phase_1';
        case 'phase-2':
        case 'phase-2-phase-3':
            return 'phase_2';
        case 'phase-3':
            return 'phase_3';
        case 'phase-4':
            return 'phase_4';
        default:
            return undefined;
    }
}

/** Map FHIR category code to app StudyType */
function mapStudyType(categoryCode?: string): StudyType {
    switch (categoryCode) {
        case 'interventional':
            return 'interventional';
        case 'observational':
            return 'observational';
        default:
            return 'observational';
    }
}

/** Get icon and color based on study type */
function getStudyIcon(type: StudyType): { icon: string; iconColor: string } {
    switch (type) {
        case 'interventional':
            return { icon: 'syringe.fill', iconColor: '#5856D6' };
        case 'observational':
            return { icon: 'eye.fill', iconColor: '#007AFF' };
        case 'registry':
            return { icon: 'doc.text.magnifyingglass', iconColor: '#007AFF' };
        case 'biobank':
            return { icon: 'drop.fill', iconColor: '#FF2D55' };
        case 'survey':
            return { icon: 'list.clipboard.fill', iconColor: '#FF9500' };
        case 'device':
            return { icon: 'waveform.path.ecg', iconColor: '#34C759' };
    }
}

/** Extract sponsor name from contained Organization */
function extractSponsor(study: ResearchStudy): string {
    const sponsorRef = (study.sponsor as any)?.reference as string | undefined;
    if (!sponsorRef?.startsWith('#')) return 'Unbekannt';

    const refId = sponsorRef.slice(1);
    const org = study.contained?.find(
        (r) => r.resourceType === 'Organization' && r.id === refId
    ) as any;
    return org?.name || 'Unbekannt';
}

/** Extract study centers from contained Locations */
function extractCenters(study: ResearchStudy): StudyCenter[] {
    const siteRefs = (study.site || [])
        .map((s: any) => s.reference as string)
        .filter((r): r is string => !!r && r.startsWith('#'));

    return siteRefs.map((ref) => {
        const refId = ref.slice(1);
        const loc = study.contained?.find(
            (r) => r.resourceType === 'Location' && r.id === refId
        ) as any;

        const addr = loc?.address || {};
        return {
            id: refId,
            name: loc?.name || 'Unbekannt',
            city: addr.city || '',
            country: addr.country || '',
        };
    });
}

const EXT_BASE = 'http://help-cure-als.org/ext';

/** Extract extension value by URL */
function getExtension(study: ResearchStudy, url: string): any {
    return study.extension?.find((e) => e.url === url);
}

/** Normalize an i18n language tag to the two-letter code ('de-DE' → 'de') */
export function normalizeLang(raw: string | undefined): string {
    return (raw ?? 'en').split('-')[0].toLowerCase();
}

/**
 * Read a localized study text field.
 *
 * The studies-sync service stores translations as sibling extensions:
 *   `ext/{field}`        — English base text
 *   `ext/{field}-{lang}` — translated text (only if a translation exists)
 *
 * Order: translation first, then English fallback. Mirrors the web
 * portal's useStudyText hook.
 */
function getLocalizedString(
    study: ResearchStudy,
    field: 'short-title' | 'summary' | 'description' | 'why-stopped',
    lang: string,
): string | undefined {
    if (lang && lang !== 'en') {
        const translated = getExtension(study, `${EXT_BASE}/${field}-${lang}`)?.valueString;
        if (translated) return translated;
    }
    return getExtension(study, `${EXT_BASE}/${field}`)?.valueString;
}

/**
 * Translated eligibility text, if available.
 *
 * Unlike the English base (`ext/eligibility`, a nested criteria
 * structure), translations are stored as a single flat string under
 * `ext/eligibility-{lang}`. Returns undefined for English or when no
 * translation exists — the UI then falls back to the structured list.
 */
function getLocalizedEligibilityText(study: ResearchStudy, lang: string): string | undefined {
    if (!lang || lang === 'en') return undefined;
    return getExtension(study, `${EXT_BASE}/eligibility-${lang}`)?.valueString;
}

/** Extract eligibility criteria from nested extension */
function extractEligibility(study: ResearchStudy): EligibilityCriterion[] {
    const ext = getExtension(study, 'http://help-cure-als.org/ext/eligibility');
    if (!ext?.extension) return [];

    return ext.extension
        .filter((c: any) => c.url === 'criterion')
        .map((c: any) => {
            const subs = c.extension || [];
            const typeExt = subs.find((s: any) => s.url === 'type');
            const descExt = subs.find((s: any) => s.url === 'description');
            return {
                type: typeExt?.valueCode === 'exclusion' ? 'exclusion' : 'inclusion',
                description: descExt?.valueString || '',
            } as EligibilityCriterion;
        })
        .filter((c: EligibilityCriterion) => c.description);
}

/**
 * Convert a FHIR ResearchStudy to the app's Study type.
 *
 * `lang` selects translated text fields (summary, short title,
 * eligibility) with fallback to the English base — pass the current
 * i18n language, normalized via `normalizeLang`.
 */
export function mapFhirStudy(resource: ResearchStudy, lang = 'en'): Study {
    const phaseCode = resource.phase?.coding?.[0]?.code;
    const categoryCode = (resource.category as any)?.[0]?.coding?.[0]?.code;
    const studyType = mapStudyType(categoryCode);
    const { icon, iconColor } = getStudyIcon(studyType);

    const nctIdentifier = resource.identifier?.find(
        (id) => id.system === 'https://clinicaltrials.gov'
    );

    const contactEmail = resource.contact?.[0]?.telecom?.find(
        (t) => t.system === 'email'
    )?.value;

    const externalUrl = resource.relatedArtifact?.find(
        (a) => (a.type as string) === 'url'
    )?.url;

    const targetExt = getExtension(resource, `${EXT_BASE}/target-participants`);

    const summary = getLocalizedString(resource, 'summary', lang);
    const shortTitle = getLocalizedString(resource, 'short-title', lang);
    const targetParticipants = targetExt?.valueInteger;

    // True when at least one displayed field actually resolved from a
    // translation extension — drives the AI-translation notice in the UI.
    const isTranslated =
        lang !== 'en' &&
        Boolean(
            getExtension(resource, `${EXT_BASE}/summary-${lang}`)?.valueString ||
            getExtension(resource, `${EXT_BASE}/short-title-${lang}`)?.valueString ||
            getExtension(resource, `${EXT_BASE}/eligibility-${lang}`)?.valueString
        );

    const tags = resource.keyword?.map((k) => k.text).filter((t): t is string => !!t);

    return {
        id: resource.id || '',
        title: resource.title || 'Unbekannte Studie',
        shortTitle,
        description: summary || resource.title || '',
        summary: summary ? summary.slice(0, 200) + (summary.length > 200 ? '...' : '') : undefined,
        type: studyType,
        phase: mapPhase(phaseCode),
        status: mapStatus(resource.status || 'active'),
        sponsor: {
            name: extractSponsor(resource),
            type: 'other',
        },
        icon,
        iconColor,
        eligibility: extractEligibility(resource),
        eligibilityText: getLocalizedEligibilityText(resource, lang),
        isTranslated,
        centers: extractCenters(resource),
        targetParticipants,
        startDate: resource.period?.start ? new Date(resource.period.start) : undefined,
        endDate: resource.period?.end ? new Date(resource.period.end) : undefined,
        nctId: nctIdentifier?.value,
        contactEmail,
        externalUrl,
        tags,
    };
}
