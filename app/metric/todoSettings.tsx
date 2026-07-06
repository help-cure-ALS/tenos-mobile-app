/**
 * Todo Settings Screen
 *
 * Configure which metrics/questionnaires appear in "Heute erledigen"
 * and set their tracking interval.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { List, useTheme } from 'react-native-nice-ui';

import { AppIcon } from '@/src/components/ui/AppIcon';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { CloseButton } from '@/src/components/ui/navigation/CloseButton';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { getMetricDefinition, getPinnableMetrics, type MetricDefinition } from '@/src/metrics';
import { getAllQuestionnaireDefinitions, type QuestionnaireDefinition } from '@/src/questionnaires';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import type { TodoItemConfig } from '@/src/stores/patientPreferencesStore';
import { emit, on } from '@/src/lib/bus';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';

type QuestionnaireItemConfig = {
    key: string;
    name: string;
    icon: string;
    iconColor: string;
    hidden: boolean;
    scheduleLabel: string;
};

type ItemConfig = {
    key: string;
    name: string;
    icon: string;
    iconColor: string;
    enabled: boolean;
    intervalDays: number;
};

type TopSectionItem =
    | { kind: 'metric'; item: ItemConfig & { _def: MetricDefinition } }
    | { kind: 'questionnaire'; item: QuestionnaireItemConfig & { _def: QuestionnaireDefinition } };

function IntervalStepper({
    value,
    onChange,
    colors,
}: {
    value: number;
    onChange: (v: number) => void;
    colors: any;
}) {
    const { t } = useTranslation();

    return (
        <View style={[styles.stepperRow, { backgroundColor: colors.listItemBackgroundMuted }]}>
            <Text style={[styles.stepperLabel, { color: colors.textSecondary }]}>
                {t('todo.intervalPrefix')}
            </Text>
            <Pressable
                onPress={() => onChange(Math.max(1, value - 1))}
                style={[styles.stepperButton, { backgroundColor: colors.border }]}
                hitSlop={8}
            >
                <AppIcon name="minus" tintColor={colors.textPrimary} size={14} />
            </Pressable>
            <Text style={[styles.stepperValue, { color: colors.textPrimary }]}>
                {value}
            </Text>
            <Pressable
                onPress={() => onChange(value + 1)}
                style={[styles.stepperButton, { backgroundColor: colors.border }]}
                hitSlop={8}
            >
                <AppIcon name="plus" tintColor={colors.textPrimary} size={14} />
            </Pressable>
            <Text style={[styles.stepperLabel, { color: colors.textSecondary }]}>
                {value === 1 ? t('todo.intervalDay') : t('todo.intervalDays')}
            </Text>
        </View>
    );
}

function TodoSettingsItem({
    item,
    onToggle,
    onIntervalChange,
    colors,
    isLast,
}: {
    item: ItemConfig;
    onToggle: () => void;
    onIntervalChange: (v: number) => void;
    colors: any;
    isLast: boolean;
}) {
    return (
        <View>
            <List.Item
                title={item.name}
                leftCmpSize={32}
                leftCmp={
                    <ListItemIcon name={item.icon} color={item.iconColor} />
                }
                rightCmp={
                    <Switch value={item.enabled} onValueChange={onToggle} />
                }
                hideChevron
                lastItem={isLast && !item.enabled}
            >
            {item.enabled && (
                <View style={[
                    styles.stepperContainer
                ]}>
                    <IntervalStepper
                        value={item.intervalDays}
                        onChange={onIntervalChange}
                        colors={colors}
                    />
                </View>
            )}
            </List.Item>
        </View>
    );
}

function QuestionnaireSettingsItem({
    item,
    onToggleHidden,
    colors,
    isLast,
}: {
    item: QuestionnaireItemConfig;
    onToggleHidden: () => void;
    colors: any;
    isLast: boolean;
}) {
    const { t } = useTranslation();

    return (
        <List.Item
            title={item.name}
            subtitle={item.hidden ? t('todo.hiddenLabel') : item.scheduleLabel}
            leftCmpSize={32}
            leftCmp={
                <View style={{ opacity: item.hidden ? 0.4 : 1 }}>
                    <ListItemIcon name={item.icon} color={item.iconColor} />
                </View>
            }
            rightCmp={
                <Switch value={!item.hidden} onValueChange={onToggleHidden} />
            }
            hideChevron
            lastItem={isLast}
        />
    );
}

export default function TodoSettingsScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useTheme();
    const router = useSafeRouter();
    const { patientPreferencesStore: prefsStore } = usePatientStores();
    const { isFiltering, isLoaded: sharingLoaded, filterMetrics, canSeeMetric, canSeeCategory } = useSharingFilter();
    const [configs, setConfigs] = useState<Record<string, TodoItemConfig>>({});
    const [loaded, setLoaded] = useState(false);

    const loadConfigs = useCallback(async () => {
        if (!prefsStore) return;
        const todoConfigs = await prefsStore.getTodoConfigs();
        setConfigs(todoConfigs);
        setLoaded(true);
    }, [prefsStore]);

    // Load current configs and refresh when remote sync updates preferences.
    useEffect(() => {
        if (!prefsStore) return;
        loadConfigs();
        const offPrefs = on('preferences:changed', loadConfigs);
        const offFhir = on('fhir:changed', loadConfigs);
        return () => {
            offPrefs();
            offFhir();
        };
    }, [prefsStore, loadConfigs]);

    // Get available metrics.
    // Patient/demo: keep existing behavior (only non-computed configurable todo metrics).
    // Doctor/caregiver: include computed metrics in read list and filter by sharing rights.
    const metrics: MetricDefinition[] = useMemo(() => {
        // TDEE is informational/computed and has no todo action.
        const allPinnable = getPinnableMetrics(i18n.language).filter(def => def.id !== 'tdee');
        const base = isFiltering
            ? allPinnable
            : allPinnable.filter(def => !def.computed);
        const visible = !isFiltering
            ? base
            : (sharingLoaded ? filterMetrics(base) : []);
        return [...visible].sort((a, b) =>
            a.name.localeCompare(b.name, i18n.language, { sensitivity: 'base' })
        );
    }, [i18n.language, isFiltering, sharingLoaded, filterMetrics]);

    // Scheduled questionnaires split into:
    // - metricLikeQuestionnaires: allowAsMetric=true (render in metrics section)
    // - regularQuestionnaires: all others (render in questionnaires section)
    const { metricLikeQuestionnaires, regularQuestionnaires } = useMemo(() => {
        const scheduled = getAllQuestionnaireDefinitions(i18n.language).filter(def => def.schedule);
        const metricLike = scheduled.filter(def => def.allowAsMetric === true);
        const regular = scheduled.filter(def => def.allowAsMetric !== true);

        // Patient/demo: keep all visible (no sharing filter)
        if (!isFiltering) {
            return {
                metricLikeQuestionnaires: metricLike,
                regularQuestionnaires: regular,
            };
        }

        // Doctor/caregiver: fail-closed until sharing data is loaded
        if (!sharingLoaded) {
            return {
                metricLikeQuestionnaires: [] as QuestionnaireDefinition[],
                regularQuestionnaires: [] as QuestionnaireDefinition[],
            };
        }

        const visibleMetricLike = metricLike.filter(def => canSeeMetric(def.metricAccessId ?? def.id));
        const visibleRegular = canSeeCategory('questionnaires') ? regular : [];

        return {
            metricLikeQuestionnaires: visibleMetricLike,
            regularQuestionnaires: visibleRegular,
        };
    }, [i18n.language, isFiltering, sharingLoaded, canSeeMetric, canSeeCategory]);

    const getItemConfig = useCallback((key: string, def: MetricDefinition): ItemConfig => {
        const config = configs[key];
        const hasSchedule = !!def.schedule;
        return {
            key,
            name: def.name,
            icon: def.icon,
            iconColor: def.iconColor,
            enabled: config?.enabled ?? hasSchedule,
            intervalDays: config?.intervalDays ?? (def.schedule?.frequencyDays ?? 1),
        };
    }, [configs]);

    const handleToggle = useCallback(async (key: string, def?: MetricDefinition) => {
        if (!prefsStore) return;
        const current = configs[key];
        const hasSchedule = !!def?.schedule;
        const isCurrentlyEnabled = current?.enabled ?? hasSchedule;

        if (isCurrentlyEnabled) {
            if (hasSchedule) {
                // Schedule metric: save explicit disabled state
                const newConfig: TodoItemConfig = { enabled: false, intervalDays: current?.intervalDays ?? def!.schedule!.frequencyDays };
                await prefsStore.setTodoConfig(key, newConfig);
                setConfigs(prev => ({ ...prev, [key]: newConfig }));
            } else {
                // Non-schedule metric: remove config
                await prefsStore.setTodoConfig(key, null);
                setConfigs(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            }
        } else {
            if (hasSchedule) {
                // Re-enable schedule metric: remove config to fall back to schedule defaults
                await prefsStore.setTodoConfig(key, null);
                setConfigs(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            } else {
                // Enable non-schedule metric: set default config
                const newConfig: TodoItemConfig = { enabled: true, intervalDays: current?.intervalDays ?? 1 };
                await prefsStore.setTodoConfig(key, newConfig);
                setConfigs(prev => ({ ...prev, [key]: newConfig }));
            }
        }
        emit('preferences:changed');
    }, [prefsStore, configs]);

    const handleIntervalChange = useCallback(async (key: string, intervalDays: number) => {
        if (!prefsStore) return;
        const newConfig: TodoItemConfig = { enabled: true, intervalDays };
        await prefsStore.setTodoConfig(key, newConfig);
        setConfigs(prev => ({ ...prev, [key]: newConfig }));
        emit('preferences:changed');
    }, [prefsStore]);

    // Toggle questionnaire hidden state (switch OFF = hidden, ON = visible)
    const handleToggleQuestionnaireHidden = useCallback(async (key: string, def: QuestionnaireDefinition) => {
        if (!prefsStore) return;
        const current = configs[key];
        const hiddenByDefault = def.todoByDefault === false;
        const isCurrentlyHidden = current ? !current.enabled : hiddenByDefault;

        if (isCurrentlyHidden) {
            if (hiddenByDefault) {
                // todoByDefault=false: must explicitly enable
                const newConfig: TodoItemConfig = { enabled: true, intervalDays: def.schedule!.frequencyDays };
                await prefsStore.setTodoConfig(key, newConfig);
                setConfigs(prev => ({ ...prev, [key]: newConfig }));
            } else {
                // todoByDefault=true: remove config to fall back to default
                await prefsStore.setTodoConfig(key, null);
                setConfigs(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            }
        } else {
            if (!hiddenByDefault && !current) {
                // todoByDefault=true, no config: explicitly disable
                const newConfig: TodoItemConfig = { enabled: false, intervalDays: def.schedule!.frequencyDays };
                await prefsStore.setTodoConfig(key, newConfig);
                setConfigs(prev => ({ ...prev, [key]: newConfig }));
            } else if (hiddenByDefault && current?.enabled) {
                // todoByDefault=false, explicitly enabled: remove config to fall back to hidden
                await prefsStore.setTodoConfig(key, null);
                setConfigs(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            } else {
                // Generic hide
                const newConfig: TodoItemConfig = { enabled: false, intervalDays: current?.intervalDays ?? def.schedule!.frequencyDays };
                await prefsStore.setTodoConfig(key, newConfig);
                setConfigs(prev => ({ ...prev, [key]: newConfig }));
            }
        }
        emit('preferences:changed');
    }, [prefsStore, configs]);

    if (!loaded || (isFiltering && !sharingLoaded)) return null;

    const rawMetricItems = metrics.map(def => ({
        ...getItemConfig(`metric:${def.id}`, def),
        _def: def,
    }));

    const getScheduleLabel = (def: QuestionnaireDefinition): string => {
        const days = def.schedule!.frequencyDays;
        if (days === 1) return t('todo.scheduleDaily');
        return t('todo.scheduleEvery', { days });
    };

    const metricLikeQuestionnaireItems = metricLikeQuestionnaires
        .map(def => {
            const key = `questionnaire:${def.id}`;
            const config = configs[key];
            const hiddenByDefault = def.todoByDefault === false;
            const linkedMetric = getMetricDefinition(def.metricAccessId ?? def.id, i18n.language);
            return {
                key,
                name: linkedMetric?.name ?? def.displayName ?? def.name,
                icon: def.icon,
                iconColor: def.iconColor,
                hidden: config ? !config.enabled : hiddenByDefault,
                scheduleLabel: getScheduleLabel(def),
                _def: def,
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name, i18n.language, { sensitivity: 'base' }));

    // Deduplicate top-section items:
    // if a questionnaire is promoted via allowAsMetric, hide the corresponding metric card.
    const metricLikeAccessIds = new Set(
        metricLikeQuestionnaireItems.map((item) => item._def.metricAccessId ?? item._def.id)
    );
    const metricItems = rawMetricItems.filter((item) => !metricLikeAccessIds.has(item._def.id));

    const topSectionItems: TopSectionItem[] = [
        ...metricItems.map((item) => ({ kind: 'metric' as const, item })),
        ...metricLikeQuestionnaireItems.map((item) => ({ kind: 'questionnaire' as const, item })),
    ].sort((a, b) => a.item.name.localeCompare(b.item.name, i18n.language, { sensitivity: 'base' }));

    const questionnaireItems = regularQuestionnaires
        .map(def => {
        const key = `questionnaire:${def.id}`;
        const config = configs[key];
        // No config: use todoByDefault (default true) to determine initial state
        const hiddenByDefault = def.todoByDefault === false;
        return {
            key,
            name: def.displayName ?? def.name,
            icon: def.icon,
            iconColor: def.iconColor,
            hidden: config ? !config.enabled : hiddenByDefault,
            scheduleLabel: getScheduleLabel(def),
            _def: def,
        };
    })
        .sort((a, b) => a.name.localeCompare(b.name, i18n.language, { sensitivity: 'base' }));

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: t('todo.settingsTitle'),
                        headerRight: () => (
                            <CloseButton onPress={() => router.back()} />
                        ),
                    }}
                />
            ) : (
                <Stack.Screen>
                    <Stack.Screen.Title>{t('todo.settingsTitle')}</Stack.Screen.Title>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button icon="xmark" variant="plain" onPress={() => router.back()} />
                    </Stack.Toolbar>
                </Stack.Screen>
            )}
            <ScrollView
                style={{ backgroundColor: colors.background }}
                contentContainerStyle={styles.scrollContent}
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScrollViewContent>
                    {/* Metrics section */}
                    {topSectionItems.length > 0 && (
                        <List.Section rounded title={t('todo.metricsSection')}>
                            {topSectionItems.map((entry, i) => (
                                entry.kind === 'metric' ? (
                                    <TodoSettingsItem
                                        key={entry.item.key}
                                        item={entry.item}
                                        onToggle={() => handleToggle(entry.item.key, entry.item._def)}
                                        onIntervalChange={(v) => handleIntervalChange(entry.item.key, v)}
                                        colors={colors}
                                        isLast={i === topSectionItems.length - 1}
                                    />
                                ) : (
                                    <QuestionnaireSettingsItem
                                        key={entry.item.key}
                                        item={entry.item}
                                        onToggleHidden={() => handleToggleQuestionnaireHidden(entry.item.key, entry.item._def)}
                                        colors={colors}
                                        isLast={i === topSectionItems.length - 1}
                                    />
                                )
                            ))}
                        </List.Section>
                    )}

                    {/* Questionnaires section */}
                    {questionnaireItems.length > 0 && (
                        <List.Section rounded title={t('todo.questionnairesSection')}>
                            {questionnaireItems.map((item, i) => (
                                <QuestionnaireSettingsItem
                                    key={item.key}
                                    item={item}
                                    onToggleHidden={() => handleToggleQuestionnaireHidden(item.key, item._def)}
                                    colors={colors}
                                    isLast={i === questionnaireItems.length - 1}
                                />
                            ))}
                        </List.Section>
                    )}
                </ScrollViewContent>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingBottom: 40,
    },
    stepperContainer: {
        alignItems: 'flex-start',
        paddingLeft: 36,
        paddingBottom: 12,
        paddingTop: 0,
    },
    stepperRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 5,
        borderRadius: 20,
        paddingHorizontal: 12
    },
    stepperButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperValue: {
        fontSize: 17,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
        minWidth: 24,
        textAlign: 'center',
    },
    stepperLabel: {
        fontSize: 15,
    },
});
