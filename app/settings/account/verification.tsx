import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useTranslation } from 'react-i18next';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/theme';
import { Button, List, Space } from 'react-native-nice-ui';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { emit } from '@/src/lib/bus';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import {
    getVerification,
    setVerification as saveVerificationFn,
    clearVerification as clearVerificationFn,
    type VerificationState,
    type VerificationStatus,
} from '@/src/stores/verificationStore';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { fmtDate } from '@/src/lib/formatDate';
import { getCareClient } from '@/src/studies/careClient';
import {
    requestVerification,
    pollVerificationStatus,
} from '@/src/lib/verificationClient';
import type { Organization } from '@medplum/fhirtypes';

type VerificationClinic = {
    id: string;
    name: string;
    specialty?: string;
    city?: string;
};

type Step = 'select' | 'explain' | 'code';

const STATUS_COLORS: Record<VerificationStatus, string> = {
    pending: '#FF9500',
    verified: '#34C759',
    rejected: '#FF3B30',
    revoked: '#FF3B30',
};

const POLL_INTERVAL_MS = 3000;

function organizationToClinic(org: Organization): VerificationClinic {
    return {
        id: org.id || Crypto.randomUUID(),
        name: org.name || 'Unknown',
        specialty: org.type?.[0]?.coding?.[0]?.display || org.type?.[0]?.text,
        city: org.address?.[0]?.city,
    };
}

