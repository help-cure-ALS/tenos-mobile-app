/**
 * useTodoItems Hook
 *
 * Loads todo configuration + completion status for the "Heute erledigen" section.
 * Computes whether each item is due based on configurable interval.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { on } from '@/src/lib/bus';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import type { TodoItemConfig } from '@/src/stores/patientPreferencesStore';
import { getMetricDefinition } from '@/src/metrics';
import { getAllMetricDefinitions } from '@/src/metrics/definitions';
import { getEntriesFromCache } from '@/src/metrics/hooks/observationsCache';
import {
    getAllQuestionnaireDefinitions,
    getQuestionnaireAvailability,
    getQuestionnaireDefinition,
    loadQuestionnaireEntries,
} from '@/src/questionnaires';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { useAppRole } from '@/src/context/AppRoleProvider';
import {
    evaluateTodoRules,
    collectRuleDataSources,
    type TodoRuleContext,
} from '@/src/hooks/todoRuleEngine';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';

export type TodoItem = {
    key: string;              // "metric:weight" / "questionnaire:alsfrs-r"
    type: 'metric' | 'questionnaire';
    id: string;               // "weight" / "alsfrs-r"
    name: string;             // Localized name
    icon: string;             // SF Symbol
    iconColor: string;
    intervalDays: number;
    isDue: boolean;
    isYesterdayMissed: boolean; // Was due yesterday and not completed
    daysSinceLastEntry: number | null;
};

export type UseTodoItemsReturn = {
    items: TodoItem[];        // Sorted: due first, then completed
    isLoading: boolean;
    allCompleted: boolean;
    hasConfiguredItems: boolean;
    yesterdayMissedItems: TodoItem[]; // Items missed yesterday
};

const DAY_MS = 24 * 60 * 60 * 1000;

function computeDaysSince(lastEntryDate: Date | null): number | null {
    if (!lastEntryDate) return null;
    return Math.floor((Date.now() - lastEntryDate.getTime()) / DAY_MS);
}

function isDue(lastEntryDate: Date | null, intervalDays: number): boolean {
    if (!lastEntryDate) return true;
    const daysSince = Math.floor((Date.now() - lastEntryDate.getTime()) / DAY_MS);
    return daysSince >= intervalDays;
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

/**
 * Check if a due item is within its display window.
 * When showForDays is set, items cycle between visible and hidden
 * based on how many days have passed since they became due.
 */
function isInDisplayWindow(daysSinceLast: number | null, intervalDays: number, showForDays?: number): boolean {
    if (daysSinceLast === null) return true;      // No entry → always show
    if (showForDays === undefined) return true;    // No limit → always show (when due)
    const overdueDays = daysSinceLast - intervalDays;
    if (overdueDays < 0) return false;             // Not yet due
    return (overdueDays % intervalDays) < showForDays;
}

/**
 * Check if enough days have passed since account creation for this item to appear.
 * Returns true if the item should be skipped (too early).
 */
function isTooEarlyForStart(startAfterDays: number | undefined, accountCreatedAt: string | undefined): boolean {
    if (startAfterDays === undefined || startAfterDays <= 0) return false;
    if (!accountCreatedAt) return false; // No creation date → don't block
    const createdDate = new Date(accountCreatedAt);
    const daysSinceCreation = Math.floor((Date.now() - createdDate.getTime()) / DAY_MS);
    return daysSinceCreation < startAfterDays;
}

function wasYesterdayMissed(lastEntryDate: Date | null, intervalDays: number): boolean {
    if (intervalDays > 1) return false; // Only relevant for daily items
    if (!lastEntryDate) return true;

    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const entryDay = new Date(
        lastEntryDate.getFullYear(),
        lastEntryDate.getMonth(),
        lastEntryDate.getDate()
    );

    // If last entry was before yesterday, yesterday was missed
    return entryDay.getTime() < yesterday.getTime();
}

