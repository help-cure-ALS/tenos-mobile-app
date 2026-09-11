/**
 * Study eligibility matching — pure, on-device engine.
 *
 * Studies arrive with machine-readable criteria (extracted server-side
 * by studies-sync against the fixed criterion catalog v1, correctable
 * in the clinic portal). This module evaluates them against a local
 * snapshot of the patient's own data. Nothing here talks to the
 * network — patient data never leaves the device for matching.
 *
 * Semantics (shared with studies-sync/src/extraction/catalog.ts):
 * a StructuredCriterion always expresses the ELIGIBILITY REQUIREMENT,
 * regardless of the section it came from — `kind` is display grouping.
 *   numeric (min/max):   patient value inside the range   → met
 *   choice op=requires:  patient has the value            → met
 *   choice op=excludes:  patient does NOT have the value  → met
 * Missing patient data or an unknown criterion id → unknown. The
 * result is a LABEL, never a filter, and never an eligibility promise
 * — that decision belongs to the study site.
 */

export type CriterionKind = 'inclusion' | 'exclusion';

export interface StructuredCriterion {
    id: string;
    kind: CriterionKind;
    min?: number;
    max?: number;
    op?: 'requires' | 'excludes';
    value?: string;
}

export type CriterionMatchState = 'met' | 'not_met' | 'unknown';

/** Local snapshot of everything matchable. undefined = unknown. */
export interface PatientMatchSnapshot {
    ageYears?: number;
    sex?: 'male' | 'female';
    monthsSinceOnset?: number;
    monthsSinceDiagnosis?: number;
    alsfrsRTotal?: number;
    fvcPercent?: number;
    svcPercent?: number;
    kingsStage?: number;
    /** Lowercase gene ids the patient carries (empty array = tested, none of them). */
    geneMutations?: string[];
    alsCause?: 'familial' | 'sporadic';
    onsetRegion?: 'bulbar' | 'spinal';
    /** undefined = unknown; flags = current aid situation. */
    ventilation?: { niv: boolean; tracheostomy: boolean };
    peg?: boolean;
    /** Lowercase substance ids the patient currently takes. */
    medications?: string[];
}

const NUMERIC_FIELD: Record<string, keyof PatientMatchSnapshot> = {
    age: 'ageYears',
    time_since_onset: 'monthsSinceOnset',
    time_since_diagnosis: 'monthsSinceDiagnosis',
    alsfrs_r_total: 'alsfrsRTotal',
    fvc_percent: 'fvcPercent',
    svc_percent: 'svcPercent',
    kings_stage: 'kingsStage',
};

function evaluateNumeric(value: number | undefined, c: StructuredCriterion): CriterionMatchState {
    if (value === undefined) return 'unknown';
    if (c.min !== undefined && value < c.min) return 'not_met';
    if (c.max !== undefined && value > c.max) return 'not_met';
    return 'met';
}

/** requires: has → met; excludes: has → not_met. undefined has-state → unknown. */
function evaluateChoice(has: boolean | undefined, c: StructuredCriterion): CriterionMatchState {
    if (has === undefined) return 'unknown';
    if (c.op === 'excludes') return has ? 'not_met' : 'met';
    return has ? 'met' : 'not_met';
}

export function evaluateCriterion(
    c: StructuredCriterion,
    p: PatientMatchSnapshot,
): CriterionMatchState {
    const numericField = NUMERIC_FIELD[c.id];
    if (numericField) {
        return evaluateNumeric(p[numericField] as number | undefined, c);
    }

    switch (c.id) {
        case 'sex':
            return evaluateChoice(p.sex === undefined ? undefined : p.sex === c.value, c);

        case 'gene_mutation': {
            // 'other' cannot be matched reliably against our known-gene list
            if (c.value === 'other') return 'unknown';
            if (p.geneMutations === undefined) return 'unknown';
            return evaluateChoice(p.geneMutations.includes(c.value ?? ''), c);
        }

        case 'als_cause':
            return evaluateChoice(p.alsCause === undefined ? undefined : p.alsCause === c.value, c);

        case 'onset_region':
            return evaluateChoice(
                p.onsetRegion === undefined ? undefined : p.onsetRegion === c.value,
                c,
            );

        case 'ventilation': {
            if (p.ventilation === undefined) return 'unknown';
            const has =
                c.value === 'niv' ? p.ventilation.niv
                : c.value === 'tracheostomy' ? p.ventilation.tracheostomy
                : p.ventilation.niv || p.ventilation.tracheostomy;
            return evaluateChoice(has, c);
        }

        case 'peg':
            return evaluateChoice(p.peg, c);

        case 'medication':
            if (p.medications === undefined) return 'unknown';
            return evaluateChoice(p.medications.includes(c.value ?? ''), c);

        default:
            // Unknown catalog id (newer server than app): never guess.
            return 'unknown';
    }
}

/**
 * All structured criteria of a study: registry base (age/sex) plus the
 * extracted/overridden criterion lines. Structurally typed to avoid an
 * import cycle with the Study type.
 */
export function collectStructuredCriteria(study: {
    structuredBase?: StructuredCriterion[];
    eligibility: Array<{ structured?: StructuredCriterion }>;
}): StructuredCriterion[] {
    return [
        ...(study.structuredBase ?? []),
        ...study.eligibility
            .map((c) => c.structured)
            .filter((c): c is StructuredCriterion => !!c),
    ];
}

export type StudyMatchLabel = 'could_fit' | 'unlikely_fit' | 'neutral';

export interface StudyMatchResult {
    label: StudyMatchLabel;
    met: number;
    notMet: number;
    unknown: number;
}

/**
 * Study-level verdict over all structured criteria (base criteria from
 * the registry plus the extracted/overridden criterion lines).
 *
 * - any criterion not met  → 'unlikely_fit'  (labeled, NOT hidden)
 * - at least one met, none violated → 'could_fit'
 * - nothing evaluable → 'neutral'
 */
export function evaluateStudyMatch(
    criteria: StructuredCriterion[],
    p: PatientMatchSnapshot,
): StudyMatchResult {
    let met = 0;
    let notMet = 0;
    let unknown = 0;

    for (const c of criteria) {
        const state = evaluateCriterion(c, p);
        if (state === 'met') met++;
        else if (state === 'not_met') notMet++;
        else unknown++;
    }

    const label: StudyMatchLabel = notMet > 0 ? 'unlikely_fit' : met > 0 ? 'could_fit' : 'neutral';
    return { label, met, notMet, unknown };
}
