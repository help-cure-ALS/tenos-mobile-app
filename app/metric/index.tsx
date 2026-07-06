import { Stack, useFocusEffect } from 'expo-router';
import {
    Alert,
    ImageBackground,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
    View
} from 'react-native';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { GreetingBanner } from '@/src/components/ui/GreetingBanner';
import { Button, List, Space, Text } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useScrollToTop } from "expo-router/react-navigation";
import { useAppTheme } from '@/src/theme';
import {
    getDefaultPinnedMetrics,
    getMetricDefinition,
    MetricCard,
    useMetric,
    type MetricDefinition
} from '@/src/metrics';
import { ALSFRSCard, type ALSFRSDomain } from "@/src/components/ui/ALSFRSCard";
import { TDEECard } from "@/src/components/ui/TDEECard";
import { ALSGeneticBackgroundCard } from '@/src/questionnaires/structured/alsGeneticBackground/components/ALSGeneticBackgroundCard';
import { ALSKingsStageCard } from '@/src/questionnaires/structured/alsKingsStage/components/ALSKingsStageCard';
import { ALSSubtypeCard } from '@/src/questionnaires/structured/alsSubtype/components/ALSSubtypeCard';
import { NeurologicalExamSummaryCard } from '@/src/questionnaires/structured/neurologicalExam/components/NeurologicalExamSummaryCard';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useLoadingOverlay } from '@/src/context/LoadingOverlayProvider';
import { usePatientPreferences, useNickname } from '@/src/hooks/usePatientPreferences';
import { on } from '@/src/lib/bus';
import { useQuestionnaire, QuestionnaireCarousel } from '@/src/questionnaires';
import { useGreetingActions } from '@/src/hooks/useGreetingActions';
import { getDefinition as getAlsfrsrDefinition } from '@/src/questionnaires/definitions/alsfrs-r';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { useAppSync, usePatientStores } from '@/src/context/AppSyncProvider';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { usePatientSwitcherToolbar } from "@/src/components/PatientSwitcher";
import { tokens } from "@/src/theme/tokens";
import { useDefinitions } from '@/src/definitions';
import { CloseButton } from "@/src/components/ui/navigation/CloseButton";
import { HeaderButton } from "@/src/components/ui/navigation/HeaderButton";
import { TodoSection } from "@/src/components/ui/TodoSection";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtDate } from '@/src/lib/formatDate';
import { SectionTitle } from "@/src/components/ui/SectionTitle";
import { useSharingFilter } from "@/src/hooks/useSharingFilter";

