/**
 * Demo data generator for the app
 * Generates realistic-looking fake data for demonstration purposes
 * All metrics generate ~1 year of data with realistic ALS disease progression
 */
import { createPatientPreferencesStore } from '@/src/stores/patientPreferencesStore';
import * as SecureStore from 'expo-secure-store';
import { aidToFhir, createAidDraft } from '@/src/aids/fhir/aidToFhir';
import type { AidStatus, AidCategory } from '@/src/aids/types';
import { structuredQuestionnaireEntryToFhir } from '@/src/questionnaires/fhir/structuredQuestionnaireToFhir';
import { buildClassificationCode } from '@/src/questionnaires/structured/alsSubtype/opmCodes';
import type { ALSSubtypeEntry } from '@/src/questionnaires/structured/alsSubtype/types';
import type { ALSGeneticBackgroundEntry } from '@/src/questionnaires/structured/alsGeneticBackground/types';
import type { ALSKingsStageEntry } from '@/src/questionnaires/structured/alsKingsStage/types';
import {
    ALS_KINGS_STAGE_QUESTIONNAIRE_ID,
    ALS_KINGS_STAGE_QUESTIONNAIRE_URL,
} from '@/src/questionnaires/structured/alsKingsStage/types';

/** Minimal FHIR Observation type for demo data */
type Observation = {
    resourceType: 'Observation';
    id: string;
    status: 'final';
    code: {
        coding?: Array<{ system?: string; code?: string; display?: string }>;
        text?: string;
    };
    subject?: { reference?: string };
    effectiveDateTime?: string;
    valueInteger?: number;
    valueQuantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
    };
    component?: Array<{
        code: { coding?: Array<{ system?: string; code?: string; display?: string }> };
        valueQuantity?: { value?: number; unit?: string; system?: string; code?: string };
    }>;
    meta?: {
        extension?: Array<{ url: string; valueString: string }>;
    };
    category?: Array<{
        coding?: Array<{ system?: string; code?: string; display?: string }>;
    }>;
};

type QuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse';
    id: string;
    meta?: {
        lastUpdated?: string;
        extension?: Array<{ url: string; valueString: string }>;
    };
    questionnaire?: string;
    status: 'completed';
    authored?: string;
    item?: Array<{
        linkId: string;
        answer?: Array<{ valueString?: string }>;
    }>;
    subject?: { reference?: string };
};

export const DEMO_PATIENT_ID = 'demo-patient';

const LOINC = 'http://loinc.org';
const UCUM = 'http://unitsofmeasure.org';
const CAT_SYS = 'http://terminology.hl7.org/CodeSystem/observation-category';

// --- Helpers ---

/** Seeded pseudo-random for reproducible demo data */
function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

/** Generate dates at regular intervals over the past year */
function datesOverYear(intervalDays: number): Date[] {
    const dates: Date[] = [];
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const d = new Date(oneYearAgo);
    while (d <= now) {
        dates.push(new Date(d));
        d.setDate(d.getDate() + intervalDays);
    }
    return dates;
}

/** Progress factor: 0 = start of year, 1 = today */
function progress(date: Date): number {
    const now = Date.now();
    const oneYearMs = 365.25 * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.min(1, (date.getTime() - (now - oneYearMs)) / oneYearMs));
}

/** Linear interpolation with noise */
function lerp(start: number, end: number, t: number, noise: number, rand: () => number): number {
    return start + (end - start) * t + (rand() - 0.5) * 2 * noise;
}

/** Create a simple valueQuantity observation */
function makeQuantityObs(
    id: string, code: string, display: string, date: Date,
    value: number, unit: string, ucumCode: string, category: string,
): Observation {
    return {
        resourceType: 'Observation', id, status: 'final',
        category: [{ coding: [{ system: CAT_SYS, code: category }] }],
        code: { coding: [{ system: LOINC, code, display }] },
        subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
        effectiveDateTime: date.toISOString(),
        valueQuantity: { value, unit, system: UCUM, code: ucumCode },
    };
}

/** Create a simple valueInteger observation */
function makeIntegerObs(
    id: string, code: string, display: string, date: Date,
    value: number, category: string, system = LOINC,
): Observation {
    return {
        resourceType: 'Observation', id, status: 'final',
        category: [{ coding: [{ system: CAT_SYS, code: category }] }],
        code: { coding: [{ system, code, display }] },
        subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
        effectiveDateTime: date.toISOString(),
        valueInteger: value,
    };
}

/** Clamp value to range */
function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

/** Round to N decimal places */
function round(v: number, decimals: number): number {
    const f = 10 ** decimals;
    return Math.round(v * f) / f;
}

function dateMonthsAgo(monthsAgo: number): Date {
    const date = new Date();
    date.setMonth(date.getMonth() - Math.floor(monthsAgo));
    date.setDate(date.getDate() - Math.round((monthsAgo % 1) * 30));
    return date;
}

// ============================================================
// ALSFRS-R (special structure with per-question observations)
// ============================================================

const ALSFRS_QUESTIONS: { id: string; code: string; display: string }[] = [
    { id: 'speech', code: '67741-3', display: 'ALSFRS-R Speech score' },
    { id: 'salivation', code: '67742-1', display: 'ALSFRS-R Salivation score' },
    { id: 'swallowing', code: '67743-9', display: 'ALSFRS-R Swallowing score' },
    { id: 'handwriting', code: '67744-7', display: 'ALSFRS-R Handwriting score' },
    { id: 'cutting_food', code: '67745-4', display: 'ALSFRS-R Cutting food score' },
    { id: 'dressing', code: '67746-2', display: 'ALSFRS-R Dressing and hygiene score' },
    { id: 'turning_in_bed', code: '67747-0', display: 'ALSFRS-R Turning in bed score' },
    { id: 'walking', code: '67748-8', display: 'ALSFRS-R Walking score' },
    { id: 'climbing_stairs', code: '67749-6', display: 'ALSFRS-R Climbing stairs score' },
    { id: 'dyspnea', code: '67750-4', display: 'ALSFRS-R Dyspnea score' },
    { id: 'orthopnea', code: '67751-2', display: 'ALSFRS-R Orthopnea score' },
    { id: 'respiratory_insufficiency', code: '67752-0', display: 'ALSFRS-R Respiratory insufficiency score' },
];

