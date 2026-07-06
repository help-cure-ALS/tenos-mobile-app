import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { getMetricsByAppCategory, MetricCard, useMetric } from '@/src/metrics';
import type { MetricCategory } from '@/src/metrics/types';
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
import { fmtDate } from '@/src/lib/formatDate';
import { useSharingFilter } from "@/src/hooks/useSharingFilter";

export default function CategoryDetailScreen() {
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const { t, i18n } = useTranslation();
    const { categoryId } = useLocalSearchParams<{ categoryId: string }>();

    const { filterMetrics } = useSharingFilter();
    const metrics = filterMetrics(getMetricsByAppCategory(categoryId as MetricCategory, i18n.language));

    // Get translated category name
    const categoryName = categoryId ? t(`categories.${categoryId}`) : t('common.default');

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="automatic"
        >
            <Stack.Screen
                options={{
                    headerTitle: categoryName,
                }}
            />

            <View style={styles.cardList}>
                {metrics.map((definition) => {
                    // Computed metrics use custom card components
                    if (definition.computed) {
                        if (definition.id === 'alsfrs-r') {
                            return (
                                <ALSFRSCardWrapper
                                    key={definition.id}
                                    onPress={() => router.push('/(tabs)/(metric)/alsfrsr')}
                                    onProgressInfoPress={() => router.push('/(tabs)/(metric)/progressRateInfo')}
                                />
                            );
                        }
                        if (definition.id === 'tdee') {
                            return (
                                <TDEECard
                                    key={definition.id}
                                    onPress={() => router.push('/(tabs)/(metric)/tdee')}
                                    onMissingDataPress={() => router.push('/settings/profile')}
                                    onMissingALSFRSPress={() => router.push('/(tabs)/(metric)/questionnaire/alsfrs-r')}
                                />
                            );
                        }
                        if (definition.id === 'als_subtype') {
                            return (
                                <ALSSubtypeCard
                                    key={definition.id}
                                    onPress={() => router.push('/(tabs)/(metric)/alsSubtype')}
                                />
                            );
                        }
                        if (definition.id === 'als_neurological_exam') {
                            return (
                                <NeurologicalExamSummaryCard
                                    key={definition.id}
                                    onPress={() => router.push('/(tabs)/(metric)/neurologicalExam')}
                                />
                            );
                        }
                        if (definition.id === 'als_kings_stage') {
                            return (
                                <ALSKingsStageCard
                                    key={definition.id}
                                    onPress={() => router.push('/(tabs)/(metric)/alsKingsStage')}
                                />
                            );
                        }
                        if (definition.id === 'als_genetic_background') {
                            return (
                                <ALSGeneticBackgroundCard
                                    key={definition.id}
                                    onPress={() => router.push('/(tabs)/(metric)/alsGeneticBackground')}
                                />
                            );
                        }
                        // Skip other computed metrics without custom cards
                        return null;
                    }

                    return (
                        <MetricCardWrapper
                            key={definition.id}
                            metricId={definition.id}
                            onPress={() => router.push(`/(tabs)/(metric)/${definition.id}`)}
                        />
                    );
                })}
            </View>
        </ScrollView>
    );
}

/** Wrapper component to use the useMetric hook for each card */
function MetricCardWrapper({
    metricId,
    onPress,
}: {
    metricId: string;
    onPress: () => void;
}) {
    const { displayDefinition, latestDisplayEntry, entryCount, displayStats } = useMetric({ metricId });

    if (!displayDefinition) return null;

    return (
        <MetricCard
            definition={displayDefinition}
            latestEntry={latestDisplayEntry}
            trend={displayStats?.trend}
            changeFromPrevious={displayStats?.changeFromPrevious}
            entryCount={entryCount}
            onPress={onPress}
        />
    );
}

// =============================================================================
// ALSFRS-R Helpers
// =============================================================================

const FIRST_SYMPTOMS_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/first-symptoms-date';

function getTrend(current?: number, previous?: number): 'up' | 'down' | 'stable' | undefined {
    if (current === undefined || previous === undefined) return undefined;
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'stable';
}

function formatDateLocal(date: Date, language: string): string {
    return fmtDate(date, language === 'de');
}

function parseYYYYMM(str: string): Date | undefined {
    const match = str.match(/^(\d{4})-(\d{2})$/);
    if (!match) return undefined;
    return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, 1);
}

/** Wrapper component for ALSFRS-R card with all data loading */
function ALSFRSCardWrapper({
    onPress,
    onProgressInfoPress,
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
        } catch (e) {
            console.warn('Failed to load first symptoms date:', e);
        }
    }, [get, getOrCreateSubjectId]);

    useEffect(() => {
        loadFirstSymptomsDate();
        const off = on('fhir:changed', loadFirstSymptomsDate);
        return () => off();
    }, [loadFirstSymptomsDate]);

    // Compute ALSFRS-R stats
    const alsfrStats = useMemo(() => {
        if (!alsfrLatest) return null;

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
            ),
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
            changePeriod: scoreChange !== undefined ? `${alsfrsrDef.trendPeriodDays ?? 30} ${t('common.days')}` : undefined,
            domains,
            lastAssessment: formatDateLocal(alsfrLatest.completedAt, i18n.language),
            progressRate,
            monthsSinceOnset,
        };
    }, [alsfrLatest, alsfrEntries, firstSymptomsDate, t, i18n.language, alsfrsrDef]);

    if (alsfrStats) {
        return (
            <ALSFRSCard
                title="ALSFRS-R"
                icon="waveform.path.ecg"
                totalScore={alsfrStats.totalScore}
                scoreChange={alsfrStats.scoreChange}
                changePeriod={alsfrStats.changePeriod}
                domains={alsfrStats.domains}
                lastAssessment={alsfrStats.lastAssessment}
                progressRate={alsfrStats.progressRate}
                monthsSinceOnset={alsfrStats.monthsSinceOnset}
                onPress={onPress}
                onProgressInfoPress={onProgressInfoPress}
            />
        );
    }

    return (
        <ALSFRSCard
            title="ALSFRS-R"
            icon="waveform.path.ecg"
            totalScore={0}
            domains={[]}
            footer={t('common.noData')}
            onPress={onPress}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    cardList: {
        gap: 12,
        marginTop: 10,
    },
});
