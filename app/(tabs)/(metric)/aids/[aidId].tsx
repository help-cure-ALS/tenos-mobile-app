import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { useTranslation } from 'react-i18next';
import { Button, List, Space, Text } from 'react-native-nice-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useAppRole } from '@/src/context/AppRoleProvider';
import {
    useAids,
    getCatalogEntry,
    getCatalogName,
    getCatalogDescription,
    getReimbursementInfo,
    AID_CATEGORY_ICONS,
    AID_CATEGORY_COLORS,
    AID_STATUS_COLORS,
} from '@/src/aids';
import type { AidStatus } from '@/src/aids';
import type { WorkflowPolicy } from '@/src/services/supplierExchange/types';
import {
    getAvailableTransitions,
    executeTransition,
    shouldNotifyProvider,
    buildTransitionTicket,
    supplierClient,
} from '@/src/services/supplierExchange';
import { fmtDateTime } from '@/src/lib/formatDate';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';
import { useSupplierProposalCounts } from '@/src/hooks/useSupplierProposalCounts';
import * as SecureStore from 'expo-secure-store';
import { useAssistiveAidsRouteGuard } from '@/src/hooks/useAssistiveAidsRouteGuard';

const STATUS_OPTIONS: AidStatus[] = ['none', 'suggested', 'requested', 'approved', 'rejected'];

const DEVICE_ID_KEY = 'medical_sync_vault_device_id';

export default function AidDetailScreen() {
    const { isAllowed } = useAssistiveAidsRouteGuard('/(tabs)/(metric)');

    if (!isAllowed) {
        return null;
    }

    return <AidDetailContent />;
}

