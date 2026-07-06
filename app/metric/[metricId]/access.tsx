import { useState, useEffect, useMemo } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { List, useTheme } from 'react-native-nice-ui';
import { AppIcon } from '@/src/components/ui/AppIcon';

import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { getMetricDefinition } from '@/src/metrics';
import { useMetricPreferences } from '@/src/hooks/usePatientPreferences';
import type { ShareTarget, SupplierIntegrationMeta } from '@/src/stores/patientPreferencesStore';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSupplierProposalCounts } from '@/src/hooks/useSupplierProposalCounts';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { isAssistiveAidsEnabledForRole } from '@/src/features/assistiveAidsFeature';

export default function MetricAccess() {
    const { t, i18n } = useTranslation();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { role } = useAppRole();
    const { metricId } = useLocalSearchParams<{ metricId: string }>();
    const definition = useMemo(
        () => getMetricDefinition(metricId, i18n.language),
        [metricId, i18n.language]
    );
    const { shareWith, setShareWith, isLoading } = useMetricPreferences(metricId);
    const { supplierIntegrations } = useSupplierProposalCounts();
    const { patientPreferencesStore } = usePatientStores();
    const assistiveAidsEnabled = isAssistiveAidsEnabledForRole(role);

    const [suppliersWithAccess, setSuppliersWithAccess] = useState<SupplierIntegrationMeta[]>([]);
    const metricCategory = definition?.category;

    useEffect(() => {
        let cancelled = false;
        async function filter() {
            if (!assistiveAidsEnabled) { setSuppliersWithAccess([]); return; }
            if (!patientPreferencesStore) { setSuppliersWithAccess([]); return; }
            const result: SupplierIntegrationMeta[] = [];
            for (const int of supplierIntegrations) {
                const policy = await patientPreferencesStore.getSupplierPolicy(int.id);
                if (!policy) continue;
                const hasMetric = policy.metricIds.includes(metricId);
                const hasCategory = metricCategory ? policy.categories[metricCategory] === true : false;
                if (hasMetric || hasCategory) result.push(int);
            }
            if (!cancelled) setSuppliersWithAccess(result);
        }
        filter();
        return () => { cancelled = true; };
    }, [assistiveAidsEnabled, supplierIntegrations, metricId, metricCategory, patientPreferencesStore]);

    useEffect(() => {
        if (role === 'doctor' || role === 'caregiver') {
            router.back();
        }
    }, [role, router]);

    if (role === 'doctor' || role === 'caregiver') {
        return null;
    }

    if (!definition) {
        return null;
    }

    const toggleOption = (option: ShareTarget) => {
        if (option === 'nobody') {
            // "niemandem" is exclusive
            setShareWith(shareWith.includes('nobody') ? [] : ['nobody']);
        } else {
            // Remove 'nobody' if selecting other options
            const withoutNobody = shareWith.filter(o => o !== 'nobody');
            if (withoutNobody.includes(option)) {
                setShareWith(withoutNobody.filter(o => o !== option));
            } else {
                setShareWith([...withoutNobody, option]);
            }
        }
    };

    const isSelected = (option: ShareTarget) => shareWith.includes(option);

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: t('metric.dataSourcesAndAccess'),
                    headerBackButtonDisplayMode: 'minimal',
                }}
            />

            <ScrollView
                style={ { backgroundColor: colors.background } }
                contentContainerStyle={ styles.scrollView }
                contentInsetAdjustmentBehavior="automatic"
            >
                <View style={ [styles.bodyWrapper,
                    {
                        // We add the insets to the padding so that the content
                        // doesn't disappear under the sidebar.
                        paddingLeft: insets.left,
                        paddingRight: insets.right
                    },
                    insets.left > 200 && { maxWidth: 940 + insets.left }
                ] }>
                <ScreenHeader
                    icon={definition.icon}
                    iconTintColor={definition.iconColor}
                    title={definition.name}
                />

                <List.Section title={t('metric.shareDataWith')} rounded>
                    <List.Item
                        title={t('metric.nobody')}
                        hideChevron
                        onPress={() => toggleOption('nobody')}
                        rightCmp={
                            isSelected('nobody') ? (
                                <AppIcon
                                    name="checkmark"
                                    size={18}
                                    tintColor={colors.tint}
                                />
                            ) : null
                        }
                    />
                    <List.Item
                        title={t('roles.doctor')}
                        hideChevron
                        onPress={() => toggleOption('doctor')}
                        rightCmp={
                            isSelected('doctor') ? (
                                <AppIcon
                                    name="checkmark"
                                    size={18}
                                    tintColor={colors.tint}
                                />
                            ) : null
                        }
                    />
                    <List.Item
                        title={t('roles.caregiver')}
                        hideChevron
                        onPress={() => toggleOption('caregiver')}
                        rightCmp={
                            isSelected('caregiver') ? (
                                <AppIcon
                                    name="checkmark"
                                    size={18}
                                    tintColor={colors.tint}
                                />
                            ) : null
                        }
                    />
                    <List.Item
                        title={t('metric.research')}
                        hideChevron
                        onPress={() => toggleOption('research')}
                        lastItem
                        rightCmp={
                            isSelected('research') ? (
                                <AppIcon
                                    name="checkmark"
                                    size={18}
                                    tintColor={colors.tint}
                                />
                            ) : null
                        }
                    />
                </List.Section>

                { assistiveAidsEnabled && (
                    <List.Section title={t('metric.suppliersWithAccess')} rounded>
                        {suppliersWithAccess.length === 0 ? (
                            <List.Item
                                title={t('metric.noSuppliers')}
                                hideChevron
                                lastItem
                            />
                        ) : (
                            suppliersWithAccess.map((integration, index) => (
                                <List.Item
                                    key={integration.id}
                                    title={integration.organizationName}
                                    hideChevron
                                    lastItem={index === suppliersWithAccess.length - 1}
                                />
                            ))
                        )}
                    </List.Section>
                ) }
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        flex: 1,
        paddingTop: 20,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
});