const ALSFRS_DEMO_ENTRIES: { monthsAgo: number; answers: Record<string, number> }[] = [
    { monthsAgo: 11, answers: { speech: 4, salivation: 4, swallowing: 4, handwriting: 4, cutting_food: 4, dressing: 4, turning_in_bed: 4, walking: 4, climbing_stairs: 3, dyspnea: 4, orthopnea: 4, respiratory_insufficiency: 4 } },
    { monthsAgo: 9, answers: { speech: 4, salivation: 4, swallowing: 4, handwriting: 4, cutting_food: 4, dressing: 3, turning_in_bed: 4, walking: 4, climbing_stairs: 3, dyspnea: 4, orthopnea: 3, respiratory_insufficiency: 3 } },
    { monthsAgo: 7, answers: { speech: 4, salivation: 4, swallowing: 3, handwriting: 3, cutting_food: 4, dressing: 3, turning_in_bed: 4, walking: 3, climbing_stairs: 3, dyspnea: 3, orthopnea: 3, respiratory_insufficiency: 3 } },
    { monthsAgo: 5, answers: { speech: 4, salivation: 3, swallowing: 3, handwriting: 3, cutting_food: 3, dressing: 3, turning_in_bed: 3, walking: 3, climbing_stairs: 3, dyspnea: 3, orthopnea: 3, respiratory_insufficiency: 3 } },
    { monthsAgo: 4, answers: { speech: 3, salivation: 3, swallowing: 3, handwriting: 3, cutting_food: 3, dressing: 3, turning_in_bed: 3, walking: 3, climbing_stairs: 2, dyspnea: 3, orthopnea: 3, respiratory_insufficiency: 3 } },
    { monthsAgo: 3, answers: { speech: 3, salivation: 3, swallowing: 3, handwriting: 3, cutting_food: 3, dressing: 2, turning_in_bed: 3, walking: 2, climbing_stairs: 2, dyspnea: 3, orthopnea: 3, respiratory_insufficiency: 3 } },
    { monthsAgo: 1.5, answers: { speech: 3, salivation: 3, swallowing: 2, handwriting: 2, cutting_food: 3, dressing: 2, turning_in_bed: 3, walking: 2, climbing_stairs: 2, dyspnea: 3, orthopnea: 3, respiratory_insufficiency: 3 } },
    { monthsAgo: 0.5, answers: { speech: 3, salivation: 3, swallowing: 2, handwriting: 2, cutting_food: 2, dressing: 2, turning_in_bed: 3, walking: 2, climbing_stairs: 2, dyspnea: 3, orthopnea: 2, respiratory_insufficiency: 3 } },
];

export function generateDemoALSFRSScores(): Observation[] {
    const observations: Observation[] = [];
    const surveyCategory = [{ coding: [{ system: CAT_SYS, code: 'survey', display: 'Survey' }] }];

    for (let i = 0; i < ALSFRS_DEMO_ENTRIES.length; i++) {
        const entry = ALSFRS_DEMO_ENTRIES[i];
        const date = new Date();
        date.setMonth(date.getMonth() - Math.floor(entry.monthsAgo));
        date.setDate(date.getDate() - Math.round((entry.monthsAgo % 1) * 30));
        const effectiveDateTime = date.toISOString();
        const sessionId = `demo-alsfrs-session-${i}`;
        const metaExtensions = [
            { url: 'urn:medical-sync-vault:questionnaire-id', valueString: 'alsfrs-r' },
            { url: 'urn:medical-sync-vault:questionnaire-session-id', valueString: sessionId },
        ];

        for (const q of ALSFRS_QUESTIONS) {
            observations.push({
                resourceType: 'Observation', id: `demo-alsfrs-${i}-${q.id}`, status: 'final',
                category: surveyCategory,
                code: { coding: [{ system: LOINC, code: q.code, display: q.display }], text: q.display },
                subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
                effectiveDateTime, valueInteger: entry.answers[q.id],
                meta: { extension: metaExtensions },
            });
        }

        const totalScore = Object.values(entry.answers).reduce((sum, v) => sum + v, 0);
        observations.push({
            resourceType: 'Observation', id: `demo-alsfrs-${i}-total`, status: 'final',
            category: surveyCategory,
            code: { coding: [{ system: LOINC, code: '67740-5', display: 'ALSFRS-R total score' }], text: 'ALSFRS-R total score' },
            subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
            effectiveDateTime, valueInteger: totalScore,
            meta: { extension: metaExtensions },
        });
    }
    return observations;
}

// ============================================================
// Body & Weight
// ============================================================

/** Weight: every 3 days, gradual loss 75kg → 70kg */
export function generateDemoWeightMeasurements(): Observation[] {
    const rand = seededRandom(42);
    return datesOverYear(3).map((d, i) => {
        const t = progress(d);
        const value = round(clamp(lerp(75, 70, t, 0.4, rand), 55, 90), 1);
        return makeQuantityObs(`demo-weight-${i}`, '29463-7', 'Body weight', d, value, 'kg', 'kg', 'vital-signs');
    });
}

/** Body fat: monthly, slight decrease with weight loss */
export function generateDemoBodyFatMeasurements(): Observation[] {
    const rand = seededRandom(43);
    return datesOverYear(30).map((d, i) => {
        const t = progress(d);
        const value = round(clamp(lerp(22, 19, t, 1, rand), 8, 40), 1);
        return makeQuantityObs(`demo-bodyfat-${i}`, '41982-0', 'Percentage body fat', d, value, '%', '%', 'vital-signs');
    });
}

/** BMI: monthly, declining with weight */
export function generateDemoBmiMeasurements(): Observation[] {
    const rand = seededRandom(44);
    return datesOverYear(30).map((d, i) => {
        const t = progress(d);
        const value = round(clamp(lerp(24.5, 22.8, t, 0.3, rand), 15, 40), 1);
        return makeQuantityObs(`demo-bmi-${i}`, '39156-5', 'Body mass index', d, value, 'kg/m²', 'kg/m2', 'vital-signs');
    });
}

// ============================================================
// Vital Signs
// ============================================================

/** Heart rate: every 3 days */
export function generateDemoHeartRateMeasurements(): Observation[] {
    const rand = seededRandom(50);
    return datesOverYear(3).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(72, 76, t, 6, rand)), 50, 120);
        return makeIntegerObs(`demo-hr-${i}`, '8867-4', 'Heart rate', d, value, 'vital-signs');
    });
}

/** SpO2: every 3 days, slight decline late stage */
export function generateDemoOxygenMeasurements(): Observation[] {
    const rand = seededRandom(51);
    return datesOverYear(3).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(98, 97, t, 1, rand)), 88, 100);
        return makeIntegerObs(`demo-spo2-${i}`, '2708-6', 'Oxygen saturation', d, value, 'vital-signs');
    });
}

/** Nocturnal SpO2: every 3 days, lower baseline, declining */
export function generateDemoNocturnalSpo2Measurements(): Observation[] {
    const rand = seededRandom(52);
    return datesOverYear(3).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(96, 94, t, 1.5, rand)), 80, 100);
        return makeIntegerObs(`demo-nspo2-${i}`, '59408-5', 'Nocturnal SpO2', d, value, 'vital-signs');
    });
}

/** Blood pressure: every 3 days */
export function generateDemoBloodPressureMeasurements(): Observation[] {
    const rand = seededRandom(53);
    return datesOverYear(3).map((d, i) => {
        const sys = clamp(Math.round(lerp(125, 118, progress(d), 8, rand)), 90, 180);
        const dia = clamp(Math.round(lerp(82, 76, progress(d), 5, rand)), 50, 110);
        return {
            resourceType: 'Observation', id: `demo-bp-${i}`, status: 'final',
            category: [{ coding: [{ system: CAT_SYS, code: 'vital-signs' }] }],
            code: { coding: [{ system: LOINC, code: '85354-9', display: 'Blood pressure panel' }] },
            subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
            effectiveDateTime: d.toISOString(),
            component: [
                { code: { coding: [{ system: LOINC, code: '8480-6', display: 'Systolic blood pressure' }] }, valueQuantity: { value: sys, unit: 'mmHg', system: UCUM, code: 'mm[Hg]' } },
                { code: { coding: [{ system: LOINC, code: '8462-4', display: 'Diastolic blood pressure' }] }, valueQuantity: { value: dia, unit: 'mmHg', system: UCUM, code: 'mm[Hg]' } },
            ],
        };
    });
}

