import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList, Platform,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { fmtDate } from '@/src/lib/formatDate';
import {
    getAllQuestionnaireDefinitions,
    getQuestionnaireAvailability,
    useQuestionnaire,
    QuestionnaireCard,
    type QuestionnaireDefinition,
} from '@/src/questionnaires';
import { FilterChip } from '@/src/components/ui/FilterChip';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharingFilter } from "@/src/hooks/useSharingFilter";

// =============================================================================
// Types
// =============================================================================

type FilterKey = 'all' | 'due' | 'available' | 'completed' | 'archived';

// =============================================================================
// Card Wrapper (uses hook, self-filters, reports visibility)
// =============================================================================

type CardWrapperProps = {
    definition: QuestionnaireDefinition;
    width: number;
    height: number;
    activeFilter: FilterKey;
    onPress: (definition: QuestionnaireDefinition, available: boolean, latestEntryId?: string) => void;
    onVisibility: (id: string, visible: boolean) => void;
};

function CardWrapper({ definition, width, height, activeFilter, onPress, onVisibility }: CardWrapperProps) {
    const { latestEntry } = useQuestionnaire({ questionnaireId: definition.id });

    const availability = useMemo(
        () => getQuestionnaireAvailability(definition, latestEntry?.completedAt ?? null),
        [definition, latestEntry],
    );

    const hasCompletions = latestEntry !== null;

    const visible = useMemo(() => {
        switch (activeFilter) {
            case 'all':
                if ((availability.reason === 'not_started' || availability.reason === 'ended') && !hasCompletions) return false;
                return true;
            case 'due': return availability.available && (availability.dueInDays ?? 0) <= 0;
            case 'available': return availability.available;
            case 'completed': return hasCompletions;
            case 'archived': return availability.reason === 'ended';
        }
    }, [activeFilter, availability, hasCompletions]);

    useEffect(() => {
        onVisibility(definition.id, visible);
    }, [definition.id, visible, onVisibility]);

    const handlePress = useCallback(
        () => onPress(definition, availability.available, latestEntry?.id),
        [definition, availability.available, latestEntry?.id, onPress],
    );

    if (!visible) return null;

    return (
        <View style={{ width, height }}>
            <QuestionnaireCard
                definition={definition}
                availability={availability}
                hasCompletions={hasCompletions}
                daysUntilEnd={availability.daysUntilEnd}
                onPress={handlePress}
            />
        </View>
    );
}

// =============================================================================
// Completed Card Wrapper (one card per entry)
// =============================================================================

type CompletedCardWrapperProps = {
    definition: QuestionnaireDefinition;
    width: number;
    height: number;
    onPress: (definition: QuestionnaireDefinition, entryId: string) => void;
    onVisibility: (id: string, count: number) => void;
};

function CompletedCardWrapper({ definition, width, height, onPress, onVisibility }: CompletedCardWrapperProps) {
    const { entries } = useQuestionnaire({ questionnaireId: definition.id });

    useEffect(() => {
        onVisibility(definition.id, entries.length);
    }, [definition.id, entries.length, onVisibility]);

    if (entries.length === 0) return null;

    return entries.map((entry) => (
        <View key={entry.id} style={{ width, height }}>
            <QuestionnaireCard
                definition={definition}
                availability={{ available: false, reason: 'locked_until_due' }}
                hasCompletions={true}
                lastCompletedAt={entry.completedAt}
                onPress={() => onPress(definition, entry.id)}
            />
        </View>
    ));
}

// =============================================================================
// Empty State
// =============================================================================

function EmptyState({ message }: { message: string }) {
    const { colors } = useAppTheme();

    return (
        <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textHint }]}>{message}</Text>
        </View>
    );
}

// =============================================================================
// Main Screen
// =============================================================================

