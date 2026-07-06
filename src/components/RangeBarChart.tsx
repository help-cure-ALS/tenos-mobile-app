import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, useColorScheme, useWindowDimensions } from 'react-native';
import { BarChart as GiftedBarChart } from 'react-native-gifted-charts';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useTranslation } from 'react-i18next';
import { AppColors, useAppTheme } from "@/src/theme";
import type { MetricDefinition, MetricEntry } from '@/src/metrics/types';
import { fmtTime, fmtWeekdayShort, fmtMonthShort, fmtMonthYear, fmtDate } from '@/src/lib/formatDate';

type TimeRange = 'day' | 'week' | 'month' | 'all';

type RangeBarChartProps = {
    /** Metric entries from useMetric */
    entries: MetricEntry[];
    /** Metric definition for field configuration */
    definition: MetricDefinition;
    /** Time range for display */
    timeRange?: TimeRange;
    /** Period start for x-axis */
    periodStart?: Date;
    /** Period end for x-axis */
    periodEnd?: Date;
    /** Show reference line from definition */
    showReferenceLine?: boolean;
};

/** Neutral mid-gray – works on both light and dark backgrounds. */
const BAR_COLOR = '#8E8E93';

// ── Aggregation helpers ────────────────────────────────────────

type AggregatedEntry = {
    min: number;
    max: number;
    date: Date;   // representative date (first entry in the group)
    count: number;
};

/** Returns a grouping key for the given date, based on the time range. */
function getGroupKey(date: Date, timeRange: TimeRange): string {
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();

    switch (timeRange) {
        case 'day':
            // Group by hour
            return `${y}-${m}-${d}-${date.getHours()}`;
        case 'week':
        case 'month':
        case 'all':
        default:
            // Group by day
            return `${y}-${m}-${d}`;
    }
}

/**
 * Aggregate entries into min/max per time-period group.
 */
