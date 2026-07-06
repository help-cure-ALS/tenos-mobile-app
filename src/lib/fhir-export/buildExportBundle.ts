import type { PatientFhirStore } from '@/src/stores/patientFhirStore';
import type { MetricDefinition } from '@/src/metrics/types';
import type { QuestionnaireDefinition } from '@/src/questionnaires/types';
import type { ExportSelection, FhirBundle } from './types';

export async function buildExportBundle(
    store: PatientFhirStore,
    subjectId: string,
    selection: ExportSelection,
    metricDefinitions: MetricDefinition[],
    questionnaireDefinitions: QuestionnaireDefinition[]
): Promise<FhirBundle> {
    // Deduplicate by resourceType + id
    const seen = new Map<string, any>();
    function addResource(resource: any) {
        const key = `${resource.resourceType}/${resource.id}`;
        if (!seen.has(key)) {
            seen.set(key, resource);
        }
    }

    function addRows(rows: Array<{ resource: any }>) {
        for (const r of rows) {
            if (r.resource?.resourceType && r.resource?.id) {
                addResource(r.resource);
            }
        }
    }

    function getQuestionnaireId(resource: any): string | undefined {
        const extensions = resource?.meta?.extension;
        if (!Array.isArray(extensions)) return undefined;
        return extensions.find((ext: any) => ext?.url === 'urn:medical-sync-vault:questionnaire-id')?.valueString;
    }

    // 1. Patient resource — always included
    const patients = await store.listForExport(subjectId, 'Patient');
    addRows(patients);

    // 2. Metric observations
    const metricDefMap = new Map(metricDefinitions.map(m => [m.id, m]));
    const customQuestionnaireIds = new Set(
        questionnaireDefinitions
            .filter((q) => q.customRenderer)
            .map((q) => q.id)
    );

    // Build a map of metricAccessId → questionnaire for questionnaires with allowAsMetric
    const metricAccessToQuestionnaire = new Map<string, QuestionnaireDefinition>();
    for (const q of questionnaireDefinitions) {
        if (q.allowAsMetric) {
            const accessId = q.metricAccessId ?? q.id;
            metricAccessToQuestionnaire.set(accessId, q);
        }
    }

    for (const metricId of selection.metricIds) {
        const metric = metricDefMap.get(metricId);

        // Check if this metric corresponds to a questionnaire with allowAsMetric
        const qDef = metricAccessToQuestionnaire.get(metricId);

        if (qDef) {
            // Questionnaire-based metric (e.g. ALSFRS-R)
            const tag = `q:${qDef.id}`;
            const obs = await store.listForExport(subjectId, 'Observation', { tag });
            addRows(obs);

            // If storage strategy is not observations-only, also include QuestionnaireResponses
            if (qDef.fhir.storageStrategy !== 'observations') {
                const qr = await store.listForExport(subjectId, 'QuestionnaireResponse', { tag });
                addRows(qr);
            }
        } else if (metric) {
            // Regular metric — use metricTag (system|code)
            const metricTag = `${metric.fhir.code.system}|${metric.fhir.code.code}`;
            const obs = await store.listForExport(subjectId, 'Observation', { metricTag });
            addRows(obs);
        }
    }

    // 3. Categories
    if (selection.categories.medications) {
        const ms = await store.listForExport(subjectId, 'MedicationStatement');
        addRows(ms);
        const ma = await store.listForExport(subjectId, 'MedicationAdministration');
        addRows(ma);
    }

    if (selection.categories.aids) {
        const dr = await store.listForExport(subjectId, 'DeviceRequest');
        addRows(dr);
    }

    if (selection.categories.questionnaires) {
        const qr = await store.listForExport(subjectId, 'QuestionnaireResponse');
        addRows(qr.filter((row) => !customQuestionnaireIds.has(getQuestionnaireId(row.resource) ?? '')));
        // Also include observations with q: tag prefix (questionnaire-derived observations)
        const qObs = await store.listForExport(subjectId, 'Observation', { tagPrefix: 'q:' });
        addRows(qObs.filter((row) => !customQuestionnaireIds.has(getQuestionnaireId(row.resource) ?? '')));
    }

    // 4. Ensure subject reference on all non-Patient resources
    const subjectRef = { reference: `Patient/${subjectId}` };
    for (const resource of seen.values()) {
        if (resource.resourceType !== 'Patient' && !resource.subject) {
            resource.subject = subjectRef;
        }
    }

    // 5. Build bundle with fullUrl for each entry
    const entries = Array.from(seen.values());
    return {
        resourceType: 'Bundle',
        type: 'collection',
        timestamp: new Date().toISOString(),
        total: entries.length,
        entry: entries.map(r => ({
            fullUrl: `urn:uuid:${r.id}`,
            resource: r,
        })),
    };
}
