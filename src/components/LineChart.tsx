import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, useColorScheme } from 'react-native';
import { LineChart as GiftedLineChart } from 'react-native-gifted-charts';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useTranslation } from 'react-i18next';
import { AppColors, useAppTheme } from "@/src/theme";
import type { MetricDefinition, MetricEntry } from '@/src/metrics/types';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { fmtTime, fmtWeekdayShort, fmtDayMonthShort, fmtMonthYear, fmtDate } from '@/src/lib/formatDate';

type TimeRange = 'day' | 'week' | 'month' | 'all';

type LineChartProps = {
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

export function LineChart({
    entries = [],
    definition,
    timeRange: initialTimeRange = 'month',
    periodStart,
    periodEnd,
    showReferenceLine = true,
}: LineChartProps) {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const colorScheme = useColorScheme();
    const styles = createStyles(colors);
    const useGerman = i18n.language === 'de';
    const timeRangeOptions = useMemo(
        () => [
            { label: t('lineChart.day'), value: 'day' as const },
            { label: t('lineChart.week'), value: 'week' as const },
            { label: t('lineChart.month'), value: 'month' as const },
            { label: t('lineChart.all'), value: 'all' as const },
        ],
        [t]
    );

    // Time range state — default to month, auto-switch to 'all' if <=1 data point
    const defaultIndex = timeRangeOptions.findIndex(o => o.value === initialTimeRange);
    const [selectedRangeIndex, setSelectedRangeIndex] = useState(defaultIndex >= 0 ? defaultIndex : timeRangeOptions.length - 1);
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

    // Determine which field(s) to display
    const primaryFieldKey = definition?.chart?.primaryField ?? definition?.fields?.[0]?.key ?? 'value';
    const secondaryFieldKey = definition?.chart?.secondaryField;
    const unit = definition?.showUnit !== false ? (definition?.defaultUnit ?? '') : '';

    // Extract values from entries for primary field
    const extractValue = (entry: MetricEntry, fieldKey: string): number | undefined => {
        return entry.values[fieldKey];
    };

    // Filter entries by time range
    const filteredEntries = useMemo(() => {
        if (!entries || entries.length === 0) {
            return [];
        }

        const now = new Date();
        let cutoffDate: Date;

        switch (timeRange) {
            case 'day':
                cutoffDate = new Date(now);
                cutoffDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                cutoffDate = new Date(now);
                cutoffDate.setDate(cutoffDate.getDate() - 7);
                break;
            case 'month':
                cutoffDate = new Date(now);
                cutoffDate.setMonth(cutoffDate.getMonth() - 1);
                break;
            case 'all':
            default:
                return entries;
        }

        return entries.filter(entry => entry.date >= cutoffDate);
    }, [entries, timeRange]);

    // Sort entries by date (oldest first for chart)
    const sortedEntries = [...filteredEntries].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
    );

    const getNiceStepSize = (range: number, targetSteps: number = 4): number => {
        if (range === 0) {
            return 10;
        }
        const roughStep = range / targetSteps;
        const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
        const normalized = roughStep / magnitude;
        let niceStep: number;
        if (normalized <= 1) {
            niceStep = 1;
        } else if (normalized <= 2) {
            niceStep = 2;
        } else if (normalized <= 5) {
            niceStep = 5;
        } else {
            niceStep = 10;
        }
        return niceStep * magnitude;
    };

    // Get all primary values
    const primaryValues = sortedEntries
        .map((e) => extractValue(e, primaryFieldKey))
        .filter((v): v is number => v !== undefined);

    const hasData = primaryValues.length > 0;

    // Get secondary values if defined
    const secondaryValues = secondaryFieldKey && hasData
        ? sortedEntries.map((e) => extractValue(e, secondaryFieldKey)).filter((v): v is number => v !== undefined)
        : [];

    // Combine for min/max calculation
    const allValues = [...primaryValues, ...secondaryValues];
    const dataMinValue = allValues.length > 0 ? Math.min(...allValues) : 0;
    const dataMaxValue = allValues.length > 0 ? Math.max(...allValues) : 100;

    // Get Y-axis configuration from definition
    const yAxisConfig = definition.chart.yAxis;
    const padding = yAxisConfig?.padding ?? 0.15; // Default 15% padding

    // Calculate range with padding — at least 2 units so narrow ranges stay readable
    const dataRange = dataMaxValue - dataMinValue || 1;
    const paddingAmount = Math.max(dataRange * padding, 2);

    // Data-driven range, clamped to config boundaries when set
    const rawMin = dataMinValue - paddingAmount;
    const rawMax = dataMaxValue + paddingAmount;
    const minWithPadding = yAxisConfig?.min !== undefined ? Math.max(yAxisConfig.min, rawMin) : rawMin;
    const maxWithPadding = yAxisConfig?.max !== undefined ? Math.min(yAxisConfig.max, rawMax) : rawMax;

    // Calculate nice step size based on the full range
    const fullRange = maxWithPadding - minWithPadding || 1;
    const stepSize = getNiceStepSize(fullRange);

    // Round to nice values
    const niceMin = Math.floor(minWithPadding / stepSize) * stepSize;
    const niceMax = Math.ceil(maxWithPadding / stepSize) * stepSize;
    const numSections = Math.max(1, Math.round((niceMax - niceMin) / stepSize));

    const formatXLabel = (date: Date): string => {
        switch (timeRange) {
            case 'day':
                return fmtTime(date);
            case 'week':
                return fmtWeekdayShort(date, useGerman);
            case 'month':
                return fmtDayMonthShort(date, useGerman);
            case 'all':
            default:
                if (sortedEntries.length <= 7) {
                    return fmtDayMonthShort(date, useGerman);
                }
                return fmtMonthYear(date, useGerman);
        }
    };

    // Filter entries that have valid primary field values
    const validEntries = sortedEntries.filter((entry) => {
        const value = extractValue(entry, primaryFieldKey);
        return value !== undefined;
    });

    // Generate chart data for primary field
    const primaryChartData = validEntries.map((entry) => {
        const value = extractValue(entry, primaryFieldKey)!;
        return {
            value,
            label: formatXLabel(entry.date),
            date: entry.date,
        };
    });

    // Generate chart data for secondary field (if exists)
    const secondaryChartData = secondaryFieldKey
        ? validEntries.map((entry) => {
            const value = extractValue(entry, secondaryFieldKey);
            return {
                value: value ?? 0,
                label: formatXLabel(entry.date),
                date: entry.date,
            };
        })
        : null;

    // Get field labels for legend
    const primaryField = definition.fields.find((f) => f.key === primaryFieldKey);
    const secondaryField = secondaryFieldKey
        ? definition.fields.find((f) => f.key === secondaryFieldKey)
        : null;
    const showCombinedHeaderValue = definition.id === 'blood_pressure' && !!secondaryField;

    // Reference line from definition
    const referenceLine = showReferenceLine ? definition.chart.referenceLine : undefined;

    // Get latest entry (entries are sorted oldest first, so last one is newest)
    const latestEntry = validEntries.length > 0 ? validEntries[validEntries.length - 1] : null;
    const latestValue = latestEntry ? extractValue(latestEntry, primaryFieldKey) : null;
    const latestSecondaryValue = latestEntry && secondaryFieldKey ? extractValue(latestEntry, secondaryFieldKey) : null;

    // Format value for display
    const formatValue = (value: number, field = primaryField): string => {
        if (field?.inputType === 'decimal' && field.decimalPlaces !== undefined) {
            return value.toFixed(field.decimalPlaces).replace('.', useGerman ? ',' : '.');
        }
        return Math.round(value).toString();
    };

    const formatCombinedValue = (
        primaryValue: number | null | undefined,
        secondaryValue: number | null | undefined
    ): string => {
        if (primaryValue == null) return '–';
        if (!showCombinedHeaderValue || !secondaryField || secondaryValue == null) {
            return formatValue(primaryValue, primaryField);
        }
        return `${formatValue(primaryValue, primaryField)}/${formatValue(secondaryValue, secondaryField)}`;
    };

    // Format date for display
    const formatDateDisplay = (date: Date): string => {
        return fmtDate(date, useGerman);
    };

    // Guard for missing definition
    if (!definition) {
        return null;
    }

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

            {/* Current Value */}
            <Text style={styles.label}>{t('common.current').toUpperCase()}</Text>
            <View style={styles.valueHeader}>
                <Text style={styles.currentValue}>
                    {formatCombinedValue(latestValue, latestSecondaryValue)}
                </Text>
                {unit && latestValue != null && <Text style={styles.unit}>{unit}</Text>}
            </View>
            {latestEntry && (
                <Text style={styles.dateText}>{formatDateDisplay(latestEntry.date)}</Text>
            )}


            {/* Legend for multi-value metrics */}
            {secondaryField && (
                <View style={styles.legend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                        <Text style={styles.legendText}>{primaryField?.label}</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: colors.tint }]} />
                        <Text style={styles.legendText}>{secondaryField.label}</Text>
                    </View>
                </View>
            )}

            <View style={styles.chartWrapper}>
                {hasData ? (
                    <GiftedLineChart
                        key={`chart-${timeRange}-${primaryChartData.length}`}
                        data={primaryChartData}
                        data2={secondaryChartData ?? undefined}
                        height={160}
                        spacing={primaryChartData.length > 10 ? 30 : primaryChartData.length > 6 ? 40 : 60}
                        initialSpacing={20}
                        endSpacing={20}
                        scrollToEnd
                        scrollAnimation={false}
                        color={definition.chart.type === 'scatter' ? 'transparent' : colors.accent}
                        color2={definition.chart.type === 'scatter' ? 'transparent' : colors.tint}
                        thickness={definition.chart.type === 'scatter' ? 0 : 2}
                        dataPointsColor={colors.accent}
                        dataPointsColor2={colors.tint}
                        dataPointsRadius={5}
                        curved={definition.chart.type !== 'scatter' && primaryChartData.length > 1}
                        animateOnDataChange={false}
                        animationDuration={0}
                        hideRules
                        yAxisTextStyle={styles.axisText}
                        xAxisLabelTextStyle={styles.axisText}
                        xAxisColor="transparent"
                        yAxisColor={colors.border}
                        yAxisThickness={StyleSheet.hairlineWidth}
                        noOfSections={numSections}
                        maxValue={niceMax - niceMin}
                        yAxisOffset={niceMin}
                        yAxisTextNumberOfLines={1}
                        formatYLabel={(label: string) => parseFloat(label).toFixed(0)}
                        showVerticalLines
                        verticalLinesColor={colors.border}
                        verticalLinesThickness={StyleSheet.hairlineWidth}
                        rulesColor={colors.border}
                        rulesType="solid"
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
                        pointerConfig={{
                            showPointerStrip: true,
                            persistPointer: true,
                            autoAdjustPointerLabelPosition: true,
                            pointerStripHeight: 160,
                            pointerStripColor: colors.textHint,
                            pointerStripWidth: 1,
                            pointerColor: colors.accent,
                            radius: 6,
                            pointerLabelWidth: 100,
                            pointerLabelHeight: secondaryChartData ? 60 : 36,
                            activatePointersDelay: 50,
                            pointerLabelComponent: (items: { value: number | undefined }[]) => {
                                const primaryValue = items[0]?.value;
                                const secondaryValue = items[1]?.value;

                                if (primaryValue == null) return null;

                                return (
                                    <View style={styles.pointerLabel}>
                                        <View style={styles.pointerRow}>
                                            {secondaryChartData && (
                                                <View style={[styles.pointerDot, { backgroundColor: colors.accent }]} />
                                            )}
                                            <Text style={styles.pointerValue}>{formatValue(primaryValue)}</Text>
                                            {!secondaryChartData && unit && (
                                                <Text style={styles.pointerUnit}>{unit}</Text>
                                            )}
                                        </View>
                                        {secondaryValue != null && (
                                            <View style={styles.pointerRow}>
                                                <View style={[styles.pointerDot, { backgroundColor: colors.tint }]} />
                                                <Text style={styles.pointerValue}>{formatValue(secondaryValue)}</Text>
                                            </View>
                                        )}
                                        {secondaryChartData && unit && (
                                            <Text style={styles.pointerUnit}>{unit}</Text>
                                        )}
                                    </View>
                                );
                            },
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
        legend: {
            flexDirection: 'row',
            gap: 16,
            marginBottom: 8,
        },
        legendItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        legendDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        legendText: {
            fontSize: 12,
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
        pointerLabel: {
            backgroundColor: colors.surface,
            padding: 6,
            borderRadius: 4,
        },
        pointerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        pointerDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
        },
        pointerValue: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        pointerUnit: {
            fontSize: 12,
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
