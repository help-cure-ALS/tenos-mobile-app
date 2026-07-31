// Supplier proposal inbox screen
// Shows incoming proposals from linked suppliers, allows accept/decline

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, List, Text } from 'react-native-nice-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import {
    supplierClient,
    filterNewProposals,
    proposalToAidInput,
} from '@/src/services/supplierExchange';
import type { SupplierProposal } from '@/src/services/supplierExchange';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { useAids, AID_CATEGORY_ICONS, AID_CATEGORY_COLORS } from '@/src/aids';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { useAssistiveAidsRouteGuard } from '@/src/hooks/useAssistiveAidsRouteGuard';

export default function SupplierInboxScreen() {
    const { isAllowed } = useAssistiveAidsRouteGuard('/(tabs)/share');

    if (!isAllowed) {
        return null;
    }

    return <SupplierInboxContent />;
}

function SupplierInboxContent() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { integrationId } = useLocalSearchParams<{ integrationId: string }>();
    const { aids, addAids } = useAids();
    const { supplierExchangeStore } = usePatientStores();

    const [proposals, setProposals] = useState<SupplierProposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingProposalId, setProcessingProposalId] = useState<string | null>(null);

    const loadProposals = useCallback(async () => {
        if (!integrationId || !supplierExchangeStore) return;
        try {
            setLoading(true);

            // Read cached proposals (persisted by background service)
            const cached = await supplierExchangeStore.getCachedProposals(integrationId);

            // Also pull fresh from server (may return newer proposals beyond cached cursor)
            let fresh: typeof cached = [];
            try {
                const state = await supplierExchangeStore.getExchangeState(integrationId);
                const result = await supplierClient.pullProposals(integrationId, state?.cursor);
                fresh = result.proposals;

                // Cache any new proposals from the fresh pull for future sessions
                if (fresh.length > 0) {
                    await supplierExchangeStore.cacheProposals(integrationId, fresh);
                }
            } catch {
                // Fresh pull failed — rely on cache only
            }

            // Merge: fresh wins over cached (server may have updated fields)
            const freshIds = new Set(fresh.map(p => p.proposal_id));
            const merged = [
                ...fresh,
                ...cached.filter(p => !freshIds.has(p.proposal_id)),
            ];

            const declined = await supplierExchangeStore.getDeclinedProposals();
            const filtered = filterNewProposals(merged, aids, declined, integrationId);
            setProposals(filtered);
        } catch (err) {
            console.warn('Failed to load proposals:', err);
        } finally {
            setLoading(false);
        }
    }, [integrationId, aids, supplierExchangeStore]);

    useEffect(() => {
        loadProposals();
    }, [loadProposals]);

    // Accept: optimistic removal + rollback on failure
    const handleAccept = useCallback(async (proposal: SupplierProposal) => {
        if (!integrationId || processingProposalId) return;
        setProcessingProposalId(proposal.proposal_id);

        // Optimistic UI: remove proposal from list
        setProposals(prev => prev.filter(p => p.proposal_id !== proposal.proposal_id));

        try {
            const aidInput = proposalToAidInput(proposal, integrationId);
            await addAids([aidInput]);
            await supplierClient.sendDecision(integrationId, proposal.proposal_id, 'accepted');
            // Remove from persistent cache
            await supplierExchangeStore?.removeCachedProposal(integrationId, proposal.proposal_id);
        } catch (err) {
            console.warn('Accept proposal failed:', err);
            // Rollback: add proposal back to list
            // If aid was created but sendDecision failed, filterNewProposals will
            // catch the duplicate via supplierProposalId on next load.
            setProposals(prev => [...prev, proposal]);
            Alert.alert(t('common.error'), t('supplier.acceptProposalError'));
        } finally {
            setProcessingProposalId(null);
        }
    }, [integrationId, addAids, processingProposalId, t]);

    // Decline: remote first, then local
    const handleDecline = useCallback(async (proposal: SupplierProposal) => {
        if (!integrationId || !supplierExchangeStore || processingProposalId) return;
        Alert.alert(
            t('supplier.declineTitle'),
            t('supplier.declineMessage', { name: proposal.name }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('supplier.decline'),
                    style: 'destructive',
                    onPress: async () => {
                        setProcessingProposalId(proposal.proposal_id);
                        try {
                            // Remote first — only persist locally on success
                            await supplierClient.sendDecision(integrationId, proposal.proposal_id, 'declined');
                            await supplierExchangeStore.addDeclinedProposal(integrationId, proposal.proposal_id);
                            await supplierExchangeStore.removeCachedProposal(integrationId, proposal.proposal_id);
                            setProposals(prev => prev.filter(p => p.proposal_id !== proposal.proposal_id));
                        } catch (err) {
                            console.warn('Decline proposal failed:', err);
                            Alert.alert(t('common.error'), t('supplier.declineProposalError'));
                        } finally {
                            setProcessingProposalId(null);
                        }
                    },
                },
            ],
        );
    }, [integrationId, supplierExchangeStore, processingProposalId, t]);

    const handleClose = useCallback(() => {
        router.back();
    }, [router]);

    const isProcessing = processingProposalId !== null;

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: t('supplier.inbox'),
                        headerRight: () => (
                            <HeaderButton onPress={handleClose} title={t('common.done')} />
                        ),
                    }}
                />
            ) : (
                <Stack.Screen options={{ headerTitle: t('supplier.inbox') }}>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button onPress={handleClose}>{t('common.done')}</Stack.Toolbar.Button>
                    </Stack.Toolbar>
                </Stack.Screen>
            )}

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScreenHeader
                    icon="tray.full.fill"
                    iconTintColor={colors.brandColorMuted}
                    subtitle={t('supplier.inboxDesc')}
                />

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator />
                    </View>
                ) : proposals.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text variant="bodyLarge" color="secondary" align="center">
                            {t('supplier.noProposals')}
                        </Text>
                    </View>
                ) : (
                    <List.Section title={t('supplier.proposals')} rounded>
                        {proposals.map((proposal, idx) => (
                            <List.Item
                                key={proposal.proposal_id}
                                title={proposal.name}
                                subtitle={[
                                    proposal.organization_name,
                                    proposal.reason,
                                ].filter(Boolean).join(' — ')}
                                subtitleNumberOfLines={2}
                                leftCmpSize={32}
                                leftCmp={
                                    <ListItemIcon
                                        name={AID_CATEGORY_ICONS[proposal.category]}
                                        color={AID_CATEGORY_COLORS[proposal.category]}
                                    />
                                }
                                hideChevron
                                lastItem={idx === proposals.length - 1}
                            >
                                <View style={styles.actionRow}>
                                    <Button
                                        title={t('supplier.adopt')}
                                        onPress={() => handleAccept(proposal)}
                                        size="small"
                                        rounded
                                        disabled={isProcessing}
                                        variantStyle={{
                                            container: { backgroundColor: 'rgba(52, 199, 89, 0.15)' },
                                            text: { color: '#34C759' },
                                        }}
                                    />
                                    <Button
                                        title={t('supplier.decline')}
                                        onPress={() => handleDecline(proposal)}
                                        size="small"
                                        rounded
                                        disabled={isProcessing}
                                        variantStyle={{
                                            container: { backgroundColor: 'rgba(255, 59, 48, 0.15)' },
                                            text: { color: '#FF3B30' },
                                        }}
                                    />
                                </View>
                            </List.Item>
                        ))}
                    </List.Section>
                )}
            </ScrollView>
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
    loadingContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyState: {
        paddingVertical: 60,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        paddingLeft: 46,
        marginBottom: 10,
    },
});
