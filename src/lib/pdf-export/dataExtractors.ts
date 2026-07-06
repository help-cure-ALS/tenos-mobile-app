import type { FhirBundle } from '../fhir-export/types';
import { fhirToALSGeneticBackground } from '@/src/questionnaires/structured/alsGeneticBackground/fhir/alsGeneticBackgroundToFhir';
import { fhirToALSKingsStage } from '@/src/questionnaires/structured/alsKingsStage/fhir/alsKingsStageToFhir';
import {
    regionLabel as kingsRegionLabel,
    sourceLabel as kingsSourceLabel,
    stage4ReasonLabel,
    stageDescription,
    stageLabel,
    summarizeALSKingsStage,
} from '@/src/questionnaires/structured/alsKingsStage/labels';
import {
    counselingStatusLabel,
    diseaseFormLabel,
    familyHistoryLabel,
    formatALSGeneticHeadline,
    geneLabel,
    sourceLabel,
    summarizeALSGeneticBackground,
    testingStatusLabel,
} from '@/src/questionnaires/structured/alsGeneticBackground/labels';
import { fhirToALSSubtype } from '@/src/questionnaires/structured/alsSubtype/fhir/alsSubtypeToFhir';
import { formatClassificationCode, summarizeALSSubtype } from '@/src/questionnaires/structured/alsSubtype/opmCodes';
import { fhirToNeurologicalExam } from '@/src/questionnaires/structured/neurologicalExam/fhir/neurologicalExamToFhir';
import {
    burdenLabel as neurologicalBurdenLabel,
    clinicalRegionLabel,
    regionLabel,
    summarizeNeurologicalExam,
} from '@/src/questionnaires/structured/neurologicalExam/labels';
import type { MetricDefinition } from '@/src/metrics/types';
import type { QuestionnaireDefinition } from '@/src/questionnaires/types';
import type {
    ALSSubtypeSummary,
    MetricSummary,
    AlsfrsSession,
    QuestionnaireSession,
    MedicationSummary,
    AidSummary,
    NeurologicalExamSummary,
    ALSGeneticBackgroundSummary,
    ALSKingsStageSummary,
} from './types';

// Helper to get meta extension value
function getMetaExtension(resource: any, url: string): string | undefined {
    const ext = resource?.meta?.extension;
    if (!Array.isArray(ext)) return undefined;
    const found = ext.find((e: any) => e.url === url);
    return found?.valueString;
}

// Check if observation belongs to a questionnaire
function isQuestionnaireObservation(resource: any): boolean {
    return !!getMetaExtension(resource, 'urn:medical-sync-vault:questionnaire-id');
}