export default function QuestionnairesScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const { width } = useWindowDimensions();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { isFiltering, isLoaded: sharingLoaded, canSeeCategory } = useSharingFilter();
    const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
    const [visibleCount, setVisibleCount] = useState(0);
    const visibilityMap = useRef<Record<string, number>>({});

    const definitions = useMemo(
        () => getAllQuestionnaireDefinitions(i18n.language).filter((definition) => !definition.customRenderer),
        [i18n.language],
    );

    const sortedDefinitions = useMemo(() => {
        const now = new Date();
        return [...definitions].sort((a, b) => {
            const aEnded = a.schedule?.availableUntil ? now > new Date(a.schedule.availableUntil) : false;
            const bEnded = b.schedule?.availableUntil ? now > new Date(b.schedule.availableUntil) : false;
            if (aEnded && !bEnded) return 1;
            if (!aEnded && bEnded) return -1;
            return (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity);
        });
    }, [definitions]);

    const filters: { key: FilterKey; label: string }[] = useMemo(() => [
        { key: 'all', label: t('questionnaire.filter.all') },
        { key: 'due', label: t('questionnaire.filter.due') },
        { key: 'available', label: t('questionnaire.filter.available') },
        { key: 'completed', label: t('questionnaire.filter.completed') },
        { key: 'archived', label: t('questionnaire.filter.archived') },
    ], [t]);

    const emptyMessages: Record<Exclude<FilterKey, 'all'>, string> = useMemo(() => ({
        due: t('questionnaire.filter.emptyDue'),
        available: t('questionnaire.filter.emptyAvailable'),
        completed: t('questionnaire.filter.emptyCompleted'),
        archived: t('questionnaire.filter.emptyArchived'),
    }), [t]);

    // Reset visibility map when filter changes
    useEffect(() => {
        visibilityMap.current = {};
        setVisibleCount(0);
    }, [activeFilter]);

    const handleVisibility = useCallback((id: string, visible: boolean) => {
        const count = visible ? 1 : 0;
        const prev = visibilityMap.current[id];
        if (prev !== count) {
            visibilityMap.current[id] = count;
            const total = Object.values(visibilityMap.current).reduce((sum, v) => sum + v, 0);
            setVisibleCount(total);
        }
    }, []);

    const handleCompletedVisibility = useCallback((id: string, count: number) => {
        const prev = visibilityMap.current[id];
        if (prev !== count) {
            visibilityMap.current[id] = count;
            const total = Object.values(visibilityMap.current).reduce((sum, v) => sum + v, 0);
            setVisibleCount(total);
        }
    }, []);

    const handleQuestionnairePress = useCallback((
        definition: QuestionnaireDefinition,
        available: boolean,
        latestEntryId?: string,
    ) => {
        if (available) {
            router.push(`/(tabs)/(metric)/questionnaire/${definition.id}`);
            return;
        }

        // If not available but has a completed entry, open in readonly mode
        if (latestEntryId) {
            router.push(`/(tabs)/(metric)/questionnaire/${definition.id}?entryId=${latestEntryId}`);
            return;
        }

        const availability = getQuestionnaireAvailability(definition, null);
        let message = t('questionnaire.notAvailable');

        if (availability.reason === 'locked_until_due' && availability.daysUntilAvailable) {
            message = t('questionnaire.availableInDays', { days: availability.daysUntilAvailable });
        } else if (availability.reason === 'not_started' && availability.nextAvailableDate) {
            message = t('questionnaire.availableFrom', {
                date: fmtDate(availability.nextAvailableDate, i18n.language === 'de'),
            });
        } else if (availability.reason === 'ended') {
            message = t('questionnaire.ended');
        }

        Alert.alert(definition.shortName ?? definition.name, message, [{ text: t('common.ok') }]);
    }, [router, t, i18n.language]);

    const handleCompletedEntryPress = useCallback((
        definition: QuestionnaireDefinition,
        entryId: string,
    ) => {
        router.push(`/(tabs)/(metric)/questionnaire/${definition.id}?entryId=${entryId}`);
    }, [router]);

    const renderFilterChips = useCallback(() => (
        <View style={{ backgroundColor: colors.background }}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterContainer}
            >
                {filters.map((filter) => (
                    <FilterChip
                        key={filter.key}
                        label={filter.label}
                        active={activeFilter === filter.key}
                        onPress={() => setActiveFilter(filter.key)}
                        variant="filled"
                    />
                ))}
            </ScrollView>
        </View>
    ), [colors.background, filters, activeFilter]);

    const GRID = { padding: 18, gap: 12, maxWidth: 940, maxTileWidth: 330, aspectRatio: 1.618 / 1.22 } as const;
    const numColumns = width > 600 ? 3 : 2;
    const contentWidth = Math.min(width, GRID.maxWidth) - GRID.padding * 2;
    const TILE_WIDTH = Math.min((contentWidth - GRID.gap * (numColumns - 1)) / numColumns, GRID.maxTileWidth);
    const TILE_HEIGHT = TILE_WIDTH * GRID.aspectRatio;

    const renderGrid = useCallback(() => (
        <View style={[styles.gridContainer, {
            paddingHorizontal: GRID.padding,
            gap: GRID.gap
        }]}>
            {activeFilter === 'completed'
                ? sortedDefinitions.map((definition) => (
                    <CompletedCardWrapper
                        key={definition.id}
                        definition={definition}
                        width={TILE_WIDTH}
                        height={TILE_HEIGHT}
                        onPress={handleCompletedEntryPress}
                        onVisibility={handleCompletedVisibility}
                    />
                ))
                : sortedDefinitions.map((definition) => (
                    <CardWrapper
                        key={definition.id}
                        definition={definition}
                        width={TILE_WIDTH}
                        height={TILE_HEIGHT}
                        activeFilter={activeFilter}
                        onPress={handleQuestionnairePress}
                        onVisibility={handleVisibility}
                    />
                ))
            }

            {activeFilter !== 'all' && visibleCount === 0 && (
                <EmptyState message={emptyMessages[activeFilter]} />
            )}
        </View>
    ), [width, sortedDefinitions, activeFilter, handleQuestionnairePress, handleCompletedEntryPress, handleVisibility, handleCompletedVisibility, visibleCount, emptyMessages]);

    const dummyData = useMemo(() => [1], []);

    if (!sharingLoaded) {
        return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator /></View>;
    }
    if (isFiltering && !canSeeCategory('questionnaires')) {
        router.back();
        return null;
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen
                options={{
                    headerTitle: t('questionnaire.allQuestionnaires'),
                    headerTransparent: false,
                    headerStyle: { backgroundColor: colors.background },
                }}
            />
            <View style={ [styles.bodyWrapper,
                {
                    // We add the insets to the padding so that the content
                    // doesn't disappear under the sidebar.
                    paddingLeft: insets.left,
                    paddingRight: insets.right
                },
                insets.left > 200 && { maxWidth: 940 + insets.left }
            ] }>
                <FlatList
                    data={dummyData}
                    renderItem={() => renderGrid()}
                    keyExtractor={() => 'grid'}
                    style={[styles.container, { backgroundColor: colors.background }]}
                    contentContainerStyle={styles.content}
                    numColumns={numColumns}
                    contentInsetAdjustmentBehavior="automatic"
                    ListHeaderComponent={renderFilterChips()}
                    stickyHeaderIndices={[0]}
                />
            </View>
        </View>
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
        flex: 1,
    },
    content: {
        paddingBottom: 40,
    },
    filterContainer: {
        paddingHorizontal: 20,
        paddingBottom: 16,
        gap: 8,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'flex-start'
    },
    emptyContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 21,
    },
});
