import React from 'react';
import type { MetricDefinition, MetricEntry } from '@/src/metrics/types';
import { LineChart } from './LineChart';
import { BarChart } from './BarChart';
import { RangeBarChart } from './RangeBarChart';

type MetricChartProps = {
    /** Metric entries from useMetric */
    entries: MetricEntry[];
    /** Metric definition – chart.type selects the renderer */
    definition: MetricDefinition;
    /** Time range for display */
    timeRange?: 'day' | 'week' | 'month' | 'all';
    /** Period start for x-axis */
    periodStart?: Date;
    /** Period end for x-axis */
    periodEnd?: Date;
    /** Show reference line from definition */
    showReferenceLine?: boolean;
};

/**
 * Dispatcher component that renders the correct chart type based on
 * `definition.chart.type`.
 *
 * - 'line' (default) → LineChart (connected data points)
 * - 'scatter'         → LineChart (data points only, no connecting line)
 * - 'bar'             → BarChart  (vertical bars)
 * - 'range'           → RangeBarChart (min-max floating bars per time period)
 */
export function MetricChart(props: MetricChartProps) {
    const chartType = props.definition?.chart?.type ?? 'line';

    switch (chartType) {
        case 'bar':
            return <BarChart {...props} />;
        case 'range':
            return <RangeBarChart {...props} />;
        case 'scatter':
        case 'line':
        default:
            return <LineChart {...props} />;
    }
}
