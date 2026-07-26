/**
 * Research Project Detail — shows project info and runs the application flow:
 * pick one of the project's clinics, request a 6-digit code, show it to the
 * clinic staff, poll until confirmed (same UX as the diagnosis verification).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, List, Space } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { emit } from '@/src/lib/bus';
import { fmtDate } from '@/src/lib/formatDate';
import { usePatientStores, useAppSync } from '@/src/context/AppSyncProvider';
import type { ParticipationInstrument, ResearchProjectParticipation } from '@/src/stores/patientPreferencesStore';
import { deriveAnonymousResearchId } from '@/src/services/researchDonation/anonymousId';
import {
    applyForResearchProject,
    fetchProjectApplicationStatus,
    fetchResearchProjectDetail,
    type ResearchProjectClinic,
    type ResearchProjectDetail,
} from '@/src/services/researchDonation/proxyClient';

type Step = 'detail' | 'clinic' | 'code' | 'data' | 'privacy';

function instrumentKey(type: 'metric' | 'questionnaire', instrumentId: string): string {
    return `${type}:${instrumentId}`;
}

const POLL_INTERVAL_MS = 3000;
const STATUS_COLORS = {
    success: '#34C759',
    error: '#FF3B30',
};

export default function ResearchProjectScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    const { patientPreferencesStore: prefsStore, donationTrackingStore } = usePatientStores();
    const { getOrCreateSubjectId } = useAppSync();

    const [step, setStep] = useState<Step>('detail');
    const [project, setProject] = useState<ResearchProjectDetail | null>(null);
    const [participation, setParticipation] = useState<ResearchProjectParticipation | null>(null);
    const [verificationTokenId, setVerificationTokenId] = useState<string | null>(null);
    const [selectedClinic, setSelectedClinic] = useState<ResearchProjectClinic | null>(null);
    const [shareHistory, setShareHistory] = useState(false);
    const [instrumentSelection, setInstrumentSelection] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isApplying, setIsApplying] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const dataOriginRef = useRef<Step>('detail');

    const openDataStep = useCallback((origin: Step) => {
        dataOriginRef.current = origin;
        setStep('data');
    }, []);

    const acceptedClinics = useMemo(
        () => (project?.clinic_bindings ?? []).filter((binding) => binding.status === 'accepted'),
        [project],
    );

    const projectRequestsHistory = useMemo(
        () => (project?.collect_all
            ? Boolean(project.collect_all_settings?.include_history)
            : (project?.instruments ?? []).some((instrument) => instrument.include_history)),
        [project],
    );

    const stopTimers = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    }, []);

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

                // Initialize instrument selection: saved participation state
                // wins, otherwise the project defaults (required always on)
                const selection: Record<string, boolean> = {};
                const record: Record<string, ParticipationInstrument> = {};
                for (const instrument of detail.instruments) {
                    const key = instrumentKey(instrument.instrument_type, instrument.instrument_id);
                    const saved = existing?.instruments?.[key];
                    const enabled = instrument.required
                        ? true
                        : (saved ? saved.enabled : instrument.default_enabled);
                    selection[key] = enabled;
                    record[key] = {
                        type: instrument.instrument_type,
                        instrumentId: instrument.instrument_id,
                        displayName: instrument.display_name_snapshot,
                        required: instrument.required,
                        enabled,
                        frequencyDays: instrument.frequency_days ?? null,
                        startsAfterDays: instrument.starts_after_days ?? null,
                    };
                }
                setInstrumentSelection(selection);

                // Self-healing: keep the instrument snapshot of an active
                // participation in sync with the server-side collection plan
                // (older participations may not have instruments stored yet)
                const collectAllSettingsSnapshot = detail.collect_all
                    ? {
                        required: Boolean(detail.collect_all_settings?.required),
                        frequencyDays: detail.collect_all_settings?.frequency_days ?? null,
                        startsAfterDays: detail.collect_all_settings?.starts_after_days ?? null,
                        includeHistory: Boolean(detail.collect_all_settings?.include_history),
                        historyWindowDays: detail.collect_all_settings?.history_window_days ?? null,
                    }
                    : undefined;
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

                // Pending application: resume the code screen with polling.
                // Active participations open the normal detail view, which
                // shows a confirmation row instead of the apply button.
                if (existing?.status === 'pending' && existing.applicationId) {
                    setStep('code');
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
            stopTimers();
        };
    }, [projectId, prefsStore, stopTimers, i18n.language]);

    const saveParticipation = useCallback(async (next: ResearchProjectParticipation) => {
        setParticipation(next);
        if (prefsStore) {
            await prefsStore.setResearchProjectParticipation(next);
        }
        emit('researchProjects:changed');
    }, [prefsStore]);

    const buildInstrumentsRecord = useCallback((
        selection: Record<string, boolean>,
    ): Record<string, ParticipationInstrument> => {
        const record: Record<string, ParticipationInstrument> = {};
        for (const instrument of project?.instruments ?? []) {
            const key = instrumentKey(instrument.instrument_type, instrument.instrument_id);
            record[key] = {
                type: instrument.instrument_type,
                instrumentId: instrument.instrument_id,
                displayName: instrument.display_name_snapshot,
                required: instrument.required,
                enabled: instrument.required ? true : (selection[key] ?? instrument.default_enabled),
                frequencyDays: instrument.frequency_days ?? null,
                startsAfterDays: instrument.starts_after_days ?? null,
            };
        }
        return record;
    }, [project]);

    const buildCollectAllSettings = useCallback(() => {
        if (!project?.collect_all) return undefined;
        const settings = project.collect_all_settings ?? {};
        return {
            required: Boolean(settings.required),
            frequencyDays: settings.frequency_days ?? null,
            startsAfterDays: settings.starts_after_days ?? null,
            includeHistory: Boolean(settings.include_history),
            historyWindowDays: settings.history_window_days ?? null,
        };
    }, [project]);

    const handleToggleInstrument = useCallback(async (key: string, enabled: boolean) => {
        const nextSelection = { ...instrumentSelection, [key]: enabled };
        setInstrumentSelection(nextSelection);

        // Active participation: persist immediately (optional instruments only)
        if (participation?.status === 'active') {
            await saveParticipation({
                ...participation,
                instruments: buildInstrumentsRecord(nextSelection),
                updatedAt: new Date().toISOString(),
            });
        }
    }, [instrumentSelection, participation, buildInstrumentsRecord, saveParticipation]);

    // Poll application status while pending
    useEffect(() => {
        if (step !== 'code') return;
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
    }, [step, participation?.applicationId, participation?.status]);

    const handleApply = useCallback(async (clinic: ResearchProjectClinic) => {
        if (!project || !projectId || isApplying) return;
        if (!verificationTokenId) return;

        setIsApplying(true);
        try {
            // Resolve the stable anonymous research id (same as for donations)
            let anonymousResearchId = (await donationTrackingStore?.getState())?.anonymousResearchId;
            if (!anonymousResearchId) {
                const subjectId = await getOrCreateSubjectId();
                anonymousResearchId = await deriveAnonymousResearchId(subjectId);
                await donationTrackingStore?.setAnonymousResearchId(anonymousResearchId);
            }

            const hasPolicy = Boolean(project.privacy_policy);
            const result = await applyForResearchProject(projectId, {
                clinicId: clinic.clinic_id,
                verificationTokenId,
                anonymousResearchId,
                shareHistory: projectRequestsHistory ? shareHistory : false,
                ...(hasPolicy ? {
                    acceptedPolicyVersion: project.privacy_policy_version,
                    acceptedLocale: i18n.language,
                } : {}),
            });

            await saveParticipation({
                projectId,
                title: project.title,
                status: 'pending',
                clinicId: clinic.clinic_id,
                clinicName: clinic.clinic_name_snapshot ?? clinic.clinic_id,
                applicationId: result.application_id,
                code: result.code,
                codeExpiresAt: result.expires_at,
                shareHistory: projectRequestsHistory ? shareHistory : false,
                ...(hasPolicy ? {
                    acceptedPolicyVersion: project.privacy_policy_version,
                    acceptedLocale: i18n.language,
                } : {}),
                collectAll: project.collect_all || undefined,
                collectAllSettings: buildCollectAllSettings(),
                linkedStudy: Boolean(project.study_link) || undefined,
                instruments: buildInstrumentsRecord(instrumentSelection),
                updatedAt: new Date().toISOString(),
            });
            setStep('code');
        } catch (e) {
            console.warn('Failed to apply for research project:', e);
        } finally {
            setIsApplying(false);
        }
    }, [project, projectId, isApplying, verificationTokenId, donationTrackingStore,
        getOrCreateSubjectId, projectRequestsHistory, shareHistory, saveParticipation,
        buildInstrumentsRecord, instrumentSelection, i18n.language]);

    const handleRequestNewCode = useCallback(async () => {
        if (!participation) return;
        const clinic = acceptedClinics.find((c) => c.clinic_id === participation.clinicId);
        if (clinic) {
            await handleApply(clinic);
        }
    }, [participation, acceptedClinics, handleApply]);

    const countdownText = useMemo(() => {
        if (countdown <= 0) return null;
        const min = Math.floor(countdown / 60);
        const sec = countdown % 60;
        return `${min}:${String(sec).padStart(2, '0')}`;
    }, [countdown]);

    function clinicSubtitle(clinic: ResearchProjectClinic): string {
        return clinic.clinic_name_snapshot ? '' : clinic.clinic_id;
    }

    // -- Detail step --
    function renderDetailStep() {
        if (!project) return null;

        return (
            <>
                <ScreenHeader
                    icon="atom"
                    iconTintColor={colors.brandColorMuted}
                    title={project.title}
                    subtitle={project.patient_description ?? project.short_description ?? ''}
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
                            onPress={() => openDataStep('detail')}
                        />
                    )}
                    {project.privacy_policy && (
                        <List.Item
                            title={t('share.research.privacyLabel')}
                            onPress={() => setStep('privacy')}
                        />
                    )}
                </List.Section>

                {projectRequestsHistory && (
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
                                title={t('share.research.verifyNow')}
                                onPress={() => setStep('clinic')}
                                rounded
                                disabled={!verificationTokenId || acceptedClinics.length === 0}
                            />
                        </List.Wrapper>
                    </>
                )}
            </>
        );
    }

    // -- Clinic selection step --
    function renderClinicStep() {
        return (
            <>
                <ScreenHeader
                    icon="building.2"
                    iconTintColor={colors.brandColorMuted}
                    subtitle={t('share.research.selectClinicSubtitle')}
                />

                <List.Section rounded>
                    {acceptedClinics.map((clinic) => (
                        <List.Item
                            key={clinic.clinic_id}
                            title={clinic.clinic_name_snapshot ?? clinic.clinic_id}
                            subtitle={clinicSubtitle(clinic)}
                            onPress={() => setSelectedClinic(clinic)}
                            leftCmpSize={56}
                            leftCmp={
                                <ListItemIcon name="building.2" color={colors.text} size="lg" backgroundColor={colors.listItemBackgroundMuted} />
                            }
                            type="checkbox"
                            checked={selectedClinic?.clinic_id === clinic.clinic_id}
                            hideChevron
                        />
                    ))}
                </List.Section>

                <Space />

                {selectedClinic && (
                    <List.Wrapper>
                        <Button
                            title={t('verification.startNow')}
                            onPress={() => void handleApply(selectedClinic)}
                            rounded
                            loading={isApplying}
                            disabled={isApplying}
                        />
                    </List.Wrapper>
                )}
            </>
        );
    }

    // -- Code / status step --
    function renderCodeStep() {
        if (!participation) return null;

        if (participation.status === 'active') {
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

                    {project?.collect_all ? (
                        <List.Section rounded>
                            <List.Item
                                title={t('share.research.instrumentsLabel')}
                                subtitle={t('share.research.allData')}
                                hideChevron
                            />
                        </List.Section>
                    ) : (project?.instruments.length ?? 0) > 0 && (
                        <List.Section rounded>
                            <List.Item
                                title={t('share.research.instrumentsLabel')}
                                subtitle={(project?.instruments ?? [])
                                    .filter((i) => instrumentSelection[instrumentKey(i.instrument_type, i.instrument_id)] !== false)
                                    .map((i) => i.display_name_snapshot)
                                    .join(', ')}
                                subtitleNumberOfLines={3}
                                onPress={() => openDataStep('code')}
                            />
                        </List.Section>
                    )}

                    <List.Wrapper>
                        <Button title={t('verification.done')} onPress={() => router.back()} rounded />
                    </List.Wrapper>
                </>
            );
        }

        if (participation.status === 'rejected') {
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
                            onPress={() => setStep('clinic')}
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

    // -- Collected data step (Datenfreigabe-style toggles) --
    function renderDataStep() {
        if (!project) return null;

        const metricInstruments = project.instruments.filter((i) => i.instrument_type === 'metric');
        const questionnaireInstruments = project.instruments.filter((i) => i.instrument_type === 'questionnaire');

        const renderInstrumentItem = (instrument: typeof project.instruments[number], lastItem: boolean) => {
            const key = instrumentKey(instrument.instrument_type, instrument.instrument_id);
            return (
                <List.Item
                    key={key}
                    title={instrument.display_name_snapshot}
                    subtitle={instrument.required ? t('share.research.required') : undefined}
                    hideChevron
                    lastItem={lastItem}
                    rightCmp={
                        <Switch
                            value={instrument.required ? true : (instrumentSelection[key] ?? instrument.default_enabled)}
                            disabled={instrument.required}
                            onValueChange={(value) => void handleToggleInstrument(key, value)}
                        />
                    }
                />
            );
        };

        return (
            <>
                <ScreenHeader
                    icon="waveform.path.ecg.rectangle"
                    iconTintColor={colors.brandColorMuted}
                    title={t('share.research.instrumentsLabel')}
                    subtitle={t('share.research.dataSubtitle')}
                />

                {metricInstruments.length > 0 && (
                    <List.Section title={t('share.research.metricsSection')} rounded>
                        {metricInstruments.map((instrument, index) =>
                            renderInstrumentItem(instrument, index === metricInstruments.length - 1))}
                    </List.Section>
                )}

                {questionnaireInstruments.length > 0 && (
                    <List.Section title={t('share.research.questionnairesSection')} rounded>
                        {questionnaireInstruments.map((instrument, index) =>
                            renderInstrumentItem(instrument, index === questionnaireInstruments.length - 1))}
                    </List.Section>
                )}
            </>
        );
    }

    // -- Privacy policy step --
    function renderPrivacyStep() {
        if (!project?.privacy_policy) return null;

        return (
            <>
                <ScreenHeader
                    icon="lock.shield"
                    iconTintColor={colors.brandColorMuted}
                    title={t('share.research.privacyLabel')}
                    subtitle={project.title}
                />

                <View style={styles.privacyContainer}>
                    <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                        {project.privacy_policy}
                    </Text>
                </View>
            </>
        );
    }

    const backTarget: Step | null =
        step === 'clinic' ? 'detail'
        : step === 'data' ? dataOriginRef.current
        : step === 'privacy' ? 'detail'
        : null;

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        ...(backTarget ? {
                            headerBackVisible: false,
                            headerLeft: () => (
                                <HeaderButton icon="chevron.left" variant="plain" onPress={() => setStep(backTarget)} />
                            ),
                        } : {}),
                        headerRight: () => (
                            <HeaderButton title={t('verification.done')} variant="plain" onPress={() => router.back()} />
                        ),
                    }}
                />
            ) : (
                <>
                    {backTarget && (
                        <Stack.Toolbar placement="left">
                            <Stack.Toolbar.Button icon="chevron.left" variant="plain" onPress={() => setStep(backTarget)} />
                        </Stack.Toolbar>
                    )}
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button variant="plain" onPress={() => router.back()}>
                            {t('verification.done')}
                        </Stack.Toolbar.Button>
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
                    ) : loadFailed ? (
                        <List.Wrapper>
                            <List.Text align="center">{t('share.research.loadFailed')}</List.Text>
                        </List.Wrapper>
                    ) : (
                        <>
                            {step === 'detail' && renderDetailStep()}
                            {step === 'clinic' && renderClinicStep()}
                            {step === 'code' && renderCodeStep()}
                            {step === 'data' && renderDataStep()}
                            {step === 'privacy' && renderPrivacyStep()}
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
    privacyContainer: {
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    privacyText: {
        fontSize: 15,
        lineHeight: 24,
    },
});