export function extractMetricSummaries(
    bundle: FhirBundle,
    metricDefs: MetricDefinition[],
    isDE: boolean
): MetricSummary[] {
    // Build lookup: system|code → MetricDefinition
    const codeToMetric = new Map<string, MetricDefinition>();
    for (const def of metricDefs) {
        const key = `${def.fhir.code.system}|${def.fhir.code.code}`;
        codeToMetric.set(key, def);
    }

    // Group observations by metric
    const metricEntries = new Map<string, Array<{ date: Date; values: Record<string, number> }>>();

    for (const entry of bundle.entry) {
        const resource = entry.resource;
        if (resource.resourceType !== 'Observation') continue;
        if (isQuestionnaireObservation(resource)) continue;

        const coding = resource.code?.coding?.[0];
        if (!coding) continue;

        const codeKey = `${coding.system}|${coding.code}`;
        const def = codeToMetric.get(codeKey);
        if (!def) continue;

        const date = new Date(resource.effectiveDateTime ?? resource.issued ?? resource.meta?.lastUpdated);
        if (isNaN(date.getTime())) continue;

        const values: Record<string, number> = {};
        const isMultiField = def.fields.length > 1 && def.fields.some(f => f.fhirComponentCode);

        if (isMultiField && resource.component) {
            // Multi-field metric (e.g. blood pressure)
            for (const field of def.fields) {
                if (!field.fhirComponentCode) continue;
                const comp = resource.component?.find(
                    (c: any) => c.code?.coding?.[0]?.code === field.fhirComponentCode!.code
                );
                if (comp) {
                    values[field.key] = comp.valueQuantity?.value ?? comp.valueInteger;
                }
            }
        } else {
            // Single-value metric
            const fieldKey = def.fields[0]?.key ?? 'value';
            const val = resource.valueQuantity?.value ?? resource.valueInteger;
            if (val !== undefined && val !== null) {
                values[fieldKey] = val;
            }
        }

        if (Object.keys(values).length === 0) continue;

        if (!metricEntries.has(def.id)) {
            metricEntries.set(def.id, []);
        }
        metricEntries.get(def.id)!.push({ date, values });
    }

    // Build summaries
    const summaries: MetricSummary[] = [];

    for (const def of metricDefs) {
        const entries = metricEntries.get(def.id);
        if (!entries || entries.length === 0) continue;

        // Sort by date (oldest first)
        entries.sort((a, b) => a.date.getTime() - b.date.getTime());

        const isMultiField = def.fields.length > 1 && def.fields.some(f => f.fhirComponentCode);
        const latest = entries[entries.length - 1];

        const primaryField = def.fields[0];
        const summary: MetricSummary = {
            name: def.name,
            unit: def.defaultUnit,
            isMultiField,
            entries,
            latest,
            count: entries.length,
            fieldFormat: primaryField ? { inputType: primaryField.inputType, decimalPlaces: primaryField.decimalPlaces } : undefined,
            description: def.exportDescription ?? def.description,
            valueLabels: primaryField?.valueLabels,
            hasExternalHealth: !!def.externalHealth,
        };

        if (isMultiField) {
            // Multi-field stats per component
            const components: NonNullable<MetricSummary['components']> = {};
            for (const field of def.fields) {
                if (!field.fhirComponentCode) continue;
                const fieldValues = entries
                    .map(e => e.values[field.key])
                    .filter(v => v !== undefined && v !== null);
                if (fieldValues.length > 0) {
                    components[field.key] = {
                        label: field.label,
                        min: Math.min(...fieldValues),
                        max: Math.max(...fieldValues),
                        avg: Math.round(fieldValues.reduce((s, v) => s + v, 0) / fieldValues.length),
                        fieldFormat: { inputType: field.inputType, decimalPlaces: field.decimalPlaces },
                    };
                }
            }
            summary.components = components;
        } else {
            // Single-value stats
            const fieldKey = def.fields[0]?.key ?? 'value';
            const allValues = entries
                .map(e => e.values[fieldKey])
                .filter(v => v !== undefined && v !== null);
            if (allValues.length > 0) {
                summary.min = Math.min(...allValues);
                summary.max = Math.max(...allValues);
                summary.avg = Math.round((allValues.reduce((s, v) => s + v, 0) / allValues.length) * 10) / 10;
            }
        }

        summaries.push(summary);
    }

    return summaries;
}