function aggregateByPeriod(
    entries: MetricEntry[],
    fieldKey: string,
    timeRange: TimeRange,
): AggregatedEntry[] {
    const groups = new Map<string, { values: number[]; date: Date }>();

    for (const entry of entries) {
        const value = entry.values[fieldKey];
        if (value === undefined) continue;

        const key = getGroupKey(entry.date, timeRange);
        const group = groups.get(key);
        if (group) {
            group.values.push(value);
        } else {
            groups.set(key, { values: [value], date: entry.date });
        }
    }

    const result: AggregatedEntry[] = [];
    for (const group of groups.values()) {
        result.push({
            min: Math.min(...group.values),
            max: Math.max(...group.values),
            date: group.date,
            count: group.values.length,
        });
    }

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ── Component ──────────────────────────────────────────────────

export function RangeBarChart({
    entries = [],
    definition,
    timeRange: initialTimeRange = 'month',
    showReferenceLine = true,
}: RangeBarChartProps) {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const colorScheme = useColorScheme();
    const { width: screenWidth } = useWindowDimensions();
    const styles = createStyles(colors);
    const useGerman = i18n.language === 'de';

    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // ── Time range selector ────────────────────────────────────────
    const timeRangeOptions = useMemo(
        () => [
            { label: t('lineChart.day'), value: 'day' as const },
            { label: t('lineChart.week'), value: 'week' as const },
            { label: t('lineChart.month'), value: 'month' as const },
            { label: t('lineChart.all'), value: 'all' as const },
        ],
        [t]
    );

    const defaultIndex = timeRangeOptions.findIndex(o => o.value === initialTimeRange);
    const [selectedRangeIndex, setSelectedRangeIndex] = useState(
        defaultIndex >= 0 ? defaultIndex : timeRangeOptions.length - 1
    );
    const autoSwitched = useRef(false);

    useEffect(() => {
        if (autoSwitched.current || entries.length === 0) return;
        autoSwitched.current = true;

        const range = timeRangeOptions[selectedRangeIndex].value;
        if (range === 'all') return;

        const now = new Date();
        let cutoff: Date;
        if (range === 'day') { cutoff = new Date(now); cutoff.setHours(0, 0, 0, 0); }
        else if (range === 'week') { cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7); }
        else { cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 1); }

        const count = entries.filter(e => e.date >= cutoff).length;
        if (count <= 1) {
            setSelectedRangeIndex(timeRangeOptions.findIndex(o => o.value === 'all'));
        }
    }, [entries, selectedRangeIndex, timeRangeOptions]);

    const timeRange = timeRangeOptions[selectedRangeIndex].value;

    // Reset selection on time-range change
    useEffect(() => { setSelectedIndex(null); }, [timeRange]);

    // ── Field config ───────────────────────────────────────────────
    const primaryFieldKey = definition?.chart?.primaryField ?? definition?.fields?.[0]?.key ?? 'value';
    const unit = definition?.showUnit !== false ? (definition?.defaultUnit ?? '') : '';

    // ── Filter by time range ───────────────────────────────────────
    const filteredEntries = useMemo(() => {
        if (!entries || entries.length === 0) return [];

        const now = new Date();
        let cutoffDate: Date;

        switch (timeRange) {
            case 'day':
                cutoffDate = new Date(now); cutoffDate.setHours(0, 0, 0, 0); break;
            case 'week':
                cutoffDate = new Date(now); cutoffDate.setDate(cutoffDate.getDate() - 7); break;
            case 'month':
                cutoffDate = new Date(now); cutoffDate.setMonth(cutoffDate.getMonth() - 1); break;
            case 'all':
            default:
                return entries;
        }

        return entries.filter(entry => entry.date >= cutoffDate);
    }, [entries, timeRange]);

    // Sort oldest first then aggregate
    const sortedEntries = [...filteredEntries].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
    );

    const aggregatedData = useMemo(
        () => aggregateByPeriod(sortedEntries, primaryFieldKey, timeRange),
        [sortedEntries, primaryFieldKey, timeRange]
    );

    const hasData = aggregatedData.length > 0;

    // ── Collect all raw values for statistics ──────────────────────
    const allValues = sortedEntries
        .map(e => e.values[primaryFieldKey])
        .filter((v): v is number => v !== undefined);

    const average = allValues.length > 0
        ? allValues.reduce((a, b) => a + b, 0) / allValues.length
        : 0;

    // ── Y-axis calculation ─────────────────────────────────────────
    const getNiceStepSize = (range: number, targetSteps: number = 4): number => {
        if (range === 0) return 10;
        const roughStep = range / targetSteps;
        const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
        const normalized = roughStep / magnitude;
        let niceStep: number;
        if (normalized <= 1) niceStep = 1;
        else if (normalized <= 2) niceStep = 2;
        else if (normalized <= 5) niceStep = 5;
        else niceStep = 10;
        return niceStep * magnitude;
    };

    const dataMinValue = hasData
        ? Math.min(...aggregatedData.map(a => a.min))
        : 0;
    const dataMaxValue = hasData
        ? Math.max(...aggregatedData.map(a => a.max))
        : 100;

    const yAxisConfig = definition.chart.yAxis;
    const padding = yAxisConfig?.padding ?? 0.15;
    const dataRange = dataMaxValue - dataMinValue || 1;
    const paddingAmount = dataRange * padding;

    // Ensure a minimum of 2 units padding so narrow ranges stay readable
    const effectivePadding = Math.max(paddingAmount, 2);
    // Data-driven range, clamped to config boundaries when set
    const rawMin = dataMinValue - effectivePadding;
    const rawMax = dataMaxValue + effectivePadding;
    const minWithPadding = yAxisConfig?.min !== undefined ? Math.max(yAxisConfig.min, rawMin) : rawMin;
    const maxWithPadding = yAxisConfig?.max !== undefined ? Math.min(yAxisConfig.max, rawMax) : rawMax;

    const fullRange = maxWithPadding - minWithPadding || 1;
    const stepSize = getNiceStepSize(fullRange);

    const niceMin = Math.floor(minWithPadding / stepSize) * stepSize;
    const niceMax = Math.ceil(maxWithPadding / stepSize) * stepSize;
    const numSections = Math.max(1, Math.round((niceMax - niceMin) / stepSize));

    const chartRange = niceMax - niceMin;
    const chartHeight = 160; // px

    // ── Bar sizing ─────────────────────────────────────────────────
    const barCount = aggregatedData.length;
    const initialSp = 20;
    const endSp = 20;
    // Available width: screen − container padding (15×2) − chartWrapper offset (10) − y-axis (~45)
    const availableWidth = screenWidth - 30 - 10 - 45 - initialSp - endSp;

    // "Alle" → fixed bar size with horizontal scroll; T/W/M → fill width
    const scrollable = timeRange === 'all' && barCount > 15;
    let barWidth: number;
    let barSpacing: number;

    if (scrollable) {
        // Fixed comfortable size for scrollable view
        barWidth = 5;
        barSpacing = 6;
    } else {
        // Dynamic — distribute evenly across the full chart width
        const slotWidth = barCount > 0 ? availableWidth / barCount : availableWidth;
        barWidth = Math.max(3, Math.min(14, Math.round(slotWidth * 0.4)));
        barSpacing = Math.max(2, Math.round(slotWidth - barWidth));
    }

    const barRadius = barWidth / 2; // pill / capsule shape (fully rounded)

    /**
     * Minimum visible bar height for single-value periods (min === max).
     * We want a round dot → the height in pixels must equal barWidth.
     * Convert barWidth px into data-units: barWidth * (chartRange / chartHeight).
     */
    const minBarHeight = barWidth * (chartRange / chartHeight);

    // ── X-axis labels ──────────────────────────────────────────────
    // For scrollable "all" view, show label only at month boundaries
    const labelStep = scrollable ? 0 /* handled per-item below */ : barCount > 15 ? 3 : barCount > 7 ? 2 : 1;

    /** Short labels that fit the narrow bar spacing. */
    const formatXLabel = (date: Date): string => {
        switch (timeRange) {
            case 'day': return fmtTime(date);
            case 'week': return fmtWeekdayShort(date, useGerman);
            case 'month':
                return `${date.getDate()}.`;
            case 'all':
            default:
                return aggregatedData.length <= 7
                    ? `${date.getDate()}.`
                    : fmtMonthYear(date, useGerman);
        }
    };

    /**
     * For the scrollable "all" view, show a label only on the first
     * entry of each month so the axis stays clean.
     */
    const isFirstOfMonth = (index: number): boolean => {
        if (index === 0) return true;
        const prev = aggregatedData[index - 1].date;
        const curr = aggregatedData[index].date;
        return curr.getMonth() !== prev.getMonth() || curr.getFullYear() !== prev.getFullYear();
    };

    // ── Stack data ─────────────────────────────────────────────────
    const stackData = aggregatedData.map((agg, index) => {
        const rawRange = agg.max - agg.min;
        let baseHeight: number;
        let rangeHeight: number;

        if (rawRange >= minBarHeight) {
            // Real range — use actual min/max
            baseHeight = Math.max(0, agg.min - niceMin);
            rangeHeight = rawRange;
        } else {
            // Single value or narrow range — center a minimum-height bar
            const center = (agg.min + agg.max) / 2;
            const halfMin = minBarHeight / 2;
            const adjustedMin = Math.max(niceMin, center - halfMin);
            const adjustedMax = Math.min(niceMin + chartRange, center + halfMin);
            baseHeight = adjustedMin - niceMin;
            rangeHeight = adjustedMax - adjustedMin;
        }

        const barColor = selectedIndex === index ? colors.accent : BAR_COLOR;
        const pressHandler = () => setSelectedIndex(prev => prev === index ? null : index);

        return {
            stacks: [
                {
                    value: baseHeight,
                    color: 'transparent',
                    onPress: pressHandler,
                },
                {
                    value: rangeHeight,
                    color: barColor,
                    borderRadius: barRadius,
                    onPress: pressHandler,
                },
            ],
            label: scrollable
                ? (isFirstOfMonth(index) ? formatXLabel(agg.date) : '')
                : (labelStep > 0 && index % labelStep === 0 ? formatXLabel(agg.date) : ''),
            // gifted-charts ignores top-level labelWidth for stackData,
            // so set it per item to prevent label truncation.
            ...(scrollable && isFirstOfMonth(index) ? { labelWidth: 45 } : {}),
        };
    });

    // ── Display value (header updates on selection) ────────────────
    const latestEntry = sortedEntries.length > 0
        ? sortedEntries[sortedEntries.length - 1]
        : null;
    const latestValue = latestEntry ? latestEntry.values[primaryFieldKey] : null;

    const selectedAgg = selectedIndex !== null ? aggregatedData[selectedIndex] : null;
    const showAverage = definition?.chart?.showAverage !== false && allValues.length > 1;

    const referenceLine = showReferenceLine ? definition.chart.referenceLine : undefined;

    const primaryField = definition.fields.find(f => f.key === primaryFieldKey);

    // ── Value formatting ───────────────────────────────────────────
    const formatValue = (value: number): string => {
        if (primaryField?.inputType === 'decimal' && primaryField.decimalPlaces !== undefined) {
            return value.toFixed(primaryField.decimalPlaces).replace('.', useGerman ? ',' : '.');
        }
        return Math.round(value).toString();
    };

    const formatDateDisplay = (date: Date): string => fmtDate(date, useGerman);

    // Header value: range when selected, latest value otherwise
    const headerValueText = (() => {
        if (selectedAgg) {
            if (selectedAgg.min !== selectedAgg.max) {
                return `${formatValue(selectedAgg.min)} – ${formatValue(selectedAgg.max)}`;
            }
            return formatValue(selectedAgg.min);
        }
        return latestValue != null ? formatValue(latestValue) : '–';
    })();

    const headerDate = selectedAgg
        ? formatDateDisplay(selectedAgg.date)
        : (latestEntry ? formatDateDisplay(latestEntry.date) : null);

    if (!definition) return null;

    return (
        <View style={styles.container}>
            {/* Time Range Selector */}
            <View style={styles.segmentedControlWrapper}>
                <SegmentedControl
                    values={timeRangeOptions.map(o => o.label)}
                    selectedIndex={selectedRangeIndex}
                    onChange={(event) => {
                        setSelectedRangeIndex(event.nativeEvent.selectedSegmentIndex);
                    }}
                    appearance={colorScheme === 'dark' ? 'dark' : 'light'}
                    style={styles.segmentedControl}
                    fontStyle={{ color: colors.textSecondary }}
                    activeFontStyle={{ color: colorScheme === 'dark' ? '#fff' : '#000' }}
                />
            </View>

            {/* Current / Selected Value */}
            <Text style={styles.label}>{t('common.current').toUpperCase()}</Text>
            <View style={styles.valueHeader}>
                <Text style={styles.currentValue}>{headerValueText}</Text>
                {unit && headerValueText !== '–' && (
                    <Text style={styles.unit}>{unit}</Text>
                )}
            </View>
            {headerDate && <Text style={styles.dateText}>{headerDate}</Text>}

            {/* Average */}
            {showAverage && (
                <View style={styles.averageSection}>
                    <Text style={styles.label}>{t('metric.average').toUpperCase()}</Text>
                    <View style={styles.averageRow}>
                        <Text style={styles.averageValue}>{formatValue(average)}</Text>
                        {unit && <Text style={styles.averageUnit}>{unit}</Text>}
                    </View>
                </View>
            )}

            {/* Chart */}
            <View style={styles.chartWrapper}>
                {hasData ? (
                    <GiftedBarChart
                        key={`range-${timeRange}-${stackData.length}`}
                        stackData={stackData}
                        barWidth={barWidth}
                        spacing={barSpacing}
                        height={chartHeight}
                        initialSpacing={initialSp}
                        endSpacing={endSp}
                        disableScroll={!scrollable}
                        scrollToEnd={scrollable}
                        scrollAnimation={false}
                        noOfSections={numSections}
                        maxValue={chartRange}
                        yAxisTextStyle={styles.axisText}
                        xAxisLabelTextStyle={styles.axisText}
                        xAxisColor="transparent"
                        yAxisColor={colors.border}
                        yAxisThickness={StyleSheet.hairlineWidth}
                        hideRules
                        yAxisTextNumberOfLines={1}
                        formatYLabel={(label: string) => {
                            const val = parseFloat(label) + niceMin;
                            return Number.isInteger(val) ? val.toString() : val.toFixed(0);
                        }}
                        showReferenceLine1={!!referenceLine}
                        referenceLine1Position={referenceLine ? referenceLine.value - niceMin : undefined}
                        referenceLine1Config={{
                            color: colors.textHint,
                            dashWidth: 4,
                            dashGap: 4,
                            thickness: 1,
                            labelText: referenceLine?.label,
                            labelTextStyle: styles.referenceLineLabel,
                        }}
                    />
                ) : (
                    <View style={styles.emptyChart}>
                        <Text style={styles.emptyChartText}>{t('lineChart.noData')}</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const createStyles = (colors: AppColors) =>
    StyleSheet.create({
        container: {
            backgroundColor: colors.listItemBackground,
            padding: 15,
        },
        segmentedControlWrapper: {
            marginBottom: 16,
        },
        segmentedControl: {
            height: 32,
        },
        label: {
            fontSize: 11,
            color: colors.textHint,
            fontWeight: '600',
            letterSpacing: 0.5,
        },
        valueHeader: {
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 4,
            marginTop: 2,
            marginBottom: 8,
        },
        currentValue: {
            fontSize: 34,
            fontWeight: '700',
            color: colors.text,
        },
        unit: {
            fontSize: 16,
            color: colors.textHint,
        },
        dateText: {
            fontSize: 13,
            color: colors.textHint,
            marginTop: -4,
            marginBottom: 8,
        },
        averageSection: {
            marginBottom: 8,
        },
        averageRow: {
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 4,
            marginTop: 2,
        },
        averageValue: {
            fontSize: 20,
            fontWeight: '600',
            color: colors.textSecondary,
        },
        averageUnit: {
            fontSize: 14,
            color: colors.textHint,
        },
        chartWrapper: {
            marginLeft: -10,
        },
        axisText: {
            fontSize: 10,
            color: colors.textHint,
        },
        referenceLineLabel: {
            fontSize: 10,
            color: colors.textHint,
        },
        emptyChart: {
            height: 160,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emptyChartText: {
            fontSize: 14,
            color: colors.textHint,
        },
    });
