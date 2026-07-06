// Reusable metric/category selection component
// Extracted pattern from sharingSettings.tsx / exportFhir.tsx

import React, { useCallback, useMemo } from 'react';
import { Switch, View } from 'react-native';
import { List } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { getSortedMetricDefinitions } from '@/src/metrics/definitions/index';
import { getCurrentLanguage } from '@/src/i18n';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { withEnabledSharingCategories, type SharingCategory } from '@/src/features/assistiveAidsFeature';

const CATEGORIES: { key: SharingCategory; icon: string; iconColor: string }[] = [
    { key: 'medications', icon: 'pills.fill', iconColor: '#FF3B30' },
    { key: 'aids', icon: 'figure.roll', iconColor: '#FF9500' },
    { key: 'questionnaires', icon: 'list.clipboard.fill', iconColor: '#AF52DE' },
];

export type DataSelection = {
    metricIds: string[];
    categories: Record<string, boolean>;
};

type DataSelectorProps = {
    selection: DataSelection;
    onSelectionChange: (selection: DataSelection) => void;
    readonly?: boolean;
};

export function DataSelector({ selection, onSelectionChange, readonly }: DataSelectorProps) {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const { role } = useAppRole();

    const allMetrics = useMemo(
        () => getSortedMetricDefinitions(i18n.language || getCurrentLanguage()),
        [i18n.language],
    );
    const visibleCategories = useMemo(
        () => withEnabledSharingCategories(CATEGORIES, role),
        [role],
    );

    const allEnabled = useMemo(() => {
        const everyMetric = allMetrics.every(m => selection.metricIds.includes(m.id));
        const allCats = visibleCategories.every(c => selection.categories[c.key]);
        return everyMetric && allCats;
    }, [selection, allMetrics, visibleCategories]);

    const toggleAll = useCallback((value: boolean) => {
        onSelectionChange({
            metricIds: value ? allMetrics.map(m => m.id) : [],
            categories: {
                medications: visibleCategories.some(c => c.key === 'medications') ? value : false,
                aids: visibleCategories.some(c => c.key === 'aids') ? value : false,
                questionnaires: visibleCategories.some(c => c.key === 'questionnaires') ? value : false,
            },
        });
    }, [onSelectionChange, allMetrics, visibleCategories]);

    const toggleMetric = useCallback((metricId: string, value: boolean) => {
        const ids = value
            ? [...selection.metricIds, metricId]
            : selection.metricIds.filter(id => id !== metricId);
        onSelectionChange({ ...selection, metricIds: ids });
    }, [selection, onSelectionChange]);

    const toggleCategory = useCallback((key: string, value: boolean) => {
        onSelectionChange({
            ...selection,
            categories: { ...selection.categories, [key]: value },
        });
    }, [selection, onSelectionChange]);

    return (
        <>
            {/* Toggle All */}
            <List.Section rounded>
                <List.Item
                    title={t('share.sharingSettings.toggleAll')}
                    leftCmpSize={32}
                    leftCmp={<ListItemIcon name="checkmark.circle.fill" color={colors.tint} />}
                    rightCmp={
                        <Switch
                            value={allEnabled}
                            onValueChange={toggleAll}
                            disabled={readonly}
                        />
                    }
                    hideChevron
                    lastItem
                />
            </List.Section>

            {/* Metrics */}
            <List.Section title={t('share.sharingSettings.metricsSection')} rounded>
                {allMetrics.map((metric, index) => (
                    <List.Item
                        key={metric.id}
                        title={metric.name}
                        leftCmpSize={32}
                        leftCmp={<ListItemIcon name={metric.icon} color={metric.iconColor} />}
                        rightCmp={
                            <Switch
                                value={selection.metricIds.includes(metric.id)}
                                onValueChange={val => toggleMetric(metric.id, val)}
                                disabled={readonly}
                            />
                        }
                        hideChevron
                        lastItem={index === allMetrics.length - 1}
                    />
                ))}
            </List.Section>

            {/* Categories */}
            <List.Section title={t('share.sharingSettings.categoriesSection')} rounded>
                {visibleCategories.map((cat, index) => (
                    <List.Item
                        key={cat.key}
                        title={t(`share.sharingSettings.category.${cat.key}`)}
                        leftCmpSize={32}
                        leftCmp={<ListItemIcon name={cat.icon} color={cat.iconColor} />}
                        rightCmp={
                            <Switch
                                value={selection.categories[cat.key] ?? false}
                                onValueChange={val => toggleCategory(cat.key, val)}
                                disabled={readonly}
                            />
                        }
                        hideChevron
                        lastItem={index === visibleCategories.length - 1}
                    />
                ))}
            </List.Section>
        </>
    );
}
