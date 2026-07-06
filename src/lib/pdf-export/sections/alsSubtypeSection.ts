import type { ALSSubtypeSummary } from '../types';

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

export function buildALSSubtypeSection(entries: ALSSubtypeSummary[], isDE: boolean): string {
    if (entries.length === 0) return '';

    const title = isDE ? 'ALS-Subtyp' : 'ALS subtype';
    const dateHeader = isDE ? 'Datum' : 'Date';
    const codeHeader = isDE ? 'Klassifikation' : 'Classification';
    const certaintyHeader = isDE ? 'Status' : 'Status';
    const summaryHeader = isDE ? 'Zusammenfassung' : 'Summary';

    const rows = entries.map((entry) => `
        <tr>
            <td>${formatDate(entry.date, isDE)}</td>
            <td><strong>${escapeHtml(entry.code)}</strong></td>
            <td>${escapeHtml(entry.certainty)}</td>
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
                        <th>${codeHeader}</th>
                        <th>${certaintyHeader}</th>
                        <th>${summaryHeader}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}
