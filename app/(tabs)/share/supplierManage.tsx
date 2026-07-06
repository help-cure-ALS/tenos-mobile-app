// Supplier integration management screen
// Shows integration details, allows policy editing, pause/resume, disconnect

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button, List, Space, Text } from 'react-native-nice-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useAppTheme } from '@/src/theme';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { deleteToken, supplierClient } from '@/src/services/supplierExchange';
import type { SupplierIntegrationMeta } from '@/src/stores/patientPreferencesStore';
import { fmtDateTime } from '@/src/lib/formatDate';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { on } from '@/src/lib/bus';
import { useSupplierProposalCounts } from '@/src/hooks/useSupplierProposalCounts';
import { useAssistiveAidsRouteGuard } from '@/src/hooks/useAssistiveAidsRouteGuard';

export default function SupplierManageScreen() {
    const { isAllowed } = useAssistiveAidsRouteGuard('/(tabs)/share');

    if (!isAllowed) {
        return null;
    }

    return <SupplierManageContent />;
}

function SupplierManageContent() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { patientPreferencesStore: store, supplierExchangeStore } = usePatientStores();
    const { isDemo } = useAppRole();
    const fhirRepo = useFhirRepo();
    const { integrationId, origin } = useLocalSearchParams<{ integrationId: string; origin?: string }>();
    const { proposalCounts } = useSupplierProposalCounts();
    const locale = i18n.language === 'de' ? 'de-DE' : 'en-US';

    const [integration, setIntegration] = useState<SupplierIntegrationMeta | null>(null);
    const proposalCount = useMemo(
        () => (integrationId ? (proposalCounts[integrationId] ?? 0) : 0),
        [integrationId, proposalCounts]
    );

    const loadData = useCallback(async () => {
        if (!store || !integrationId || !supplierExchangeStore) return;
        const integrations = await store.getSupplierIntegrations();
        const found = integrations.find(i => i.id === integrationId);
        setIntegration(found ?? null);
    }, [store, integrationId]);

    useEffect(() => {
        loadData();
        const offPrefs = on('preferences:changed', loadData);
        return () => {
            offPrefs();
        };
    }, [loadData]);

    const handleToggleActive = useCallback(async (active: boolean) => {
        if (!store || !integration) return;
        const updated = { ...integration, active };
        await store.setSupplierIntegration(updated);
        setIntegration(updated);
    }, [store, integration]);

    const handleDisconnect = useCallback(() => {
        if (isDemo) {
            Alert.alert(t('common.demoModeTitle'), t('common.demoModeMessage'), [{ text: t('common.ok') }]);
            return;
        }
        Alert.alert(
            t('supplier.disconnectTitle'),
            t('supplier.disconnectMessage', { name: integration?.organizationName }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('supplier.disconnect'),
                    style: 'destructive',
                    onPress: async () => {
                        if (!store || !integrationId || !supplierExchangeStore) return;
                        try {
                            await supplierClient.disconnectIntegration(integrationId);
                        } catch (e: any) {
                            const msg = typeof e?.message === 'string' ? e.message : '';
                            const alreadyInactive = (
                                msg.includes('integration_inactive')
                                || msg.includes('invalid_token')
                                || msg.includes('integration_not_found')
                            );
                            if (!alreadyInactive) {
                                Alert.alert(t('common.error'), t('supplier.disconnectError'));
                                return;
                            }
                        }

                        await deleteToken(integrationId);
                        await store.removeSupplierIntegration(integrationId);
                        await supplierExchangeStore.removeIntegrationData(integrationId);

                        // Delete FHIR Organization
                        if (integration?.organizationId) {
                            await fhirRepo.markDeleted('Organization', integration.organizationId);
                        }

                        router.back();
                    },
                },
            ],
        );
    }, [isDemo, store, integrationId, integration, router, t]);

    const handleClose = useCallback(() => {
        router.back();
    }, [router]);

    if (!integration) {
        return (
            <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
                <Stack.Screen options={{ headerTitle: '' }} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: integration.organizationName,
                        headerRight: () => (
                            <HeaderButton onPress={handleClose} title={t('common.done')} />
                        ),
                    }}
                />
            ) : (
                <Stack.Screen options={{ headerTitle: integration.organizationName }}>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button onPress={handleClose}>{t('common.done')}</Stack.Toolbar.Button>
                    </Stack.Toolbar>
                </Stack.Screen>
            )}

            <ScrollView
                contentContainerStyle={ styles.scrollView }
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScreenHeader
                    icon="cross.case.fill"
                    iconTintColor={colors.brandColorMuted}
                    title={integration.organizationName}
                />

                {/* Details */}
                <List.Section title={t('supplier.details')} rounded>
                    <List.Item
                        title={t('supplier.contactDetails')}
                        onPress={() => router.push({
                            pathname: '/settings/careProvider/detail',
                            params: { id: integration.organizationId, type: 'organization' },
                        })}
                        lastItem
                    />
                    <List.Item
                        title={t('supplier.dataPolicy')}
                        onPress={() => router.push({
                            pathname: origin === 'aids'
                                ? '/(tabs)/(metric)/aids/supplierDataPolicy'
                                : '/(tabs)/share/supplierDataPolicy',
                            params: { integrationId: integrationId! },
                        })}
                    />
                    <List.Item
                        title={t('supplier.linkedSince')}
                        rightCmp={
                            <Text variant="bodyMedium" color="secondary">
                                {fmtDateTime(new Date(integration.linkedAt), locale.startsWith('de'))}
                            </Text>
                        }
                        hideChevron
                    />
                    <List.Item
                        title={t('supplier.status')}
                        rightCmp={
                            <Text variant="bodyMedium" style={{ color: integration.active ? '#34C759' : '#FF9500' }}>
                                {integration.active ? t('supplier.statusActive') : t('supplier.statusPaused')}
                            </Text>
                        }
                        hideChevron
                    />
                    {/* Pause/Resume */}
                    <List.Item
                        title={t('supplier.pauseExchange')}
                        rightCmp={
                            <Switch
                                value={integration.active}
                                onValueChange={handleToggleActive}
                            />
                        }
                        hideChevron
                    />

                </List.Section>

                {/* Inbox */}
                <List.Section rounded>
                    <List.Item
                        title={t('supplier.inbox')}
                        subtitle={t('supplier.inboxDesc')}
                        subtitleNumberOfLines={2}
                        rightCmp={proposalCount > 0 ? (
                            <Badge label={String(proposalCount)} variant="error" />
                        ) : undefined}
                        onPress={() => router.push({
                            pathname: origin === 'aids'
                                ? '/(tabs)/(metric)/aids/supplierInbox'
                                : '/(tabs)/share/supplierInbox',
                            params: { integrationId: integrationId! },
                        })}
                        lastItem
                    />
                </List.Section>
                <Space size="xl" />
                <List.Wrapper>
                    <Button
                        title={t('supplier.disconnect')}
                        onPress={handleDisconnect}
                        variant="danger"
                        rounded
                    />
                </List.Wrapper>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    }
});
