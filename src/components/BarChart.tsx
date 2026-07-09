import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, useColorScheme, Pressable, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { BarChart as GiftedBarChart } from 'react-native-gifted-charts';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useTranslation } from 'react-i18next';
import { AppColors, useAppTheme } from "@/src/theme";
import type { MetricDefinition, MetricEntry } from '@/src/metrics/types';
import { fmtTime, fmtWeekdayShort, fmtDayMonthShort, fmtMonthYear, fmtDate, fmtDateRangeLong } from '@/src/lib/formatDate';

type TimeRange = 'day' | 'week' | 'month' | 'all';

type BarChartProps = {
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

export function BarChart({
    entries = [],
    definition,
    timeRange: initialTimeRange = 'month',
    showReferenceLine = true,
}: BarChartProps) {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const colorScheme = useColorScheme();
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

    // Auto-switch to 'all' if <=1 data point in current range
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

    // Reset bar selection on time-range change
    useEffect(() => { setSelectedIndex(null); }, [timeRange]);

    // ── Field config ───────────────────────────────────────────────
    const primaryFieldKey = definition?.chart?.primaryField ?? definition?.fields?.[0]?.key ?? 'value';
    const unit = definition?.showUnit !== false ? (definition?.defaultUnit ?? '') : '';

    const extractValue = (entry: MetricEntry, fieldKey: string): number | undefined =>
        entry.values[fieldKey];

    // ── Filter entries by time range ───────────────────────────────
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

    // Sort oldest first
    const sortedEntries = [...filteredEntries].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
    );

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

    const validEntries = sortedEntries.filter(
        entry => extractValue(entry, primaryFieldKey) !== undefined
    );

    const primaryValues = validEntries
        .map(e => extractValue(e, primaryFieldKey))
        .filter((v): v is number => v !== undefined);

    const hasData = primaryValues.length > 0;

    const dataMaxValue = hasData ? Math.max(...primaryValues) : 100;

    const yAxisConfig = definition.chart.yAxis;
    const padding = yAxisConfig?.padding ?? 0.15;

    const dataMinValue = hasData ? Math.min(...primaryValues) : 0;
    const dataRange = dataMaxValue - dataMinValue || 1;
    const paddingAmount = dataRange * padding;

    const minWithPadding = yAxisConfig?.min !== undefined ? yAxisConfig.min : dataMinValue - paddingAmount;
    const maxWithPadding = yAxisConfig?.max !== undefined ? yAxisConfig.max : dataMaxValue + paddingAmount;

    const fullRange = maxWithPadding - minWithPadding || 1;
    const stepSize = getNiceStepSize(fullRange);

    const niceMin = Math.floor(minWithPadding / stepSize) * stepSize;
    const niceMax = Math.ceil(maxWithPadding / stepSize) * stepSize;
    const numSections = Math.max(1, Math.round((niceMax - niceMin) / stepSize));

    // ── X-axis labels ──────────────────────────────────────────────
    const formatXLabel = (date: Date): string => {
        switch (timeRange) {
            case 'day': return fmtTime(date);
            case 'week': return fmtWeekdayShort(date, useGerman);
            case 'month': return fmtDayMonthShort(date, useGerman);
            case 'all':
            default:
                return sortedEntries.length <= 7
                    ? fmtDayMonthShort(date, useGerman)
                    : fmtMonthYear(date, useGerman);
        }
    };

    // Show every Nth label to avoid overlap
    const barCount = validEntries.length;
    const labelStep = barCount > 25 ? 5 : barCount > 15 ? 3 : barCount > 7 ? 2 : 1;

    // ── Bar sizing ─────────────────────────────────────────────────
    // Fixed thin bar width (Apple Health style), dynamic spacing fills the rest.
    const { width: screenWidth } = useWindowDimensions();
    const initialSp = 20;
    const endSp = 20;
    // Available width: screen − container padding (15×2) − chartWrapper offset (10) − y-axis (~45)
    const availableWidth = screenWidth - 30 - 10 - 45 - initialSp - endSp;

    const BAR_WIDTH = 5;
    const barWidth = BAR_WIDTH;
    const barSpacing = barCount > 0
        ? Math.min(12, Math.max(3, Math.round((availableWidth / barCount) - BAR_WIDTH)))
        : 12;
    const barRadius = 2;

    // Slot width for the touch overlay (bar + spacing)
    const slotWidth = barWidth + barSpacing;

    // In scrollable mode the overlay can't track scroll offset,
    // so we fall back to the bars' own onPress handlers.
    const scrollable = barCount * slotWidth > availableWidth;

    // ── Bar data ───────────────────────────────────────────────────
    const barData = validEntries.map((entry, index) => ({
        value: extractValue(entry, primaryFieldKey)!,
        label: index % labelStep === 0 ? formatXLabel(entry.date) : '',
        frontColor: selectedIndex === index ? colors.accent : BAR_COLOR,
        barBorderTopLeftRadius: barRadius,
        barBorderTopRightRadius: barRadius,
        onPress: () => setSelectedIndex(prev => prev === index ? null : index),
    }));

    // ── Touch overlay ─────────────────────────────────────────────
    // Covers the entire chart area so taps in the spacing between
    // bars are forwarded to the nearest bar (Apple Health style).
    const chartRef = useRef<View>(null);
    const handleOverlayPress = useCallback((e: GestureResponderEvent) => {
        const touchX = e.nativeEvent.locationX;
        // Y-axis default width is ~35px, then initialSpacing
        const chartStartX = 35 + initialSp;
        const relativeX = touchX - chartStartX;
        if (relativeX < 0) return;
        // Offset by half the spacing so the slot boundary falls
        // in the middle of the gap between bars, not at the bar edge.
        const index = Math.floor((relativeX + barSpacing / 2) / slotWidth);
        if (index >= 0 && index < barCount) {
            setSelectedIndex(prev => prev === index ? null : index);
        }
    }, [slotWidth, barCount, initialSp]);

    // ── Display value (header updates on bar selection) ────────────
    const latestEntry = validEntries.length > 0 ? validEntries[validEntries.length - 1] : null;
    const displayEntry = selectedIndex !== null ? validEntries[selectedIndex] : latestEntry;
    const displayValue = displayEntry ? extractValue(displayEntry, primaryFieldKey) : null;

    const primaryField = definition.fields.find(f => f.key === primaryFieldKey);
    const showRange = definition?.chart?.showRange === true;
    const showLastMeasurement = definition?.chart?.showLastMeasurement === true;

    const referenceLine = showReferenceLine ? definition.chart.referenceLine : undefined;

    // ── Value formatting ───────────────────────────────────────────
    const formatValue = (value: number): string => {
        if (primaryField?.inputType === 'decimal' && primaryField.decimalPlaces !== undefined) {
            return value.toFixed(primaryField.decimalPlaces).replace('.', useGerman ? ',' : '.');
        }
        return Math.round(value).toString();
    };

    const formatDateDisplay = (date: Date): string => fmtDate(date, useGerman);

    // ── Range header data ─────────────────────────────────────────
    const rangeMin = hasData ? Math.min(...primaryValues) : null;
    const rangeMax = hasData ? Math.max(...primaryValues) : null;
    const periodStart = validEntries.length > 0 ? validEntries[0].date : null;
    const periodEnd = validEntries.length > 0 ? validEntries[validEntries.length - 1].date : null;

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

            {/* Header: Range mode or Current mode */}
            {showRange && selectedIndex === null ? (
                <>
                    <Text style={styles.label}>{t('metric.valueRange').toUpperCase()}</Text>
                    <View style={styles.valueHeader}>
                        <Text style={styles.currentValue}>
                            {rangeMin != null && rangeMax != null
                                ? `${formatValue(rangeMin)}–${formatValue(rangeMax)}`
                                : '–'}
                        </Text>
                        {unit && rangeMin != null && <Text style={styles.unit}>{unit}</Text>}
                    </View>
                    {periodStart && periodEnd && (
                        <Text style={styles.dateText}>
                            {fmtDateRangeLong(periodStart, periodEnd, useGerman)}
                        </Text>
                    )}
                </>
            ) : (
                <>
                    <Text style={styles.label}>{t('common.current').toUpperCase()}</Text>
                    <View style={styles.valueHeader}>
                        <Text style={styles.currentValue}>
                            {displayValue != null ? formatValue(displayValue) : '–'}
                        </Text>
                        {unit && displayValue != null && <Text style={styles.unit}>{unit}</Text>}
                    </View>
                    {displayEntry && (
                        <Text style={styles.dateText}>{formatDateDisplay(displayEntry.date)}</Text>
                    )}
                </>
            )}

            {/* Chart */}
            <View style={styles.chartWrapper} ref={chartRef}>
                {hasData ? (
                    <>
                        <GiftedBarChart
                            key={`bar-${timeRange}-${barData.length}`}
                            data={barData}
                            barWidth={barWidth}
                            spacing={barSpacing}
                            height={160}
                            initialSpacing={initialSp}
                            endSpacing={endSp}
                            scrollToEnd
                            scrollAnimation={false}
                            noOfSections={numSections}
                            maxValue={niceMax - niceMin}
                            yAxisOffset={niceMin}
                            yAxisTextStyle={styles.axisText}
                            xAxisLabelTextStyle={styles.axisText}
                            xAxisColor="transparent"
                            yAxisColor={colors.border}
                            yAxisThickness={StyleSheet.hairlineWidth}
                            hideRules
                            yAxisTextNumberOfLines={1}
                            formatYLabel={(label: string) => parseFloat(label).toFixed(0)}
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
                        {/* Transparent touch overlay — expands tap targets to full slot width.
                            Only for non-scrollable views; in scrollable mode it would block
                            scroll gestures and can't track the scroll offset. */}
                        {!scrollable && (
                            <Pressable
                                style={StyleSheet.absoluteFill}
                                onPress={handleOverlayPress}
                            />
                        )}
                    </>
                ) : (
                    <View style={styles.emptyChart}>
                        <Text style={styles.emptyChartText}>{t('lineChart.noData')}</Text>
                    </View>
                )}
            </View>

            {/* Last Measurement */}
            {showLastMeasurement && latestEntry && (() => {
                const lastIdx = validEntries.length - 1;
                const isLastSelected = selectedIndex === lastIdx;
                return (
                    <Pressable
                        style={[
                            styles.lastMeasurementRow,
                            isLastSelected && { backgroundColor: colors.primary },
                        ]}
                        onPress={() => setSelectedIndex(prev => prev === lastIdx ? null : lastIdx)}
                    >
                        <Text style={[styles.lastMeasurementLabel, isLastSelected && { color: '#fff' }]}>
                            {t('common.lastRecorded')}: {fmtTime(latestEntry.date)}
                        </Text>
                        <Text style={[styles.lastMeasurementValue, isLastSelected && { color: '#fff' }]}>
                            {extractValue(latestEntry, primaryFieldKey) != null
                                ? `${formatValue(extractValue(latestEntry, primaryFieldKey)!)}${unit ? unit : ''}`
                                : '–'}
                        </Text>
                    </Pressable>
                );
            })()}
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
        lastMeasurementRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: colors.background,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            marginTop: 12,
        },
        lastMeasurementLabel: {
            fontSize: 15,
            color: colors.text,
        },
        lastMeasurementValue: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
    });
