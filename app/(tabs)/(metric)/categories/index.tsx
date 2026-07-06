import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageBackground, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { List, Text } from 'react-native-nice-ui';
import { getMetricsByAppCategory, MetricCard, useMetric } from '@/src/metrics';
import { metricCategoryInfos, type MetricCategory } from '@/src/metrics/types';
import { ALSFRSCard, type ALSFRSDomain } from '@/src/components/ui/ALSFRSCard';
import { TDEECard } from '@/src/components/ui/TDEECard';
import { ALSGeneticBackgroundCard } from '@/src/questionnaires/structured/alsGeneticBackground/components/ALSGeneticBackgroundCard';
import { ALSKingsStageCard } from '@/src/questionnaires/structured/alsKingsStage/components/ALSKingsStageCard';
import { ALSSubtypeCard } from '@/src/questionnaires/structured/alsSubtype/components/ALSSubtypeCard';
import { NeurologicalExamSummaryCard } from '@/src/questionnaires/structured/neurologicalExam/components/NeurologicalExamSummaryCard';
import { useQuestionnaire } from '@/src/questionnaires';
import { getDefinition as getAlsfrsrDefinition } from '@/src/questionnaires/definitions/alsfrs-r';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { on } from '@/src/lib/bus';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmtDate } from '@/src/lib/formatDate';
import { SectionTitle } from "@/src/components/ui/SectionTitle";
import { useSharingFilter } from "@/src/hooks/useSharingFilter";

export default function CategoriesScreen() {
    const { colors, isDark } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { t, i18n } = useTranslation();
    const { isFiltering, isLoaded: sharingLoaded, filterMetrics } = useSharingFilter();

    return (
        <>
            <Stack.Screen
                options={ {
                    headerTitle: t('metric.allCategories'),
                    headerLargeTitle: false
                } }
            />
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') }
                             style={ [{ flex: 1 }, { backgroundColor: colors.background }] }>
                <ScrollView
                    style={ { flex: 1 } }
                    contentContainerStyle={ styles.scrollView }
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <View style={ [styles.bodyWrapper,
                        {
                            // We add the insets to the padding so that the content
                            // doesn't disappear under the sidebar.
                            paddingLeft: insets.left,
                            paddingRight: insets.right
                        },
                        insets.left > 200 && { maxWidth: 940 + insets.left }
                    ] }>

                        { (() => {
                            const categoryGroups = metricCategoryInfos
                                .map((category) => ({
                                    category,
                                    metrics: filterMetrics(getMetricsByAppCategory(category.id, i18n.language))
                                }))
                                .filter(g => g.metrics.length > 0);

                            if (isFiltering && sharingLoaded && categoryGroups.length === 0) {
                                return (
                                    <View style={ styles.noAccessContainer }>
                                        <Text variant="bodyMedium" color="hint" style={ { textAlign: 'center' } }>
                                            { t('metric.noAccessHint') }
                                        </Text>
                                    </View>
                                );
                            }

                            return categoryGroups.map(({ category, metrics }) => (
                                <View key={ category.id }>

                                    <List.Wrapper>
                                        <SectionTitle title={ t(`categories.${ category.id }`) } />
                                    </List.Wrapper>

                                    <List.Wrapper>
                                        <View style={ styles.cardList }>
                                            { metrics.map((definition) => {
                                                if (definition.computed) {
                                                    if (definition.id === 'alsfrs-r') {
                                                        return (
                                                            <ALSFRSCardWrapper
                                                                key={ definition.id }
                                                                onPress={ () => router.push('/(tabs)/(metric)/alsfrsr') }
                                                                onProgressInfoPress={ () => router.push('/(tabs)/(metric)/progressRateInfo') }
                                                            />
                                                        );
                                                    }
                                                    if (definition.id === 'tdee') {
                                                        return (
                                                            <TDEECard
                                                                key={ definition.id }
                                                                onPress={ () => router.push('/(tabs)/(metric)/tdee') }
                                                                onMissingDataPress={ () => router.push('/settings/profile') }
                                                                onMissingALSFRSPress={ () => router.push('/(tabs)/(metric)/questionnaire/alsfrs-r') }
                                                            />
                                                        );
                                                    }
                                                    if (definition.id === 'als_subtype') {
                                                        return (
                                                            <ALSSubtypeCard
                                                                key={ definition.id }
                                                                onPress={ () => router.push('/(tabs)/(metric)/alsSubtype') }
                                                            />
                                                        );
                                                    }
                                                    if (definition.id === 'als_neurological_exam') {
                                                        return (
                                                            <NeurologicalExamSummaryCard
                                                                key={ definition.id }
                                                                onPress={ () => router.push('/(tabs)/(metric)/neurologicalExam') }
                                                            />
                                                        );
                                                    }
                                                    if (definition.id === 'als_kings_stage') {
                                                        return (
                                                            <ALSKingsStageCard
                                                                key={ definition.id }
                                                                onPress={ () => router.push('/(tabs)/(metric)/alsKingsStage') }
                                                            />
                                                        );
                                                    }
                                                    if (definition.id === 'als_genetic_background') {
                                                        return (
                                                            <ALSGeneticBackgroundCard
                                                                key={ definition.id }
                                                                onPress={ () => router.push('/(tabs)/(metric)/alsGeneticBackground') }
                                                            />
                                                        );
                                                    }
                                                    return null;
                                                }

                                                return (
                                                    <MetricCardWrapper
                                                        key={ definition.id }
                                                        metricId={ definition.id }
                                                        onPress={ () => router.push(`/(tabs)/(metric)/${ definition.id }`) }
                                                    />
                                                );
                                            }) }
                                        </View>
                                    </List.Wrapper>
                                </View>
                            ));
                        })() }
                    </View>
                </ScrollView>
            </ImageBackground>
        </>
    );
}