export default function VerificationScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { patientPreferencesStore: prefsStore } = usePatientStores();

    const [step, setStep] = useState<Step>('select');
    const [clinics, setClinics] = useState<VerificationClinic[]>([]);
    const [selectedClinic, setSelectedClinic] = useState<VerificationClinic | null>(null);
    const [verificationState, setVerificationState] = useState<VerificationState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRequesting, setIsRequesting] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load existing verification state and clinics on mount
    useEffect(() => {
        async function init() {
            setIsLoading(true);
            try {
                const existing = prefsStore ? await getVerification(prefsStore) : null;
                if (existing) {
                    setVerificationState(existing);
                    setSelectedClinic({
                        id: existing.clinicId,
                        name: existing.clinicName,
                    });
                    setStep('code');
                }

                await loadClinics();
            } finally {
                setIsLoading(false);
            }
        }
        init();

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, []);

    // Load verification-enabled clinics from Medplum
    const loadClinics = useCallback(async () => {
        try {
            const client = await getCareClient();
            const orgs = await client.searchResources('Organization', {
                _tag: 'urn:hca:verification|enabled',
                _count: '100',
                _sort: 'name',
            });
            setClinics(orgs.map(organizationToClinic));
        } catch (e) {
            console.error('Failed to load verification clinics:', e);
            setClinics([]);
        }
    }, []);

    // Start polling when in pending state
    useEffect(() => {
        if (!verificationState || verificationState.status !== 'pending') return;

        // Check if code has expired
        const expiresAt = new Date(verificationState.expiresAt).getTime();
        const now = Date.now();
        if (now >= expiresAt) return;

        // Start countdown
        setCountdown(Math.max(0, Math.ceil((expiresAt - now) / 1000)));
        countdownRef.current = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
            setCountdown(remaining);
            if (remaining <= 0 && countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
        }, 1000);

        // Start polling
        const requestId = verificationState.requestId;
        pollRef.current = setInterval(async () => {
            try {
                const result = await pollVerificationStatus(requestId);

                if (result.status === 'confirmed') {
                    if (pollRef.current) clearInterval(pollRef.current);
                    if (countdownRef.current) clearInterval(countdownRef.current);

                    const updated: VerificationState = {
                        ...verificationState,
                        status: 'verified',
                        tokenId: result.token_id,
                        clinicPseudonym: result.clinic_pseudonym,
                        resolvedAt: new Date().toISOString(),
                    };
                    if (prefsStore) await saveVerificationFn(prefsStore, updated);
                    setVerificationState(updated);
                    emit('verification:changed');
                } else if (result.status === 'rejected') {
                    if (pollRef.current) clearInterval(pollRef.current);
                    if (countdownRef.current) clearInterval(countdownRef.current);

                    const updated: VerificationState = {
                        ...verificationState,
                        status: 'rejected',
                        resolvedAt: new Date().toISOString(),
                    };
                    if (prefsStore) await saveVerificationFn(prefsStore, updated);
                    setVerificationState(updated);
                    emit('verification:changed');
                } else if (result.status === 'expired') {
                    if (pollRef.current) clearInterval(pollRef.current);
                    if (countdownRef.current) clearInterval(countdownRef.current);
                    setCountdown(0);
                }
            } catch (e) {
                console.warn('Polling error:', e);
            }
        }, POLL_INTERVAL_MS);

        return () => {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
        };
    }, [verificationState?.requestId, verificationState?.status]);

    const handleSelectClinic = useCallback((clinic: VerificationClinic) => {
        setSelectedClinic(clinic);
    }, []);

    const handleNext = useCallback(() => {
        if (step === 'select' && selectedClinic) {
            setStep('explain');
        }
    }, [step, selectedClinic]);

    const handleStartVerification = useCallback(async () => {
        if (!selectedClinic || isRequesting) return;

        setIsRequesting(true);
        try {
            const deviceId = Crypto.randomUUID();
            const result = await requestVerification(selectedClinic.id, deviceId);

            const state: VerificationState = {
                status: 'pending',
                code: result.code,
                requestId: result.request_id,
                clinicId: selectedClinic.id,
                clinicName: selectedClinic.name,
                createdAt: new Date().toISOString(),
                expiresAt: result.expires_at,
            };

            if (prefsStore) await saveVerificationFn(prefsStore, state);
            setVerificationState(state);
            setStep('code');
            emit('verification:changed');
        } catch (e: any) {
            console.error('Failed to request verification:', e);
        } finally {
            setIsRequesting(false);
        }
    }, [selectedClinic, isRequesting]);

    const handleRequestNewCode = useCallback(async () => {
        if (!selectedClinic || isRequesting) return;

        setIsRequesting(true);
        try {
            const deviceId = Crypto.randomUUID();
            const result = await requestVerification(selectedClinic.id, deviceId);

            const state: VerificationState = {
                status: 'pending',
                code: result.code,
                requestId: result.request_id,
                clinicId: selectedClinic.id,
                clinicName: selectedClinic.name,
                createdAt: new Date().toISOString(),
                expiresAt: result.expires_at,
            };

            if (prefsStore) await saveVerificationFn(prefsStore, state);
            setVerificationState(state);
            emit('verification:changed');
        } catch (e: any) {
            console.error('Failed to request new code:', e);
        } finally {
            setIsRequesting(false);
        }
    }, [selectedClinic, isRequesting]);

    const handleStartNew = useCallback(async () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
        if (prefsStore) await clearVerificationFn(prefsStore);
        setVerificationState(null);
        setSelectedClinic(null);
        setStep('select');
        emit('verification:changed');
    }, []);

    const handleClose = useCallback(() => {
        router.back();
    }, [router]);

    const countdownText = useMemo(() => {
        if (countdown <= 0) return null;
        const min = Math.floor(countdown / 60);
        const sec = countdown % 60;
        return `${min}:${String(sec).padStart(2, '0')}`;
    }, [countdown]);

    function formatSubtitle(clinic: VerificationClinic): string {
        const parts: string[] = [];
        if (clinic.specialty) parts.push(clinic.specialty);
        if (clinic.city) parts.push(clinic.city);
        return parts.join(' \u00b7 ');
    }

    // -- Step 1: Select clinic --
    function renderSelectStep() {
        return (
            <>
                <ScreenHeader
                    icon="checkmark.shield"
                    iconTintColor={colors.brandColorMuted}
                    subtitle={t('verification.selectClinicSubtitle')}
                />

                {clinics.length > 0 ? (
                    <>
                        <List.Section rounded>
                            {clinics.map((clinic) => (
                                <List.Item
                                    key={clinic.id}
                                    title={clinic.name}
                                    subtitle={formatSubtitle(clinic)}
                                    onPress={() => handleSelectClinic(clinic)}
                                    leftCmpSize={56}
                                    leftCmp={
                                        <ListItemIcon name="building.2" color={colors.text} size="lg" backgroundColor={colors.listItemBackgroundMuted} />
                                    }
                                    type="checkbox"
                                    checked={selectedClinic?.id === clinic.id}
                                    hideChevron
                                />
                            ))}
                        </List.Section>
                        <List.Wrapper>
                            <List.Text align="center">
                                {t('verification.missingClinicHint')}
                            </List.Text>
                        </List.Wrapper>
                    </>
                ) : (
                    <List.Wrapper>
                        <List.Text align="center">
                            {t('verification.noProviders')}
                        </List.Text>
                    </List.Wrapper>
                )}

                <Space />

                {selectedClinic && (
                    <List.Wrapper>
                        <Button
                            title={t('verification.next')}
                            onPress={handleNext}
                            rounded
                        />
                    </List.Wrapper>
                )}
            </>
        );
    }

    // -- Step 2: Explain process --
    function renderExplainStep() {
        return (
            <>
                <ScreenHeader
                    icon="checkmark.shield"
                    iconTintColor={colors.brandColorMuted}
                    subtitle={t('verification.nextStepsTitle')}
                />

                <View style={styles.explainContainer}>
                    <Text style={[styles.explainText, { color: colors.textSecondary }]}>
                        {t('verification.nextStepsBody')}
                    </Text>
                </View>

                <View style={styles.selectedClinicBox}>
                    <Text style={[styles.selectedClinicLabel, { color: colors.textHint }]}>
                        {t('verification.selectClinic')}
                    </Text>
                    <Text style={[styles.selectedClinicName, { color: colors.text }]}>
                        {selectedClinic?.name}
                    </Text>
                </View>

                <List.Wrapper>
                    <Button
                        title={t('verification.startNow')}
                        onPress={handleStartVerification}
                        rounded
                        loading={isRequesting}
                        disabled={isRequesting}
                    />
                </List.Wrapper>
            </>
        );
    }

    // -- Step 3: Show code / verified / rejected --
    function renderCodeStep() {
        if (!verificationState) return null;

        const status = verificationState.status;

        // Verified — show success screen
        if (status === 'verified') {
            return (
                <>
                    <ScreenHeader
                        icon="checkmark.shield.fill"
                        iconTintColor={STATUS_COLORS.verified}
                        subtitle={t('verification.verifiedSubtitle')}
                    />

                    <View style={styles.verifiedInfoContainer}>
                        <View style={styles.clinicRow}>
                            <AppIcon name="building.2" tintColor={colors.textHint} size={16} />
                            <Text style={[styles.clinicName, { color: colors.textSecondary }]}>
                                {verificationState.clinicName}
                            </Text>
                        </View>
                        {verificationState.resolvedAt && (
                            <Text style={[styles.verifiedDate, { color: colors.textHint }]}>
                                {fmtDate(new Date(verificationState.resolvedAt), true)}
                            </Text>
                        )}
                    </View>

                    <List.Wrapper>
                        <Button
                            title={t('verification.done')}
                            onPress={handleClose}
                            rounded
                        />
                    </List.Wrapper>
                </>
            );
        }

        // Revoked — token was revoked by clinic after confirmation
        if (status === 'revoked') {
            return (
                <>
                    <ScreenHeader
                        icon="xmark.shield"
                        iconTintColor={STATUS_COLORS.revoked}
                        subtitle={t('verification.revokedMessage')}
                    />




                    <Space />
                    <List.Wrapper>
                        <View style={styles.clinicRow}>
                            <AppIcon name="building.2" tintColor={colors.textHint} size={16} />
                            <Text style={[styles.clinicName, { color: colors.textSecondary }]}>
                                {verificationState.clinicName}
                            </Text>
                        </View>
                        <Space />
                        <Button
                            title={t('verification.startNew')}
                            onPress={handleStartNew}
                            rounded
                        />
                        <Space />
                        <Button
                            title={t('verification.done')}
                            onPress={handleClose}
                            rounded
                            variant="secondary"
                        />
                    </List.Wrapper>
                </>
            );
        }

        // Rejected — show rejection with retry
        if (status === 'rejected') {
            return (
                <>
                    <ScreenHeader
                        icon="xmark.shield"
                        iconTintColor={STATUS_COLORS.rejected}
                        subtitle={t('verification.rejectedMessage')}
                    />

                    <View style={styles.clinicRow}>
                        <AppIcon name="building.2" tintColor={colors.textHint} size={16} />
                        <Text style={[styles.clinicName, { color: colors.textSecondary }]}>
                            {verificationState.clinicName}
                        </Text>
                    </View>

                    <Space />

                    <List.Wrapper>
                        <Button
                            title={t('verification.startNew')}
                            onPress={handleStartNew}
                            rounded
                        />
                    </List.Wrapper>
                    <List.Wrapper>
                        <Button
                            title={t('verification.done')}
                            onPress={handleClose}
                            rounded
                            variant="secondary"
                        />
                    </List.Wrapper>
                </>
            );
        }

        // Pending — show code
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
                            {verificationState.code}
                        </Text>
                    </View>

                    {countdownText && (
                        <Text style={[styles.countdownText, {
                            color: countdown <= 30 ? STATUS_COLORS.rejected : colors.textSecondary,
                        }]}>
                            {countdownText}
                        </Text>
                    )}

                    {isExpired && (
                        <Text style={[styles.expiredText, { color: STATUS_COLORS.rejected }]}>
                            {t('verification.codeExpired')}
                        </Text>
                    )}

                    <Text style={[styles.codeHint, { color: colors.textSecondary }]}>
                        {t('verification.showToClinic')}
                    </Text>

                    <View style={styles.clinicRow}>
                        <AppIcon name="building.2" tintColor={colors.textHint} size={16} />
                        <Text style={[styles.clinicName, { color: colors.textSecondary }]}>
                            {verificationState.clinicName}
                        </Text>
                    </View>
                </View>

                {!isExpired && (
                    <>


                        <View style={styles.pollingContainer}>
                            <ActivityIndicator size="small" color={colors.textSecondary} />
                            <Text style={[styles.pollingText, { color: colors.textHint }]}>
                                {t('verification.waitingForClinic')}
                            </Text>
                        </View>
                    </>
                )}



                {isExpired && (
                    <List.Wrapper>
                        <Button
                            title={t('verification.requestNewCode')}
                            onPress={handleRequestNewCode}
                            rounded
                            loading={isRequesting}
                            disabled={isRequesting}
                        />
                    </List.Wrapper>
                )}
                <Space />
                <List.Wrapper>
                    <Button
                        title={t('verification.startNew')}
                        onPress={handleStartNew}
                        rounded
                        variant="secondary"
                    />
                    <Space />
                    <Button
                        title={t('verification.done')}
                        onPress={handleClose}
                        rounded
                        variant="secondary"
                    />
                </List.Wrapper>

            </>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        ...(step === 'explain' ? {
                            headerBackVisible: false,
                            headerLeft: () => (
                                <HeaderButton icon="chevron.left" variant="plain" onPress={() => setStep('select')} />
                            ),
                        } : {}),
                        headerRight: () => (
                            <HeaderButton title={t('verification.done')} variant="plain" onPress={() => router.back()} />
                        ),
                    }}
                />
            ) : (
                <>
                    {step === 'explain' && (
                        <Stack.Toolbar placement="left">
                            <Stack.Toolbar.Button icon="chevron.left" variant="plain" onPress={() => setStep('select')} />
                        </Stack.Toolbar>
                    )}
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button variant="plain" onPress={() => router.back()}>{t('verification.done')}</Stack.Toolbar.Button>
                    </Stack.Toolbar>
                </>
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
                    ) : (
                        <>
                            {step === 'select' && renderSelectStep()}
                            {step === 'explain' && renderExplainStep()}
                            {step === 'code' && renderCodeStep()}
                        </>
                    )}
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
    explainContainer: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    explainText: {
        fontSize: 15,
        lineHeight: 24,
    },
    selectedClinicBox: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    selectedClinicLabel: {
        fontSize: 13,
        marginBottom: 4,
    },
    selectedClinicName: {
        fontSize: 17,
        fontWeight: '600',
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
    statusContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 15,
        fontWeight: '600',
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
    rejectedContainer: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    rejectedText: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
    },
    verifiedContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    verifiedInfoContainer: {
        alignItems: 'center',
        marginBottom: 24,
        gap: 4
    },
    verifiedDate: {
        fontSize: 13,
    },
});
