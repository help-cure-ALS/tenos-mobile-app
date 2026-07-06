import type { ALSKingsStageSummary } from '../types';

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

export function buildALSKingsStageSection(entries: ALSKingsStageSummary[], isDE: boolean): string {
    if (entries.length === 0) return '';

    const title = "King's Stage";
    const dateHeader = isDE ? 'Datum' : 'Date';
    const stageHeader = isDE ? 'Stadium' : 'Stage';
    const regionsHeader = isDE ? 'Regionen' : 'Regions';
    const sourceHeader = isDE ? 'Quelle' : 'Source';
    const summaryHeader = isDE ? 'Zusammenfassung' : 'Summary';

    const rows = entries.map((entry) => `
        <tr>
            <td>${formatDate(entry.date, isDE)}</td>
            <td><strong>${escapeHtml(entry.stage)}</strong><br/>${escapeHtml(entry.description)}</td>
            <td>${escapeHtml(entry.regions || entry.stage4Reason)}</td>
            <td>${escapeHtml(entry.source)}</td>
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
                        <th>${stageHeader}</th>
                        <th>${regionsHeader}</th>
                        <th>${sourceHeader}</th>
                        <th>${summaryHeader}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}
