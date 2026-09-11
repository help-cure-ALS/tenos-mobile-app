/**
 * Unit tests for the pure study-matching engine.
 * Run with: npm run test:matching (uses npx tsx — no RN runtime needed)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    evaluateCriterion,
    evaluateStudyMatch,
    type PatientMatchSnapshot,
    type StructuredCriterion,
} from '../src/studies/matching';

const PATIENT: PatientMatchSnapshot = {
    ageYears: 54,
    sex: 'male',
    monthsSinceOnset: 18,
    monthsSinceDiagnosis: 10,
    alsfrsRTotal: 38,
    fvcPercent: 72,
    kingsStage: 2,
    geneMutations: ['sod1'],
    alsCause: 'familial',
    onsetRegion: 'spinal',
    ventilation: { niv: false, tracheostomy: false },
    peg: false,
    medications: ['riluzole'],
};

function c(partial: Partial<StructuredCriterion> & { id: string }): StructuredCriterion {
    return { kind: 'inclusion', ...partial };
}

test('numeric criteria: met / not met / unknown', () => {
    assert.equal(evaluateCriterion(c({ id: 'age', min: 18, max: 75 }), PATIENT), 'met');
    assert.equal(evaluateCriterion(c({ id: 'age', min: 60 }), PATIENT), 'not_met');
    assert.equal(evaluateCriterion(c({ id: 'fvc_percent', min: 50 }), PATIENT), 'met');
    assert.equal(evaluateCriterion(c({ id: 'fvc_percent', min: 80 }), PATIENT), 'not_met');
    assert.equal(evaluateCriterion(c({ id: 'time_since_onset', max: 24 }), PATIENT), 'met');
    // svc missing on the patient → unknown, never guessed from fvc
    assert.equal(evaluateCriterion(c({ id: 'svc_percent', min: 50 }), PATIENT), 'unknown');
});

test('choice criteria: requires and excludes', () => {
    assert.equal(evaluateCriterion(c({ id: 'sex', op: 'requires', value: 'male' }), PATIENT), 'met');
    assert.equal(evaluateCriterion(c({ id: 'sex', op: 'requires', value: 'female' }), PATIENT), 'not_met');
    assert.equal(
        evaluateCriterion(c({ id: 'gene_mutation', op: 'requires', value: 'sod1' }), PATIENT),
        'met',
    );
    assert.equal(
        evaluateCriterion(c({ id: 'gene_mutation', op: 'excludes', value: 'c9orf72' }), PATIENT),
        'met',
    );
    // 'other' genes cannot be matched reliably → unknown
    assert.equal(
        evaluateCriterion(c({ id: 'gene_mutation', op: 'requires', value: 'other' }), PATIENT),
        'unknown',
    );
    assert.equal(
        evaluateCriterion(c({ id: 'ventilation', op: 'excludes', value: 'tracheostomy', kind: 'exclusion' }), PATIENT),
        'met',
    );
    assert.equal(
        evaluateCriterion(c({ id: 'ventilation', op: 'excludes', value: 'any' }), { ...PATIENT, ventilation: { niv: true, tracheostomy: false } }),
        'not_met',
    );
    assert.equal(
        evaluateCriterion(c({ id: 'medication', op: 'requires', value: 'riluzole' }), PATIENT),
        'met',
    );
    assert.equal(evaluateCriterion(c({ id: 'peg', op: 'excludes', value: 'peg' }), PATIENT), 'met');
});

test('missing patient data and unknown ids are unknown', () => {
    const empty: PatientMatchSnapshot = {};
    assert.equal(evaluateCriterion(c({ id: 'age', min: 18 }), empty), 'unknown');
    assert.equal(evaluateCriterion(c({ id: 'sex', op: 'requires', value: 'male' }), empty), 'unknown');
    assert.equal(evaluateCriterion(c({ id: 'gene_mutation', op: 'excludes', value: 'sod1' }), empty), 'unknown');
    // Future catalog id from a newer server → unknown, never a fail
    assert.equal(evaluateCriterion(c({ id: 'brand_new_criterion', min: 1 }), PATIENT), 'unknown');
});

test('study label: could_fit / unlikely_fit / neutral', () => {
    const fits = evaluateStudyMatch(
        [c({ id: 'age', min: 18, max: 75 }), c({ id: 'fvc_percent', min: 50 }), c({ id: 'svc_percent', min: 50 })],
        PATIENT,
    );
    assert.equal(fits.label, 'could_fit');
    assert.deepEqual([fits.met, fits.notMet, fits.unknown], [2, 0, 1]);

    const unlikely = evaluateStudyMatch(
        [c({ id: 'age', min: 18, max: 75 }), c({ id: 'sex', op: 'requires', value: 'female' })],
        PATIENT,
    );
    assert.equal(unlikely.label, 'unlikely_fit');

    // Only unknowns → neutral (no judgement without evidence)
    assert.equal(evaluateStudyMatch([c({ id: 'svc_percent', min: 50 })], PATIENT).label, 'neutral');
    assert.equal(evaluateStudyMatch([], PATIENT).label, 'neutral');
});
