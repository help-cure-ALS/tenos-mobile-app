/**
 * Research Project Detail — shows project info and the entry point into the
 * application flow. The flow lives in its own nested stack (this modal),
 * so the sub-screens push as regular cards with native swipe-back:
 *
 *   index (detail) → clinic → code
 *                  ↘ data / privacy
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, List, Space } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { emit, on } from '@/src/lib/bus';
import { fmtDate } from '@/src/lib/formatDate';
import { usePatientStores, useAppSync } from '@/src/context/AppSyncProvider';
import type { ResearchProjectParticipation } from '@/src/stores/patientPreferencesStore';
import {
    fetchResearchProjectDetail,
    withdrawFromResearchProject,
    type ResearchProjectDetail,
} from '@/src/services/researchDonation/proxyClient';
import {
    DRAFT_SELECTION_EVENT,
    type DraftSelectionPayload,
    buildCollectAllSettings,
    buildDefaultSelection,
    buildDirectParticipation,
    buildInstrumentsRecord,
    instrumentKey,
    projectRequestsHistory,
    resolveAnonymousResearchId,
    serializeSelection,
} from '@/src/lib/researchProjectApplication';

const STATUS_COLORS = {
    success: '#34C759',
};

export default function ResearchProjectScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const rawRouter = useRouter();
    const insets = useSafeAreaInsets();
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    const { patientPreferencesStore: prefsStore, donationTrackingStore } = usePatientStores();
    const { getOrCreateSubjectId } = useAppSync();

    const [project, setProject] = useState<ResearchProjectDetail | null>(null);
    const [participation, setParticipation] = useState<ResearchProjectParticipation | null>(null);
    const [verificationTokenId, setVerificationTokenId] = useState<string | null>(null);
    const [shareHistory, setShareHistory] = useState(false);
    const [instrumentSelection, setInstrumentSelection] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    const redirectedRef = useRef(false);

    const acceptedClinics = useMemo(
        () => (project?.clinic_bindings ?? []).filter((binding) => binding.status === 'accepted'),
        [project],
    );

    const requestsHistory = useMemo(
        () => (project ? projectRequestsHistory(project) : false),
        [project],
    );

    // Partner forwarding: linking step required before participation
    const needsPartnerLink = project?.forwarding_identity_mode === 'partner_account';
    // 'general' verification: the general token suffices — participation
    // completes in the app, no clinic application/confirmation.
    const isDirectJoin = project?.participation_mode === 'closed'
        && project?.verification_requirement === 'general';

    // Load project detail + existing participation
    useEffect(() => {
        let cancelled = false;

        async function init() {
            if (!projectId) return;
            setIsLoading(true);
            setLoadFailed(false);
            try {
                const [detail, prefs] = await Promise.all([
                    fetchResearchProjectDetail(projectId, i18n.language),
                    prefsStore ? prefsStore.getAll() : Promise.resolve(null),
                ]);
                if (cancelled) return;

                setProject(detail);
                setVerificationTokenId(prefs?.verification?.tokenId ?? null);

                const existing = prefs?.researchProjects?.[projectId] ?? null;
                setParticipation(existing);
                setShareHistory(Boolean(existing?.shareHistory));
                setInstrumentSelection(buildDefaultSelection(detail, existing));

                // Self-healing: keep the instrument snapshot of an active
                // participation in sync with the server-side collection plan
                // (older participations may not have instruments stored yet)
                const record = buildInstrumentsRecord(detail, buildDefaultSelection(detail, existing));
                const collectAllSettingsSnapshot = buildCollectAllSettings(detail);
                if (
                    existing?.status === 'active'
                    && (
                        JSON.stringify(record) !== JSON.stringify(existing.instruments ?? {})
                        || Boolean(detail.collect_all) !== Boolean(existing.collectAll)
                        || JSON.stringify(collectAllSettingsSnapshot ?? null) !== JSON.stringify(existing.collectAllSettings ?? null)
                        || Boolean(detail.study_link) !== Boolean(existing.linkedStudy)
                    )
                ) {
                    const updated: ResearchProjectParticipation = {
                        ...existing,
                        collectAll: detail.collect_all || undefined,
                        collectAllSettings: collectAllSettingsSnapshot,
                        linkedStudy: Boolean(detail.study_link) || undefined,
                        instruments: record,
                        updatedAt: new Date().toISOString(),
                    };
                    setParticipation(updated);
                    if (prefsStore) await prefsStore.setResearchProjectParticipation(updated);
                    emit('researchProjects:changed');
                }

                // Pending application: continue on the code screen with polling.
                // Uses the raw router — the safe-router cooldown from opening
                // this screen would otherwise swallow the redirect.
                if (existing?.status === 'pending' && existing.applicationId && !redirectedRef.current) {
                    redirectedRef.current = true;
                    rawRouter.push({
                        pathname: '/researchProject/code',
                        params: { projectId, title: detail.title },
                    });
                }
            } catch (e) {
                console.warn('Failed to load research project:', e);
                if (!cancelled) setLoadFailed(true);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        init();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, prefsStore, i18n.language]);

    // Participation changed on another screen (confirmation, toggles, re-apply)
    const reloadParticipation = useCallback(async () => {
        if (!prefsStore || !projectId) return;
        const prefs = await prefsStore.getAll();
        const existing = prefs?.researchProjects?.[projectId] ?? null;
        setParticipation(existing);
        if (project) {
            setInstrumentSelection(buildDefaultSelection(project, existing));
        }
    }, [prefsStore, projectId, project]);

    useEffect(() => on('researchProjects:changed', () => { void reloadParticipation(); }), [reloadParticipation]);

    // Draft selection edited on the data screen before an application exists
    useEffect(() => on<DraftSelectionPayload>(DRAFT_SELECTION_EVENT, (payload) => {
        if (payload?.projectId === projectId) {
            setInstrumentSelection(payload.selection);
        }
    }), [projectId]);

    const pushDataScreen = useCallback(() => {
        if (!projectId) return;
        router.push({
            pathname: '/researchProject/data',
            params: {
                projectId,
                title: project?.title ?? '',
                selection: serializeSelection(instrumentSelection),
            },
        });
    }, [router, projectId, project, instrumentSelection]);

    const pushClinicScreen = useCallback(() => {
        if (!projectId) return;
        router.push({
            pathname: '/researchProject/clinic',
            params: {
                projectId,
                title: project?.title ?? '',
                shareHistory: shareHistory ? '1' : '0',
                selection: serializeSelection(instrumentSelection),
            },
        });
    }, [router, projectId, project, shareHistory, instrumentSelection]);

    // Direct participation without partner linking ('general' + anonymous)
    const [isJoining, setIsJoining] = useState(false);
    const handleDirectJoin = useCallback(async () => {
        if (!project || !projectId || isJoining) return;
        setIsJoining(true);
        try {
            const joined = buildDirectParticipation({
                project,
                projectId,
                shareHistory,
                selection: instrumentSelection,
                locale: i18n.language,
            });
            setParticipation(joined);
            if (prefsStore) await prefsStore.setResearchProjectParticipation(joined);
            emit('researchProjects:changed');
        } catch (e) {
            console.warn('Failed to join research project:', e);
            Alert.alert(t('common.error'), t('share.research.joinFailed'));
        } finally {
            setIsJoining(false);
        }
    }, [project, projectId, isJoining, shareHistory, instrumentSelection, i18n.language, prefsStore, t]);

    const handleParticipate = useCallback(() => {
        if (!projectId) return;
        if (needsPartnerLink) {
            router.push({
                pathname: '/researchProject/partnerLink' as any,
                params: {
                    projectId,
                    title: project?.title ?? '',
                    shareHistory: shareHistory ? '1' : '0',
                    selection: serializeSelection(instrumentSelection),
                    next: isDirectJoin ? 'join' : 'clinic',
                },
            });
            return;
        }
        if (isDirectJoin) {
            void handleDirectJoin();
            return;
        }
        pushClinicScreen();
    }, [projectId, needsPartnerLink, isDirectJoin, router, project, shareHistory, instrumentSelection, handleDirectJoin, pushClinicScreen]);

    // Consent withdrawal: revokes the grant on the clinic side, stops
    // project todos and donation batches immediately. Re-application via
    // the normal code flow stays possible.
    const handleWithdraw = useCallback(() => {
        if (!participation || participation.status !== 'active' || isWithdrawing) return;

        Alert.alert(
            t('share.research.endParticipationTitle'),
            project?.is_forwarding
                ? `${t('share.research.endParticipationMessage')}\n\n${t('share.research.endParticipationForwardingNote')}`
                : t('share.research.endParticipationMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('share.research.endParticipationConfirm'),
                    style: 'destructive',
                    onPress: async () => {
                        setIsWithdrawing(true);
                        try {
                            if (participation.grantId) {
                                const anonymousResearchId = await resolveAnonymousResearchId(
                                    donationTrackingStore, getOrCreateSubjectId,
                                );
                                await withdrawFromResearchProject(participation.grantId, anonymousResearchId, {
                                    projectId: participation.projectId,
                                    partnerAccountRef: participation.partnerAccountRef,
                                });
                            }
                            const updated: ResearchProjectParticipation = {
                                ...participation,
                                status: 'revoked',
                                updatedAt: new Date().toISOString(),
                            };
                            setParticipation(updated);
                            if (prefsStore) await prefsStore.setResearchProjectParticipation(updated);
                            emit('researchProjects:changed');
                        } catch (e) {
                            console.warn('Failed to withdraw from research project:', e);
                            Alert.alert(t('common.error'), t('share.research.endParticipationError'));
                        } finally {
                            setIsWithdrawing(false);
                        }
                    },
                },
            ],
        );
    }, [participation, isWithdrawing, project, donationTrackingStore, getOrCreateSubjectId, prefsStore, t]);

    function renderContent() {
        if (!project) return null;

        return (
            <>
                <ScreenHeader
                    icon="atom"
                    iconTintColor={colors.brandColorMuted}
                    title={project.title}
                    subtitle={project.patient_description ?? ''}
                />

                {participation?.status === 'active' && (
                    <List.Section rounded>
                        <List.Item
                            title={t('share.research.confirmedTitle')}
                            subtitle={[
                                participation.clinicName,
                                participation.consentedAt ? fmtDate(new Date(participation.consentedAt), true) : null,
                            ].filter(Boolean).join(' · ')}
                            leftCmpSize={40}
                            leftCmp={
                                <ListItemIcon
                                    name="checkmark.shield.fill"
                                    color={STATUS_COLORS.success}
                                    backgroundColor={colors.listItemBackgroundMuted}
                                    size="md"
                                />
                            }
                            hideChevron
                        />
                    </List.Section>
                )}

                <List.Section rounded>
                    {project.sponsor_name && (
                        <List.Item
                            title={t('share.research.sponsorLabel')}
                            subtitle={project.sponsor_name}
                            hideChevron
                        />
                    )}
                    {project.ends_at && (
                        <List.Item
                            title={t('share.research.periodLabel')}
                            subtitle={[
                                project.starts_at ? fmtDate(new Date(project.starts_at), i18n.language.startsWith('de')) : null,
                                fmtDate(new Date(project.ends_at), i18n.language.startsWith('de')),
                            ].filter(Boolean).join(' – ')}
                            hideChevron
                        />
                    )}
                    {project.study_link && (
                        <List.Item
                            title={t('share.research.studyLabel')}
                            subtitle={project.study_link.title_snapshot}
                            subtitleNumberOfLines={2}
                            hideChevron
                        />
                    )}
                    {project.collect_all ? (
                        <List.Item
                            title={t('share.research.instrumentsLabel')}
                            subtitle={t('share.research.allData')}
                            hideChevron
                        />
                    ) : project.instruments.length > 0 && (
                        <List.Item
                            title={t('share.research.instrumentsLabel')}
                            subtitle={project.instruments
                                .filter((i) => instrumentSelection[instrumentKey(i.instrument_type, i.instrument_id)] !== false)
                                .map((i) => i.display_name_snapshot)
                                .join(', ')}
                            subtitleNumberOfLines={3}
                            onPress={pushDataScreen}
                        />
                    )}
                    {project.is_forwarding && (
                        <List.Item
                            title={t('share.research.forwardingLabel')}
                            subtitle={t('share.research.forwardingNotice', {
                                partner: project.sponsor_name ?? project.title,
                            })}
                            subtitleNumberOfLines={4}
                            hideChevron
                        />
                    )}
                    {participation?.status === 'active' && participation.partnerAccountRef && (
                        <List.Item
                            title={t('share.research.partnerLinkedTitle')}
                            hideChevron
                        />
                    )}
                    {project.privacy_policy && (
                        <List.Item
                            title={t('share.research.privacyLabel')}
                            onPress={() => router.push({
                                pathname: '/researchProject/privacy',
                                params: { projectId, title: project.title },
                            })}
                        />
                    )}
                </List.Section>

                {requestsHistory && (
                    <List.Section rounded>
                        <List.Item
                            title={t('share.research.shareHistoryLabel')}
                            subtitle={t('share.research.shareHistoryHint')}
                            subtitleNumberOfLines={3}
                            hideChevron
                            rightCmp={
                                <Switch
                                    value={shareHistory}
                                    onValueChange={setShareHistory}
                                />
                            }
                        />
                    </List.Section>
                )}

                {participation?.status !== 'active' && participation?.status !== 'pending' && (
                    <>
                        <List.Wrapper>
                            <List.Text align="center">
                                {project.privacy_policy
                                    ? `${t('share.research.applyHint')} ${t('share.research.privacyConsentHint')}`
                                    : t('share.research.applyHint')}
                            </List.Text>
                        </List.Wrapper>

                        <Space />

                        <List.Wrapper>
                            <Button
                                title={isDirectJoin ? t('share.research.joinNow') : t('share.research.verifyNow')}
                                onPress={handleParticipate}
                                rounded
                                loading={isJoining}
                                disabled={
                                    isJoining
                                    || !verificationTokenId
                                    || (!isDirectJoin && acceptedClinics.length === 0)
                                }
                            />
                        </List.Wrapper>
                    </>
                )}

                {participation?.status === 'active' && (
                    <>
                        <Space />
                        <List.Wrapper>
                            <Button
                                title={t('share.research.endParticipation')}
                                onPress={handleWithdraw}
                                rounded
                                variant="secondary"
                                loading={isWithdrawing}
                                disabled={isWithdrawing}
                            />
                        </List.Wrapper>
                    </>
                )}
            </>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerRight: () => (
                            <HeaderButton title={t('verification.done')} variant="plain" onPress={() => router.back()} />
                        ),
                    }}
                />
            ) : (
                <Stack.Toolbar placement="right">
                    <Stack.Toolbar.Button variant="plain" onPress={() => router.back()}>
                        {t('verification.done')}
                    </Stack.Toolbar.Button>
                </Stack.Toolbar>
            )}

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScrollViewContent>
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={colors.textSecondary} />
                        </View>
                    ) : loadFailed ? (
                        <List.Wrapper>
                            <List.Text align="center">{t('share.research.loadFailed')}</List.Text>
                        </List.Wrapper>
                    ) : renderContent()}
                </ScrollViewContent>
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
        alignItems: 'center',
        paddingVertical: 60,
    },
});
