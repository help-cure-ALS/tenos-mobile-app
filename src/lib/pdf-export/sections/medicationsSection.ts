import type { MedicationSummary } from '../types';

export function buildMedicationsSection(medications: MedicationSummary[], isDE: boolean): string {
    if (medications.length === 0) return '';

    const title = isDE ? 'Medikamente' : 'Medications';

    const headers = isDE
        ? ['Name', 'Stärke', 'Dosierung', 'Zeiten', 'Seit', 'Hinweis']
        : ['Name', 'Strength', 'Dosage', 'Times', 'Since', 'Notes'];

    const headerRow = headers.map(h => `<th>${h}</th>`).join('');

    const rows = medications.map(med => {
        const startFormatted = med.startDate
            ? new Date(med.startDate).toLocaleDateString(isDE ? 'de-DE' : 'en-US', {
                month: '2-digit',
                year: 'numeric',
            })
            : '';

        return `
            <tr>
                <td><strong>${med.name}</strong></td>
                <td>${med.strength}</td>
                <td>${med.dosageText}</td>
                <td>${med.timing}</td>
                <td class="text-muted">${startFormatted}</td>
                <td class="text-muted text-small">${med.notes}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="page-section">
            <div class="section-title">${title}</div>
            <table>
                <thead><tr>${headerRow}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}
