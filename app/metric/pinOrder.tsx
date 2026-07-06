import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { List, Space, Text, useTheme } from 'react-native-nice-ui';
import * as Haptics from 'expo-haptics';
import DraggableFlatList, {
    RenderItemParams,
    ScaleDecorator
} from 'react-native-draggable-flatlist';
import { getMetricDefinition, getMetricsByAppCategory, type MetricDefinition } from '@/src/metrics';
import { metricCategoryInfos } from '@/src/metrics/types';
import { usePatientPreferences } from '@/src/hooks/usePatientPreferences';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';
import { emit } from '@/src/lib/bus';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';

type PinnedMetricItem = {
    id: string;
    definition: MetricDefinition;
    order: number;
};

const ITEM_HEIGHT = 52;

export default function PinOrderScreen() {
    const { colors, tokens } = useTheme();
    const router = useSafeRouter();
    const { t, i18n } = useTranslation();
    const { getPinnedMetricIds } = usePatientPreferences();
    const { patientPreferencesStore: prefsStore } = usePatientStores();
    const [pinnedMetrics, setPinnedMetrics] = useState<PinnedMetricItem[]>([]);
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
    const [isLoaded, setIsLoaded] = useState(false);
    const { canSeeMetric } = useSharingFilter();

    const loadData = useCallback(async () => {
        if (!prefsStore) return;
        const store = prefsStore;
        const ids = await getPinnedMetricIds();
        const prefs = await store.getAll();

        const items = ids
            .map(id => {
                const definition = getMetricDefinition(id, i18n.language);
                if (!definition) return null;
                return {
                    id,
                    definition,
                    order: prefs.metrics[id]?.pinnedOrder ?? 999
                };
            })
            .filter((item): item is PinnedMetricItem => item !== null)
            .sort((a, b) => a.order - b.order)
            .filter(item => canSeeMetric(item.id));

        setPinnedMetrics(items);
        setPinnedIds(new Set(ids));
        setIsLoaded(true);
    }, [prefsStore, getPinnedMetricIds, i18n.language, canSeeMetric]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Available (unpinned) metrics grouped by category
    const availableByCategory = useMemo(() => {
        return metricCategoryInfos
            .map(cat => ({
                category: cat,
                metrics: getMetricsByAppCategory(cat.id, i18n.language)
                    .filter(m => m.canPin && !pinnedIds.has(m.id) && canSeeMetric(m.id))
            }))
            .filter(group => group.metrics.length > 0);
    }, [pinnedIds, i18n.language, canSeeMetric]);

    const handleUnpin = useCallback(async (metricId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Optimistic update
        setPinnedMetrics(prev => prev.filter(m => m.id !== metricId));
        setPinnedIds(prev => {
            const next = new Set(prev);
            next.delete(metricId);
            return next;
        });

        if (!prefsStore) return;
        await prefsStore.updateMetricPreferences(metricId, { pinned: false });
        emit('preferences:changed');
    }, [prefsStore]);

    const handlePin = useCallback(async (metricId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const definition = getMetricDefinition(metricId, i18n.language);
        if (!definition) return;

        // Calculate next order
        const maxOrder = pinnedMetrics.length > 0
            ? Math.max(...pinnedMetrics.map(m => m.order))
            : 0;
        const nextOrder = maxOrder + 10;

        // Optimistic update
        setPinnedMetrics(prev => [...prev, { id: metricId, definition, order: nextOrder }]);
        setPinnedIds(prev => new Set(prev).add(metricId));

        if (!prefsStore) return;
        await prefsStore.updateMetricPreferences(metricId, { pinned: true, pinnedOrder: nextOrder });
        emit('preferences:changed');
    }, [prefsStore, pinnedMetrics, i18n.language]);

    const renderPinnedItem = useCallback(
        ({ item, drag, isActive }: RenderItemParams<PinnedMetricItem>) => (
            <ScaleDecorator activeScale={1.02}>
                <View
                    style={[
                        styles.pinnedItem,
                        {
                            backgroundColor: colors.listItemBackground,
                            borderRadius: tokens.listSectionRadius
                        },
                        isActive && styles.itemActive
                    ]}
                >
                    <TouchableOpacity
                        onPress={() => handleUnpin(item.id)}
                        hitSlop={8}
                        accessibilityLabel={t('common.remove')}
                    >
                        <AppIcon
                            name="minus.circle.fill"
                            tintColor="#FF3B30"
                            size={28}
                        />
                    </TouchableOpacity>
                    <Text variant="bodyMedium" style={styles.itemTitle}>
                        {item.definition.name}
                    </Text>
                    <TouchableOpacity
                        onPressIn={async () => {
                            await Haptics.selectionAsync();
                            drag();
                        }}
                        hitSlop={8}
                        accessibilityLabel={t('pinOrder.dragToSort')}
                    >
                        <View style={styles.dragHandle}>
                            <AppIcon
                                name="line.3.horizontal"
                                tintColor={colors.textHint}
                                size={24}
                            />
                        </View>
                    </TouchableOpacity>
                </View>
            </ScaleDecorator>
        ),
        [colors, tokens, handleUnpin, t]
    );

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        animation: 'slide_from_bottom',
                        headerShown: true,
                        headerTransparent: false,
                        headerBackVisible: false,
                        headerTitle: t('pinOrder.title'),
                        headerRight: () => (
                            <TouchableOpacity onPress={() => router.back()}>
                                <AppIcon name="checkmark" tintColor={colors.primary} size={22} />
                            </TouchableOpacity>
                        )
                    }}
                />
            ) : (
                <Stack.Screen>
                    <Stack.Screen.Title>{t('pinOrder.title')}</Stack.Screen.Title>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button icon="checkmark" onPress={() => router.back()} />
                    </Stack.Toolbar>
                </Stack.Screen>
            )}

            {!isLoaded ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                </View>
            ) : (
            <ScrollView
                style={{ backgroundColor: colors.background }}
                contentContainerStyle={styles.scrollContent}
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScrollViewContent>
                    {/* Pinned section */}
                    <List.Wrapper rounded>
                        <Text variant="titleMedium" style={{ fontSize: 18, fontWeight: '700'}}>{t('pinOrder.pinned')}</Text>
                    </List.Wrapper>
                    <Space size="md" />

                    {pinnedMetrics.length > 0 ? (
                        <View style={{ height: pinnedMetrics.length * ITEM_HEIGHT, paddingHorizontal: tokens.listSectionPaddingHorizontal }}>
                            <DraggableFlatList
                                data={pinnedMetrics}
                                keyExtractor={(item) => item.id}
                                renderItem={renderPinnedItem}
                                scrollEnabled={false}
                                contentContainerStyle={styles.pinnedListContent}
                                onDragEnd={async ({ data }) => {
                                    const updatedMetrics = data.map((item, index) => ({
                                        ...item,
                                        order: index * 10
                                    }));

                                    setPinnedMetrics(updatedMetrics);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                                    if (!prefsStore) return;
                                    (async () => {
                                        for (const item of updatedMetrics) {
                                            await prefsStore.updateMetricPreferences(item.id, {
                                                pinnedOrder: item.order
                                            });
                                        }
                                        emit('preferences:changed');
                                    })().catch(console.warn);
                                }}
                            />
                        </View>
                    ) : (
                        <List.Wrapper>
                            <List.Text align="center">
                                {t('pinOrder.dragHint')}
                            </List.Text>
                        </List.Wrapper>
                    )}

                    {/* Available metrics by category */}
                    {availableByCategory.map(({ category, metrics }) => (
                        <View key={category.id}>
                            <List.Section title= {t(`categories.${category.id}`)} rounded>
                                {metrics.map((metric, index) => (
                                    <List.Item
                                        key={metric.id}
                                        title={metric.name}
                                        lastItem={index === metrics.length - 1}
                                        hideChevron
                                        leftCmp={
                                            <AppIcon
                                                name="plus.circle.fill"
                                                tintColor="#34C759"
                                                size={28}
                                            />
                                        }
                                        onPress={() => handlePin(metric.id)}
                                    />
                                ))}
                            </List.Section>
                        </View>
                    ))}
                </ScrollViewContent>
            </ScrollView>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    scrollContent: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    pinnedListContent: {
        gap: 6
    },
    pinnedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        paddingLeft: 18,
        gap: 12,
        height: ITEM_HEIGHT - 6
    },
    itemActive: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5
    },
    itemTitle: {
        flex: 1
    },
    dragHandle: {
        padding: 2
    }
});