/** Temperature: every 5 days, stable */
export function generateDemoTemperatureMeasurements(): Observation[] {
    const rand = seededRandom(54);
    return datesOverYear(5).map((d, i) => {
        const value = round(clamp(lerp(36.5, 36.5, progress(d), 0.3, rand), 35.5, 38.0), 1);
        return makeQuantityObs(`demo-temp-${i}`, '8310-5', 'Body temperature', d, value, '°C', 'Cel', 'vital-signs');
    });
}

// ============================================================
// Respiratory Function
// ============================================================

/** FVC: monthly, declining 3.5L → 2.8L */
export function generateDemoFvcMeasurements(): Observation[] {
    const rand = seededRandom(60);
    return datesOverYear(30).map((d, i) => {
        const t = progress(d);
        const value = round(clamp(lerp(3.5, 2.8, t, 0.15, rand), 0.5, 6.0), 2);
        return makeQuantityObs(`demo-fvc-${i}`, '19868-9', 'Forced vital capacity', d, value, 'L', 'L', 'vital-signs');
    });
}

/** FVC%: monthly, declining 95% → 75% */
export function generateDemoFvcPercentMeasurements(): Observation[] {
    const rand = seededRandom(61);
    return datesOverYear(30).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(95, 75, t, 4, rand)), 20, 130);
        return makeIntegerObs(`demo-fvcpct-${i}`, '19870-5', 'FVC percent predicted', d, value, 'vital-signs');
    });
}

/** Peak Cough Flow: monthly, declining 360 → 280 L/min */
export function generateDemoPeakCoughFlowMeasurements(): Observation[] {
    const rand = seededRandom(62);
    return datesOverYear(30).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(360, 280, t, 20, rand)), 60, 600);
        return makeIntegerObs(`demo-pcf-${i}`, '33452-4', 'Peak cough flow', d, value, 'vital-signs');
    });
}

// ============================================================
// Motor & Strength
// ============================================================

/** Grip strength: monthly, declining. Uses components for left/right hand */
export function generateDemoGripStrengthMeasurements(): Observation[] {
    const rand = seededRandom(70);
    return datesOverYear(30).map((d, i) => {
        const t = progress(d);
        const right = round(clamp(lerp(35, 24, t, 2, rand), 0, 80), 1);
        const left = round(clamp(lerp(32, 22, t, 2, rand), 0, 80), 1);
        return {
            resourceType: 'Observation', id: `demo-grip-${i}`, status: 'final',
            category: [{ coding: [{ system: CAT_SYS, code: 'vital-signs' }] }],
            code: { coding: [{ system: LOINC, code: '83193-4', display: 'Grip strength panel' }] },
            subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
            effectiveDateTime: d.toISOString(),
            component: [
                { code: { coding: [{ system: LOINC, code: '83189-2', display: 'Grip strength right hand' }] }, valueQuantity: { value: right, unit: 'kg', system: UCUM, code: 'kg' } },
                { code: { coding: [{ system: LOINC, code: '83191-8', display: 'Grip strength left hand' }] }, valueQuantity: { value: left, unit: 'kg', system: UCUM, code: 'kg' } },
            ],
        };
    });
}

/** Walking distance (6MWT): monthly, declining 400m → 230m */
export function generateDemoWalkingDistanceMeasurements(): Observation[] {
    const rand = seededRandom(71);
    return datesOverYear(30).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(400, 230, t, 20, rand)), 0, 800);
        return makeIntegerObs(`demo-walk-${i}`, '64098-7', 'Six minute walk test', d, value, 'activity');
    });
}

/** Falls: monthly count, increasing 0 → 2 */
export function generateDemoFallsMeasurements(): Observation[] {
    const rand = seededRandom(72);
    return datesOverYear(30).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(0, 2, t, 0.8, rand)), 0, 10);
        return makeIntegerObs(`demo-falls-${i}`, '52552-7', 'Falls', d, value, 'survey');
    });
}

// ============================================================
// Symptoms
// ============================================================

/** Pain level: weekly, increasing 0 → 1.5 */
export function generateDemoPainLevelMeasurements(): Observation[] {
    const rand = seededRandom(80);
    return datesOverYear(7).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(0, 1.5, t, 0.6, rand)), 0, 4);
        return makeIntegerObs(`demo-pain-${i}`, '54834-7', 'Pain severity', d, value, 'survey');
    });
}

/** Pain - Sleep interference: weekly, increasing 1 → 3 */
export function generateDemoPainSleepMeasurements(): Observation[] {
    const rand = seededRandom(81);
    return datesOverYear(7).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(1, 3, t, 1, rand)), 0, 10);
        return makeIntegerObs(`demo-painsleep-${i}`, '75261-4', 'Pain interference with sleep', d, value, 'survey');
    });
}

/** Pain - Mobility interference: weekly, increasing 1 → 3.5 */
export function generateDemoPainMobilityMeasurements(): Observation[] {
    const rand = seededRandom(82);
    return datesOverYear(7).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(1, 3.5, t, 1, rand)), 0, 10);
        return makeIntegerObs(`demo-painmob-${i}`, '75262-2', 'Pain interference with mobility', d, value, 'survey');
    });
}

/** Pain - Mood interference: weekly, increasing 1 → 2.5 */
export function generateDemoPainMoodMeasurements(): Observation[] {
    const rand = seededRandom(83);
    return datesOverYear(7).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(1, 2.5, t, 1, rand)), 0, 10);
        return makeIntegerObs(`demo-painmood-${i}`, '75263-0', 'Pain interference with mood', d, value, 'survey');
    });
}

/** Fatigue: weekly, increasing 2 → 4.5 */
export function generateDemoFatigueMeasurements(): Observation[] {
    const rand = seededRandom(84);
    return datesOverYear(7).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(2, 4.5, t, 1, rand)), 0, 10);
        return makeIntegerObs(`demo-fatigue-${i}`, '68858-0', 'Fatigue assessment', d, value, 'survey');
    });
}

/** Cramps per day: weekly, 1 → 3 */
export function generateDemoCrampsMeasurements(): Observation[] {
    const rand = seededRandom(85);
    return datesOverYear(7).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(1, 3, t, 1, rand)), 0, 20);
        return makeIntegerObs(`demo-cramps-${i}`, '80323-0', 'Muscle cramp frequency', d, value, 'survey');
    });
}

/** Fasciculations severity: weekly, 0 → 1 */
export function generateDemoFasciculationsMeasurements(): Observation[] {
    const rand = seededRandom(86);
    return datesOverYear(7).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(0, 1, t, 0.4, rand)), 0, 3);
        return makeIntegerObs(`demo-fasc-${i}`, '89261-2', 'Fasciculation severity', d, value, 'survey');
    });
}

/** Cold sensitivity: weekly, 0 → 1 */
export function generateDemoColdSensitivityMeasurements(): Observation[] {
    const rand = seededRandom(87);
    return datesOverYear(7).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(0, 1, t, 0.4, rand)), 0, 3);
        return makeIntegerObs(
            `demo-cold-${i}`, 'cold-sensitivity', 'Cold sensitivity severity', d, value, 'survey',
            'http://example.org/fhir/CodeSystem/als-metrics',
        );
    });
}