function AidDetailContent() {
    const { aidId } = useLocalSearchParams<{ aidId: string }>();
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { getAidById, updateAid, deleteAid } = useAids();
    const { get } = useFhirRepo();
    const { getOrCreateSubjectId } = useAppSync();
    const { role } = useAppRole();
    const { isFiltering, isLoaded: sharingLoaded, canSeeCategory } = useSharingFilter();
    const { supplierIntegrations } = useSupplierProposalCounts();

    const locale = i18n.language === 'de' ? 'de-DE' : 'en-US';
    const aid = getAidById(aidId);
    const catalogEntry = useMemo(() => aid?.catalogId ? getCatalogEntry(aid.catalogId) : undefined, [aid?.catalogId]);

    const [status, setStatus] = useState<AidStatus>(aid?.status ?? 'none');
    const [notes, setNotes] = useState(aid?.notes ?? '');
    const [country, setCountry] = useState<string>('');
    const [workflowPolicy, setWorkflowPolicy] = useState<WorkflowPolicy | null>(null);
    const [policyLoadFailed, setPolicyLoadFailed] = useState(false);
    const [deviceId, setDeviceId] = useState<string>('');

    const isSupplierAid = aid?.source === 'supplier';

    const supplierName = useMemo(() => {
        if (!aid?.supplierIntegrationId) return undefined;
        return supplierIntegrations.find(i => i.id === aid.supplierIntegrationId)?.organizationName;
    }, [aid?.supplierIntegrationId, supplierIntegrations]);

    // Load patient country for reimbursement info
    useEffect(() => {
        (async () => {
            try {
                const patientId = await getOrCreateSubjectId();
                const row = await get('Patient', patientId);
                const c = row?.resource?.address?.[0]?.country;
                if (c) setCountry(c);
            } catch {
                // ignore
            }
        })();
    }, [get, getOrCreateSubjectId]);

    // Load workflow policy for supplier aids (fail-closed: no transitions if policy unavailable)
    useEffect(() => {
        if (!isSupplierAid || !country) return;
        setPolicyLoadFailed(false);
        (async () => {
            try {
                const policy = await supplierClient.getWorkflowPolicy(country);
                setWorkflowPolicy(policy);
            } catch {
                setPolicyLoadFailed(true);
            }
        })();
    }, [isSupplierAid, country]);

    // Load device ID for audit trail
    useEffect(() => {
        SecureStore.getItemAsync(DEVICE_ID_KEY).then(id => {
            if (id) setDeviceId(id);
        }).catch(() => {});
    }, []);

    // Sync state when aid changes
    useEffect(() => {
        if (aid) {
            setStatus(aid.status);
            setNotes(aid.notes ?? '');
        }
    }, [aid]);

    const hasChanges = aid && (status !== aid.status || notes !== (aid.notes ?? ''));

    // Determine available status transitions
    const availableStatuses = useMemo<AidStatus[]>(() => {
        if (!aid) return [];
        if (isSupplierAid) {
            // Supplier aids: fail-closed — no transitions without loaded policy
            if (!workflowPolicy || !role) return [];
            return getAvailableTransitions(workflowPolicy, aid.status, role);
        }
        // User-created aids: free status setting
        return STATUS_OPTIONS;
    }, [aid, isSupplierAid, workflowPolicy, role]);

    const handleSave = useCallback(async () => {
        if (!aid) return;

        const statusChanged = status !== aid.status;

        if (isSupplierAid && statusChanged) {
            // Supplier aids require a loaded policy for status changes (fail-closed)
            if (!workflowPolicy || !role) return;

            const updated = executeTransition(aid, status, { role, deviceId });
            await updateAid(aid.id, {
                status: updated.status,
                transitions: updated.transitions,
                notes: notes.trim() || undefined,
            });

            // Notify provider if policy says so
            if (shouldNotifyProvider(workflowPolicy, status) && aid.supplierIntegrationId) {
                const lastTransition = updated.transitions![updated.transitions!.length - 1];
                const ticket = buildTransitionTicket(
                    aid.supplierIntegrationId,
                    aid.supplierProposalId,
                    aid.id,
                    lastTransition,
                );
                try {
                    await supplierClient.sendTransition(aid.supplierIntegrationId, ticket);
                } catch (err) {
                    console.warn('Failed to notify supplier of transition:', err);
                }
            }
        } else {
            await updateAid(aid.id, { status, notes: notes.trim() || undefined });
        }

        router.back();
    }, [aid, status, notes, updateAid, router, isSupplierAid, workflowPolicy, role, deviceId]);

    const handleDelete = useCallback(() => {
        if (!aid) return;
        Alert.alert(
            t('aids.deleteTitle'),
            t('aids.deleteMessage', { name: displayName }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        await deleteAid(aid.id);
                        router.back();
                    },
                },
            ],
        );
    }, [aid, deleteAid, router, t]);

    const handleStatusChange = useCallback(() => {
        const statusesToShow = availableStatuses;
        if (statusesToShow.length === 0) return;

        const options = statusesToShow.map(s => t(`aids.status.${s}`));
        options.push(t('common.cancel'));

        if (Platform.OS === 'ios') {
            const { ActionSheetIOS } = require('react-native');
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    title: t('aids.status.changeStatus'),
                    options,
                    cancelButtonIndex: options.length - 1,
                },
                (index) => {
                    if (index < statusesToShow.length) {
                        setStatus(statusesToShow[index]);
                    }
                },
            );
        } else {
            Alert.alert(
                t('aids.status.changeStatus'),
                undefined,
                [
                    ...statusesToShow.map(s => ({
                        text: t(`aids.status.${s}`),
                        onPress: () => setStatus(s),
                    })),
                    { text: t('common.cancel'), style: 'cancel' as const },
                ],
            );
        }
    }, [t, availableStatuses]);

    if (!sharingLoaded || (isFiltering && !canSeeCategory('aids'))) {
        if (isFiltering && sharingLoaded) router.back();
        return null;
    }

    if (!aid) {
        return (
            <>
                <Stack.Screen options={{ headerTitle: '' }} />
                <View style={[styles.emptyState, { backgroundColor: colors.background }]}>
                    <Text variant="bodyLarge" color="secondary">{t('aids.noAidsYet')}</Text>
                </View>
            </>
        );
    }

    const displayName = catalogEntry
        ? getCatalogName(catalogEntry, i18n.language)
        : aid.name;

    const description = catalogEntry
        ? getCatalogDescription(catalogEntry, i18n.language)
        : undefined;

    const reimbursement = catalogEntry && country
        ? getReimbursementInfo(catalogEntry, country)
        : undefined;

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: '',
                        headerLargeTitle: false,
                        headerRight: () => hasChanges ? (
                            <HeaderButton
                                icon="checkmark"
                                variant="done"
                                tintColor={colors.tint}
                                onPress={handleSave}
                            />
                        ) : null
                    }}
                />
            ) : (
                <>
                    <Stack.Screen options={{ headerLargeTitle: false }} />
                    <Stack.Screen.Title>{''}</Stack.Screen.Title>
                    {hasChanges && (
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="checkmark" variant="done" tintColor={colors.tint} onPress={handleSave} />
                        </Stack.Toolbar>
                    )}
                </>
            )}
            <ScrollView
                style={{ backgroundColor: colors.background }}
                contentContainerStyle={styles.scrollView}
                contentInsetAdjustmentBehavior="automatic"
            >
                <View style={[styles.bodyWrapper,
                    {
                        paddingLeft: insets.left,
                        paddingRight: insets.right,
                    },
                    insets.left > 200 && { maxWidth: 940 + insets.left },
                ]}>
                    <ScreenHeader
                        icon={AID_CATEGORY_ICONS[aid.category]}
                        iconTintColor={AID_CATEGORY_COLORS[aid.category]}
                        iconContainerColor={AID_CATEGORY_COLORS[aid.category] + '20'}
                        title={displayName}
                        subtitle={t(`aids.categories.${aid.category}`)}
                        titleVariant="headlineSmall"
                    />

                    {/* Status */}
                    <List.Section title="Status" rounded>
                        <List.Item
                            title={t(`aids.status.${status}`)}
                            onPress={availableStatuses.length > 0 ? handleStatusChange : undefined}
                            leftCmp={
                                <View style={[styles.statusDot, { backgroundColor: AID_STATUS_COLORS[status] }]} />
                            }
                            hideChevron={availableStatuses.length === 0}
                            lastItem
                        />
                    </List.Section>

                    {/* Info section */}
                    <List.Section title={t('aids.description')} rounded>
                        {description && (
                            <List.Item
                                title={description}
                                titleNumberOfLines={3}
                            />
                        )}
                        {catalogEntry && (
                            <List.Item
                                title={t('aids.alsPhase')}
                                rightCmp={
                                    <Text variant="bodyMedium" color="secondary">{catalogEntry.alsPhase}</Text>
                                }
                            />
                        )}
                        {catalogEntry && (
                            <List.Item
                                title={t('aids.isoClass')}
                                rightCmp={
                                    <Text variant="bodyMedium" color="secondary">
                                        {catalogEntry.isoClass} / {catalogEntry.isoSubclass}
                                    </Text>
                                }
                            />
                        )}
                        <List.Item
                            title={t('aids.addedAt')}
                            rightCmp={
                                <Text variant="bodyMedium" color="secondary">
                                    {fmtDateTime(new Date(aid.createdAt), locale.startsWith('de'))}
                                </Text>
                            }
                        />
                        <List.Item
                            title={t('aids.lastUpdated')}
                            rightCmp={
                                <Text variant="bodyMedium" color="secondary">
                                    {fmtDateTime(new Date(aid.updatedAt), locale.startsWith('de'))}
                                </Text>
                            }
                            lastItem
                        />
                    </List.Section>

                    {/* Reimbursement section */}
                    {reimbursement && (
                        <List.Section title={t('aids.reimbursement')} rounded>
                            {'productGroup' in reimbursement && (
                                <List.Item
                                    title={t('aids.productGroup')}
                                    rightCmp={
                                        <Text variant="bodyMedium" color="secondary">
                                            {(reimbursement as any).productGroup} – {(reimbursement as any).label}
                                        </Text>
                                    }
                                />
                            )}
                            {'area' in reimbursement && (
                                <List.Item
                                    title={(reimbursement as any).area}
                                    subtitle={(reimbursement as any).approval ? `Bewilligungspflichtig: ${(reimbursement as any).approval}` : undefined}
                                />
                            )}
                            {'group' in reimbursement && (
                                <List.Item
                                    title={(reimbursement as any).group}
                                    subtitle={(reimbursement as any).position ? `Position: ${(reimbursement as any).position}` : undefined}
                                />
                            )}
                            {reimbursement.prescriber && reimbursement.prescriber !== '—' && (
                                <List.Item
                                    title={t('aids.prescriber')}
                                    rightCmp={
                                        <Text variant="bodyMedium" color="secondary">{reimbursement.prescriber}</Text>
                                    }
                                />
                            )}
                            {reimbursement.notes && reimbursement.notes !== '—' && (
                                <List.Item
                                    title={t('aids.reimbursementNotes')}
                                    subtitle={reimbursement.notes}
                                    lastItem
                                />
                            )}
                        </List.Section>
                    )}

                    {/* Supplier info */}
                    {aid.source === 'supplier' && (
                        <List.Section title={t('aids.supplierInfo')} rounded>
                            {aid.supplierReason && (
                                <List.Item
                                    title={t('aids.supplierReason')}
                                    subtitle={aid.supplierReason}
                                    subtitleNumberOfLines={3}
                                    hideChevron
                                />
                            )}
                            <List.Item
                                title={t('aids.source')}
                                rightCmp={
                                    <Text variant="bodyMedium" color="secondary">
                                        {supplierName ?? t('aids.sourceSupplier')}
                                    </Text>
                                }
                                hideChevron
                                lastItem
                            />
                        </List.Section>
                    )}

                    {/* Transition history */}
                    {aid.transitions && aid.transitions.length > 0 && (
                        <List.Section title={t('aids.transitionHistory')} rounded>
                            {aid.transitions.map((tr, idx) => (
                                <List.Item
                                    key={idx}
                                    title={`${t(`aids.status.${tr.from}`)} → ${t(`aids.status.${tr.to}`)}`}
                                    subtitle={`${tr.role} — ${fmtDateTime(new Date(tr.timestamp), locale.startsWith('de'))}`}
                                    hideChevron
                                    lastItem={idx === aid.transitions!.length - 1}
                                />
                            ))}
                        </List.Section>
                    )}

                    {/* Notes */}
                    <List.Section title={t('aids.notes')} rounded>
                        <List.Item
                            title={
                                <TextInput
                                    style={[styles.notesInput, { color: colors.textPrimary }]}
                                    placeholder={t('aids.notesPlaceholder')}
                                    placeholderTextColor={colors.textTertiary}
                                    value={notes}
                                    onChangeText={setNotes}
                                    multiline
                                    numberOfLines={3}
                                />
                            }
                            lastItem
                        />
                    </List.Section>

                    <Space size="xl" />
                    {/* Delete button */}
                    <List.Wrapper>
                        <Button
                            title={t('aids.deleteTitle')}
                            onPress={handleDelete}
                            variant="danger"
                            rounded
                        />
                    </List.Wrapper>
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90,
    },
    bodyWrapper: {
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    notesInput: {
        fontSize: 16,
        padding: 0,
        minHeight: 60,
        textAlignVertical: 'top',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
});
