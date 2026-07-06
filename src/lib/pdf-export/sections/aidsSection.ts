import type { AidSummary } from '../types';

export function buildAidsSection(aids: AidSummary[], isDE: boolean): string {
    if (aids.length === 0) return '';

    const title = isDE ? 'Hilfsmittel' : 'Aids & Equipment';

    const headers = isDE
        ? ['Name', 'Kategorie', 'Status']
        : ['Name', 'Category', 'Status'];

    const headerRow = headers.map(h => `<th>${h}</th>`).join('');

    const rows = aids.map(aid => `
        <tr>
            <td><strong>${aid.name}</strong></td>
            <td>${aid.category}</td>
            <td>${aid.status}</td>
        </tr>
    `).join('');

    return `
        <div class="page-section avoid-break">
            <div class="section-title">${title}</div>
            <table>
                <thead><tr>${headerRow}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}