/** Suicidality (PHQ-9 item 9): monthly, low stable 0-1 */
export function generateDemoSuicidalityMeasurements(): Observation[] {
    const rand = seededRandom(88);
    return datesOverYear(30).map((d, i) => {
        const value = clamp(Math.round(lerp(0, 0.5, progress(d), 0.4, rand)), 0, 3);
        return makeIntegerObs(`demo-suic-${i}`, '44260-8', 'PHQ-9 item 9', d, value, 'survey');
    });
}

// ============================================================
// Bulbar Function
// ============================================================

/** Speech rate: monthly, declining 150 → 120 wpm */
export function generateDemoSpeechRateMeasurements(): Observation[] {
    const rand = seededRandom(90);
    return datesOverYear(30).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(150, 120, t, 8, rand)), 20, 200);
        return makeIntegerObs(`demo-speech-${i}`, '89016-0', 'Speech rate', d, value, 'survey');
    });
}

/** Swallowing time: monthly, increasing 3s → 8s */
export function generateDemoSwallowingTimeMeasurements(): Observation[] {
    const rand = seededRandom(91);
    return datesOverYear(30).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(3, 8, t, 1, rand)), 1, 60);
        return makeIntegerObs(`demo-swallow-${i}`, '72106-8', 'Swallowing time', d, value, 'survey');
    });
}

/** Sialorrhea severity: weekly, increasing 1 → 3 */
export function generateDemoSialorrheaMeasurements(): Observation[] {
    const rand = seededRandom(92);
    return datesOverYear(7).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(1, 3, t, 0.8, rand)), 0, 10);
        return makeIntegerObs(`demo-sial-${i}`, '67535-5', 'Sialorrhea severity', d, value, 'survey');
    });
}

// ============================================================
// Nutrition
// ============================================================

/** Fluid intake: every 3 days, declining 2200ml → 1800ml */
export function generateDemoFluidIntakeMeasurements(): Observation[] {
    const rand = seededRandom(100);
    return datesOverYear(3).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(2200, 1800, t, 200, rand)), 500, 4000);
        return makeIntegerObs(`demo-fluid-${i}`, '8999-5', 'Fluid intake 24h', d, value, 'survey');
    });
}

/** Caloric intake: every 3 days, declining 2100kcal → 1800kcal */
export function generateDemoCaloricIntakeMeasurements(): Observation[] {
    const rand = seededRandom(101);
    return datesOverYear(3).map((d, i) => {
        const t = progress(d);
        const value = clamp(Math.round(lerp(2100, 1800, t, 150, rand)), 800, 3500);
        return makeIntegerObs(`demo-cal-${i}`, '9052-2', 'Caloric intake 24h', d, value, 'survey');
    });
}

// ============================================================
// Passive device metrics (Apple Health / Health Connect import)
// These mirror the T-002 metrics. Many use the TENOS device-metric
// code system rather than LOINC, so the demo observations must carry
// the exact same system+code the metric definitions declare.
// ============================================================

const DEVICE_METRIC_SYS = 'https://tenos.health/fhir/CodeSystem/device-metric';

/** valueQuantity observation under the TENOS device-metric code system (for decimals). */
function makeDeviceQuantityObs(
    id: string, code: string, display: string, date: Date,
    value: number, unit: string, ucumCode: string, category: string,
): Observation {
    return {
        resourceType: 'Observation', id, status: 'final',
        category: [{ coding: [{ system: CAT_SYS, code: category }] }],
        code: { coding: [{ system: DEVICE_METRIC_SYS, code, display }] },
        subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
        effectiveDateTime: date.toISOString(),
        valueQuantity: { value, unit, system: UCUM, code: ucumCode },
    };
}

/** Steps: every 3 days, activity declines 6000 → 2400 */
export function generateDemoStepCountMeasurements(): Observation[] {
    const rand = seededRandom(130);
    return datesOverYear(3).map((d, i) => {
        const value = clamp(Math.round(lerp(6000, 2400, progress(d), 700, rand)), 0, 100000);
        return makeIntegerObs(`demo-steps-${i}`, '55423-8', 'Number of steps', d, value, 'activity');
    });
}

/** Walking speed: weekly, declines 1.2 → 0.7 m/s */
export function generateDemoWalkingSpeedMeasurements(): Observation[] {
    const rand = seededRandom(131);
    return datesOverYear(7).map((d, i) => {
        const value = round(clamp(lerp(1.2, 0.7, progress(d), 0.08, rand), 0, 3), 2);
        return makeDeviceQuantityObs(`demo-walkspeed-${i}`, 'walking-speed', 'Walking speed', d, value, 'm/s', 'm/s', 'activity');
    });
}

/** Flights climbed: every 3 days, declines 8 → 1 */
export function generateDemoFlightsClimbedMeasurements(): Observation[] {
    const rand = seededRandom(132);
    return datesOverYear(3).map((d, i) => {
        const value = clamp(Math.round(lerp(8, 1, progress(d), 2, rand)), 0, 1000);
        return makeIntegerObs(`demo-flights-${i}`, 'flights-climbed', 'Flights climbed', d, value, 'activity', DEVICE_METRIC_SYS);
    });
}

/** Respiratory rate: every 3 days, rises 14 → 19 /min as breathing weakens */
export function generateDemoRespiratoryRateMeasurements(): Observation[] {
    const rand = seededRandom(133);
    return datesOverYear(3).map((d, i) => {
        const value = clamp(Math.round(lerp(14, 19, progress(d), 1.5, rand)), 4, 60);
        return makeIntegerObs(`demo-resprate-${i}`, '9279-1', 'Respiratory rate', d, value, 'vital-signs');
    });
}

/** HRV SDNN (iOS): every 3 days, autonomic decline 45 → 25 ms */
export function generateDemoHrvSdnnMeasurements(): Observation[] {
    const rand = seededRandom(134);
    return datesOverYear(3).map((d, i) => {
        const value = clamp(Math.round(lerp(45, 25, progress(d), 6, rand)), 0, 300);
        return makeIntegerObs(`demo-hrvsdnn-${i}`, 'heart-rate-variability-sdnn', 'Heart rate variability (SDNN)', d, value, 'vital-signs', DEVICE_METRIC_SYS);
    });
}

/** HRV RMSSD (Android): every 3 days, autonomic decline 40 → 22 ms */
export function generateDemoHrvRmssdMeasurements(): Observation[] {
    const rand = seededRandom(135);
    return datesOverYear(3).map((d, i) => {
        const value = clamp(Math.round(lerp(40, 22, progress(d), 6, rand)), 0, 300);
        return makeIntegerObs(`demo-hrvrmssd-${i}`, 'heart-rate-variability-rmssd', 'Heart rate variability (RMSSD)', d, value, 'vital-signs', DEVICE_METRIC_SYS);
    });
}

/** Active energy: every 3 days, declines 450 → 200 kcal */
export function generateDemoActiveEnergyMeasurements(): Observation[] {
    const rand = seededRandom(136);
    return datesOverYear(3).map((d, i) => {
        const value = clamp(Math.round(lerp(450, 200, progress(d), 60, rand)), 0, 10000);
        return makeIntegerObs(`demo-activeenergy-${i}`, 'active-energy-burned', 'Active energy burned', d, value, 'activity', DEVICE_METRIC_SYS);
    });
}

