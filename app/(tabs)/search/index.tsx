import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    View,
    KeyboardAvoidingView
} from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { List, Space, Text } from 'react-native-nice-ui';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { metricCategoryInfos, type MetricCategoryInfo } from '@/src/metrics/types';
import { getMetricsByAppCategory, MetricCard, useMetric } from '@/src/metrics';
import { getAllMetricDefinitions } from '@/src/metrics/definitions';
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharingFilter } from "@/src/hooks/useSharingFilter";

export default function SearchScreen() {
    const { colors } = useAppTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const router = useSafeRouter();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { filterMetrics, isFiltering, canSeeCategory } = useSharingFilter();

    const handleCategoryPress = useCallback((category: MetricCategoryInfo) => {
        router.push(`/(tabs)/search/category/${ category.id }`);
    }, [router]);

    // Filter metrics by name when searching
    const filteredMetrics = useMemo(() => {
        if (!searchQuery.trim()) {
            return [];
        }
        const query = normalizeSearchText(searchQuery);
        const matched = getAllMetricDefinitions(i18n.language).filter((def) => {
            const haystack = normalizeSearchText([
                def.name,
                def.shortName,
                def.description,
                def.id.replaceAll('_', ' '),
            ].filter(Boolean).join(' '));
            return haystack.includes(query);
        });
        return filterMetrics(matched);
    }, [searchQuery, i18n.language, filterMetrics]);

    // Group matching metrics by category
    const groupedResults = useMemo(() => {
        if (filteredMetrics.length === 0) {
            return [];
        }
        return metricCategoryInfos
            .map(cat => ({
                category: cat,
                metrics: filteredMetrics.filter(m => m.category === cat.id)
            }))
            .filter(group => group.metrics.length > 0);
    }, [filteredMetrics]);

    const isSearching = searchQuery.trim().length > 0;

    return (
        <KeyboardAvoidingView
            style={ styles.container }
            behavior={ Platform.OS === 'ios' ? 'padding' : 'height' }
            keyboardVerticalOffset={ 0 }
        >
            <Stack.Screen
                options={ {
                    headerSearchBarOptions: {
                        hideWhenScrolling: false,
                        placement: 'automatic',
                        onChangeText: (event) => setSearchQuery(event.nativeEvent.text)
                    }
                } }
            />
            <ScrollView
                style={ { backgroundColor: colors.background } }
                contentContainerStyle={ styles.scrollView }
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
            >
                <View style={ [styles.bodyWrapper,
                    {
                        paddingLeft: insets.left,
                        paddingRight: insets.right
                    },
                    insets.left > 200 && { maxWidth: 940 + insets.left }
                ] }>
                    { !isSearching ? (
                        // No search text → show category list + extra navigation items
                        <>
                        <List.Section title={ t('navigation.healthCategories') } rounded>
                            { (() => {
                                // Insert "Medikamente" alphabetically among metric categories
                                const medicationsItem = canSeeCategory('medications') ? {
                                    id: '_medications',
                                    title: t('navigation.medications'),
                                    icon: 'pills.fill' as const,
                                    iconColor: '#FF9500',
                                    onPress: () => router.push('/(tabs)/(metric)/medications' as any),
                                } : null;
                                type ListEntry = { id: string; title: string; icon: string; iconColor: string; onPress: () => void };
                                const items: ListEntry[] = metricCategoryInfos
                                    .filter(cat => filterMetrics(getMetricsByAppCategory(cat.id, i18n.language)).length > 0)
                                    .map(cat => ({
                                        id: cat.id,
                                        title: t(`categories.${ cat.id }`),
                                        icon: cat.icon,
                                        iconColor: cat.iconColor,
                                        onPress: () => handleCategoryPress(cat),
                                    }));
                                if (medicationsItem) items.push(medicationsItem);
                                items.sort((a, b) => a.title.localeCompare(b.title, i18n.language));

                                return items.map((item, index) => (
                                    <List.Item
                                        key={ item.id }
                                        title={ item.title }
                                        onPress={ item.onPress }
                                        leftCmpSize={32}
                                        leftCmp={
                                            <ListItemIcon name={item.icon} color={item.iconColor} />
                                        }
                                        lastItem={ index === items.length - 1 }
                                    />
                                ));
                            })() }
                        </List.Section>

                        { (canSeeCategory('aids') || canSeeCategory('questionnaires')) && (
                            <List.Section rounded>
                                { canSeeCategory('aids') && (
                                    <List.Item
                                        title={ t('navigation.aids') }
                                        onPress={ () => router.push('/(tabs)/(metric)/aids' as any) }
                                        leftCmpSize={32}
                                        leftCmp={
                                            <ListItemIcon name="cross.case.fill" color="#FF3B30" />
                                        }
                                        lastItem={ !canSeeCategory('questionnaires') }
                                    />
                                ) }
                                { canSeeCategory('questionnaires') && (
                                    <List.Item
                                        title={ t('navigation.allQuestionnaires') }
                                        onPress={ () => router.push('/(tabs)/(metric)/questionnaires' as any) }
                                        leftCmpSize={32}
                                        leftCmp={
                                            <ListItemIcon name="list.bullet.clipboard.fill" color="#5856D6" />
                                        }
                                        lastItem
                                    />
                                ) }
                            </List.Section>
                        ) }
                        </>
                    ) : groupedResults.length > 0 ? (
                        <View style={ { marginTop: 30 } }>
                            {
                                // Search text → show matching metrics as cards grouped by category
                                groupedResults.map(({ category, metrics }) => (
                                    <View key={ category.id }>
                                        <List.Wrapper rounded>
                                            <Text variant="titleMedium">{ t(`categories.${ category.id }`) }</Text>
                                        </List.Wrapper>
                                        <Space size="sm" />
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
                                                            onPress={ () => router.push(`/(tabs)/search/${ definition.id }`) }
                                                        />
                                                    );
                                                }) }
                                            </View>
                                        </List.Wrapper>
                                    </View>
                                ))
                            }
                        </View>

                    ) : (
                        // No results
                        <View style={ styles.emptyState }>
                            <Text style={ [styles.emptyText, { color: colors.textHint }] }>
                                { t('search.noResults', { query: searchQuery }) }
                            </Text>
                        </View>
                    ) }
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function normalizeSearchText(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// =============================================================================
// MetricCardWrapper
// =============================================================================

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
// ALSFRS-R Helpers
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

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    container: {
        flex: 1
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40
    },
    emptyText: {
        fontSize: 16
    },
    cardList: {
        gap: 12,
        marginBottom: 24
    }
});
