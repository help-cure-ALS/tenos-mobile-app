import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, List, Space, Text } from 'react-native-nice-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { getSortedMetricDefinitions } from '@/src/metrics/definitions/index';
import { getAllQuestionnaireDefinitions } from '@/src/questionnaires/definitions/index';
import { getCurrentLanguage } from '@/src/i18n';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';
import { useAuthLock } from '@/src/context/AuthLockProvider';
import { getPatientFhirStore } from '@/src/stores/patientFhirStore';
import { buildExportBundle } from '@/src/lib/fhir-export/buildExportBundle';
import { exportPdfToShareSheet } from '@/src/lib/pdf-export/exportPdfToShareSheet';
import type { ExportSelection } from '@/src/lib/fhir-export/types';
import { HeaderButton } from "@/src/components/ui/navigation/HeaderButton";
import { withEnabledSharingCategories, type SharingCategory } from '@/src/features/assistiveAidsFeature';

const CATEGORIES: { key: SharingCategory; labelKey: string; icon: string; iconColor: string }[] = [
    { key: 'medications', labelKey: 'share.sharingSettings.category.medications', icon: 'pills.fill', iconColor: '#FF3B30' },
    { key: 'aids', labelKey: 'share.sharingSettings.category.aids', icon: 'figure.roll', iconColor: '#FF9500' },
    { key: 'questionnaires', labelKey: 'share.sharingSettings.category.questionnaires', icon: 'list.clipboard.fill', iconColor: '#AF52DE' },
];