/** Walking steadiness (iOS): weekly, declines 75 → 40 % */
export function generateDemoWalkingSteadinessMeasurements(): Observation[] {
    const rand = seededRandom(137);
    return datesOverYear(7).map((d, i) => {
        const value = clamp(Math.round(lerp(75, 40, progress(d), 4, rand)), 0, 100);
        return makeIntegerObs(`demo-steadiness-${i}`, 'apple-walking-steadiness', 'Apple Walking Steadiness', d, value, 'activity', DEVICE_METRIC_SYS);
    });
}

/** Walking step length (iOS): weekly, declines 0.70 → 0.50 m */
export function generateDemoWalkingStepLengthMeasurements(): Observation[] {
    const rand = seededRandom(138);
    return datesOverYear(7).map((d, i) => {
        const value = round(clamp(lerp(0.70, 0.50, progress(d), 0.04, rand), 0, 2), 2);
        return makeDeviceQuantityObs(`demo-steplength-${i}`, 'walking-step-length', 'Walking step length', d, value, 'm', 'm', 'activity');
    });
}

/** Walking asymmetry (iOS): weekly, rises 3 → 12 % */
export function generateDemoWalkingAsymmetryMeasurements(): Observation[] {
    const rand = seededRandom(139);
    return datesOverYear(7).map((d, i) => {
        const value = clamp(Math.round(lerp(3, 12, progress(d), 2, rand)), 0, 100);
        return makeIntegerObs(`demo-asymmetry-${i}`, 'walking-asymmetry', 'Walking asymmetry', d, value, 'activity', DEVICE_METRIC_SYS);
    });
}

/** Walking double support (iOS): weekly, rises 25 → 34 % */
export function generateDemoWalkingDoubleSupportMeasurements(): Observation[] {
    const rand = seededRandom(140);
    return datesOverYear(7).map((d, i) => {
        const value = clamp(Math.round(lerp(25, 34, progress(d), 2, rand)), 0, 100);
        return makeIntegerObs(`demo-doublesupport-${i}`, 'walking-double-support', 'Walking double support time', d, value, 'activity', DEVICE_METRIC_SYS);
    });
}

/** Stair descent speed (iOS): weekly, declines 0.55 → 0.30 m/s */
export function generateDemoStairDescentSpeedMeasurements(): Observation[] {
    const rand = seededRandom(141);
    return datesOverYear(7).map((d, i) => {
        const value = round(clamp(lerp(0.55, 0.30, progress(d), 0.05, rand), 0, 3), 2);
        return makeDeviceQuantityObs(`demo-stairdescent-${i}`, 'stair-descent-speed', 'Stair descent speed', d, value, 'm/s', 'm/s', 'activity');
    });
}

// ============================================================
// Digestion
// ============================================================

/** Bristol stool scale: every 5 days, fluctuating 3-5 */
export function generateDemoBristolStoolMeasurements(): Observation[] {
    const rand = seededRandom(110);
    return datesOverYear(5).map((d, i) => {
        const value = clamp(Math.round(lerp(4, 4, progress(d), 1.2, rand)), 1, 7);
        return makeIntegerObs(`demo-bristol-${i}`, '11029-8', 'Bristol stool scale', d, value, 'survey');
    });
}

// ============================================================
// Biomarkers
// ============================================================

/** Neurofilament Light (Serum): quarterly, increasing 25 → 50 pg/ml */
export function generateDemoNflMeasurements(): Observation[] {
    const rand = seededRandom(120);
    return datesOverYear(90).map((d, i) => {
        const t = progress(d);
        const value = round(clamp(lerp(25, 50, t, 5, rand), 5, 200), 1);
        return makeQuantityObs(`demo-nfl-${i}`, '94505-5', 'Neurofilament light chain serum', d, value, 'pg/ml', 'pg/mL', 'laboratory');
    });
}

/** Neurofilament Light (CSF): every 6 months, increasing 1200 → 2200 pg/ml */
export function generateDemoNflCsfMeasurements(): Observation[] {
    const rand = seededRandom(121);
    return datesOverYear(180).map((d, i) => {
        const t = progress(d);
        const value = round(clamp(lerp(1200, 2200, t, 200, rand), 300, 8000), 0);
        return makeQuantityObs(`demo-nflcsf-${i}`, '94677-2', 'Neurofilament light chain CSF', d, value, 'pg/ml', 'pg/mL', 'laboratory');
    });
}

// ============================================================
// Questionnaire observations (hybrid storage - storeAsObservation items)
// ============================================================

/** PHQ-9 total score: monthly, 4 → 8 (mild depression) */
export function generateDemoPhq9Scores(): Observation[] {
    const rand = seededRandom(130);
    const surveyCategory = [{ coding: [{ system: CAT_SYS, code: 'survey', display: 'Survey' }] }];
    return datesOverYear(30).map((d, i) => {
        const t = progress(d);
        const totalScore = clamp(Math.round(lerp(4, 8, t, 1.5, rand)), 0, 27);
        const sessionId = `demo-phq9-session-${i}`;
        return {
            resourceType: 'Observation', id: `demo-phq9-${i}`, status: 'final',
            category: surveyCategory,
            code: { coding: [{ system: LOINC, code: '44261-6', display: 'PHQ-9 total score' }] },
            subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
            effectiveDateTime: d.toISOString(),
            valueInteger: totalScore,
            meta: { extension: [
                { url: 'urn:medical-sync-vault:questionnaire-id', valueString: 'phq9' },
                { url: 'urn:medical-sync-vault:questionnaire-session-id', valueString: sessionId },
            ] },
        };
    });
}

/** BDI-FS total score: monthly, 2 → 5 */
export function generateDemoBdiFsScores(): Observation[] {
    const rand = seededRandom(131);
    const surveyCategory = [{ coding: [{ system: CAT_SYS, code: 'survey', display: 'Survey' }] }];
    return datesOverYear(30).map((d, i) => {
        const t = progress(d);
        const totalScore = clamp(Math.round(lerp(2, 5, t, 1, rand)), 0, 21);
        const sessionId = `demo-bdifs-session-${i}`;
        return {
            resourceType: 'Observation', id: `demo-bdifs-${i}`, status: 'final',
            category: surveyCategory,
            code: { coding: [{ system: LOINC, code: '89208-3', display: 'BDI-FS total score' }] },
            subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
            effectiveDateTime: d.toISOString(),
            valueInteger: totalScore,
            meta: { extension: [
                { url: 'urn:medical-sync-vault:questionnaire-id', valueString: 'bdi-fs' },
                { url: 'urn:medical-sync-vault:questionnaire-session-id', valueString: sessionId },
            ] },
        };
    });
}