export function extractAlsfrsSessions(
    bundle: FhirBundle,
    questionnaireDef: QuestionnaireDefinition
): AlsfrsSession[] {
    // Build LOINC code → question mapping
    const codeToQuestion = new Map<string, { questionId: string; domainId: string }>();
    for (const domain of questionnaireDef.domains) {
        for (const q of domain.questions) {
            if (q.fhirCode) {
                codeToQuestion.set(q.fhirCode.code, { questionId: q.id, domainId: domain.id });
            }
        }
    }

    // Total score code to skip
    const totalScoreCode = questionnaireDef.fhir.totalScoreCode?.code;

    // Group observations by session
    const sessions = new Map<string, {
        date: Date;
        answers: Record<string, number>;
        domainAnswers: Record<string, Record<string, number>>;
    }>();

    for (const entry of bundle.entry) {
        const resource = entry.resource;
        if (resource.resourceType !== 'Observation') continue;

        const qId = getMetaExtension(resource, 'urn:medical-sync-vault:questionnaire-id');
        if (qId !== questionnaireDef.id) continue;

        const sessionId = getMetaExtension(resource, 'urn:medical-sync-vault:questionnaire-session-id');
        if (!sessionId) continue;

        const coding = resource.code?.coding?.[0];
        if (!coding) continue;

        // Skip total score observations
        if (totalScoreCode && coding.code === totalScoreCode) continue;

        const mapping = codeToQuestion.get(coding.code);
        if (!mapping) continue;

        const val = resource.valueQuantity?.value ?? resource.valueInteger;
        if (val === undefined || val === null) continue;

        const date = new Date(resource.effectiveDateTime ?? resource.issued ?? resource.meta?.lastUpdated);

        if (!sessions.has(sessionId)) {
            sessions.set(sessionId, { date, answers: {}, domainAnswers: {} });
        }

        const session = sessions.get(sessionId)!;
        session.answers[mapping.questionId] = val;

        if (!session.domainAnswers[mapping.domainId]) {
            session.domainAnswers[mapping.domainId] = {};
        }
        session.domainAnswers[mapping.domainId][mapping.questionId] = val;

        // Use earliest date from session's observations
        if (date < session.date) {
            session.date = date;
        }
    }

    // Build session results
    const results: AlsfrsSession[] = [];

    for (const [sessionId, session] of sessions) {
        const domainScores: Record<string, number> = {};
        let totalScore = 0;

        for (const domain of questionnaireDef.domains) {
            const domainTotal = domain.questions.reduce((sum, q) => {
                return sum + (session.answers[q.id] ?? 0);
            }, 0);
            domainScores[domain.id] = domainTotal;
            totalScore += domainTotal;
        }

        results.push({
            sessionId,
            date: session.date,
            domainScores,
            totalScore,
        });
    }

    // Sort chronologically (oldest first)
    results.sort((a, b) => a.date.getTime() - b.date.getTime());

    return results;
}

export function extractALSSubtypeSummaries(bundle: FhirBundle, isDE: boolean): ALSSubtypeSummary[] {
    const language = isDE ? 'de' : 'en';
    const summaries: ALSSubtypeSummary[] = [];

    for (const entry of bundle.entry) {
        const resource = entry.resource;
        const parsed = fhirToALSSubtype(resource);
        if (!parsed) continue;

        const date = new Date(parsed.assessedAt);
        if (isNaN(date.getTime())) continue;

        summaries.push({
            date,
            code: formatClassificationCode(parsed.classificationCode),
            summary: summarizeALSSubtype(parsed, language),
            certainty: parsed.certainty,
        });
    }

    summaries.sort((a, b) => a.date.getTime() - b.date.getTime());
    return summaries;
}

export function extractNeurologicalExamSummaries(bundle: FhirBundle, isDE: boolean): NeurologicalExamSummary[] {
    const language = isDE ? 'de' : 'en';
    const summaries: NeurologicalExamSummary[] = [];

    for (const entry of bundle.entry) {
        const resource = entry.resource;
        const parsed = fhirToNeurologicalExam(resource);
        if (!parsed) continue;

        const date = new Date(parsed.assessedAt);
        if (isNaN(date.getTime())) continue;

        summaries.push({
            date,
            motorNeuronCode: parsed.suggestedMotorNeuronCode ?? '',
            summary: summarizeNeurologicalExam(parsed, language),
            umnBurden: neurologicalBurdenLabel(parsed.overallUmnBurden, language),
            lmnBurden: neurologicalBurdenLabel(parsed.overallLmnBurden, language),
            regions: parsed.clinicalRegions?.length
                ? parsed.clinicalRegions.map((region) => clinicalRegionLabel(region.region, language)).join(', ')
                : parsed.regions.map((region) => regionLabel(region.region, language)).join(', '),
        });
    }

    summaries.sort((a, b) => a.date.getTime() - b.date.getTime());
    return summaries;
}

