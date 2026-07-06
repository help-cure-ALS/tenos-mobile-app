import type { PdfExportOptions } from './types';
import { getStyles } from './styles';
import {
    extractMetricSummaries,
    extractAlsfrsSessions,
    extractQuestionnaireResponses,
    extractALSGeneticBackgroundSummaries,
    extractALSKingsStageSummaries,
    extractALSSubtypeSummaries,
    extractNeurologicalExamSummaries,
    extractMedications,
    extractAids,
} from './dataExtractors';
import { buildCoverSection } from './sections/coverSection';
import { buildPatientSection } from './sections/patientSection';
import { buildSummarySection } from './sections/summarySection';
import { buildMetricsSection } from './sections/metricsSection';
import { buildAlsfrsSection } from './sections/alsfrsSection';
import { buildQuestionnaireSection } from './sections/questionnairesSection';
import { buildALSGeneticBackgroundSection } from './sections/alsGeneticBackgroundSection';
import { buildALSKingsStageSection } from './sections/alsKingsStageSection';
import { buildALSSubtypeSection } from './sections/alsSubtypeSection';
import { buildNeurologicalExamSection } from './sections/neurologicalExamSection';
import { buildMedicationsSection } from './sections/medicationsSection';
import { buildAidsSection } from './sections/aidsSection';
import { buildDisclaimerSection } from './sections/disclaimerSection';

export function buildPdfHtml(options: PdfExportOptions): string {
    const { bundle, metricDefinitions, questionnaireDefinitions, language } = options;
    const isDE = language === 'de';

    // Extract data
    const metricSummaries = extractMetricSummaries(bundle, metricDefinitions, isDE);

    // Find ALSFRS-R questionnaire definition
    const alsfrsDef = questionnaireDefinitions.find(q => q.id === 'alsfrs-r');
    const alsfrsSessions = alsfrsDef ? extractAlsfrsSessions(bundle, alsfrsDef) : [];
    const alsSubtypeEntries = extractALSSubtypeSummaries(bundle, isDE);
    const neurologicalExamEntries = extractNeurologicalExamSummaries(bundle, isDE);
    const alsKingsStageEntries = extractALSKingsStageSummaries(bundle, isDE);
    const alsGeneticBackgroundEntries = extractALSGeneticBackgroundSummaries(bundle, isDE);

    const medications = extractMedications(bundle, isDE);
    const aids = extractAids(bundle, isDE);

    // Build sections (only if data present)
    const sections: string[] = [];

    sections.push(buildCoverSection(bundle, isDE));

    const patientHtml = buildPatientSection(bundle, isDE);
    if (patientHtml) sections.push(patientHtml);

    sections.push(buildSummarySection(bundle, isDE));

    if (metricSummaries.length > 0) {
        sections.push(buildMetricsSection(metricSummaries, isDE));
    }

    if (alsfrsSessions.length > 0 && alsfrsDef) {
        sections.push(buildAlsfrsSection(alsfrsSessions, alsfrsDef, isDE));
    }

    // Standard questionnaires (non-ALSFRS, non-structured)
    const skipQIds = new Set(['alsfrs-r']);
    for (const qDef of questionnaireDefinitions) {
        if (skipQIds.has(qDef.id)) continue;
        if (qDef.customRenderer) continue; // structured questionnaires have their own sections
        const qSessions = extractQuestionnaireResponses(bundle, qDef);
        if (qSessions.length > 0) {
            sections.push(buildQuestionnaireSection(qSessions, qDef, isDE));
        }
    }

    if (alsSubtypeEntries.length > 0) {
        sections.push(buildALSSubtypeSection(alsSubtypeEntries, isDE));
    }

    if (neurologicalExamEntries.length > 0) {
        sections.push(buildNeurologicalExamSection(neurologicalExamEntries, isDE));
    }

    if (alsKingsStageEntries.length > 0) {
        sections.push(buildALSKingsStageSection(alsKingsStageEntries, isDE));
    }

    if (alsGeneticBackgroundEntries.length > 0) {
        sections.push(buildALSGeneticBackgroundSection(alsGeneticBackgroundEntries, isDE));
    }

    if (medications.length > 0) {
        sections.push(buildMedicationsSection(medications, isDE));
    }

    if (aids.length > 0) {
        sections.push(buildAidsSection(aids, isDE));
    }

    sections.push(buildDisclaimerSection(isDE));

    const styles = getStyles();
    const body = sections.join('\n');

    return `<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${styles}
</head>
<body>
    ${body}
</body>
</html>`;
}