/** PDQ-5 total score: monthly, 3 → 6 */
export function generateDemoPdq5Scores(): Observation[] {
    const rand = seededRandom(132);
    const surveyCategory = [{ coding: [{ system: CAT_SYS, code: 'survey', display: 'Survey' }] }];
    return datesOverYear(30).map((d, i) => {
        const t = progress(d);
        const totalScore = clamp(Math.round(lerp(3, 6, t, 1, rand)), 0, 20);
        const sessionId = `demo-pdq5-session-${i}`;
        return {
            resourceType: 'Observation', id: `demo-pdq5-${i}`, status: 'final',
            category: surveyCategory,
            code: { coding: [{ system: LOINC, code: '71946-2', display: 'PDQ-5 total score' }] },
            subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
            effectiveDateTime: d.toISOString(),
            valueInteger: totalScore,
            meta: { extension: [
                { url: 'urn:medical-sync-vault:questionnaire-id', valueString: 'pdq5' },
                { url: 'urn:medical-sync-vault:questionnaire-session-id', valueString: sessionId },
            ] },
        };
    });
}

// ============================================================
// Structured ALS assessment data
// ============================================================

function makeStructuredQuestionnaireResponse<TPayload extends { id: string }>(
    questionnaireId: string,
    questionnaireUrl: string,
    authored: string,
    payload: TPayload,
): QuestionnaireResponse {
    return structuredQuestionnaireEntryToFhir({
        id: payload.id,
        questionnaireId,
        questionnaireUrl,
        authored,
        payload,
        subjectReference: `Patient/${DEMO_PATIENT_ID}`,
    }) as QuestionnaireResponse;
}

function makeALSSubtypeEntry(
    entry: Omit<ALSSubtypeEntry, 'opmVersion' | 'classificationCode'>
): ALSSubtypeEntry {
    const payload: ALSSubtypeEntry = {
        ...entry,
        opmVersion: '3.3',
        classificationCode: buildClassificationCode(entry),
    };
    return payload;
}

export function generateDemoALSSubtypeResponses(): QuestionnaireResponse[] {
    const older = makeALSSubtypeEntry({
        id: 'demo-als-subtype-older',
        onsetCode: 'O2d',
        propagationStatus: 'P0',
        propagationMonths: 6,
        motorNeuronCode: 'M2d',
        certainty: 'preliminary',
        assessedAt: dateMonthsAgo(8).toISOString(),
        recordedByRole: 'doctor',
        note: 'Initiale Einordnung im Demo-Verlauf.',
    });
    const current = makeALSSubtypeEntry({
        id: 'demo-als-subtype-current',
        onsetCode: 'O2d',
        propagationStatus: 'P1',
        propagationMonths: 8,
        motorNeuronCode: 'M3',
        certainty: 'confirmed',
        assessedAt: dateMonthsAgo(1).toISOString(),
        recordedByRole: 'doctor',
        note: 'Ausbreitung von distaler Armregion auf weitere motorische Regionen dokumentiert.',
    });

    return [older, current].map((entry) => makeStructuredQuestionnaireResponse(
        'als_subtype',
        'https://tenos.health/fhir/Questionnaire/als-subtype',
        entry.assessedAt,
        entry,
    ));
}

export function generateDemoALSGeneticBackgroundResponses(): QuestionnaireResponse[] {
    const assessedAt = dateMonthsAgo(3).toISOString();
    const testDate = dateMonthsAgo(4);
    const entry: ALSGeneticBackgroundEntry = {
        id: 'demo-als-genetic-background-current',
        schemaVersion: 'als-genetic-background-v1',
        assessedAt,
        recordedByRole: 'doctor',
        diseaseForm: 'sporadic',
        familyHistory: 'none_known',
        testingStatus: 'negative',
        source: 'lab_report',
        testDate: `${testDate.getFullYear()}-${String(testDate.getMonth() + 1).padStart(2, '0')}`,
        counselingStatus: 'completed',
        note: 'Keine bekannte pathogene ALS-assoziierte Mutation im Demo-Datensatz.',
    };

    return [makeStructuredQuestionnaireResponse(
        'als_genetic_background',
        'https://tenos.health/fhir/Questionnaire/als-genetic-background',
        entry.assessedAt,
        entry,
    )];
}

export function generateDemoALSKingsStageResponses(): QuestionnaireResponse[] {
    const stage2: ALSKingsStageEntry = {
        id: 'demo-als-kings-stage-stage2',
        schemaVersion: 'als-kings-stage-v1',
        assessedAt: dateMonthsAgo(7).toISOString(),
        recordedByRole: 'doctor',
        stage: '2',
        source: 'manual',
        affectedRegions: ['upper_limb', 'lower_limb'],
        note: 'Demo-Verlauf: obere und untere Extremität betroffen.',
    };
    const current: ALSKingsStageEntry = {
        id: 'demo-als-kings-stage-current',
        schemaVersion: 'als-kings-stage-v1',
        assessedAt: dateMonthsAgo(0.5).toISOString(),
        recordedByRole: 'doctor',
        stage: '4B',
        source: 'suggested_from_care',
        affectedRegions: ['upper_limb', 'lower_limb', 'thoracic'],
        stage4Reason: 'respiratory',
        note: 'Demo-Verlauf: NIV-Beatmungsgerät ist angefragt, daher Stadium 4B passend zur Versorgungslogik.',
    };

    return [stage2, current].map((entry) => makeStructuredQuestionnaireResponse(
        ALS_KINGS_STAGE_QUESTIONNAIRE_ID,
        ALS_KINGS_STAGE_QUESTIONNAIRE_URL,
        entry.assessedAt,
        entry,
    ));
}

// ============================================================
// Get all demo data
// ============================================================

export function getAllDemoData() {
    return {
        // ALSFRS-R (questionnaire with per-question observations)
        alsfrsScores: generateDemoALSFRSScores(),
        // Body & Weight
        weights: generateDemoWeightMeasurements(),
        bodyFat: generateDemoBodyFatMeasurements(),
        bmi: generateDemoBmiMeasurements(),
        // Vital Signs
        heartRate: generateDemoHeartRateMeasurements(),
        bloodOxygen: generateDemoOxygenMeasurements(),
        nocturnalSpo2: generateDemoNocturnalSpo2Measurements(),
        bloodPressure: generateDemoBloodPressureMeasurements(),
        temperature: generateDemoTemperatureMeasurements(),
        // Respiratory
        fvc: generateDemoFvcMeasurements(),
        fvcPercent: generateDemoFvcPercentMeasurements(),
        peakCoughFlow: generateDemoPeakCoughFlowMeasurements(),
        // Motor & Strength
        gripStrength: generateDemoGripStrengthMeasurements(),
        walkingDistance: generateDemoWalkingDistanceMeasurements(),
        falls: generateDemoFallsMeasurements(),
        // Passive device metrics (Apple Health / Health Connect)
        stepCount: generateDemoStepCountMeasurements(),
        walkingSpeed: generateDemoWalkingSpeedMeasurements(),
        flightsClimbed: generateDemoFlightsClimbedMeasurements(),
        respiratoryRate: generateDemoRespiratoryRateMeasurements(),
        hrvSdnn: generateDemoHrvSdnnMeasurements(),
        hrvRmssd: generateDemoHrvRmssdMeasurements(),
        activeEnergy: generateDemoActiveEnergyMeasurements(),
        walkingSteadiness: generateDemoWalkingSteadinessMeasurements(),
        walkingStepLength: generateDemoWalkingStepLengthMeasurements(),
        walkingAsymmetry: generateDemoWalkingAsymmetryMeasurements(),
        walkingDoubleSupport: generateDemoWalkingDoubleSupportMeasurements(),
        stairDescentSpeed: generateDemoStairDescentSpeedMeasurements(),
        // Symptoms
        painLevel: generateDemoPainLevelMeasurements(),
        painSleep: generateDemoPainSleepMeasurements(),
        painMobility: generateDemoPainMobilityMeasurements(),
        painMood: generateDemoPainMoodMeasurements(),
        fatigue: generateDemoFatigueMeasurements(),
        cramps: generateDemoCrampsMeasurements(),
        fasciculations: generateDemoFasciculationsMeasurements(),
        coldSensitivity: generateDemoColdSensitivityMeasurements(),
        suicidality: generateDemoSuicidalityMeasurements(),
        // Bulbar
        speechRate: generateDemoSpeechRateMeasurements(),
        swallowingTime: generateDemoSwallowingTimeMeasurements(),
        sialorrhea: generateDemoSialorrheaMeasurements(),
        // Nutrition
        fluidIntake: generateDemoFluidIntakeMeasurements(),
        caloricIntake: generateDemoCaloricIntakeMeasurements(),
        // Digestion
        bristolStool: generateDemoBristolStoolMeasurements(),
        // Biomarkers
        nfl: generateDemoNflMeasurements(),
        nflCsf: generateDemoNflCsfMeasurements(),
        // Questionnaire scores
        phq9: generateDemoPhq9Scores(),
        bdifs: generateDemoBdiFsScores(),
        pdq5: generateDemoPdq5Scores(),
    };
}