export function extractALSGeneticBackgroundSummaries(bundle: FhirBundle, isDE: boolean): ALSGeneticBackgroundSummary[] {
    const language = isDE ? 'de' : 'en';
    const summaries: ALSGeneticBackgroundSummary[] = [];

    for (const entry of bundle.entry) {
        const resource = entry.resource;
        const parsed = fhirToALSGeneticBackground(resource);
        if (!parsed) continue;

        const date = new Date(parsed.assessedAt);
        if (isNaN(date.getTime())) continue;

        summaries.push({
            date,
            headline: formatALSGeneticHeadline(parsed, language),
            diseaseForm: diseaseFormLabel(parsed.diseaseForm, language),
            familyHistory: familyHistoryLabel(parsed.familyHistory, language),
            testingStatus: testingStatusLabel(parsed.testingStatus, language),
            gene: geneLabel(parsed, language),
            variantText: parsed.variantText ?? '',
            testDate: parsed.testDate ?? '',
            source: sourceLabel(parsed.source, language),
            counselingStatus: counselingStatusLabel(parsed.counselingStatus, language),
            summary: summarizeALSGeneticBackground(parsed, language),
            note: parsed.note ?? '',
        });
    }

    summaries.sort((a, b) => a.date.getTime() - b.date.getTime());
    return summaries;
}

export function extractALSKingsStageSummaries(bundle: FhirBundle, isDE: boolean): ALSKingsStageSummary[] {
    const language = isDE ? 'de' : 'en';
    const summaries: ALSKingsStageSummary[] = [];

    for (const entry of bundle.entry) {
        const resource = entry.resource;
        const parsed = fhirToALSKingsStage(resource);
        if (!parsed) continue;

        const date = new Date(parsed.assessedAt);
        if (isNaN(date.getTime())) continue;

        summaries.push({
            date,
            stage: stageLabel(parsed.stage, language),
            description: stageDescription(parsed.stage, language),
            regions: parsed.affectedRegions?.map((region) => kingsRegionLabel(region, language)).join(', ') ?? '',
            stage4Reason: stage4ReasonLabel(parsed.stage4Reason, language),
            source: kingsSourceLabel(parsed.source, language),
            summary: summarizeALSKingsStage(parsed, language),
        });
    }

    summaries.sort((a, b) => a.date.getTime() - b.date.getTime());
    return summaries;
}

/**
 * Extract sessions from QuestionnaireResponse resources for standard questionnaires.
 * Works for all non-ALSFRS questionnaires (hybrid + questionnaireResponse storage).
 */
export function extractQuestionnaireResponses(
    bundle: FhirBundle,
    questionnaireDef: QuestionnaireDefinition
): QuestionnaireSession[] {
    // Build linkId → question mapping
    const linkIdToQuestion = new Map<string, { questionId: string; domainId: string }>();
    for (const domain of questionnaireDef.domains) {
        for (const q of domain.questions) {
            const linkId = q.linkId ?? q.id;
            linkIdToQuestion.set(linkId, { questionId: q.id, domainId: domain.id });
        }
    }

    const sessions: QuestionnaireSession[] = [];

    for (const entry of bundle.entry) {
        const resource = entry.resource;
        if (resource.resourceType !== 'QuestionnaireResponse') continue;

        const qId = getMetaExtension(resource, 'urn:medical-sync-vault:questionnaire-id');
        if (qId !== questionnaireDef.id) continue;

        const sessionId = getMetaExtension(resource, 'urn:medical-sync-vault:questionnaire-session-id') ?? resource.id;
        const date = new Date(resource.authored ?? resource.meta?.lastUpdated);
        if (isNaN(date.getTime())) continue;

        // Parse answers from item array
        const answers: Record<string, number> = {};
        if (Array.isArray(resource.item)) {
            for (const item of resource.item) {
                const linkId = item.linkId;
                const mapping = linkIdToQuestion.get(linkId);
                if (!mapping) continue;

                const val = item.answer?.[0]?.valueInteger;
                if (val !== undefined && val !== null) {
                    answers[mapping.questionId] = val;
                }
            }
        }

        // Calculate domain scores and total
        const domainScores: Record<string, number> = {};
        let totalScore = 0;

        if (questionnaireDef.scoring.calculateScore) {
            // Use custom score calculation (e.g. KESS with Bristol mapping)
            totalScore = questionnaireDef.scoring.calculateScore(answers);
        } else {
            // Default: sum all values
            totalScore = Object.values(answers).reduce((sum, v) => sum + v, 0);
        }

        for (const domain of questionnaireDef.domains) {
            const domainAnswers: Record<string, number> = {};
            for (const q of domain.questions) {
                if (answers[q.id] !== undefined) {
                    domainAnswers[q.id] = answers[q.id];
                }
            }

            if (questionnaireDef.scoring.calculateScore) {
                // Use custom calculation for domain sub-scores too
                domainScores[domain.id] = questionnaireDef.scoring.calculateScore(domainAnswers);
            } else {
                domainScores[domain.id] = Object.values(domainAnswers).reduce((sum, v) => sum + v, 0);
            }
        }

        sessions.push({ sessionId, date, totalScore, domainScores, answers });
    }

    // Sort chronologically (oldest first)
    sessions.sort((a, b) => a.date.getTime() - b.date.getTime());

    return sessions;
}

