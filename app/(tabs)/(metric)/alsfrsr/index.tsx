import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Stack } from 'expo-router';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { List } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';

import { getMetricDefinition } from '@/src/metrics';
import { useMetricPreferences } from '@/src/hooks/usePatientPreferences';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useQuestionnaire, getQuestionnaireDefinition } from '@/src/questionnaires';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { on } from '@/src/lib/bus';
import { useAppTheme } from '@/src/theme';
import { green, red } from '@/src/theme/colors';
import { useDisplayMode } from '@/src/context/DisplayModeProvider';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmtDate as fmtDateFast } from '@/src/lib/formatDate';
import { useSharingFilter } from "@/src/hooks/useSharingFilter";

const FIRST_SYMPTOMS_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/first-symptoms-date';

function parseYYYYMM(str: string): Date | undefined {
    const match = str.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
        return undefined;
    }
    return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, 1);
}

function formatDate(date: Date, useGerman: boolean): string {
    return fmtDateFast(date, useGerman);
}

function getTrend(current?: number, previous?: number): 'up' | 'down' | 'stable' | undefined {
    if (current === undefined || previous === undefined) {
        return undefined;
    }
    if (current > previous) {
        return 'up';
    }
    if (current < previous) {
        return 'down';
    }
    return 'stable';
}

type ProgressRateCategory = 'slow' | 'intermediate' | 'fast';

function getProgressRateInfo(rate: number): { category: ProgressRateCategory; labelKey: string; color: string } {
    if (rate < 0.5) {
        return { category: 'slow', labelKey: 'progressRate.slowProgression', color: green };
    }
    if (rate <= 1.0) {
        return { category: 'intermediate', labelKey: 'progressRate.intermediateProgression', color: '#FF9500' };
    }
    return { category: 'fast', labelKey: 'progressRate.fastProgression', color: red };
}

function getProgressRatePosition(rate: number): number {
    if (rate <= 0) {
        return 0;
    }
    if (rate >= 2) {
        return 100;
    }
    if (rate <= 1) {
        return rate * 50;
    }
    return 50 + (rate - 1) * 50;
}

