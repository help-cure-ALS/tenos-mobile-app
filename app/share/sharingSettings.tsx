/**
 * Sharing Settings Modal
 *
 * Allows the patient to configure which metrics and data categories
 * are shared with a specific role (doctor or caregiver).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { List, Space, Text } from 'react-native-nice-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { getSortedMetricDefinitions } from '@/src/metrics/definitions/index';
import { getCurrentLanguage } from '@/src/i18n';
import type { ShareTarget } from '@/src/stores/patientPreferencesStore';
import { useVerification } from '@/src/hooks/usePatientPreferences';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';
import { useActivePatientOwnerAccess } from '@/src/hooks/useActivePatientOwnerAccess';
import { on } from '@/src/lib/bus';
import { HeaderButton } from "@/src/components/ui/navigation/HeaderButton";
import { withEnabledSharingCategories, type SharingCategory } from '@/src/features/assistiveAidsFeature';

const CATEGORIES: { key: SharingCategory; icon: string; iconColor: string }[] = [
    { key: 'medications', icon: 'pills.fill', iconColor: '#FF3B30' },
    { key: 'aids', icon: 'figure.roll', iconColor: '#FF9500' },
    { key: 'questionnaires', icon: 'list.clipboard.fill', iconColor: '#AF52DE' }
];

export default function SharingSettingsScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { patientPreferencesStore: store } = usePatientStores();

    const params = useLocalSearchParams<{ role: string; name: string; deviceId: string }>();
    const role = (params.role === 'caregiver' ? 'caregiver' : params.role === 'research' ? 'research' : 'doctor') as ShareTarget;
    const displayName = params.name ?? '';
    const { isDemo, role: appRole } = useAppRole();
    const { hasOwnerAccess, isLoaded: ownerAccessLoaded } = useActivePatientOwnerAccess();
    const { status: verificationStatus, refresh: refreshVerification } = useVerification();
    useFocusEffect(useCallback(() => { refreshVerification(); }, [refreshVerification]));
    const { isLoaded: isSharingFilterLoaded, filterMetrics, canSeeCategory } = useSharingFilter(role);
    const isResearch = role === 'research';
    const isVerified = verificationStatus === 'verified';
    const disableToggles = isDemo || (isResearch && !isVerified);
    const ownerAccessReady = appRole !== 'caregiver' || ownerAccessLoaded;
    const canManageSharing = appRole === 'patient' || appRole === 'demo' || (appRole === 'caregiver' && hasOwnerAccess);
    const isViewOnly = !canManageSharing;
    const enabledCategories = useMemo(
        () => withEnabledSharingCategories(CATEGORIES, appRole),
        [appRole],
    );

    // State: metric sharing toggles keyed by metricId
    const [metricSharing, setMetricSharing] = useState<Record<string, boolean>>({});
    // State: category sharing toggles
    const [categorySharing, setCategorySharing] = useState<Record<SharingCategory, boolean>>({
        medications: false,
        aids: false,
        questionnaires: false
    });
    const [isLoading, setIsLoading] = useState(true);

    const allMetrics = useMemo(
        () => getSortedMetricDefinitions(i18n.language || getCurrentLanguage()),
        [i18n.language]
    );

    // Load current sharing state
    const loadState = useCallback(async () => {
        if (!store) {
            return;
        }

        const metricStates: Record<string, boolean> = {};
        const allPrefs = await store.getAll();

        for (const metric of allMetrics) {
            const shareWith = allPrefs.metrics[metric.id]?.shareWith ?? [];
            metricStates[metric.id] = shareWith.includes(role);
        }
        setMetricSharing(metricStates);

        const catStates = { medications: false, aids: false, questionnaires: false };
        for (const cat of enabledCategories) {
            const targets = allPrefs.sharing?.[cat.key] ?? [];
            catStates[cat.key] = targets.includes(role);
        }
        setCategorySharing(catStates);

        setIsLoading(false);
    }, [store, role, allMetrics, enabledCategories]);

    useEffect(() => {
        if (isViewOnly) {
            setIsLoading(false);
            return;
        }
        loadState();
        const offFhir = on('fhir:changed', loadState);
        const offPrefs = on('preferences:changed', loadState);
        return () => {
            offFhir();
            offPrefs();
        };
    }, [isViewOnly, loadState]);

    // Toggle metric sharing
    const toggleMetric = useCallback(async (metricId: string, value: boolean) => {
        if (!store) {
            return;
        }

        // Optimistic update
        setMetricSharing(prev => ({ ...prev, [metricId]: value }));

        const current = await store.getShareWith(metricId);
        const updated = value
            ? [...current.filter(t => t !== role), role]
            : current.filter(t => t !== role);
        await store.setShareWith(metricId, updated);
    }, [store, role]);

    // Toggle category sharing
    const toggleCategory = useCallback(async (category: SharingCategory, value: boolean) => {
        if (!store) {
            return;
        }

        // Optimistic update
        setCategorySharing(prev => ({ ...prev, [category]: value }));

        const current = await store.getCategorySharing(category);
        const updated = value
            ? [...current.filter(t => t !== role), role]
            : current.filter(t => t !== role);
        await store.setCategorySharing(category, updated);
    }, [store, role]);

    // For doctor/caregiver: use the centralized sharing filter (fail-closed until loaded)
    const metrics = useMemo(() => {
        const sorted = [...allMetrics].sort((a, b) => a.name.localeCompare(b.name));
        if (!isViewOnly) {
            return sorted;
        }
        if (!isSharingFilterLoaded) {
            return [];
        }
        return filterMetrics(sorted);
    }, [allMetrics, isViewOnly, isSharingFilterLoaded, filterMetrics]);

    const visibleCategories = useMemo(() => {
        if (!isViewOnly) {
            return enabledCategories;
        }
        if (!isSharingFilterLoaded) {
            return [];
        }
        return enabledCategories.filter(c => canSeeCategory(c.key));
    }, [enabledCategories, isViewOnly, isSharingFilterLoaded, canSeeCategory]);

    // Derived: are all items enabled?
    const allEnabled = useMemo(() => {
        const everyMetric = allMetrics.every(m => metricSharing[m.id]);
        const allCats = enabledCategories.every(c => categorySharing[c.key]);
        return everyMetric && allCats;
    }, [metricSharing, categorySharing, allMetrics, enabledCategories]);

    // Toggle all metrics + categories in a single batch save
    const toggleAll = useCallback(async (value: boolean) => {
        if (!store) {
            return;
        }

        // Optimistic update
        const newMetricStates: Record<string, boolean> = {};
        for (const m of metrics) {
            newMetricStates[m.id] = value;
        }
        setMetricSharing(newMetricStates);
        const newCategoryStates: Record<SharingCategory, boolean> = {
            medications: false,
            aids: false,
            questionnaires: false,
        };
        for (const cat of enabledCategories) {
            newCategoryStates[cat.key] = value;
        }
        setCategorySharing(newCategoryStates);

        // Single persist call
        await store.batchSetSharing(
            role,
            value,
            metrics.map(m => m.id),
            enabledCategories.map(c => c.key)
        );
    }, [store, role, metrics, enabledCategories]);

    const handleClose = useCallback(() => {
        router.back();
    }, [router]);

    const headerTitle = t('share.sharingSettings.title');

    const needsVerification = isResearch && !isVerified && !isDemo;
    const descriptionText = needsVerification
        ? t('share.sharingSettings.verificationRequired')
        : role === 'doctor'
            ? t('share.sharingSettings.descDoctor')
            : role === 'research'
                ? t('share.sharingSettings.descResearch')
                : t('share.sharingSettings.descCaregiver');

    if (!ownerAccessReady || (!isViewOnly && isLoading) || (isViewOnly && !isSharingFilterLoaded)) {
        return (
            <View style={ [styles.container, { backgroundColor: colors.modalBackground }] }>
                <Stack.Screen options={ { headerTitle } } />
            </View>
        );
    }

    return (
        <View style={ [styles.container, { backgroundColor: colors.modalBackground }] }>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle,
                        headerRight: () => (
                            <HeaderButton
                                onPress={handleClose}
                                title={t('common.done')}
                            />
                        ),
                    }}
                />
            ) : (
                <Stack.Screen>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button onPress={handleClose}>{t('common.done')}</Stack.Toolbar.Button>
                    </Stack.Toolbar>
                </Stack.Screen>
            )}

            <ScrollView
                contentContainerStyle={ [styles.scrollContent, { paddingBottom: insets.bottom + 20 }] }
                contentInsetAdjustmentBehavior="automatic"
            >
                {/* Header with description */ }
                <ScreenHeader
                    subtitle={ descriptionText }
                />
                { needsVerification && (
                    <Pressable
                        style={ styles.verificationLink }
                        onPress={ () => router.push('/settings/account/verification') }
                    >
                        <Text variant="bodyMedium" style={ { color: colors.tint } }>
                            { t('share.sharingSettings.verificationLink') }
                        </Text>
                    </Pressable>
                ) }

                {/* GDPR notice + privacy policy link */ }
                <List.Wrapper>

                    <Pressable
                        style={ styles.privacyLink }
                        onPress={ () => router.push('/settings/legal/privacy?modal=1') }
                    >
                        <Text variant="bodySmall" color="secondary" style={ { textAlign: 'center' } }>
                            { t('share.sharingSettings.gdprNote') }{ ' ' }
                            <Text variant="bodySmall" style={ { color: colors.tint } }>
                                { t('share.sharingSettings.privacyPolicyLink') }
                            </Text>
                        </Text>

                    </Pressable>
                </List.Wrapper>

                {/* Toggle All — hidden for doctor/caregiver (read-only view) */ }
                { !isViewOnly && (
                    <List.Section rounded>
                        <List.Item
                            title={ t('share.sharingSettings.toggleAll') }
                            leftCmpSize={32}
                            leftCmp={<ListItemIcon name="checkmark.circle.fill" color={colors.tint} />}
                            rightCmp={
                                <Switch
                                    value={ allEnabled }
                                    onValueChange={ toggleAll }
                                    disabled={ disableToggles }
                                />
                            }
                            hideChevron
                            lastItem
                        />
                    </List.Section>
                ) }

                {/* Metrics Section */ }
                { (!isViewOnly || metrics.length > 0) && (
                    <List.Section
                        title={ t('share.sharingSettings.metricsSection') }
                        rounded
                    >
                        { metrics.map((metric, index) => (
                            <List.Item
                                key={ metric.id }
                                title={ metric.name }
                                leftCmpSize={32}
                                leftCmp={<ListItemIcon name={metric.icon} color={metric.iconColor} />}
                                rightCmp={
                                    <Switch
                                        value={ isViewOnly ? true : (metricSharing[metric.id] ?? false) }
                                        onValueChange={ (val) => toggleMetric(metric.id, val) }
                                        disabled={ disableToggles || isViewOnly }
                                    />
                                }
                                hideChevron
                                lastItem={ index === metrics.length - 1 }
                            />
                        )) }
                    </List.Section>
                ) }

                {/* Categories Section */ }
                { (!isViewOnly || visibleCategories.length > 0) && (
                    <List.Section
                        title={ t('share.sharingSettings.categoriesSection') }
                        rounded
                    >
                        { visibleCategories.map((cat, index) => (
                            <List.Item
                                key={ cat.key }
                                title={ t(`share.sharingSettings.category.${ cat.key }`) }
                                leftCmpSize={32}
                                leftCmp={<ListItemIcon name={cat.icon} color={cat.iconColor} />}
                                rightCmp={
                                    <Switch
                                        value={ isViewOnly ? true : categorySharing[cat.key] }
                                        onValueChange={ (val) => toggleCategory(cat.key, val) }
                                        disabled={ disableToggles || isViewOnly }
                                    />
                                }
                                hideChevron
                                lastItem={ index === visibleCategories.length - 1 }
                            />
                        )) }
                    </List.Section>
                ) }

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    scrollContent: {
        paddingTop: 20
    },
    verificationLink: {
        alignItems: 'center',
        marginTop: 4
    },
    privacyLink: {
        alignItems: 'center'
        // marginTop: 8,
        // gap: 2,
    },
});
