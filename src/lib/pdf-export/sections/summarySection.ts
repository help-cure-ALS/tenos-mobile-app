import type { FhirBundle } from '../../fhir-export/types';

export function buildSummarySection(bundle: FhirBundle, isDE: boolean): string {
    // Count resources by type
    const counts = new Map<string, number>();
    for (const entry of bundle.entry) {
        const type = entry.resource.resourceType;
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }

    if (counts.size === 0) return '';

    const labelMap: Record<string, { de: string; en: string }> = {
        Patient: { de: 'Patient', en: 'Patient' },
        Observation: { de: 'Messwerte', en: 'Observations' },
        MedicationStatement: { de: 'Medikamente', en: 'Medications' },
        MedicationAdministration: { de: 'Verabreichungen', en: 'Administrations' },
        DeviceRequest: { de: 'Hilfsmittel', en: 'Aids' },
        QuestionnaireResponse: { de: 'Fragebögen', en: 'Questionnaires' },
    };

    const badges = Array.from(counts.entries())
        .filter(([, count]) => count > 0)
        .map(([type, count]) => {
            const labels = labelMap[type];
            const label = labels ? (isDE ? labels.de : labels.en) : type;
            return `<span class="summary-badge"><strong>${count}</strong> ${label}</span>`;
        })
        .join('');

    const title = isDE ? 'Übersicht' : 'Overview';

    return `
        <div class="page-section avoid-break">
            <div class="section-title">${title}</div>
            <div class="summary-grid">${badges}</div>
        </div>
    `;
}
