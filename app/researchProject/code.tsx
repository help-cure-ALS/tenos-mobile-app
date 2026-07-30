/**
 * Research Project Application — code screen. Shows the 6-digit code the
 * patient presents at the clinic, polls the application status until it is
 * confirmed or rejected, and renders the resulting participation state.
 * All data comes from the stored participation, no project fetch needed.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, List, Space } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { emit } from '@/src/lib/bus';
import { fmtDate } from '@/src/lib/formatDate';
import { usePatientStores, useAppSync } from '@/src/context/AppSyncProvider';
import type { ResearchProjectParticipation } from '@/src/stores/patientPreferencesStore';
import { fetchProjectApplicationStatus } from '@/src/services/researchDonation/proxyClient';
import {
    resolveAnonymousResearchId,
    resubmitProjectApplication,
    serializeSelection,
} from '@/src/lib/researchProjectApplication';

const POLL_INTERVAL_MS = 3000;
const STATUS_COLORS = {
    success: '#34C759',
    error: '#FF3B30',
};

export default function ResearchProjectCodeScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { projectId, title } = useLocalSearchParams<{ projectId: string; title?: string }>();
    const { patientPreferencesStore: prefsStore, donationTrackingStore } = usePatientStores();
    const { getOrCreateSubjectId } = useAppSync();

    const [participation, setParticipation] = useState<ResearchProjectParticipation | null>(null);
    const [verificationTokenId, setVerificationTokenId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isApplying, setIsApplying] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopTimers = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function init() {
            if (!projectId || !prefsStore) return;
            setIsLoading(true);
            try {
                const prefs = await prefsStore.getAll();
                if (cancelled) return;
                setParticipation(prefs?.researchProjects?.[projectId] ?? null);
                setVerificationTokenId(prefs?.verification?.tokenId ?? null);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        init();
        return () => {
            cancelled = true;
            stopTimers();
        };
    }, [projectId, prefsStore, stopTimers]);

    const saveParticipation = useCallback(async (next: ResearchProjectParticipation) => {
        setParticipation(next);
        if (prefsStore) {
            await prefsStore.setResearchProjectParticipation(next);
        }
        emit('researchProjects:changed');
    }, [prefsStore]);

    // Poll application status while pending
    useEffect(() => {
        if (!participation || participation.status !== 'pending' || !participation.applicationId) return;

        const expiresAt = participation.codeExpiresAt ? new Date(participation.codeExpiresAt).getTime() : 0;
        const now = Date.now();
        if (expiresAt <= now) {
            setCountdown(0);
            return;
        }

        setCountdown(Math.max(0, Math.ceil((expiresAt - now) / 1000)));
        countdownRef.current = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
            setCountdown(remaining);
            if (remaining <= 0 && countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
        }, 1000);

        const applicationId = participation.applicationId;
        pollRef.current = setInterval(async () => {
            try {
                const result = await fetchProjectApplicationStatus(applicationId);

                if (result.status === 'confirmed') {
                    stopTimers();
                    await saveParticipation({
                        ...participation,
                        status: 'active',
                        grantId: result.grant_id,
                        consentedAt: new Date().toISOString(),
                        code: undefined,
                        codeExpiresAt: undefined,
                        updatedAt: new Date().toISOString(),
                    });
                } else if (result.status === 'rejected') {
                    stopTimers();
                    await saveParticipation({
                        ...participation,
                        status: 'rejected',
                        code: undefined,
                        codeExpiresAt: undefined,
                        updatedAt: new Date().toISOString(),
                    });
                } else if (result.status === 'expired') {
                    stopTimers();
                    setCountdown(0);
                }
            } catch (e) {
                console.warn('Application polling error:', e);
            }
        }, POLL_INTERVAL_MS);

        return stopTimers;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [participation?.applicationId, participation?.status]);

    const handleRequestNewCode = useCallback(async () => {
        if (!participation || !verificationTokenId || isApplying) return;

        setIsApplying(true);
        try {
            const anonymousResearchId = await resolveAnonymousResearchId(
                donationTrackingStore, getOrCreateSubjectId,
            );
            const next = await resubmitProjectApplication({
                participation,
                verificationTokenId,
                anonymousResearchId,
                locale: i18n.language,
            });
            await saveParticipation(next);
        } catch (e) {
            console.warn('Failed to re-apply for research project:', e);
        } finally {
            setIsApplying(false);
        }
    }, [participation, verificationTokenId, isApplying, donationTrackingStore,
        getOrCreateSubjectId, saveParticipation, i18n.language]);

    const pushClinicScreen = useCallback(() => {
        if (!projectId) return;
        const selection: Record<string, boolean> = {};
        for (const [key, instrument] of Object.entries(participation?.instruments ?? {})) {
            selection[key] = instrument.enabled;
        }
        router.replace({
            pathname: '/researchProject/clinic',
            params: {
                projectId,
                title: participation?.title ?? title ?? '',
                shareHistory: participation?.shareHistory ? '1' : '0',
                selection: serializeSelection(selection),
            },
        });
    }, [router, projectId, participation]);

    const countdownText = useMemo(() => {
        if (countdown <= 0) return null;
        const min = Math.floor(countdown / 60);
        const sec = countdown % 60;
        return `${min}:${String(sec).padStart(2, '0')}`;
    }, [countdown]);

    const enabledInstrumentNames = useMemo(
        () => Object.values(participation?.instruments ?? {})
            .filter((instrument) => instrument.enabled)
            .map((instrument) => instrument.displayName)
            .join(', '),
        [participation],
    );

    function renderActive() {
        if (!participation) return null;

        return (
            <>
                <ScreenHeader
                    icon="checkmark.shield.fill"
                    iconTintColor={STATUS_COLORS.success}
                    title={participation.title}
                    subtitle={t('share.research.activeSubtitle')}
                />

                <View style={styles.confirmedInfoContainer}>
                    <View style={styles.clinicRow}>
                        <AppIcon name="building.2" tintColor={colors.textHint} size={16} />
                        <Text style={[styles.clinicName, { color: colors.textSecondary }]}>
                            {participation.clinicName}
                        </Text>
                    </View>
                    {participation.consentedAt && (
                        <Text style={[styles.confirmedDate, { color: colors.textHint }]}>
                            {fmtDate(new Date(participation.consentedAt), true)}
                        </Text>
                    )}
                </View>

                {participation.collectAll ? (
                    <List.Section rounded>
                        <List.Item
                            title={t('share.research.instrumentsLabel')}
                            subtitle={t('share.research.allData')}
                            hideChevron
                        />
                    </List.Section>
                ) : enabledInstrumentNames.length > 0 && (
                    <List.Section rounded>
                        <List.Item
                            title={t('share.research.instrumentsLabel')}
                            subtitle={enabledInstrumentNames}
                            subtitleNumberOfLines={3}
                            onPress={() => router.push({
                                pathname: '/researchProject/data',
                                params: { projectId, title: participation.title },
                            })}
                        />
                    </List.Section>
                )}

                <List.Wrapper>
                    <Button title={t('verification.done')} onPress={() => router.back()} rounded />
                </List.Wrapper>
            </>
        );
    }

    function renderRejected() {
        if (!participation) return null;

        return (
            <>
                <ScreenHeader
                    icon="xmark.shield"
                    iconTintColor={STATUS_COLORS.error}
                    title={participation.title}
                    subtitle={t('share.research.rejectedSubtitle')}
                />

                <Space />
                <List.Wrapper>
                    <Button
                        title={t('verification.startNew')}
                        onPress={pushClinicScreen}
                        rounded
                    />
                    <Space />
                    <Button
                        title={t('verification.done')}
                        onPress={() => router.back()}
                        rounded
                        variant="secondary"
                    />
                </List.Wrapper>
            </>
        );
    }

    function renderPending() {
        if (!participation) return null;

        const isExpired = countdown <= 0;

        return (
            <>
                <View style={styles.codeContainer}>
                    <Text style={[styles.codeTitle, { color: colors.text }]}>
                        {t('verification.yourCode')}
                    </Text>

                    <View style={[styles.codeBox, {
                        backgroundColor: colors.listItemBackground,
                        opacity: isExpired ? 0.4 : 1,
                    }]}>
                        <Text style={[styles.codeText, { color: colors.text }]}>
                            {participation.code}
                        </Text>
                    </View>

                    {countdownText && (
                        <Text style={[styles.countdownText, {
                            color: countdown <= 30 ? STATUS_COLORS.error : colors.textSecondary,
                        }]}>
                            {countdownText}
                        </Text>
                    )}

                    {isExpired && (
                        <Text style={[styles.expiredText, { color: STATUS_COLORS.error }]}>
                            {t('verification.codeExpired')}
                        </Text>
                    )}

                    <Text style={[styles.codeHint, { color: colors.textSecondary }]}>
                        {t('verification.showToClinic')}
                    </Text>

                    <View style={styles.clinicRow}>
                        <AppIcon name="building.2" tintColor={colors.textHint} size={16} />
                        <Text style={[styles.clinicName, { color: colors.textSecondary }]}>
                            {participation.clinicName}
                        </Text>
                    </View>
                </View>

                {!isExpired && (
                    <View style={styles.pollingContainer}>
                        <ActivityIndicator size="small" color={colors.textSecondary} />
                        <Text style={[styles.pollingText, { color: colors.textHint }]}>
                            {t('verification.waitingForClinic')}
                        </Text>
                    </View>
                )}

                {isExpired && (
                    <List.Wrapper>
                        <Button
                            title={t('verification.requestNewCode')}
                            onPress={() => void handleRequestNewCode()}
                            rounded
                            loading={isApplying}
                            disabled={isApplying}
                        />
                    </List.Wrapper>
                )}

                <Space />
                <List.Wrapper>
                    <Button
                        title={t('verification.done')}
                        onPress={() => router.back()}
                        rounded
                        variant="secondary"
                    />
                </List.Wrapper>
            </>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            <Stack.Screen options={{ headerTitle: title || participation?.title || '' }} />
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScrollViewContent>
                    {isLoading || !participation ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={colors.textSecondary} />
                        </View>
                    ) : participation.status === 'active' ? renderActive()
                        : participation.status === 'rejected' ? renderRejected()
                        : renderPending()}
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
    codeContainer: {
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    codeTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 16,
    },
    codeBox: {
        paddingHorizontal: 32,
        paddingVertical: 24,
        borderRadius: 16,
        marginBottom: 8,
    },
    codeText: {
        fontSize: 40,
        fontWeight: '700',
        letterSpacing: 8,
        fontVariant: ['tabular-nums'],
    },
    countdownText: {
        fontSize: 20,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
        marginBottom: 12,
    },
    expiredText: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 12,
    },
    codeHint: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 8,
    },
    clinicRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    clinicName: {
        fontSize: 14,
    },
    pollingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 24,
    },
    pollingText: {
        fontSize: 14,
    },
    confirmedInfoContainer: {
        alignItems: 'center',
        marginBottom: 24,
        gap: 4,
    },
    confirmedDate: {
        fontSize: 13,
    },
});