export function getAllDemoQuestionnaireResponses(): QuestionnaireResponse[] {
    return [
        ...generateDemoALSSubtypeResponses(),
        ...generateDemoALSGeneticBackgroundResponses(),
        ...generateDemoALSKingsStageResponses(),
    ];
}

/** Flatten all demo observations into a single array */
export function getAllDemoObservations(): Observation[] {
    const data = getAllDemoData();
    return Object.values(data).flat();
}

// ============================================================
// Demo patient resource (profile / health information)
// ============================================================

export const demoPatientResource = {
    resourceType: 'Patient' as const,
    id: DEMO_PATIENT_ID,
    birthDate: '1968-03',
    gender: 'male' as const,
    address: [{ country: 'DE' }],
    extension: [
        { url: 'http://example.org/fhir/StructureDefinition/body-height-cm', valueDecimal: 178 },
        { url: 'http://example.org/fhir/StructureDefinition/first-symptoms-date', valueString: (() => {
            const d = new Date();
            d.setMonth(d.getMonth() - 18);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })() },
        { url: 'http://example.org/fhir/StructureDefinition/diagnosis-date', valueString: (() => {
            const d = new Date();
            d.setMonth(d.getMonth() - 14);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })() },
        { url: 'http://example.org/fhir/StructureDefinition/als-cause', valueString: 'sporadic' },
        { url: 'http://example.org/fhir/StructureDefinition/als-onset-region', valueString: 'upper_extremity' },
        { url: 'http://example.org/fhir/StructureDefinition/als-motor-neuron-involvement', valueString: 'both' },
    ],
    meta: { lastUpdated: new Date().toISOString() },
};

// ============================================================
// Medications & Supplements
// ============================================================

const MED_META_URL = 'urn:medical-sync-vault:medication-meta';
const SCHED_META_URL = 'urn:medical-sync-vault:medication-schedule';

type DemoMedDef = {
    id: string;
    name: string;
    form: string;
    strengthValue?: number;
    strengthUnit?: string;
    dosageText: string;
    schedule: { type: string; times: string[]; weekdays?: number[]; intervalDays?: number };
    notes?: string;
    monthsAgo: number; // when the medication was started
};

const DEMO_MEDICATIONS: DemoMedDef[] = [
    // --- Prescription medications ---
    {
        id: 'demo-med-riluzol',
        name: 'Riluzol',
        form: 'tablet',
        strengthValue: 50,
        strengthUnit: 'mg',
        dosageText: '1 Tablette',
        schedule: { type: 'daily', times: ['08:00', '20:00'] },
        notes: 'Nüchtern einnehmen, 1h vor oder 2h nach dem Essen',
        monthsAgo: 12,
    },
    {
        id: 'demo-med-baclofen',
        name: 'Baclofen',
        form: 'tablet',
        strengthValue: 10,
        strengthUnit: 'mg',
        dosageText: '1 Tablette',
        schedule: { type: 'daily', times: ['08:00', '14:00', '20:00'] },
        notes: 'Gegen Spastik, langsam einschleichen',
        monthsAgo: 8,
    },
    {
        id: 'demo-med-amitriptylin',
        name: 'Amitriptylin',
        form: 'tablet',
        strengthValue: 25,
        strengthUnit: 'mg',
        dosageText: '1 Tablette',
        schedule: { type: 'daily', times: ['21:00'] },
        notes: 'Gegen Speichelfluss, abends einnehmen',
        monthsAgo: 6,
    },
    {
        id: 'demo-med-pantoprazol',
        name: 'Pantoprazol',
        form: 'tablet',
        strengthValue: 20,
        strengthUnit: 'mg',
        dosageText: '1 Tablette',
        schedule: { type: 'daily', times: ['07:30'] },
        notes: 'Magenschutz, 30 min vor dem Frühstück',
        monthsAgo: 10,
    },
    // --- Supplements ---
    {
        id: 'demo-med-vitamind',
        name: 'Vitamin D3',
        form: 'capsule',
        strengthValue: 1000,
        strengthUnit: 'mcg',
        dosageText: '1 Kapsel',
        schedule: { type: 'daily', times: ['08:00'] },
        monthsAgo: 11,
    },
    {
        id: 'demo-med-kreatin',
        name: 'Kreatin-Monohydrat',
        form: 'powder',
        strengthValue: 5,
        strengthUnit: 'g',
        dosageText: '1 Messlöffel (5g)',
        schedule: { type: 'daily', times: ['09:00'] },
        notes: 'In Wasser oder Saft auflösen',
        monthsAgo: 9,
    },
    {
        id: 'demo-med-coq10',
        name: 'Coenzym Q10',
        form: 'capsule',
        strengthValue: 200,
        strengthUnit: 'mg',
        dosageText: '1 Kapsel',
        schedule: { type: 'daily', times: ['08:00'] },
        monthsAgo: 7,
    },
    {
        id: 'demo-med-omega3',
        name: 'Omega-3 Fischöl',
        form: 'capsule',
        strengthValue: 1000,
        strengthUnit: 'mg',
        dosageText: '1 Kapsel',
        schedule: { type: 'daily', times: ['12:00'] },
        monthsAgo: 11,
    },
    {
        id: 'demo-med-magnesium',
        name: 'Magnesium',
        form: 'tablet',
        strengthValue: 400,
        strengthUnit: 'mg',
        dosageText: '1 Tablette',
        schedule: { type: 'daily', times: ['20:00'] },
        notes: 'Gegen Krämpfe, abends einnehmen',
        monthsAgo: 10,
    },
];

