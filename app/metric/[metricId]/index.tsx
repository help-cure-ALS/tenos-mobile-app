import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { List, useTheme } from 'react-native-nice-ui';
import { MetricChart } from '@/src/components/MetricChart';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { MetricValueDisplay, useMetric, getValueLabel } from '@/src/metrics';
import { fmtDateTime } from '@/src/lib/formatDate';
import { useMetricPreferences } from '@/src/hooks/usePatientPreferences';
import { useDisplayMode } from '@/src/context/DisplayModeProvider';
import React from "react";
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useMetricBasePath } from '@/src/hooks/useMetricBasePath';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharingFilter } from "@/src/hooks/useSharingFilter";

export default function MetricDetail() {
    const { t, i18n } = useTranslation();
    const { colors } = useTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { metricId } = useLocalSearchParams<{ metricId: string }>();
    const basePath = useMetricBasePath(metricId);

    const {
        definition,
        displayDefinition,
        displayEntries,
        latestDisplayEntry,
        displayStats,
        displayUnit,
    } = useMetric({
        metricId,
        mode: 'full',
    });
    const { pinned, setPinned } = useMetricPreferences(metricId);
    const { mode } = useDisplayMode();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();

    if (!sharingLoaded) {
        return <View style={ [styles.centered, { backgroundColor: colors.background }] }><ActivityIndicator /></View>;
    }
    if (isFiltering && !canSeeMetric(metricId)) {
        router.back();
        return null;
    }

    if (!definition || !displayDefinition) {
        return (
            <View
                style={ [
                    styles.centered,
                    { backgroundColor: colors.background }
                ] }
            >
                <Text style={ { color: colors.textPrimary } }>
                    { t('metric.metricNotFound') }
                </Text>
            </View>
        );
    }

    // Format date for list items
    const formatDate = (date: Date): string => {
        return fmtDateTime(date, i18n.language === 'de');
    };

    // Whether to show unit
    const showUnit = displayDefinition.showUnit !== false;

    // Format value based on field definition
    const formatValue = (
        values: Record<string, number>,
        unit: string
    ): string => {
        const unitSuffix = showUnit ? ` ${ unit }` : '';
        if (displayDefinition.fields.length === 1) {
            const field = displayDefinition.fields[0];
            const value = values[field.key];

            // If field has value labels, use the label
            const label = getValueLabel(field, value);
            if (label) {
                return label;
            }

            if (field.inputType === 'decimal' && field.decimalPlaces !== undefined) {
                const decimalSep = i18n.language === 'de' ? ',' : '.';
                return `${ value.toFixed(field.decimalPlaces).replace('.', decimalSep) }${ unitSuffix }`;
            }
            return `${ Math.round(value) }${ unitSuffix }`;
        }

        // Multi-value (e.g., blood pressure)
        const decimalSep = i18n.language === 'de' ? ',' : '.';
        return displayDefinition.fields
            .map((field) => {
                const value = values[field.key];
                const label = getValueLabel(field, value);
                if (label) return label;
                if (field.inputType === 'decimal' && field.decimalPlaces !== undefined) {
                    return value.toFixed(field.decimalPlaces).replace('.', decimalSep);
                }
                return `${ Math.round(value) }`;
            })
            .join('/') + unitSuffix;
    };

    return (
        <>
            {
                Platform.OS === 'android' ? (
                    <Stack.Screen
                        options={ {
                            headerTitle: displayDefinition.name,
                            headerRight: () => (
                                <HeaderButton
                                    title={t('shared.save')}
                                    onPress={() => router.push(`${basePath}/add` as any)}
                                    icon="plus"
                                    variant="done"
                                />
                            )
                        } }
                    />
                ) : (
                    <>
                        <Stack.Screen.Title>{ displayDefinition.name }</Stack.Screen.Title>
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="plus" variant="done" tintColor={colors.textPrimary} onPress={() => router.push(`${basePath}/add` as any)} />
                        </Stack.Toolbar>
                    </>
                )
            }




            <ScrollView
                style={{ backgroundColor: colors.background }}
                contentContainerStyle={ styles.scrollView }
                contentInsetAdjustmentBehavior="automatic"
            >

                    { displayDefinition.chart.showChart !== false && (

                            <View style={ [styles.chartSection,
                                {
                                    // We add the insets to the padding so that the content
                                    // doesn't disappear under the sidebar.
                                    paddingLeft: insets.left,
                                    paddingRight: insets.right
                                }
                            ] }>
                            <MetricChart
                                entries={ displayEntries }
                                definition={ displayDefinition }
                            />
                        </View>
                    ) }
                <View style={ [styles.centered,
                    {
                        // We add the insets to the padding so that the content
                        // doesn't disappear under the sidebar.
                        paddingLeft: insets.left,
                        paddingRight: insets.right
                    },
                    insets.left > 200 && { maxWidth: 940 + insets.left }
                ] }>
                    { latestDisplayEntry && displayDefinition.chart.showChart === false && (
                        <List.Wrapper>
                            <View
                                style={ [
                                    styles.currentValueCard,
                                    { backgroundColor: colors.listItemBackground }
                                ] }
                            >
                                <Text
                                    style={ [
                                        styles.currentValueLabel,
                                        { color: colors.textHint }
                                    ] }
                                >
                                    { t('metric.currentValue') }
                                </Text>
                                <MetricValueDisplay
                                    definition={ displayDefinition }
                                    entry={ latestDisplayEntry }
                                    showTrend
                                    trend={ displayStats?.trend }
                                />
                                <Text
                                    style={ [
                                        styles.currentValueDate,
                                        { color: colors.textHint }
                                    ] }
                                >
                                    { formatDate(latestDisplayEntry.date) }
                                </Text>
                            </View>


                        </List.Wrapper>
                    ) }

                    {/* Stats Summary (clinical mode only) */ }
                    { mode === 'clinical' && displayStats && displayEntries.length > 1 && (
                        <List.Section title={ t('metric.statistics') }
                                      titleStyle={ [styles.sectionTitle, { color: colors.textPrimary }] }
                                      rounded>
                            <List.Item
                                title={ t('metric.measurementCount') }
                                rightTitle={ String(displayStats.count) }
                                hideChevron
                                lastItem={ displayStats.average === null && (displayStats.min === null || displayStats.max === null) }
                            />
                            { displayStats.average !== null && (() => {
                                const field = displayDefinition.fields[0];
                                const roundedAvg = Math.round(displayStats.average);
                                const label = getValueLabel(field, roundedAvg);
                                const decimalSep = i18n.language === 'de' ? ',' : '.';
                                const displayValue = label
                                    ? `${ label } (Ø ${ displayStats.average.toFixed(1).replace('.', decimalSep) })`
                                    : `${ displayStats.average.toFixed(1).replace('.', decimalSep) }${ showUnit ? ` ${ displayDefinition.defaultUnit }` : '' }`;
                                return (
                                    <List.Item
                                        title={ t('metric.average') }
                                        rightTitle={ displayValue }
                                        hideChevron
                                        lastItem={ displayStats.min === null || displayStats.max === null }
                                    />
                                );
                            })() }
                            { displayStats.min !== null && displayStats.max !== null && (() => {
                                const decimalSep = i18n.language === 'de' ? ',' : '.';
                                return (
                                    <List.Item
                                        title={ t('metric.valueRange') }
                                        rightTitle={ `${ displayStats.min.toFixed(1).replace('.', decimalSep) } – ${ displayStats.max.toFixed(1).replace('.', decimalSep) }${ showUnit ? ` ${ displayDefinition.defaultUnit }` : '' }` }
                                        hideChevron
                                        lastItem
                                    />
                                );
                            })() }
                        </List.Section>
                    ) }

                    <List.Section title={ displayDefinition.descriptionTitle }
                                  titleStyle={ [styles.sectionTitle, { color: colors.textPrimary }] } rounded>
                        <List.Item
                            title={ displayDefinition.description }
                            titleNumberOfLines={ 99 }
                        />
                    </List.Section>

                    { displayDefinition.canPin && (
                        <List.Section rounded>
                            <List.Item
                                title={ t('metric.pinToOverview') }
                                hideChevron
                                lastItem
                                rightCmp={
                                    <Switch
                                        value={ pinned }
                                        onValueChange={ setPinned }
                                    />
                                }
                            />
                        </List.Section>
                    ) }

                    <List.Section rounded>
                        <List.Item
                            title={ t('metric.showAllData') }
                            onPress={ () => router.push(`${basePath}/list` as any) }
                        />
                        { !isFiltering && (
                            <List.Item
                                title={ t('metric.metricAccess') }
                                onPress={ () => router.push(`${basePath}/access` as any) }
                                lastItem={ !showUnit }
                            />
                        ) }
                        { showUnit && (
                            displayDefinition.availableUnits && displayDefinition.availableUnits.length > 1 ? (
                                <List.Item
                                    title={ t('metric.unit') }
                                    rightTitle={ displayUnit ?? displayDefinition.defaultUnit }
                                    onPress={ () => router.push(`${basePath}/unit` as any) }
                                    lastItem
                                />
                            ) : (
                                <List.Item
                                    title={ t('metric.unit') }
                                    rightTitle={ displayDefinition.defaultUnit }
                                    hideChevron
                                    lastItem
                                />
                            )
                        ) }
                    </List.Section>
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        paddingTop: 20,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%',
    },
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    chartSection: {},
    currentValueCard: {
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 24
    },
    currentValueLabel: {
        fontSize: 14,
        marginBottom: 8
    },
    currentValueDate: {
        fontSize: 13,
        marginTop: 8
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 50,
        borderRadius: 12,
        marginTop: 16
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600'
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600'
    },
    historyContainer: {
        minHeight: 300
    },
    historyList: {
        overflow: 'hidden'
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14
    },
    historyItemContent: {
        flex: 1
    },
    historyValue: {
        fontSize: 17,
        fontWeight: '500',
        fontVariant: ['tabular-nums']
    },
    historyDate: {
        fontSize: 13,
        marginTop: 2
    },
    historySource: {
        fontSize: 12
    },
    emptyState: {
        padding: 40,
        borderRadius: 12,
        alignItems: 'center'
    },
    emptyStateText: {
        fontSize: 16,
        fontWeight: '500',
        marginTop: 16
    },
    emptyStateSubtext: {
        fontSize: 14,
        marginTop: 4
    }
});