export default function ALSFRSRDetailScreen() {
    const { t, i18n } = useTranslation();
    const { colors, tokens } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();
    const definition = getMetricDefinition('alsfrs-r', i18n.language);
    const questionnaireDefinition = useMemo(
        () => getQuestionnaireDefinition('alsfrs-r', i18n.language),
        [i18n.language]
    );
    const { pinned, setPinned } = useMetricPreferences('alsfrs-r');
    const { mode, preferences, getScoreColor, getTrendDisplay } = useDisplayMode();

    const { entries: alsfrEntries, latestEntry: alsfrLatest } = useQuestionnaire({ questionnaireId: 'alsfrs-r' });
    const { get } = useFhirRepo();
    const { getOrCreateSubjectId } = useAppSync();
    const [firstSymptomsDate, setFirstSymptomsDate] = useState<Date | undefined>();
    const [isLoading, setIsLoading] = useState(true);

    // Timeline slider: 0 = newest (default), entries.length-1 = oldest
    const [selectedIndex, setSelectedIndex] = useState(0);
    const useGerman = i18n.language === 'de';

    // Load first symptoms date from Patient resource
    const loadFirstSymptomsDate = useCallback(async () => {
        try {
            const patientId = await getOrCreateSubjectId();
            const row = await get('Patient', patientId);
            if (row?.resource?.extension) {
                const ext = row.resource.extension.find(
                    (e: any) => e.url === FIRST_SYMPTOMS_EXTENSION_URL
                );
                if (ext?.valueString) {
                    setFirstSymptomsDate(parseYYYYMM(ext.valueString));
                } else {
                    setFirstSymptomsDate(undefined);
                }
            }
        }
        catch (e) {
            console.warn('Failed to load first symptoms date:', e);
        }
        finally {
            setIsLoading(false);
        }
    }, [get, getOrCreateSubjectId]);

    useEffect(() => {
        loadFirstSymptomsDate();
        const off = on('fhir:changed', loadFirstSymptomsDate);
        return () => off();
    }, [loadFirstSymptomsDate]);

    // Clamp selectedIndex when entries change
    const clampedIndex = Math.min(selectedIndex, Math.max(0, alsfrEntries.length - 1));

    // Compute ALSFRS-R stats for the selected entry
    const stats = useMemo(() => {
        const selectedEntry = alsfrEntries[clampedIndex];
        if (!selectedEntry) {
            return null;
        }

        // Compare with the next (older) entry
        const compareEntry = alsfrEntries[clampedIndex + 1] ?? null;

        const scoreChange = compareEntry
            ? selectedEntry.totalScore - compareEntry.totalScore
            : undefined;

        // Build domain data with trends
        const domains = (questionnaireDefinition?.domains ?? []).map(d => ({
            id: d.id,
            name: d.name,
            score: selectedEntry.domainScores?.[d.id] ?? 0,
            maxScore: 12,
            trend: getTrend(
                selectedEntry.domainScores?.[d.id],
                compareEntry?.domainScores?.[d.id]
            )
        }));

        // Calculate months from first symptoms to the selected entry's date
        let monthsSinceOnset: number | undefined;
        if (firstSymptomsDate) {
            const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
            monthsSinceOnset = Math.floor(
                (selectedEntry.completedAt.getTime() - firstSymptomsDate.getTime()) / msPerMonth
            );
            if (monthsSinceOnset < 0) monthsSinceOnset = undefined;
        }

        // Calculate progress rate: ΔFS = (48 - score) / months since symptom onset
        const progressRate = monthsSinceOnset && monthsSinceOnset > 0
            ? (48 - selectedEntry.totalScore) / monthsSinceOnset
            : undefined;

        return {
            totalScore: selectedEntry.totalScore,
            scoreChange,
            changePeriodDays: scoreChange !== undefined ? (questionnaireDefinition?.trendPeriodDays ?? 30) : undefined,
            domains,
            lastAssessment: formatDate(selectedEntry.completedAt, useGerman),
            progressRate,
            monthsSinceOnset,
            entryCount: alsfrEntries.length
        };
    }, [clampedIndex, alsfrEntries, firstSymptomsDate, questionnaireDefinition, useGerman]);

    if (!definition) {
        return (
            <View style={ [styles.container, styles.centered, { backgroundColor: colors.background }] }>
                <Text style={ { color: colors.textPrimary } }>{ t('metric.metricNotFound') }</Text>
            </View>
        );
    }

    if (!sharingLoaded) {
        return (
            <View style={ [styles.container, styles.loadingContainer, { backgroundColor: colors.background }] }>
                <Stack.Screen options={ { headerTitle: definition.name } } />
                <ActivityIndicator color={ colors.textSecondary } style={ styles.loadingIndicator } />
            </View>
        );
    }
    if (isFiltering && !canSeeMetric('alsfrs-r')) {
        router.back();
        return null;
    }

    if (isLoading) {
        return (
            <View style={ [styles.container, styles.loadingContainer, { backgroundColor: colors.background }] }>
                <Stack.Screen options={ { headerTitle: definition.name } } />
                <ActivityIndicator color={ colors.textSecondary } style={ styles.loadingIndicator } />
                <Text style={ [styles.loadingText, { color: colors.textHint }] }>{ t('common.loading') }</Text>
            </View>
        );
    }

    // Derived display values
    const showScore = preferences.showScores;
    const showDomains = preferences.showDomainScores && stats;
    const showChange = preferences.showScoreChanges && stats?.scoreChange !== undefined;
    const showProgressBars = preferences.showProgressBars;

    const progressInfo = stats?.progressRate !== undefined ? getProgressRateInfo(stats.progressRate) : null;
    const progressPosition = stats?.progressRate !== undefined ? getProgressRatePosition(stats.progressRate) : 0;
    const showProgress = preferences.showProgressRate && stats?.progressRate !== undefined && progressInfo;

    const totalColor = stats ? getScoreColor(stats.totalScore, 48, colors.tint) : colors.tint;

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={ {
                        headerTitle: definition.name,
                        headerRight: () => (
                            <HeaderButton
                                icon="plus"
                                variant="done"
                                onPress={() => router.push('/(tabs)/(metric)/questionnaire/alsfrs-r')}
                            />
                        )
                    } }
                />
            ) : (
                <>
                    <Stack.Screen.Title>{definition.name}</Stack.Screen.Title>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button icon="plus" variant="done" tintColor={colors.textPrimary} onPress={() => router.push('/(tabs)/(metric)/questionnaire/alsfrs-r')} />
                    </Stack.Toolbar>
                </>
            )}

            <ScrollView
                style={ { backgroundColor: colors.background } }
                contentContainerStyle={ styles.scrollView }
                contentInsetAdjustmentBehavior="automatic"
            >
                {/* Card-style Header */ }
                <View style={ [styles.heroSection, { backgroundColor: colors.listItemBackground }] }>
                        <View style={ [styles.heroWrapper,
                            {
                                // We add the insets to the padding so that the content
                                // doesn't disappear under the sidebar.
                                paddingLeft: insets.left,
                                paddingRight: insets.right
                            },
                            insets.left > 200 && { maxWidth: 940 + insets.left }
                        ] }>
                        {/* Score Row */ }
                        <View style={ [styles.scoreSection, !stats && styles.scoreSectionEmpty] }>
                            { stats ? (
                                showScore ? (
                                    <>
                                        <View style={ styles.scoreRow }>
                                            <Text style={ [styles.totalScore, { color: totalColor }] }>
                                                { stats.totalScore }
                                            </Text>
                                            <Text style={ [styles.maxScore, { color: colors.textSecondary }] }> /
                                                48</Text>
                                            { showChange && (
                                                <View
                                                    style={ [styles.changeContainer, { marginLeft: tokens.spacingMd }] }>
                                                    <AppIcon
                                                        name={ (stats.scoreChange! > 0 ? 'arrow.up' : stats.scoreChange! < 0 ? 'arrow.down' : 'minus') }
                                                        tintColor={
                                                            preferences.useSignalColors
                                                                ? (stats.scoreChange! > 0 ? green : stats.scoreChange! < 0 ? red : '#8E8E93')
                                                                : '#8E8E93'
                                                        }
                                                        size={ 12 }
                                                    />
                                                    <Text
                                                        style={ [
                                                            styles.changeText,
                                                            {
                                                                color: preferences.useSignalColors
                                                                    ? (stats.scoreChange! > 0 ? green : stats.scoreChange! < 0 ? red : '#8E8E93')
                                                                    : '#8E8E93'
                                                            }
                                                        ] }
                                                    >
                                                        { Math.abs(stats.scoreChange!) } { stats.changePeriodDays && t('alsfrsCard.changePeriod', { count: stats.changePeriodDays }) }
                                                    </Text>
                                                </View>
                                            ) }
                                        </View>
                                        <Text style={ [styles.lastAssessment, { color: colors.textHint }] }>
                                            { stats.lastAssessment }
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <View style={ styles.completedRow }>
                                            <AppIcon
                                                name="checkmark.circle.fill"
                                                tintColor={ colors.tint }
                                                size={ 24 }
                                            />
                                            <Text style={ [styles.completedText, { color: colors.text }] }>
                                                { t('alsfrsCard.recorded') }
                                            </Text>
                                        </View>
                                        <Text style={ [styles.lastAssessment, { color: colors.textHint }] }>
                                            { stats.lastAssessment }
                                        </Text>
                                    </>
                                )
                            ) : (
                                <Text style={ [styles.noDataText, { color: colors.textHint }] }>
                                    { t('common.noData') }
                                </Text>
                            ) }
                        </View>

                        {/* Domain Scores */ }
                        { showDomains && stats.domains.length > 0 && (
                            <>
                                <View style={ [styles.divider, {
                                    backgroundColor: colors.border,
                                    marginHorizontal: tokens.spacingLg
                                }] } />

                                <View style={ [styles.domainsContainer, {
                                    padding: tokens.spacingLg,
                                    gap: tokens.spacingMd
                                }] }>
                                    { stats.domains.map((domain, index) => {
                                        const maxScore = domain.maxScore;
                                        const percentage = domain.score / maxScore;
                                        const barColor = getScoreColor(domain.score, maxScore, colors.tint);
                                        const trendInfo = domain.trend ? getTrendDisplay(domain.trend) : null;

                                        return (
                                            <View key={ domain.id } style={ styles.domainRow }>
                                                <View style={ [styles.domainInfo, { gap: tokens.spacingSm }] }>
                                                    <Text style={ [styles.domainName, { color: colors.text }] }>
                                                        { domain.name }
                                                    </Text>
                                                    <Text
                                                        style={ [styles.domainScore, { color: colors.textSecondary }] }>
                                                        { domain.score }/{ maxScore }
                                                    </Text>
                                                </View>
                                                <View style={ [styles.domainRight, { gap: tokens.spacingSm }] }>
                                                    { showProgressBars && (
                                                        <View style={ [styles.progressBarBackground, {
                                                            backgroundColor: colors.border,
                                                            borderRadius: tokens.radiusSm
                                                        }] }>
                                                            <View
                                                                style={ [
                                                                    styles.progressBarFill,
                                                                    {
                                                                        backgroundColor: barColor,
                                                                        width: `${ percentage * 100 }%`,
                                                                        borderRadius: tokens.radiusSm
                                                                    }
                                                                ] }
                                                            />
                                                        </View>
                                                    ) }
                                                    { trendInfo && (
                                                        <View style={ styles.trendContainer }>
                                                            <AppIcon
                                                                name={ trendInfo.icon }
                                                                tintColor={ trendInfo.color }
                                                                size={ 10 }
                                                            />
                                                        </View>
                                                    ) }
                                                </View>
                                            </View>
                                        );
                                    }) }
                                </View>
                            </>
                        ) }

                        {/* Progress Rate */ }
                        { showProgress && (
                            <View style={ [styles.progressSection, { backgroundColor: colors.background }] }>
                                <View style={ styles.progressHeader }>
                                    <Text
                                        style={ [styles.progressTitle, { color: colors.text }] }>{ t('progressRate.title') }</Text>
                                    <Pressable onPress={ () => router.push('/(tabs)/(metric)/progressRateInfo') }
                                               hitSlop={ 12 }>
                                        <AppIcon
                                            name="questionmark.circle.fill"
                                            tintColor={ colors.textHint }
                                            size={ 20 }
                                        />
                                    </Pressable>
                                </View>

                                <View style={ styles.progressValueRow }>
                                    <Text style={ [
                                        styles.progressValue,
                                        { color: preferences.useSignalColors ? progressInfo.color : colors.text }
                                    ] }>
                                        { stats!.progressRate!.toFixed(2) }
                                    </Text>
                                    { preferences.showStatusLabels && (
                                        <Text style={ [
                                            styles.progressLabel,
                                            { color: preferences.useSignalColors ? progressInfo.color : colors.textSecondary }
                                        ] }>
                                            { t(progressInfo.labelKey) }
                                        </Text>
                                    ) }
                                </View>

                                <View style={ styles.scaleContainer }>
                                    <View style={ styles.scaleTrack }>
                                        <View style={ [
                                            styles.scaleSegment,
                                            styles.scaleSegmentSlow,
                                            { backgroundColor: preferences.useSignalColors ? green : colors.border }
                                        ] } />
                                        <View style={ [
                                            styles.scaleSegment,
                                            styles.scaleSegmentIntermediate,
                                            { backgroundColor: preferences.useSignalColors ? '#FF9500' : colors.border }
                                        ] } />
                                        <View style={ [
                                            styles.scaleSegment,
                                            styles.scaleSegmentFast,
                                            { backgroundColor: preferences.useSignalColors ? red : colors.border }
                                        ] } />
                                    </View>

                                    <View style={ [
                                        styles.scaleMarker,
                                        {
                                            left: `${ progressPosition }%`,
                                            backgroundColor: preferences.useSignalColors ? progressInfo.color : colors.tint
                                        }
                                    ] }>
                                        <View
                                            style={ [styles.scaleMarkerInner, { backgroundColor: colors.listItemBackground }] } />
                                    </View>
                                </View>

                                <View style={ styles.scaleLabels }>
                                    <Text style={ [styles.scaleLabelText, { color: colors.textHint }] }>0</Text>
                                    <Text style={ [styles.scaleLabelText, { color: colors.textHint }] }>0.5</Text>
                                    <Text style={ [styles.scaleLabelText, { color: colors.textHint }] }>1.0</Text>
                                    <Text style={ [styles.scaleLabelText, { color: colors.textHint }] }>2.0</Text>
                                </View>
                            </View>
                        ) }

                        {/* Timeline Slider */ }
                        { alsfrEntries.length > 1 && (
                            <View style={ styles.sliderSection }>
                                <View style={ [styles.divider, {
                                    backgroundColor: colors.border,
                                    marginHorizontal: tokens.spacingLg
                                }] } />
                                <View style={ styles.sliderWrapper }>
                                    <Slider
                                        style={ styles.slider }
                                        minimumValue={ 0 }
                                        maximumValue={ alsfrEntries.length - 1 }
                                        step={ 1 }
                                        value={ alsfrEntries.length - 1 - clampedIndex }
                                        onValueChange={ (v) => setSelectedIndex(alsfrEntries.length - 1 - Math.round(v)) }
                                        minimumTrackTintColor={ colors.border }
                                        maximumTrackTintColor={ colors.border }
                                        thumbTintColor={ colors.textSecondary }
                                    />
                                    <View style={ styles.sliderLabels }>
                                        <Text style={ [styles.sliderLabelText, { color: colors.textHint }] }>
                                            { formatDate(alsfrEntries[alsfrEntries.length - 1].completedAt, useGerman) }
                                        </Text>
                                        <Text style={ [styles.sliderIndexText, { color: colors.textSecondary }] }>
                                            { alsfrEntries.length - clampedIndex } / { alsfrEntries.length }
                                        </Text>
                                        <Text style={ [styles.sliderLabelText, { color: colors.textHint }] }>
                                            { formatDate(alsfrEntries[0].completedAt, useGerman) }
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ) }

                        {/* Footer: months since onset */ }
                        { stats?.monthsSinceOnset !== undefined && mode === 'clinical' && (
                            <View style={ styles.footerWrapper }>
                                <Text style={ [styles.footerText, { color: colors.textHint }] }>
                                    { t('alsfrsCard.sinceFirstSymptoms', { count: stats.monthsSinceOnset }) }
                                </Text>
                            </View>
                        ) }
                    </View>
                </View>

                <View style={ [styles.bodyWrapper,
                    {
                        // We add the insets to the padding so that the content
                        // doesn't disappear under the sidebar.
                        paddingLeft: insets.left,
                        paddingRight: insets.right
                    },
                    insets.left > 200 && { maxWidth: 940 + insets.left }
                ] }>
                    {/* Description */ }
                    <List.Section
                        title={ definition.descriptionTitle }
                        titleStyle={ [styles.sectionTitle, { color: colors.textPrimary }] }
                        rounded
                    >
                        <List.Item title={ definition.description } titleNumberOfLines={ 99 } />
                    </List.Section>

                    {/* Pin to Overview */ }
                    <List.Section rounded>
                        <List.Item
                            title={t('metric.pinToOverview')}
                            hideChevron
                            lastItem
                            rightCmp={
                                <Switch value={ pinned } onValueChange={ setPinned } />
                            }
                        />
                    </List.Section>

                    {/* No Data Hint */ }
                    { !stats && (
                        <List.Section rounded>
                            <List.Item
                                title={t('alsfrsCard.fillQuestionnaire')}
                                subtitle={t('alsfrsCard.fillQuestionnaireHint')}
                                subtitleNumberOfLines={ 3 }
                                leftCmp={
                                    <AppIcon
                                        name="plus.circle.fill"
                                        tintColor={ colors.tint }
                                        size={ 24 }
                                    />
                                }
                                onPress={ () => router.push('/(tabs)/(metric)/questionnaire/alsfrs-r') }
                                lastItem
                            />
                        </List.Section>
                    ) }

                    {/* History & Access */ }
                    <List.Section rounded>
                        { alsfrEntries.length > 0 && (
                            <List.Item
                                title={t('alsfrsCard.showHistory')}
                                subtitle={t('alsfrsCard.entryCount', { count: alsfrEntries.length })}
                                onPress={ () => router.push('/(tabs)/(metric)/alsfrsr/list') }
                            />
                        ) }
                        { !isFiltering && (
                            <List.Item
                                title={ t('metric.metricAccess') }
                                onPress={ () => router.push('/(tabs)/(metric)/alsfrs-r/access') }
                                lastItem
                            />
                        ) }
                    </List.Section>

                    {/* Disclaimer */ }
                    <List.Wrapper>
                        <List.Text align="center">
                            {t('alsfrsCard.detailsDisclaimer')}
                        </List.Text>
                    </List.Wrapper>

                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        flex: 1,
        paddingTop: 20,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    container: {
        flex: 1
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100
    },
    loadingIndicator: {
        marginBottom: 16
    },
    loadingText: {
        fontSize: 16
    },
    content: {
        paddingBottom: 40
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600'
    },

    // Card-style header
    heroSection: {
        paddingTop: 12,
        paddingBottom: 12,
        minHeight: 220
    },
    heroWrapper: {
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingRight: 10,
        overflow: 'hidden'
    },
    iconContainer: {
        width: 26,
        height: 26,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 13.8,
        fontWeight: '700',
        letterSpacing: -0.4,
        flex: 1
    },
    // Score
    scoreSection: {
        paddingHorizontal: 14,
        paddingVertical: 10
    },
    scoreSectionEmpty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'baseline'
    },
    totalScore: {
        fontSize: 32,
        fontWeight: '700'
    },
    maxScore: {
        fontSize: 16,
        fontWeight: '600'
    },
    changeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    changeText: {
        fontSize: 12
    },
    completedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    completedText: {
        fontSize: 18,
        fontWeight: '600'
    },
    lastAssessment: {
        fontSize: 12,
        marginTop: 4
    },
    noDataText: {
        fontSize: 18,
        fontWeight: '600'
    },

    // Domains
    divider: {
        height: StyleSheet.hairlineWidth
    },
    domainsContainer: {},
    domainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    domainInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center'
    },
    domainName: {
        fontSize: 13.5,
        fontWeight: '500',
        minWidth: 120
    },
    domainScore: {
        fontSize: 12,
        textAlign: 'right',
        marginRight: 20,
        flex: 1
    },
    domainRight: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: '40%'
    },
    progressBarBackground: {
        flex: 1,
        height: 6,
        overflow: 'hidden'
    },
    progressBarFill: {
        height: '100%'
    },
    trendContainer: {
        width: 16,
        alignItems: 'center'
    },

    // Progress Rate
    progressSection: {
        marginHorizontal: 14,
        marginBottom: 14,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 8,
        gap: 8
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    progressTitle: {
        fontSize: 13,
        fontWeight: '600'
    },
    progressValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8
    },
    progressValue: {
        fontSize: 24,
        fontWeight: '700'
    },
    progressLabel: {
        fontSize: 12,
        fontWeight: '500'
    },
    scaleContainer: {
        height: 10,
        position: 'relative',
        justifyContent: 'center'
    },
    scaleTrack: {
        flexDirection: 'row',
        height: 3,
        borderRadius: 3,
        overflow: 'hidden'
    },
    scaleSegment: {
        height: '100%'
    },
    scaleSegmentSlow: {
        flex: 25
    },
    scaleSegmentIntermediate: {
        flex: 25
    },
    scaleSegmentFast: {
        flex: 50
    },
    scaleMarker: {
        position: 'absolute',
        width: 16,
        height: 16,
        borderRadius: 8,
        marginLeft: -8,
        alignItems: 'center',
        justifyContent: 'center'
    },
    scaleMarkerInner: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    scaleLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    scaleLabelText: {
        fontSize: 10
    },

    // Timeline Slider
    sliderSection: {
        paddingTop: 4
    },
    sliderWrapper: {
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 4
    },
    slider: {
        width: '100%',
        height: 32
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    sliderLabelText: {
        fontSize: 10
    },
    sliderIndexText: {
        fontSize: 11,
        fontWeight: '600'
    },

    // Footer
    footerWrapper: {
        paddingHorizontal: 14,
        paddingBottom: 12,
        gap: 2
    },
    footerText: {
        fontSize: 12
    }
});