function makeMedicationStatement(def: DemoMedDef) {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - def.monthsAgo);
    const startIso = startDate.toISOString();
    const updatedIso = now.toISOString();

    const metaPayload = {
        id: def.id,
        name: def.name,
        form: def.form,
        strengthValue: def.strengthValue,
        strengthUnit: def.strengthUnit,
        dosageText: def.dosageText,
        duration: { startDate: startIso },
        isActive: true,
        createdAt: startIso,
        updatedAt: updatedIso,
    };

    const schedulePayload = def.schedule;

    return {
        resourceType: 'MedicationStatement' as const,
        id: def.id,
        status: 'active' as const,
        medicationCodeableConcept: { text: def.name },
        effectivePeriod: { start: startIso },
        dosage: [{
            text: def.dosageText,
            timing: { repeat: { timeOfDay: def.schedule.times } },
            doseAndRate: def.strengthValue !== undefined && def.strengthUnit
                ? [{ doseQuantity: { value: def.strengthValue, unit: def.strengthUnit } }]
                : undefined,
        }],
        note: def.notes ? [{ text: def.notes }] : undefined,
        meta: {
            lastUpdated: updatedIso,
            extension: [
                { url: MED_META_URL, valueString: JSON.stringify(metaPayload) },
                { url: SCHED_META_URL, valueString: JSON.stringify(schedulePayload) },
            ],
        },
    };
}

export function generateDemoMedications() {
    return DEMO_MEDICATIONS.map(makeMedicationStatement);
}

// ============================================================
// Seed demo data into FHIR store (bypasses outbox)
// ============================================================

/**
 * Seed all demo data directly into a FHIR store.
 * Uses store.upsert() directly to avoid outbox queueing.
 */
export async function seedDemoData(
    store: { upsert(subjectId: string, resourceType: string, id: string, resource: any, updatedAt?: string, tag?: string | null): Promise<void> },
): Promise<void> {
    // Seed patient profile
    await store.upsert(
        DEMO_PATIENT_ID, 'Patient', DEMO_PATIENT_ID,
        demoPatientResource, demoPatientResource.meta.lastUpdated,
    );

    // Seed all observations — pass tag for questionnaire-linked ones
    const observations = getAllDemoObservations();
    for (const obs of observations) {
        // Extract questionnaire tag from extension if present
        const qExt = obs.meta?.extension?.find(e => e.url === 'urn:medical-sync-vault:questionnaire-id');
        const tag = qExt?.valueString ? `q:${qExt.valueString}` : null;
        await store.upsert(DEMO_PATIENT_ID, 'Observation', obs.id, obs, obs.effectiveDateTime, tag);
    }

    // Seed structured assessment questionnaire responses
    const questionnaireResponses = getAllDemoQuestionnaireResponses();
    for (const response of questionnaireResponses) {
        const qExt = response.meta?.extension?.find(e => e.url === 'urn:medical-sync-vault:questionnaire-id');
        const tag = qExt?.valueString ? `q:${qExt.valueString}` : null;
        await store.upsert(
            DEMO_PATIENT_ID,
            'QuestionnaireResponse',
            response.id,
            response,
            response.meta?.lastUpdated ?? response.authored,
            tag,
        );
    }

    // Seed medications & supplements
    const medications = generateDemoMedications();
    for (const med of medications) {
        await store.upsert(DEMO_PATIENT_ID, 'MedicationStatement', med.id, med, med.meta.lastUpdated);
    }

    // Seed assistive aids
    const demoAids = generateDemoAids();
    for (const aid of demoAids) {
        await store.upsert(DEMO_PATIENT_ID, 'DeviceRequest', aid.id, aid, aid.meta?.lastUpdated);
    }

    // Seed care providers
    for (const provider of demoCareProviders) {
        await store.upsert(DEMO_PATIENT_ID, provider.resourceType, provider.id, provider);
    }

    // Seed patient preferences (nickname, profile icon/color)
    // Set createdAt 30 days ago so all staggered questionnaires are visible in demo
    const prefsStore = createPatientPreferencesStore(DEMO_PATIENT_ID);
    const prefs = await prefsStore.getAll();
    if (!prefs.createdAt || new Date(prefs.createdAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        await prefsStore.importPreferences({ ...prefs, createdAt: thirtyDaysAgo });
    }
    await prefsStore.setNickname('Thomas');
    await prefsStore.setProfileIcon('figure.roll');
    await prefsStore.setProfileColor('#007AFF');

    // Seed supplier integration (Sanitaetshaus Mueller)
    await prefsStore.setSupplierIntegration({
        id: 'demo-int-1',
        organizationId: 'org-1',
        organizationName: 'Sanitaetshaus Mueller',
        linkedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        active: true,
    });
    await prefsStore.setSupplierPolicy({
        integrationId: 'demo-int-1',
        metricIds: [],
        categories: { medications: true, aids: true, questionnaires: false },
        directions: { outbound: true, inbound: true },
    });

    // Set display mode to comfort
    await SecureStore.setItemAsync('display_mode_v1', JSON.stringify('comfort'));
}

// ============================================================
// Demo assistive aids
// ============================================================

const DEMO_AIDS: Array<{ catalogId: string; name: string; category: AidCategory; status: AidStatus }> = [
    { catalogId: 'MOB-003', name: 'Leichtgewicht-Rollstuhl (manuell)', category: 'mobility', status: 'approved' },
    { catalogId: 'MOB-002', name: 'Rollator / Gehwagen', category: 'mobility', status: 'approved' },
    { catalogId: 'ATM-001', name: 'NIV-Beatmungsgerät (BiPAP/CPAP)', category: 'respiratory', status: 'requested' },
    { catalogId: 'TRA-005', name: 'Pflegebett (elektrisch verstellbar)', category: 'transfer', status: 'approved' },
    { catalogId: 'ALL-002', name: 'Dusch-/Badewannensitz', category: 'daily_living', status: 'none' },
];

export function generateDemoAids() {
    return DEMO_AIDS.map((def) => {
        const item = createAidDraft({
            catalogId: def.catalogId,
            name: def.name,
            category: def.category,
            status: def.status,
        });
        return aidToFhir(item);
    });
}

// ============================================================
// Demo care providers
// ============================================================

export const demoCareProviders = [
    {
        resourceType: 'Organization' as const,
        id: 'demo-org-1',
        name: 'ALS-Ambulanz Charité Berlin',
        telecom: [
            { system: 'phone' as const, value: '+49 30 450 560 032' },
            { system: 'email' as const, value: 'als-ambulanz@charite.de' },
        ],
        address: [{
            line: ['Augustenburger Platz 1'],
            city: 'Berlin',
            postalCode: '13353',
        }],
    },
    {
        resourceType: 'Organization' as const,
        id: 'org-1',
        name: 'Sanitaetshaus Mueller',
        extension: [{ url: 'http://example.org/fhir/StructureDefinition/supplier-linked', valueBoolean: true }],
        telecom: [
            { system: 'phone' as const, value: '+49 89 234 567 89' },
            { system: 'email' as const, value: 'info@sanitaetshaus-mueller.de' },
        ],
        address: [{
            line: ['Marienplatz 12'],
            city: 'München',
            postalCode: '80331',
        }],
    },
    {
        resourceType: 'Practitioner' as const,
        id: 'demo-doc-1',
        name: [{
            family: 'Müller',
            given: ['Thomas'],
            prefix: ['Dr. med.'],
        }],
        telecom: [
            { system: 'phone' as const, value: '+49 30 123 456 78' },
        ],
    },
];