export function useTodoItems(): UseTodoItemsReturn {
    const { i18n } = useTranslation();
    const { list, count } = useFhirRepo();
    const { activePatientId } = useAppRole();
    const { patientPreferencesStore: prefsStore } = usePatientStores();
    const { canSeeMetric, canSeeCategory } = useSharingFilter();
    const [configs, setConfigs] = useState<Record<string, TodoItemConfig>>({});
    const [items, setItems] = useState<TodoItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadConfigs = useCallback(async () => {
        if (!prefsStore) { setConfigs({}); return; }
        const todoConfigs = await prefsStore.getTodoConfigs();
        setConfigs(todoConfigs);
    }, [prefsStore]);

    // Load configs on mount and whenever local OR remote preference updates arrive.
    useEffect(() => {
        loadConfigs();
        const offPrefs = on('preferences:changed', loadConfigs);
        const offFhir = on('fhir:changed', loadConfigs);
        return () => {
            offPrefs();
            offFhir();
        };
    }, [loadConfigs]);

    // Build items whenever configs, language, or FHIR data changes
    const buildItems = useCallback(async () => {
        const language = i18n.language;
        const listFn = async (resourceType: string, opts?: { tag?: string }) => {
            return list(resourceType, { limit: 1000, ...opts });
        };

        const result: TodoItem[] = [];

        // Load account creation date for startAfterDays checks
        const accountCreatedAt = prefsStore ? await prefsStore.getCreatedAt() : undefined;

        // Pre-load data for todo rules evaluation
        const allRules = [
            ...getAllMetricDefinitions(language).flatMap(d => d.todoRules ?? []),
            ...getAllQuestionnaireDefinitions(language).flatMap(d => d.todoRules ?? []),
        ];
        const { questionnaireIds, metricIds } = collectRuleDataSources(allRules);

        const ruleCtx: TodoRuleContext = {
            questionnaireEntries: new Map(),
            metricEntries: new Map(),
        };

        if (activePatientId && (questionnaireIds.size > 0 || metricIds.size > 0)) {
            await Promise.all([
                // Load questionnaire entries for rules
                ...Array.from(questionnaireIds).map(async (qId) => {
                    const qDef = getQuestionnaireDefinition(qId, language);
                    if (!qDef) return;
                    const entries = await loadQuestionnaireEntries(qDef, listFn);
                    if (entries.length > 0) {
                        ruleCtx.questionnaireEntries.set(qId, entries[0]);
                    }
                }),
                // Load metric entries for rules
                ...Array.from(metricIds).map(async (mId) => {
                    const entries = await getEntriesFromCache(mId, activePatientId, list, count);
                    if (entries.length > 0) {
                        ruleCtx.metricEntries.set(mId, entries[0]);
                    }
                }),
            ]);
        }

        // 1) Metrics: manually configured (enabled in config)
        const metricKeys = Object.entries(configs)
            .filter(([key, c]) => key.startsWith('metric:') && c.enabled)
            .map(([key, c]) => ({ key, config: c }));

        await Promise.all(metricKeys.map(async ({ key, config }) => {
            const id = key.split(':')[1];
            const def = getMetricDefinition(id, language);
            if (!def) return;

            let lastEntryDate: Date | null = null;
            if (activePatientId) {
                const entries = await getEntriesFromCache(id, activePatientId, list, count);
                if (entries.length > 0) {
                    lastEntryDate = entries[0].date;
                }
            }

            const daysSince = computeDaysSince(lastEntryDate);
            const itemIsDue = isDue(lastEntryDate, config.intervalDays);

            // showForDays: hide due items outside their display window
            if (itemIsDue && !isInDisplayWindow(daysSince, config.intervalDays, def.schedule?.showForDays)) return;

            result.push({
                key,
                type: 'metric',
                id,
                name: def.shortName || def.name,
                icon: def.icon,
                iconColor: def.iconColor,
                intervalDays: config.intervalDays,
                isDue: itemIsDue,
                isYesterdayMissed: wasYesterdayMissed(lastEntryDate, config.intervalDays),
                daysSinceLastEntry: daysSince,
            });
        }));

        // 2) Metrics with schedule but no config: auto-show with schedule interval
        const allMetrics = getAllMetricDefinitions(language);
        const scheduledMetrics = allMetrics.filter(def => def.schedule && !def.computed);

        await Promise.all(scheduledMetrics.map(async (def) => {
            const key = `metric:${def.id}`;
            const config = configs[key];

            // Already processed above (manually enabled) → skip
            if (config?.enabled) return;
            // Explicitly disabled by patient → skip
            if (config && !config.enabled) return;
            // Skip if not shown in todo by default and rules don't match
            if (def.todoByDefault === false && !config?.enabled) {
                if (!evaluateTodoRules(def.todoRules, ruleCtx)) return;
            }
            // Skip if account is too new for this metric
            if (isTooEarlyForStart(def.schedule!.startAfterDays, accountCreatedAt)) return;
            // No config → auto-show with schedule interval
            const intervalDays = def.schedule!.frequencyDays;

            let lastEntryDate: Date | null = null;
            if (activePatientId) {
                const entries = await getEntriesFromCache(def.id, activePatientId, list, count);
                if (entries.length > 0) {
                    lastEntryDate = entries[0].date;
                }
            }

            const daysSince = computeDaysSince(lastEntryDate);
            const itemIsDue = isDue(lastEntryDate, intervalDays);

            // showForDays: hide due items outside their display window
            if (itemIsDue && !isInDisplayWindow(daysSince, intervalDays, def.schedule!.showForDays)) return;

            result.push({
                key,
                type: 'metric',
                id: def.id,
                name: def.shortName || def.name,
                icon: def.icon,
                iconColor: def.iconColor,
                intervalDays,
                isDue: itemIsDue,
                isYesterdayMissed: wasYesterdayMissed(lastEntryDate, intervalDays),
                daysSinceLastEntry: daysSince,
            });
        }));

        // 3) Questionnaires: automatically from schedule
        const allQuestionnaires = getAllQuestionnaireDefinitions(language);
        const scheduledQuestionnaires = allQuestionnaires.filter(def => def.schedule);

        await Promise.all(scheduledQuestionnaires.map(async (def) => {
            const key = `questionnaire:${def.id}`;

            // Skip if user explicitly hid this questionnaire
            const config = configs[key];
            if (config && !config.enabled) return;
            // Skip if not shown in todo by default and rules don't match
            if (def.todoByDefault === false && !config?.enabled) {
                if (!evaluateTodoRules(def.todoRules, ruleCtx)) return;
            }
            // Skip if account is too new for this questionnaire (unless user explicitly enabled)
            if (!config?.enabled && isTooEarlyForStart(def.schedule!.startAfterDays, accountCreatedAt)) return;

            // Load last completed date
            let lastCompletedAt: Date | null = null;
            const entries = await loadQuestionnaireEntries(def, listFn);
            if (entries.length > 0) {
                lastCompletedAt = entries[0].completedAt;
            }

            // Check availability via schedule
            const availability = getQuestionnaireAvailability(def, lastCompletedAt);
            if (!availability.available) return;

            const completedToday = lastCompletedAt != null && isSameDay(lastCompletedAt, new Date());
            const isDueToday = (availability.dueInDays ?? 0) <= 0;

            // Show only on due days. Completed today = was due today, show as checked off.
            if (!isDueToday && !completedToday) return;

            // showForDays: hide due items outside their display window
            const intervalDays = def.schedule!.frequencyDays;
            if (isDueToday && def.schedule?.showForDays !== undefined && lastCompletedAt) {
                const daysSinceLast = Math.floor((Date.now() - lastCompletedAt.getTime()) / DAY_MS);
                if (!isInDisplayWindow(daysSinceLast, intervalDays, def.schedule.showForDays)) return;
            }

            result.push({
                key,
                type: 'questionnaire',
                id: def.id,
                name: def.displayName || def.shortName || def.name,
                icon: def.icon,
                iconColor: def.iconColor,
                intervalDays,
                isDue: isDueToday && !completedToday,
                isYesterdayMissed: false,
                daysSinceLastEntry: computeDaysSince(lastCompletedAt),
            });
        }));

        // Filter by sharing preferences (doctor/caregiver only see allowed items)
        const filtered = result.filter(item => {
            if (item.type === 'metric') return canSeeMetric(item.id);
            if (item.type === 'questionnaire') return canSeeCategory('questionnaires');
            return true;
        });

        // Sort: due first, then completed
        filtered.sort((a, b) => {
            if (a.isDue && !b.isDue) return -1;
            if (!a.isDue && b.isDue) return 1;
            return 0;
        });

        setItems(filtered);
        setIsLoading(false);
    }, [configs, i18n.language, list, count, activePatientId, prefsStore, canSeeMetric, canSeeCategory]);

    useEffect(() => {
        buildItems();
        const offFhir = on('fhir:changed', buildItems);
        return () => { offFhir(); };
    }, [buildItems]);

    const hasConfiguredItems = items.length > 0 || Object.values(configs).some(c => c.enabled);
    const allCompleted = hasConfiguredItems && items.length > 0 && items.every(i => !i.isDue);
    const yesterdayMissedItems = useMemo(
        () => items.filter(i => i.isYesterdayMissed && i.isDue),
        [items]
    );

    return {
        items,
        isLoading,
        allCompleted,
        hasConfiguredItems,
        yesterdayMissedItems,
    };
}
