import type { AlsfrsSession } from '../types';
import type { QuestionnaireDefinition } from '@/src/questionnaires/types';

export function buildAlsfrsSection(
    sessions: AlsfrsSession[],
    questionnaireDef: QuestionnaireDefinition,
    isDE: boolean
): string {
    if (sessions.length === 0) return '';

    const title = 'ALSFRS-R';
    const domains = questionnaireDef.domains;

    // Table header: Date + domain names + Total
    const dateHeader = isDE ? 'Datum' : 'Date';
    const totalHeader = isDE ? 'Gesamt' : 'Total';
    const maxHeader = `(/${questionnaireDef.scoring.maxScore})`;

    const headerCells = [
        `<th>${dateHeader}</th>`,
        ...domains.map(d => `<th class="text-center">${d.name}</th>`),
        `<th class="text-center">${totalHeader} ${maxHeader}</th>`,
    ].join('');

    // Table rows
    const rows = sessions.map(session => {
        const dateStr = session.date.toLocaleDateString(isDE ? 'de-DE' : 'en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });

        const domainCells = domains.map(d => {
            const score = session.domainScores[d.id] ?? 0;
            const maxDomainScore = d.questions.length * 4; // Each question max 4
            return `<td class="text-center">${score}/${maxDomainScore}</td>`;
        }).join('');

        return `
            <tr>
                <td>${dateStr}</td>
                ${domainCells}
                <td class="text-center"><strong>${session.totalScore}</strong></td>
            </tr>
        `;
    }).join('');

    return `
        <div class="page-section">
            <div class="section-title">${title}</div>
            <table>
                <thead><tr>${headerCells}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}