export default function Metric() {
    const { colors, isDark } = useAppTheme();
    const { t, i18n } = useTranslation();
    const router = useSafeRouter();
    const { width } = useWindowDimensions();
    const patientToolbarMenu = usePatientSwitcherToolbar({ showName: true });
    const insets = useSafeAreaInsets();
    const { role } = useAppRole();
    const { hideLoading } = useLoadingOverlay();
    const isManaged = role === 'caregiver' || role === 'doctor';
    const { getPinnedMetricIds } = usePatientPreferences();
    const { nickname, profileIcon } = useNickname();
    const { patientPreferencesStore: prefsStore } = usePatientStores();
    const { refresh: refreshDefinitions, refreshing: definitionsRefreshing } = useDefinitions();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric, canSeeCategory, filterMetrics } = useSharingFilter();
    const [pinnedMetrics, setPinnedMetrics] = useState<MetricDefinition[]>([]);
    const scrollViewRef = useRef<ScrollView>(null);
    const cardListY = useRef(0);
    const todoSectionY = useRef(0);

    useScrollToTop(scrollViewRef);

    const scrollToMetrics = useCallback(() => {
        scrollViewRef.current?.scrollTo({ y: cardListY.current - 110, animated: true });
    }, []);

    const scrollToTodo = useCallback(() => {
        scrollViewRef.current?.scrollTo({ y: todoSectionY.current - 110, animated: true });
    }, []);

    const { isFirstLaunch, action, hint } = useGreetingActions({ onTodoPress: scrollToTodo });

    const loadPinnedMetrics = useCallback(async () => {
        if (!prefsStore) return;
        const store = prefsStore;
        const ids = await getPinnedMetricIds();

        if (ids.length === 0) {
            // First use: pin default metrics
            const defaults = getDefaultPinnedMetrics(i18n.language);
            for (let i = 0; i < defaults.length; i++) {
                const def = defaults[i];
                await store.updateMetricPreferences(def.id, {
                    pinned: true,
                    pinnedOrder: def.defaultPinnedOrder ?? (i * 10)
                });
            }
            setPinnedMetrics(defaults);
        } else {
            // Remove stale pinned metrics if their definitions are no longer available
            // (e.g. archived/retired in remote catalog).
            const staleIds = ids.filter((id) => getMetricDefinition(id, i18n.language) === undefined);
            if (staleIds.length > 0) {
                await Promise.all(
                    staleIds.map((id) =>
                        store.updateMetricPreferences(id, { pinned: false, pinnedOrder: undefined })
                    )
                );
            }

            // Add newly introduced default-pinned metrics for existing patients.
            // Explicit user choices are preserved: pinned=false is not overwritten.
            const prefs = await store.getAll();
            const activeIds = ids.filter((id) => !staleIds.includes(id));
            const defaultMetrics = getDefaultPinnedMetrics(i18n.language);
            const missingDefaultMetrics = defaultMetrics.filter(
                (def) => prefs.metrics[def.id]?.pinned === undefined && !activeIds.includes(def.id)
            );
            if (missingDefaultMetrics.length > 0) {
                await Promise.all(
                    missingDefaultMetrics.map((def) =>
                        store.updateMetricPreferences(def.id, {
                            pinned: true,
                            pinnedOrder: def.defaultPinnedOrder ?? 999,
                        })
                    )
                );
                const updatedPrefs = await store.getAll();
                const sorted = [...activeIds, ...missingDefaultMetrics.map((def) => def.id)]
                    .map(id => ({ id, order: updatedPrefs.metrics[id]?.pinnedOrder ?? 999 }))
                    .sort((a, b) => a.order - b.order)
                    .map(({ id }) => getMetricDefinition(id, i18n.language))
                    .filter((def): def is MetricDefinition => def !== undefined);
                setPinnedMetrics(sorted);
                return;
            }

            // Load pinned metrics sorted by pinnedOrder
            const sorted = activeIds
                .map(id => ({ id, order: prefs.metrics[id]?.pinnedOrder ?? 999 }))
                .sort((a, b) => a.order - b.order)
                .map(({ id }) => getMetricDefinition(id, i18n.language))
                .filter((def): def is MetricDefinition => def !== undefined);
            setPinnedMetrics(sorted);
        }
    }, [prefsStore, getPinnedMetricIds, i18n.language]);

    useFocusEffect(
        useCallback(() => { hideLoading(); }, [hideLoading])
    );

    useEffect(() => {
        loadPinnedMetrics();

        // Reload when preferences change (e.g., after pinning/unpinning or reordering)
        const offFhir = on('fhir:changed', loadPinnedMetrics);
        const offPrefs = on('preferences:changed', loadPinnedMetrics);
        return () => {
            offFhir();
            offPrefs();
        };
    }, [loadPinnedMetrics]);

    const handleSettings = useCallback(() => {
        router.push('/settings');
    }, [router]);

    const handleUnpinMetric = useCallback((metricId: string, metricName: string) => {
        Alert.alert(
            t('metric.removeFromOverview'),
            t('metric.removeFromOverviewMessage', { name: metricName }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.remove'),
                    style: 'destructive',
                    onPress: async () => {
                        if (!prefsStore) return;
                        await prefsStore.updateMetricPreferences(metricId, { pinned: false });
                        loadPinnedMetrics();
                    }
                }
            ]
        );
    }, [prefsStore, loadPinnedMetrics, t]);

    return (
        <>
            {
                Platform.OS === 'android' ? (
                    <Stack.Screen
                        options={ {
                            headerRight: () => (
                                <HeaderButton
                                    title={ t('shared.save') }
                                    onPress={ handleSettings }
                                    icon={ profileIcon ?? 'figure.boxing' }
                                    tintColor={ colors.textPrimary }
                                    variant="prominent"
                                />
                            )
                        } }
                    />
                ) : (
                    <Stack.Screen>
                        <Stack.Toolbar placement="right">
                            { patientToolbarMenu }
                            <Stack.Toolbar.Button variant="prominent" tintColor={ colors.textPrimary }
                                                  icon={ (profileIcon ?? 'figure.boxing') as any }
                                                  onPress={ handleSettings } />
                        </Stack.Toolbar>
                    </Stack.Screen>
                )
            }
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-3.png') }
                             style={ [styles.image, { backgroundColor: colors.background }] }>
                <ScrollView
                    ref={ scrollViewRef }
                    style={ [styles.container, isDark && { backgroundColor: colors.background }] }
                    contentContainerStyle={ styles.content }
                    contentInsetAdjustmentBehavior="automatic"
                    refreshControl={
                        <RefreshControl
                            refreshing={ definitionsRefreshing }
                            onRefresh={ refreshDefinitions }
                            tintColor={ colors.textSecondary }
                        />
                    }
                >

                    <View style={ [styles.contentWrapper,
                        {
                            // We add the insets to the padding so that the content
                            // doesn't disappear under the sidebar.
                            paddingLeft: insets.left + tokens.listSectionPaddingHorizontal,
                            paddingRight: insets.right + tokens.listSectionPaddingHorizontal
                        },
                        insets.left > 200 && { maxWidth: 940 + insets.left }
                    ] }>
                        { role !== 'caregiver' && role !== 'doctor' && (
                            <GreetingBanner
                                nickname={ nickname }
                                textColor={ colors.textPrimary }
                                onPress={ scrollToMetrics }
                                isFirstLaunch={ isFirstLaunch }
                                action={ action }
                                hint={ hint }
                            />
                        ) }

                        <View onLayout={(e) => { todoSectionY.current = e.nativeEvent.layout.y; }}>
                            <TodoSection style={{ marginBottom: 20 }} />
                        </View>

                        { isFiltering && sharingLoaded && filterMetrics(pinnedMetrics).length === 0
                            && !canSeeCategory('medications') && !canSeeCategory('aids') && !canSeeCategory('questionnaires') ? (
                            <View style={ styles.noAccessContainer }>
                                <Text variant="bodyMedium" color="hint" style={ { textAlign: 'center' } }>
                                    { t('metric.noAccessHint') }
                                </Text>
                            </View>
                        ) : (
                            <>
                                <View
                                    onLayout={ (e) => {
                                        cardListY.current = e.nativeEvent.layout.y;
                                    } }
                                >
                                    <SectionTitle
                                        title={ t('metric.pinned') }
                                        rightCmp={
                                            <Pressable onPress={ () => router.push('/(tabs)/(metric)/pinOrder') }>
                                                <Text variant="bodyMedium" color="hint">{ t('metric.reorderLink') }</Text>
                                            </Pressable>
                                        }
                                    />

                                    <View style={ styles.cardList }>
                                        { filterMetrics(pinnedMetrics).map((definition) => {
                                            // Computed metrics use custom card components
                                            if (definition.computed) {
                                                if (definition.id === 'alsfrs-r') {
                                                    return (
                                                        <ALSFRSCardWrapper
                                                            key={ definition.id }
                                                            onPress={ () => router.push('/(tabs)/(metric)/alsfrsr') }
                                                            onLongPress={ () => handleUnpinMetric(definition.id, definition.name) }
                                                            onProgressInfoPress={ () => router.push('/(tabs)/(metric)/progressRateInfo') }
                                                        />
                                                    );
                                                }
                                                if (definition.id === 'tdee') {
                                                    return (
                                                        <TDEECard
                                                            key={ definition.id }
                                                            onPress={ () => router.push('/(tabs)/(metric)/tdee') }
                                                            onLongPress={ () => handleUnpinMetric(definition.id, definition.name) }
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
                                                            onLongPress={ () => handleUnpinMetric(definition.id, definition.name) }
                                                        />
                                                    );
                                                }
                                                if (definition.id === 'als_neurological_exam') {
                                                    return (
                                                        <NeurologicalExamSummaryCard
                                                            key={ definition.id }
                                                            onPress={ () => router.push('/(tabs)/(metric)/neurologicalExam') }
                                                            onLongPress={ () => handleUnpinMetric(definition.id, definition.name) }
                                                        />
                                                    );
                                                }
                                                if (definition.id === 'als_kings_stage') {
                                                    return (
                                                        <ALSKingsStageCard
                                                            key={ definition.id }
                                                            onPress={ () => router.push('/(tabs)/(metric)/alsKingsStage') }
                                                            onLongPress={ () => handleUnpinMetric(definition.id, definition.name) }
                                                        />
                                                    );
                                                }
                                                if (definition.id === 'als_genetic_background') {
                                                    return (
                                                        <ALSGeneticBackgroundCard
                                                            key={ definition.id }
                                                            onPress={ () => router.push('/(tabs)/(metric)/alsGeneticBackground') }
                                                            onLongPress={ () => handleUnpinMetric(definition.id, definition.name) }
                                                        />
                                                    );
                                                }
                                                // Skip other computed metrics without custom cards
                                                return null;
                                            }

                                            return (
                                                <MetricCardWrapper
                                                    key={ definition.id }
                                                    metricId={ definition.id }
                                                    onPress={ () => router.push(`/(tabs)/(metric)/${ definition.id }`) }
                                                    onLongPress={ () => handleUnpinMetric(definition.id, definition.name) }
                                                />
                                            );
                                        }) }
                                    </View>
                                </View>
                            </>
                        ) }

                    </View>

                    <View style={ [styles.listWrapper,
                        {
                            paddingLeft: insets.left,
                            paddingRight: insets.right
                        },
                        insets.left > 200 && { maxWidth: 940 + insets.left }
                    ] }>
                        <List.Section rounded>
                            <List.Item
                                title={ t('metric.allCategories') }
                                leftCmpSize={32}
                                leftCmp={<ListItemIcon name="cross.circle.fill" color={colors.background} backgroundColor={colors.textPrimary} />}
                                onPress={ () => router.push('/(tabs)/(metric)/categories') }
                                lastItem
                            />
                        </List.Section>
                    </View>

                    { canSeeCategory('questionnaires') && (
                        <View style={ styles.questionnaireCarouselWrapper }>
                            <QuestionnaireCarousel title={ t(isManaged ? 'metric.questionnairesNeutral' : 'metric.yourQuestionnaires') } />
                        </View>
                    ) }

                    <View style={ [styles.listWrapper,
                        {
                            // We add the insets to the padding so that the content
                            // doesn't disappear under the sidebar.
                            paddingLeft: insets.left,
                            paddingRight: insets.right
                        },
                        insets.left > 200 && { maxWidth: 940 + insets.left }
                    ] }>
                        <List.Section rounded>
                            <List.Item
                                title={ t('metric.medications') }
                                leftCmpSize={32}
                                leftCmp={<ListItemIcon name="pills.fill" color={colors.background} backgroundColor={colors.textPrimary} />}
                                onPress={ () => router.push('/(tabs)/(metric)/medications') }
                                disabled={ isFiltering && !canSeeCategory('medications') }
                            />
                            { canSeeCategory('aids') && (
                                <List.Item
                                    title={ t(isManaged ? 'metric.aidsNeutral' : 'metric.aids') }
                                    leftCmpSize={32}
                                    leftCmp={<ListItemIcon name="figure.roll" color={colors.background} backgroundColor={colors.textPrimary} />}
                                    onPress={ () => router.push('/(tabs)/(metric)/aids') }
                                />
                            ) }
                            <List.Item
                                title={ t(isManaged ? 'metric.studiesNeutral' : 'metric.studies') }
                                leftCmpSize={32}
                                leftCmp={<ListItemIcon name="heart.text.clipboard" color={colors.background} backgroundColor={colors.textPrimary} />}
                                onPress={ () => router.push('/(tabs)/(metric)/studies') }
                            />
                            <List.Item
                                title={ t('metric.allQuestionnaires') }
                                leftCmpSize={32}
                                leftCmp={<ListItemIcon name="questionmark.text.page.fill" color={colors.background} backgroundColor={colors.textPrimary} />}
                                onPress={ () => router.push('/(tabs)/(metric)/questionnaires') }
                                disabled={ isFiltering && !canSeeCategory('questionnaires') }
                                lastItem
                            />
                        </List.Section>
                    </View>
                </ScrollView>
            </ImageBackground>
        </>
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

function formatDateLocal(date: Date): string {
    return fmtDate(date, true);
}

function parseYYYYMM(str: string): Date | undefined {
    const match = str.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
        return undefined;
    }
    return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, 1);
}

