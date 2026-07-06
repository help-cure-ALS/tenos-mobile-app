import type { ALSGeneticBackgroundSummary } from '../types';

function formatDate(date: Date, isDE: boolean): string {
    return date.toLocaleDateString(isDE ? 'de-DE' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatMonthYear(value: string, isDE: boolean): string {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) return value;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    return date.toLocaleDateString(isDE ? 'de-DE' : 'en-US', {
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

export function buildALSGeneticBackgroundSection(entries: ALSGeneticBackgroundSummary[], isDE: boolean): string {
    if (entries.length === 0) return '';

    const title = isDE ? 'ALS-Form & Genetik' : 'ALS form & genetics';
    const dateHeader = isDE ? 'Datum' : 'Date';
    const formHeader = isDE ? 'ALS-Form' : 'ALS form';
    const familyHeader = isDE ? 'Familienanamnese' : 'Family history';
    const testingHeader = isDE ? 'Genetik' : 'Genetics';
    const testDateHeader = isDE ? 'Testdatum' : 'Test date';
    const sourceHeader = isDE ? 'Quelle' : 'Source';
    const counselingHeader = isDE ? 'Humangenetische Beratung' : 'Genetic counseling';
    const summaryHeader = isDE ? 'Zusammenfassung' : 'Summary';

    const rows = entries.map((entry) => {
        const geneticDetails = [
            entry.testingStatus,
            entry.gene,
            entry.variantText,
        ].filter(Boolean).map(escapeHtml).join('<br/>');

        return `
            <tr>
                <td>${formatDate(entry.date, isDE)}</td>
                <td><strong>${escapeHtml(entry.diseaseForm)}</strong></td>
                <td>${escapeHtml(entry.familyHistory)}</td>
                <td>${geneticDetails}</td>
                <td>${escapeHtml(formatMonthYear(entry.testDate, isDE))}</td>
                <td>${escapeHtml(entry.source)}</td>
                <td>${escapeHtml(entry.counselingStatus)}</td>
                <td>${escapeHtml(entry.summary)}${entry.note ? `<br/>${escapeHtml(entry.note)}` : ''}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="page-section">
            <div class="section-title">${title}</div>
            <table>
                <thead>
                    <tr>
                        <th>${dateHeader}</th>
                        <th>${formHeader}</th>
                        <th>${familyHeader}</th>
                        <th>${testingHeader}</th>
                        <th>${testDateHeader}</th>
                        <th>${sourceHeader}</th>
                        <th>${counselingHeader}</th>
                        <th>${summaryHeader}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}