function burdenLabel(value: string | undefined, isDE: boolean): string {
    switch (value) {
        case 'none': return isDE ? 'keine' : 'none';
        case 'mild': return isDE ? 'leicht' : 'mild';
        case 'moderate': return isDE ? 'mittel' : 'moderate';
        case 'severe': return isDE ? 'schwer' : 'severe';
        default: return '';
    }
}

export function extractMedications(bundle: FhirBundle, isDE: boolean): MedicationSummary[] {
    const medications: MedicationSummary[] = [];

    for (const entry of bundle.entry) {
        const resource = entry.resource;
        if (resource.resourceType !== 'MedicationStatement') continue;

        const name = resource.medicationCodeableConcept?.text ?? (isDE ? 'Unbekannt' : 'Unknown');
        const dosage = resource.dosage?.[0];

        const dosageText = dosage?.text ?? '';
        const timingValues = dosage?.timing?.repeat?.timeOfDay;
        const timing = Array.isArray(timingValues) ? timingValues.join(', ') : '';

        const doseQuantity = dosage?.doseAndRate?.[0]?.doseQuantity;
        const strength = doseQuantity
            ? `${doseQuantity.value} ${doseQuantity.unit ?? ''}`
            : '';

        const status = resource.status ?? '';
        const notes = resource.note?.[0]?.text ?? '';
        const startDate = resource.effectivePeriod?.start ?? '';

        medications.push({ name, dosageText, timing, strength, status, notes, startDate });
    }

    return medications;
}

export function extractAids(bundle: FhirBundle, isDE: boolean): AidSummary[] {
    const aids: AidSummary[] = [];

    for (const entry of bundle.entry) {
        const resource = entry.resource;
        if (resource.resourceType !== 'DeviceRequest') continue;

        const name = resource.codeCodeableConcept?.text ?? (isDE ? 'Unbekannt' : 'Unknown');

        // Parse aid meta extension
        let category = '';
        let status = '';
        const aidMetaStr = getMetaExtension(resource, 'urn:medical-sync-vault:aid-meta');
        if (aidMetaStr) {
            try {
                const aidMeta = JSON.parse(aidMetaStr);
                category = aidMeta.category ?? '';
                const rawStatus = aidMeta.status ?? resource.status ?? '';
                status = rawStatus === 'active'
                    ? (isDE ? 'Genehmigt' : 'Approved')
                    : rawStatus === 'draft'
                        ? (isDE ? 'Beantragt' : 'Requested')
                        : rawStatus;
            } catch {
                status = resource.status ?? '';
            }
        } else {
            status = resource.status ?? '';
        }

        aids.push({ name, category, status });
    }

    return aids;
}
