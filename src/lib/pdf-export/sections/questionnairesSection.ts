import type { QuestionnaireSession } from '../types';
import type { QuestionnaireDefinition } from '@/src/questionnaires/types';

function formatDate(date: Date, isDE: boolean): string {
    return date.toLocaleDateString(isDE ? 'de-DE' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

/**
 * Compute a trend arrow from the first and last few sessions.
 * Compares the average of the first 3 values to the average of the last 3.
 * Returns ▲ (rising), ▼ (falling), or → (stable).
 */
function computeTrend(values: number[]): string {
    if (values.length < 2) return '';

    const headCount = Math.min(3, Math.floor(values.length / 2));
    const tailCount = headCount;

    const headAvg = values.slice(0, headCount).reduce((s, v) => s + v, 0) / headCount;
    const tailAvg = values.slice(-tailCount).reduce((s, v) => s + v, 0) / tailCount;

    const diff = tailAvg - headAvg;
    if (diff > 0.5) return '▲';
    if (diff < -0.5) return '▼';
    return '→';
}

/**
 * Build the export title for a questionnaire section.
 * Priority: exportTitle > displayName – shortName > displayName > name
 */
function getExportTitle(def: QuestionnaireDefinition): string {
    if (def.exportTitle) return def.exportTitle;
    if (def.displayName && def.shortName && def.displayName !== def.shortName) {
        return `${def.displayName} – ${def.shortName}`;
    }
    return def.displayName || def.name;
}

/**
 * Build the section header: title + optional description.
 */
function buildSectionHeader(def: QuestionnaireDefinition): string {
    const title = getExportTitle(def);
    const desc = def.description
        ? `<div style="font-size: 10px; color: #666; margin-top: 1px; margin-bottom: 4px; max-width: 80%;">${def.description}</div>`
        : '';
    return `<div class="section-title">${title}</div>${desc}`;
}

/**
 * Collect all questions from a questionnaire definition in order.
 * Includes scale info (min/max value and labels) for per-column legends.
 */
function getAllQuestions(def: QuestionnaireDefinition): Array<{
    id: string;
    text: string;
    exportLabel?: string;
    minValue: number;
    maxValue: number;
    minLabel: string;
    maxLabel: string;
}> {
    const questions: Array<{
        id: string;
        text: string;
        exportLabel?: string;
        minValue: number;
        maxValue: number;
        minLabel: string;
        maxLabel: string;
    }> = [];
    for (const domain of def.domains) {
        for (const q of domain.questions) {
            const values = q.options.map(o => o.value);
            const minVal = Math.min(...values);
            const maxVal = Math.max(...values);
            questions.push({
                id: q.id,
                text: q.text ?? q.id,
                exportLabel: q.exportLabel,
                minValue: minVal,
                maxValue: maxVal,
                minLabel: q.options.find(o => o.value === minVal)?.label ?? String(minVal),
                maxLabel: q.options.find(o => o.value === maxVal)?.label ?? String(maxVal),
            });
        }
    }
    return questions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail view: one column per question, trend arrow at the end.
// Used when showScore is false and total question count is ≤ 8.
// Dates as rows → scales naturally across page breaks.
// ─────────────────────────────────────────────────────────────────────────────

function buildDetailSection(
    sessions: QuestionnaireSession[],
    questionnaireDef: QuestionnaireDefinition,
    isDE: boolean
): string {
    const questions = getAllQuestions(questionnaireDef);
    const dateHeader = isDE ? 'Datum' : 'Date';
    const trendHeader = isDE ? 'Trend' : 'Trend';

    // Check if all questions share the same scale
    const allSameScale = questions.every(
        q => q.minValue === questions[0].minValue &&
             q.maxValue === questions[0].maxValue &&
             q.minLabel === questions[0].minLabel &&
             q.maxLabel === questions[0].maxLabel
    );

    // Shared legend (only when all questions have the same scale)
    let legendHtml = '';
    if (allSameScale && questions.length > 0) {
        const q0 = questions[0];
        const legend = `(${q0.minValue} = ${q0.minLabel}, ${q0.maxValue} = ${q0.maxLabel})`;
        legendHtml = `<div style="font-size: 10px; color: #666; margin-bottom: 6px;">${legend}</div>`;
    }

    // Header row — when scales differ, append "(0–4)" range to each column header
    const headerCells = [
        `<th>${dateHeader}</th>`,
        ...questions.map(q => {
            const label = q.exportLabel ?? q.text;
            const scaleHint = allSameScale ? '' : ` (${q.minValue}–${q.maxValue})`;
            return `<th class="text-center" title="${q.text}">${label}${scaleHint}</th>`;
        }),
        `<th class="text-center">${trendHeader}</th>`,
    ].join('');

    // Data rows
    const rows = sessions.map((session, idx) => {
        const dateStr = formatDate(session.date, isDE);

        const questionCells = questions.map(q => {
            const val = session.answers[q.id];
            return `<td class="text-center">${val !== undefined ? val : '–'}</td>`;
        }).join('');

        // Trend: compare this session's total to the average of the first few
        let trendCell = '';
        if (idx > 0) {
            const totals = sessions.slice(0, idx + 1).map(s => s.totalScore);
            trendCell = computeTrend(totals);
        }

        return `
            <tr>
                <td>${dateStr}</td>
                ${questionCells}
                <td class="text-center">${trendCell}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="page-section">
            ${buildSectionHeader(questionnaireDef)}
            ${legendHtml}
            <table>
                <thead><tr>${headerCells}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Score view: domain scores + total + trend.
// Used when showScore is not false, or when there are too many questions.
// ─────────────────────────────────────────────────────────────────────────────

function buildScoreSection(
    sessions: QuestionnaireSession[],
    questionnaireDef: QuestionnaireDefinition,
    isDE: boolean
): string {
    const domains = questionnaireDef.domains;
    const showDomains = domains.length > 1;

    const dateHeader = isDE ? 'Datum' : 'Date';
    const totalHeader = isDE ? 'Gesamt' : 'Total';
    const trendHeader = isDE ? 'Trend' : 'Trend';
    const maxScore = questionnaireDef.scoring.maxScore;

    // Compute max score per domain
    const domainMaxScores: Record<string, number> = {};
    for (const domain of domains) {
        domainMaxScores[domain.id] = domain.questions.reduce((sum, q) => {
            const maxOption = Math.max(...q.options.map(o => o.value));
            return sum + maxOption;
        }, 0);
    }

    // Table header
    const headerCells = [
        `<th>${dateHeader}</th>`,
        ...(showDomains ? domains.map(d => `<th class="text-center">${d.name}</th>`) : []),
        `<th class="text-center">${totalHeader} (/${maxScore})</th>`,
        `<th class="text-center">${trendHeader}</th>`,
    ].join('');

    // Table rows
    const rows = sessions.map((session, idx) => {
        const dateStr = formatDate(session.date, isDE);

        const domainCells = showDomains
            ? domains.map(d => {
                const score = session.domainScores[d.id] ?? 0;
                const maxDomain = domainMaxScores[d.id] ?? 0;
                return `<td class="text-center">${score}/${maxDomain}</td>`;
            }).join('')
            : '';

        let trendCell = '';
        if (idx > 0) {
            const totals = sessions.slice(0, idx + 1).map(s => s.totalScore);
            trendCell = computeTrend(totals);
        }

        return `
            <tr>
                <td>${dateStr}</td>
                ${domainCells}
                <td class="text-center"><strong>${session.totalScore}</strong></td>
                <td class="text-center">${trendCell}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="page-section">
            ${buildSectionHeader(questionnaireDef)}
            <table>
                <thead><tr>${headerCells}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DETAIL_QUESTIONS = 8;

/**
 * Build a PDF section for a single standard questionnaire (non-ALSFRS, non-structured).
 *
 * Chooses between two layouts:
 * - Detail view: individual question values per column (when showScore is false and ≤ 8 questions)
 * - Score view: domain scores + total (all other cases)
 *
 * Both views include a trend arrow column.
 */
export function buildQuestionnaireSection(
    sessions: QuestionnaireSession[],
    questionnaireDef: QuestionnaireDefinition,
    isDE: boolean
): string {
    if (sessions.length === 0) return '';

    const totalQuestions = questionnaireDef.domains.reduce(
        (sum, d) => sum + d.questions.length, 0
    );

    const useDetail =
        questionnaireDef.scoring.showScore === false &&
        totalQuestions <= MAX_DETAIL_QUESTIONS;

    return useDetail
        ? buildDetailSection(sessions, questionnaireDef, isDE)
        : buildScoreSection(sessions, questionnaireDef, isDE);
}
