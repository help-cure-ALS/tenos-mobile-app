import type { MetricSummary, MetricFieldFormat } from '../types';

function formatDate(date: Date, isDE: boolean): string {
    return date.toLocaleDateString(isDE ? 'de-DE' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

/**
 * Format a numeric value based on the metric field definition.
 * Matches the UI formatting logic (MetricValueDisplay / LineChart / BarChart).
 */
function formatNum(value: number | undefined, fieldFormat?: MetricFieldFormat): string {
    if (value === undefined || value === null) return '–';
    if (fieldFormat?.inputType === 'decimal' && fieldFormat.decimalPlaces !== undefined) {
        return value.toFixed(fieldFormat.decimalPlaces);
    }
    // Default: round to integer (same as UI for 'integer' inputType)
    return String(Math.round(value));
}

/**
 * Get the display label for a numeric value from valueLabels.
 */
function getValueLabel(
    value: number | undefined,
    valueLabels?: Array<{ value: number; label: string }>
): string | undefined {
    if (value === undefined || !valueLabels) return undefined;
    return valueLabels.find(vl => vl.value === value)?.label;
}

/**
 * Build a scale legend string from valueLabels, e.g. "(0 = Keine, 3 = Stark)".
 * Shows only the min and max labels to keep it compact.
 */
function buildScaleLegend(
    valueLabels?: Array<{ value: number; label: string }>
): string {
    if (!valueLabels || valueLabels.length < 2) return '';
    const sorted = [...valueLabels].sort((a, b) => a.value - b.value);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    return `(${min.value} = ${min.label}, ${max.value} = ${max.label})`;
}

function buildMetricCard(metric: MetricSummary, isDE: boolean): string {
    let latestStr = '';
    let latestDateStr = '';
    const fmt = metric.fieldFormat;

    if (metric.latest) {
        latestDateStr = formatDate(metric.latest.date, isDE);

        if (metric.isMultiField && metric.components) {
            // BP-style: 125/82 mmHg
            const keys = Object.keys(metric.components);
            const parts = keys.map(k => {
                const val = metric.latest!.values[k];
                const cFmt = metric.components![k]?.fieldFormat;
                return val !== undefined ? formatNum(val, cFmt) : '–';
            });
            latestStr = `${parts.join('/')} ${metric.unit}`;
        } else {
            const fieldKey = Object.keys(metric.latest.values)[0];
            const val = metric.latest.values[fieldKey];
            if (val !== undefined) {
                const label = getValueLabel(val, metric.valueLabels);
                if (label) {
                    // Discrete scale: show value with label, e.g. "1 (Leicht)"
                    latestStr = `${formatNum(val, fmt)} (${label})`;
                } else {
                    latestStr = `${formatNum(val, fmt)} ${metric.unit}`;
                }
            }
        }
    }

    // Description
    const descHtml = metric.description
        ? `<div style="font-size: 9px; color: #666; margin-top: 1px; max-width: 80%;">${metric.description}</div>`
        : '';

    // Scale legend for discrete metrics
    const legend = buildScaleLegend(metric.valueLabels);
    const legendHtml = legend
        ? `<div style="font-size: 9px; color: #666; margin-top: 2px;">${legend}</div>`
        : '';

    // Source info
    let sourceHtml = '';
    if (metric.hasExternalHealth) {
        const sourceLabel = isDE ? 'Quelle: Apple Health / Health Connect' : 'Source: Apple Health / Health Connect';
        sourceHtml = `<div style="font-size: 9px; color: #666; margin-top: 2px;">${sourceLabel}</div>`;
    }

    let statsHtml = '';
    if (metric.isMultiField && metric.components) {
        const statParts = Object.values(metric.components).map(c => {
            const cFmt = c.fieldFormat;
            return `<span class="metric-stat">${c.label}: <strong>${formatNum(c.min, cFmt)}–${formatNum(c.max, cFmt)}</strong> (Ø ${formatNum(c.avg, cFmt)})</span>`;
        });
        statsHtml = `<div class="metric-stats">${statParts.join('')}</div>`;
    } else if (metric.min !== undefined) {
        const minLabel = getValueLabel(metric.min, metric.valueLabels);
        const maxLabel = getValueLabel(metric.max, metric.valueLabels);

        const minStr = minLabel
            ? `${formatNum(metric.min, fmt)} (${minLabel})`
            : formatNum(metric.min, fmt);
        const maxStr = maxLabel
            ? `${formatNum(metric.max, fmt)} (${maxLabel})`
            : formatNum(metric.max, fmt);

        statsHtml = `
            <div class="metric-stats">
                <span class="metric-stat">Min: <strong>${minStr}</strong></span>
                <span class="metric-stat">Max: <strong>${maxStr}</strong></span>
                <span class="metric-stat">Ø: <strong>${formatNum(metric.avg, fmt)}</strong></span>
                <span class="metric-stat">n = ${metric.count}</span>
            </div>
        `;
    }

    return `
        <div class="metric-card avoid-break">
            <div class="metric-header">
                <span class="metric-name">${metric.name}</span>
                <span>
                    <span class="metric-latest">${latestStr}</span>
                    <span class="metric-latest-date"> ${latestDateStr}</span>
                </span>
            </div>
            ${descHtml}
            ${legendHtml}
            ${statsHtml}
            ${sourceHtml}
        </div>
    `;
}

export function buildMetricsSection(metrics: MetricSummary[], isDE: boolean): string {
    if (metrics.length === 0) return '';

    const title = isDE ? 'Metriken' : 'Metrics';
    const cards = metrics.map(m => buildMetricCard(m, isDE)).join('');

    return `
        <div class="page-section">
            <div class="section-title">${title}</div>
            ${cards}
        </div>
    `;
}