function MetricCardWrapper({ metricId, onPress }: { metricId: string; onPress: () => void }) {
    const { displayDefinition, latestDisplayEntry, entryCount, displayStats } = useMetric({ metricId });
    if (!displayDefinition) {
        return null;
    }

    return (
        <MetricCard
            definition={ displayDefinition }
            latestEntry={ latestDisplayEntry }
            trend={ displayStats?.trend }
            changeFromPrevious={ displayStats?.changeFromPrevious }
            entryCount={ entryCount }
            onPress={ onPress }
        />
    );
}

// =============================================================================
// ALSFRS-R Helpers (same as [categoryId].tsx)
// =============================================================================

const FIRST_SYMPTOMS_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/first-symptoms-date';

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

function formatDateLocal(date: Date, language: string): string {
    return fmtDate(date, language === 'de');
}

function parseYYYYMM(str: string): Date | undefined {
    const match = str.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
        return undefined;
    }
    return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, 1);
}

function ALSFRSCardWrapper({
                               onPress,
                               onProgressInfoPress
                           }: {
    onPress: () => void;
    onProgressInfoPress: () => void;
}) {
    const { t, i18n } = useTranslation();
    const alsfrsrDef = useMemo(() => getAlsfrsrDefinition(i18n.language), [i18n.language]);
    const { entries: alsfrEntries, latestEntry: alsfrLatest } = useQuestionnaire({ questionnaireId: 'alsfrs-r' });
    const { get } = useFhirRepo();
    const { getOrCreateSubjectId } = useAppSync();
    const [firstSymptomsDate, setFirstSymptomsDate] = useState<Date | undefined>();

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
    }, [get, getOrCreateSubjectId]);

    useEffect(() => {
        loadFirstSymptomsDate();
        const off = on('fhir:changed', loadFirstSymptomsDate);
        return () => off();
    }, [loadFirstSymptomsDate]);

    const alsfrStats = useMemo(() => {
        if (!alsfrLatest) {
            return null;
        }

        const trendPeriodMs = (alsfrsrDef.trendPeriodDays ?? 30) * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(alsfrLatest.completedAt.getTime() - trendPeriodMs);

        const compareEntry = alsfrEntries.find(e =>
            e.id !== alsfrLatest.id && e.completedAt <= cutoffDate
        );

        const scoreChange = compareEntry
            ? alsfrLatest.totalScore - compareEntry.totalScore
            : undefined;

        const domains: ALSFRSDomain[] = alsfrsrDef.domains.map(d => ({
            name: d.name,
            score: alsfrLatest.domainScores?.[d.id] ?? 0,
            maxScore: 12,
            trend: getTrend(
                alsfrLatest.domainScores?.[d.id],
                compareEntry?.domainScores?.[d.id]
            )
        }));

        let monthsSinceOnset: number | undefined;
        if (firstSymptomsDate) {
            const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
            monthsSinceOnset = Math.floor(
                (Date.now() - firstSymptomsDate.getTime()) / msPerMonth
            );
        }

        const progressRate = monthsSinceOnset && monthsSinceOnset > 0
            ? (48 - alsfrLatest.totalScore) / monthsSinceOnset
            : undefined;

        return {
            totalScore: alsfrLatest.totalScore,
            scoreChange,
            changePeriod: scoreChange !== undefined ? `${ alsfrsrDef.trendPeriodDays ?? 30 } ${ t('common.days') }` : undefined,
            domains,
            lastAssessment: formatDateLocal(alsfrLatest.completedAt, i18n.language),
            progressRate,
            monthsSinceOnset
        };
    }, [alsfrLatest, alsfrEntries, firstSymptomsDate, t, i18n.language, alsfrsrDef]);

    if (alsfrStats) {
        return (
            <ALSFRSCard
                title="ALSFRS-R"
                icon="waveform.path.ecg"
                totalScore={ alsfrStats.totalScore }
                scoreChange={ alsfrStats.scoreChange }
                changePeriod={ alsfrStats.changePeriod }
                domains={ alsfrStats.domains }
                lastAssessment={ alsfrStats.lastAssessment }
                progressRate={ alsfrStats.progressRate }
                monthsSinceOnset={ alsfrStats.monthsSinceOnset }
                onPress={ onPress }
                onProgressInfoPress={ onProgressInfoPress }
            />
        );
    }

    return (
        <ALSFRSCard
            title="ALSFRS-R"
            icon="waveform.path.ecg"
            totalScore={ 0 }
            domains={ [] }
            footer={ t('common.noData') }
            onPress={ onPress }
        />
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        paddingTop: 20,
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    container: {
        flex: 1
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 40
    },
    noAccessContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24
    },
    cardList: {
        gap: 12,
        marginBottom: 24
    }
});