/** Wrapper component to use the useMetric hook for each card */
function MetricCardWrapper({
                               metricId,
                               onPress,
                               onLongPress
                           }: {
    metricId: string;
    onPress: () => void;
    onLongPress?: () => void;
}) {
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
            onLongPress={ onLongPress }
            style={ styles.gridItem }
        />
    );
}

/** Wrapper component for ALSFRS-R card with all data loading */
function ALSFRSCardWrapper({
                               onPress,
                               onLongPress,
                               onProgressInfoPress
                           }: {
    onPress: () => void;
    onLongPress?: () => void;
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

    // Compute ALSFRS-R stats
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
            lastAssessment: formatDateLocal(alsfrLatest.completedAt),
            progressRate,
            monthsSinceOnset
        };
    }, [alsfrLatest, alsfrEntries, firstSymptomsDate, t, alsfrsrDef]);

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
                onLongPress={ onLongPress }
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
            onLongPress={ onLongPress }
        />
    );
}

const styles = StyleSheet.create({
    image: {
        flex: 1
    },
    questionnaireCarouselWrapper: {
        marginTop: 5
    },
    listWrapper: {
        marginTop: 5,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    container: {
        flex: 1
    },
    contentWrapper: {
        paddingTop: 10,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    content: {
        paddingBottom: 40
    },
    noAccessContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24,
    },
    cardList: {
        gap: 12
    },
    gridItem: {
        flex: 1
    },
    cardGrid: {
        justifyContent: 'space-between',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16
    },
    orderLink: {
        alignSelf: 'flex-end'
    }
});