export default function ExportPdfScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { role, activePatientId, isLoading: roleLoading } = useAppRole();
    const { unlock } = useAuthLock();
    const [isExporting, setIsExporting] = useState(false);
    const enabledCategories = useMemo(
        () => withEnabledSharingCategories(CATEGORIES, role),
        [role],
    );

    // For caregiver: filter by sharing permissions
    const sharingRole = role === 'caregiver' ? 'caregiver' : undefined;
    const { isLoaded: isSharingFilterLoaded, filterMetrics, canSeeCategory } = useSharingFilter(sharingRole);

    const allMetrics = useMemo(
        () => getSortedMetricDefinitions(i18n.language || getCurrentLanguage()),
        [i18n.language]
    );

    const allQuestionnaires = useMemo(
        () => getAllQuestionnaireDefinitions(i18n.language || getCurrentLanguage()),
        [i18n.language]
    );

    // Apply sharing filter for caregiver
    const isFiltered = role === 'caregiver';
    const metrics = useMemo(() => {
        const sorted = [...allMetrics].sort((a, b) => a.name.localeCompare(b.name));
        if (!isFiltered) return sorted;
        if (!isSharingFilterLoaded) return [];
        return filterMetrics(sorted);
    }, [allMetrics, isFiltered, isSharingFilterLoaded, filterMetrics]);

    const visibleCategories = useMemo(() => {
        if (!isFiltered) return enabledCategories;
        if (!isSharingFilterLoaded) return [];
        return enabledCategories.filter(c => canSeeCategory(c.key));
    }, [enabledCategories, isFiltered, isSharingFilterLoaded, canSeeCategory]);

    // State: toggles
    const [metricToggles, setMetricToggles] = useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = {};
        for (const m of allMetrics) init[m.id] = true;
        return init;
    });
    const [categoryToggles, setCategoryToggles] = useState<Record<SharingCategory, boolean>>({
        medications: true,
        aids: true,
        questionnaires: true,
    });

    // Derived: all enabled?
    const allEnabled = useMemo(() => {
        const everyMetric = metrics.every(m => metricToggles[m.id]);
        const allCats = visibleCategories.every(c => categoryToggles[c.key]);
        return everyMetric && allCats;
    }, [metricToggles, categoryToggles, metrics, visibleCategories]);

    const toggleAll = useCallback((value: boolean) => {
        const newMetric: Record<string, boolean> = {};
        for (const m of metrics) newMetric[m.id] = value;
        setMetricToggles(newMetric);
        setCategoryToggles({
            medications: visibleCategories.some(c => c.key === 'medications') ? value : false,
            aids: visibleCategories.some(c => c.key === 'aids') ? value : false,
            questionnaires: visibleCategories.some(c => c.key === 'questionnaires') ? value : false,
        });
    }, [metrics, visibleCategories]);

    const toggleMetric = useCallback((metricId: string, value: boolean) => {
        setMetricToggles(prev => ({ ...prev, [metricId]: value }));
    }, []);

    const toggleCategory = useCallback((key: SharingCategory, value: boolean) => {
        setCategoryToggles(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleExport = useCallback(async () => {
        if (!activePatientId) return;

        const unlocked = await unlock();
        if (!unlocked) return;

        setIsExporting(true);
        try {
            const store = getPatientFhirStore();

            const selection: ExportSelection = {
                metricIds: metrics.filter(m => metricToggles[m.id]).map(m => m.id),
                categories: {
                    medications: categoryToggles.medications && visibleCategories.some(c => c.key === 'medications'),
                    aids: categoryToggles.aids && visibleCategories.some(c => c.key === 'aids'),
                    questionnaires: categoryToggles.questionnaires && visibleCategories.some(c => c.key === 'questionnaires'),
                },
            };

            const bundle = await buildExportBundle(
                store,
                activePatientId,
                selection,
                allMetrics,
                allQuestionnaires
            );

            const language = (i18n.language?.startsWith('de') ? 'de' : 'en') as 'de' | 'en';

            await exportPdfToShareSheet({
                bundle,
                metricDefinitions: allMetrics,
                questionnaireDefinitions: allQuestionnaires,
                language,
            });
        } catch (e: any) {
            Alert.alert(t('common.error'), e?.message ?? t('share.exportPdfError'));
        } finally {
            setIsExporting(false);
        }
    }, [activePatientId, unlock, metrics, metricToggles, categoryToggles, visibleCategories, allMetrics, allQuestionnaires, t, i18n.language]);

    // Fail-closed: loading state
    if (roleLoading || (isFiltered && !isSharingFilterLoaded)) {
        return (
            <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
                <Stack.Screen options={{ headerTitle: '' }} />
                <View style={styles.loading}>
                    <ActivityIndicator />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: t('share.exportPdf'),
                        headerRight: () => (
                            <HeaderButton
                                onPress={() => router.back()}
                                title={t('common.done')}
                            />
                        ),
                    }}
                />
            ) : (
                <Stack.Screen>
                    <Stack.Screen.Title>{t('share.exportPdf')}</Stack.Screen.Title>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button onPress={() => router.back()}>{t('common.done')}</Stack.Toolbar.Button>
                    </Stack.Toolbar>
                </Stack.Screen>
            )}

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScreenHeader
                    subtitle={t('share.exportPdfDescription')}
                />

                <Space size="sm" />

                {/* Toggle All */}
                <List.Section rounded>
                    <List.Item
                        title={t('share.exportPdfToggleAll')}
                        leftCmpSize={32}
                        leftCmp={<ListItemIcon name="checkmark.circle.fill" color={colors.tint} />}
                        rightCmp={
                            <Switch
                                value={allEnabled}
                                onValueChange={toggleAll}
                            />
                        }
                        hideChevron
                        lastItem
                    />
                </List.Section>

                {/* Metrics Section */}
                {metrics.length > 0 && (
                    <List.Section
                        title={t('share.exportPdfMetrics')}
                        rounded
                    >
                        {metrics.map((metric, index) => (
                            <List.Item
                                key={metric.id}
                                title={metric.name}
                                leftCmpSize={32}
                                leftCmp={<ListItemIcon name={metric.icon} color={metric.iconColor} />}
                                rightCmp={
                                    <Switch
                                        value={metricToggles[metric.id] ?? false}
                                        onValueChange={(val) => toggleMetric(metric.id, val)}
                                    />
                                }
                                hideChevron
                                lastItem={index === metrics.length - 1}
                            />
                        ))}
                    </List.Section>
                )}

                {/* Categories Section */}
                {visibleCategories.length > 0 && (
                    <List.Section
                        title={t('share.exportPdfCategories')}
                        rounded
                    >
                        {visibleCategories.map((cat, index) => (
                            <List.Item
                                key={cat.key}
                                title={t(cat.labelKey)}
                                leftCmpSize={32}
                                leftCmp={<ListItemIcon name={cat.icon} color={cat.iconColor} />}
                                rightCmp={
                                    <Switch
                                        value={categoryToggles[cat.key]}
                                        onValueChange={(val) => toggleCategory(cat.key, val)}
                                    />
                                }
                                hideChevron
                                lastItem={index === visibleCategories.length - 1}
                            />
                        ))}
                    </List.Section>
                )}

            </ScrollView>

            {/* Export Button – fixed at bottom */}
            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.modalBackground }]}>
                <Button
                    title={t('share.exportPdfButton')}
                    onPress={handleExport}
                    disabled={isExporting}
                    loading={isExporting}
                    rounded
                    />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 20,
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomBar: {
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(128,128,128,0.2)',
    },
    exportButton: {
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    exportButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});
