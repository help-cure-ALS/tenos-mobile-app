import type { NeurologicalExamSummary } from '../types';

function formatDate(date: Date, isDE: boolean): string {
    return date.toLocaleDateString(isDE ? 'de-DE' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function buildNeurologicalExamSection(entries: NeurologicalExamSummary[], isDE: boolean): string {
    if (entries.length === 0) return '';

    const title = isDE ? 'Neurologische Untersuchung' : 'Neurological exam';
    const dateHeader = isDE ? 'Datum' : 'Date';
    const motorHeader = isDE ? 'M-Phänotyp' : 'M phenotype';
    const burdenHeader = isDE ? 'UMN/LMN' : 'UMN/LMN';
    const regionsHeader = isDE ? 'Regionen' : 'Regions';
    const summaryHeader = isDE ? 'Zusammenfassung' : 'Summary';

    const rows = entries.map((entry) => `
        <tr>
            <td>${formatDate(entry.date, isDE)}</td>
            <td><strong>${escapeHtml(entry.motorNeuronCode)}</strong></td>
            <td>UMN ${escapeHtml(entry.umnBurden)}<br/>LMN ${escapeHtml(entry.lmnBurden)}</td>
            <td>${escapeHtml(entry.regions)}</td>
            <td>${escapeHtml(entry.summary)}</td>
        </tr>
    `).join('');

    return `
        <div class="page-section">
            <div class="section-title">${title}</div>
            <table>
                <thead>
                    <tr>
                        <th>${dateHeader}</th>
                        <th>${motorHeader}</th>
                        <th>${burdenHeader}</th>
                        <th>${regionsHeader}</th>
                        <th>${summaryHeader}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}
