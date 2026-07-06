import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    TextInput,
    View,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAppTheme } from '@/src/theme';
import { useAppRole, usePatientDisplay } from '@/src/context/AppRoleProvider';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { Button, List, Space, Text } from 'react-native-nice-ui';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { getManagedPatientsStore, type ManagedPatient } from '@/src/stores/managedPatientsStore';
import { createDeviceAccessStore } from '@/src/stores/deviceAccessStore';
import { createExpoSecureStore, createKeybag } from '@/src/lib/medical-sync-vault';
import { getOrCreateStableDeviceId } from '@/src/lib/medical-sync-vault/deviceId';
import { clearPatientLocalData } from '@/src/utils/clearPatientLocalData';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { getCaregiverDoctorName, setCaregiverDoctorName } from '@/src/utils/caregiverDoctorName';
import { getDeviceDisplayName, getDeviceInfo } from '@/src/utils/deviceInfo';

type ManagedRole = 'caregiver' | 'doctor';
type SetupMode = 'loading' | 'name' | 'auth' | 'existing' | 'select';

const ROLE_CONFIG = {
    caregiver: {
        existingIcon: 'person.2.fill'
    },
    doctor: {
        existingIcon: 'stethoscope'
    },
} as const;

export default function ManagedSetupScreen() {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { setCaregiver, setDoctor, getPatientAlias } = useAppRole();
    const { activateIdentity, probePatientAccess } = useAppSync();
    const router = useSafeRouter();

    const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
    const role: ManagedRole = roleParam === 'doctor' ? 'doctor' : 'caregiver';
    const config = ROLE_CONFIG[role];

    const [mode, setMode] = useState<SetupMode>('loading');
    const [existingPatients, setExistingPatients] = useState<ManagedPatient[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Neutral (non-error) hint, e.g. "you have patients linked under a different role". Kept
    // separate from `error` so a role mismatch is never shown as a scary "re-link" error.
    const [infoNotice, setInfoNotice] = useState<string | null>(null);
    const [userName, setUserName] = useState('');
    // T-002: a patient who revoked this device is removed entirely here too (a dead grant left
    // behind corrupts a later re-link). Guard against re-handling the same id across reloads.
    const handledRevokedRef = useRef<Set<string>>(new Set());

    const managedPatientsStore = getManagedPatientsStore();
    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);

    const checkExistingPatients = useCallback(async () => {
        try {
            const storedName = await getCaregiverDoctorName(role);
            const patients = await managedPatientsStore.getAll();
            setError(null);
            setInfoNotice(null);

            if (patients.length > 0) {
                const deviceId = await getOrCreateStableDeviceId(store, K);
                let filteredPatients = patients;
                let incompleteCount = 0;
                let otherRoleCount = 0;

                if (deviceId) {
                    const results = await Promise.all(
                        patients.map(async (p) => {
                            const accessStore = createDeviceAccessStore(p.patientId);
                            let entry = await accessStore.getEntry(deviceId);

                            if (!entry && role === 'caregiver' && p.source === 'created') {
                                const info = getDeviceInfo();
                                await accessStore.addEntry({
                                    device_id: deviceId,
                                    role: 'owner',
                                    name: storedName ?? getDeviceDisplayName(),
                                    addedByDeviceId: deviceId,
                                    ...info,
                                    lastSeenAt: new Date().toISOString(),
                                });
                                entry = await accessStore.getEntry(deviceId);
                            }

                            const visible = role === 'caregiver'
                                ? entry?.role === 'owner' || entry?.role === 'caregiver'
                                : entry?.role === 'doctor';

                            if (visible) {
                                return { patient: p, kind: 'visible' as const };
                            }
                            if (p.source !== 'linked') {
                                return { patient: null, kind: 'hidden' as const };
                            }
                            // Non-visible LINKED patient: distinguish a genuinely incomplete identity
                            // (no access entry / keys missing → "re-link") from a patient that is
                            // simply linked under a DIFFERENT role (entry present + full identity →
                            // not an error, just not part of the current role).
                            const hasIdentity = await managedPatientsStore.hasFullIdentity(p.patientId);
                            if (entry && hasIdentity) {
                                return { patient: null, kind: 'otherRole' as const };
                            }
                            return { patient: null, kind: 'incomplete' as const };
                        })
                    );
                    incompleteCount = results.filter((result) => result.kind === 'incomplete').length;
                    otherRoleCount = results.filter((result) => result.kind === 'otherRole').length;
                    filteredPatients = results
                        .map((result) => result.patient)
                        .filter((p): p is ManagedPatient => p !== null);
                }

                if (incompleteCount > 0) {
                    setError(t('onboarding.managedSetup.missingPatientIdentity'));
                } else if (otherRoleCount > 0) {
                    setInfoNotice(t(role === 'caregiver'
                        ? 'onboarding.managedSetup.otherRoleHintDoctor'
                        : 'onboarding.managedSetup.otherRoleHintCaregiver'));
                }

                if (filteredPatients.length > 0) {
                    setExistingPatients(filteredPatients);
                    setMode('auth');
                } else if (!storedName) {
                    setMode('name');
                } else {
                    setUserName(storedName);
                    setMode('select');
                }
            } else if (!storedName) {
                setMode('name');
            } else {
                setUserName(storedName);
                setMode('select');
            }
        } catch {
            setMode('name');
        }
    }, [role, t, managedPatientsStore, store, K]);

    // Check for existing patients on mount
    useEffect(() => {
        checkExistingPatients();
    }, [checkExistingPatients]);

    // T-002: tear down a revoked patient locally. The role scope is rebuilt from the remaining
    // patients when the user picks/links one, so we only purge local data + the stored grant.
    const teardownRevoked = useCallback(async (patientId: string): Promise<string> => {
        const name = getPatientAlias(patientId)?.localName ?? patientId.slice(0, 8);
        await clearPatientLocalData(patientId).catch(() => {});
        await managedPatientsStore.remove(patientId).catch(() => {});
        return name;
    }, [getPatientAlias, managedPatientsStore]);

    // T-002: probe each existing patient. If one revoked this device, remove it entirely (and
    // recompute the list) instead of letting the doctor pick a dead identity and bounce back here.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const targets = existingPatients.filter((p) => !handledRevokedRef.current.has(p.patientId));
            if (targets.length === 0) return;
            const results = await Promise.all(
                targets.map(async (p) => [p.patientId, await probePatientAccess(p.patientId)] as const)
            );
            if (cancelled) return;
            const revoked = results.filter(([, status]) => status === 'revoked').map(([id]) => id);
            if (revoked.length === 0) return;
            revoked.forEach((id) => handledRevokedRef.current.add(id));
            const names: string[] = [];
            for (const id of revoked) {
                names.push(await teardownRevoked(id));
            }
            if (cancelled) return;
            await checkExistingPatients();
            Alert.alert(t('patients.autoRemovedTitle'), t('patients.autoRemovedNotice', { names: names.join(', ') }));
        })();
        return () => { cancelled = true; };
    }, [existingPatients, probePatientAccess, teardownRevoked, checkExistingPatients, t]);

    const handleNameSubmit = useCallback(async () => {
        const trimmed = userName.trim();
        if (!trimmed) {
            setError(t(`onboarding.managedSetup.${role}.enterYourName`));
            return;
        }
        await setCaregiverDoctorName(role, trimmed);
        setError(null);
        setMode('select');
    }, [userName, role, t]);

    const handleAuthenticate = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (!hasHardware || !isEnrolled) {
                setMode('existing');
                return;
            }

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: t(`onboarding.managedSetup.${role}.authPrompt`),
                fallbackLabel: t('onboarding.managedSetup.enterCode'),
                cancelLabel: t('common.cancel'),
                disableDeviceFallback: false,
            });

            if (result.success) {
                setMode('existing');
            } else {
                setError(t('onboarding.managedSetup.authFailed'));
            }
        } catch (e: any) {
            setError(e?.message ?? t('onboarding.managedSetup.authFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [role, t]);

    const handleSelectPatient = useCallback(async (selectedPatientId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const identity = await managedPatientsStore.getFullIdentity(selectedPatientId);
            if (!identity) {
                throw new Error(t('onboarding.managedSetup.missingPatientIdentity'));
            }

            // T-002: re-check access right before activating. If the patient revoked this device,
            // remove it (and recompute the list) instead of activating a dead identity.
            const status = await probePatientAccess(selectedPatientId);
            if (status === 'revoked') {
                handledRevokedRef.current.add(selectedPatientId);
                const name = await teardownRevoked(selectedPatientId);
                await checkExistingPatients();
                Alert.alert(t('patients.autoRemovedTitle'), t('patients.autoRemovedNotice', { names: name }));
                return;
            }

            await activateIdentity(identity, 'fresh');
            const patientIds = existingPatients.map(p => p.patientId);

            if (role === 'caregiver') {
                await setCaregiver(selectedPatientId, patientIds, selectedPatientId);
            } else {
                await setDoctor(selectedPatientId, patientIds, selectedPatientId);
            }
            router.replace('/(tabs)/(metric)');
        } catch (e: any) {
            if (e?.code === 'device_disabled') {
                handledRevokedRef.current.add(selectedPatientId);
                const name = await teardownRevoked(selectedPatientId);
                await checkExistingPatients();
                Alert.alert(t('patients.autoRemovedTitle'), t('patients.autoRemovedNotice', { names: name }));
                return;
            }
            setError(e?.message ?? t('onboarding.errorOccurred'));
        } finally {
            setIsLoading(false);
        }
    }, [existingPatients, activateIdentity, setCaregiver, setDoctor, role, t, managedPatientsStore, probePatientAccess, teardownRevoked, checkExistingPatients]);

    const handleLinkPatient = useCallback(() => {
        const existingIds = existingPatients.map(p => p.patientId).join(',');
        router.push({
            pathname: '/onboarding/managed/link',
            params: { existingPatientIds: existingIds, expectedRole: role },
        });
    }, [existingPatients, role]);

    const handleCreatePatient = useCallback(() => {
        const existingIds = existingPatients.map(p => p.patientId).join(',');
        router.push({
            pathname: '/onboarding/managed/createPatient',
            params: { existingPatientIds: existingIds },
        });
    }, [existingPatients]);

    const handleRestart = useCallback(() => {
        Alert.alert(
            t('onboarding.managedSetup.restartTitle'),
            t('onboarding.managedSetup.restartMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        await managedPatientsStore.clear();
                        setExistingPatients([]);
                        setMode('select');
                    },
                },
            ]
        );
    }, [managedPatientsStore, t]);

    // Renders the red error box AND/OR the neutral info hint (role-mismatch). Kept together so
    // every screen shows both consistently without duplicating the markup.
    const renderNotices = () => (
        <>
            {error && (
                <View style={[styles.errorContainer, { backgroundColor: '#FF3B3015' }]}>
                    <Text style={[styles.errorText, { color: '#FF3B30' }]}>
                        {error}
                    </Text>
                </View>
            )}
            {infoNotice && (
                <View style={[styles.errorContainer, { backgroundColor: colors.listItemBackground }]}>
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                        {infoNotice}
                    </Text>
                </View>
            )}
        </>
    );

    // Loading Screen
    if (mode === 'loading') {
        return (
            <View style={[styles.container, { backgroundColor: colors.onboardingBackground }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                </View>
            </View>
        );
    }

    // Name Input Screen
    if (mode === 'name') {
        return (
            <KeyboardAvoidingView
                style={[styles.container, { backgroundColor: colors.onboardingBackground }]}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <ScreenHeader
                        icon="person.fill"
                        iconTintColor={colors.brandColorMuted}
                        title={t(`onboarding.managedSetup.${role}.nameTitle`)}
                        subtitle={t(`onboarding.managedSetup.${role}.nameSubtitle`)}
                    />

                    <View style={styles.content}>
                        <View style={styles.inputSection}>
                            <Text style={[styles.inputLabel, { color: colors.text }]}>
                                {t(`onboarding.managedSetup.${role}.yourName`)}
                            </Text>
                            <TextInput
                                style={[
                                    styles.textInput,
                                    {
                                        backgroundColor: colors.listItemBackground,
                                        color: colors.text,
                                        borderColor: error && !userName.trim() ? '#FF3B30' : colors.listItemBackground,
                                    },
                                ]}
                                placeholder={t(`onboarding.managedSetup.${role}.yourNamePlaceholder`)}
                                placeholderTextColor={colors.textHint}
                                value={userName}
                                onChangeText={setUserName}
                                autoCapitalize="words"
                                autoCorrect={false}
                                autoFocus
                            />
                        </View>

                        {renderNotices()}
                    </View>
                </ScrollView>

                <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                    <Button
                        title={t('common.continue')}
                        onPress={handleNameSubmit}
                        rounded
                    />
                </View>
            </KeyboardAvoidingView>
        );
    }

    // Authentication Screen
    if (mode === 'auth') {
        return (
            <View style={[styles.container, { backgroundColor: colors.onboardingBackground }]}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <ScreenHeader
                        icon="faceid"
                        iconTintColor={colors.brandColorMuted}
                        title={t('onboarding.managedSetup.authRequired')}
                        subtitle={t('onboarding.managedSetup.authSubtitle')}
                    />

                    <View style={styles.content}>
                        {renderNotices()}
                    </View>
                </ScrollView>
                <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                    <Button
                        title={isLoading ? '' : t('onboarding.managedSetup.authenticate')}
                        onPress={handleAuthenticate}
                        disabled={isLoading}
                        rounded
                        style={styles.fullButton}
                        leftIcon={isLoading ? <ActivityIndicator color="white" /> : undefined}
                    />
                    <Space />
                    <Button
                        title={t('onboarding.managedSetup.restart')}
                        onPress={handleRestart}
                        variant="danger"
                        rounded
                    />
                </View>
            </View>
        );
    }

    // Existing Patients Screen
    if (mode === 'existing') {
        return (
            <View style={[styles.container, { backgroundColor: colors.onboardingBackground }]}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <ScreenHeader
                        icon={config.existingIcon}
                        iconTintColor={colors.brandColorMuted}
                        title={t('onboarding.managedSetup.welcomeBack')}
                        subtitle={existingPatients.length === 1
                            ? t('onboarding.managedSetup.existingPatientsSubtitle', { count: existingPatients.length })
                            : t('onboarding.managedSetup.existingPatientsSubtitle_plural', { count: existingPatients.length })
                        }
                    />

                    <List.Section rounded spaced>
                        {existingPatients.map((patient) => (
                            <ExistingPatientItem
                                key={patient.patientId}
                                patientId={patient.patientId}
                                source={patient.source}
                                colors={colors}
                                onPress={() => handleSelectPatient(patient.patientId)}
                                disabled={isLoading}
                            />
                        ))}
                    </List.Section>

                    <List.Wrapper>
                        {renderNotices()}
                    </List.Wrapper>
                </ScrollView>

                <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                    <Button
                        title={t(`onboarding.managedSetup.${role}.addNewPatient`)}
                        onPress={() => setMode('select')}
                        variant="primary"
                        rounded
                    />
                    <Space />
                    <Button
                        title={t('onboarding.managedSetup.restart')}
                        onPress={handleRestart}
                        variant="danger"
                        rounded
                    />
                </View>
            </View>
        );
    }

    // Select Screen — role-dependent
    if (role === 'caregiver') {
        return (
            <View style={[styles.container, { backgroundColor: colors.onboardingBackground }]}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <ScreenHeader
                        icon="person.2.fill"
                        iconTintColor={colors.brandColorMuted}
                        title={t('onboarding.managedSetup.caregiver.title')}
                        subtitle={t('onboarding.managedSetup.caregiver.subtitle')}
                    />

                    <View style={styles.content}>
                        {renderNotices()}
                    </View>

                    <List.Section rounded spaced>
                        <List.Item
                            title={t('onboarding.managedSetup.caregiver.createNew')}
                            titleNumberOfLines={2}
                            titleStyle={{ fontWeight: '600' }}
                            subtitle={t('onboarding.managedSetup.caregiver.createNewDesc')}
                            onPress={handleCreatePatient}
                            leftCmpSize={56}
                            leftCmp={<ListItemIcon name="person.badge.plus" color={colors.textPrimary} size="lg" backgroundColor={colors.listItemBackgroundMuted} />}
                        />

                        <List.Item
                            title={t('onboarding.managedSetup.caregiver.linkExisting')}
                            titleNumberOfLines={2}
                            titleStyle={{ fontWeight: '600' }}
                            subtitle={t('onboarding.managedSetup.caregiver.linkExistingDesc')}
                            onPress={handleLinkPatient}
                            leftCmpSize={56}
                            leftCmp={<ListItemIcon name="qrcode.viewfinder" color={colors.textPrimary} size="lg" backgroundColor={colors.listItemBackgroundMuted} />}
                        />
                    </List.Section>
                </ScrollView>
            </View>
        );
    }

    // Doctor select screen — features + link button
    return (
        <View style={[styles.container, { backgroundColor: colors.onboardingBackground }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScreenHeader
                    icon="stethoscope"
                    iconTintColor={colors.brandColorMuted}
                    title={t('onboarding.managedSetup.doctor.title')}
                    subtitle={t('onboarding.managedSetup.doctor.subtitle')}
                />

                <View style={styles.content}>
                    {renderNotices()}
                </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                <Button
                    title={isLoading ? '' : t('onboarding.managedSetup.doctor.linkPatient')}
                    onPress={handleLinkPatient}
                    disabled={isLoading}
                    rounded
                    leftIcon={isLoading ? <ActivityIndicator color="white" /> : undefined}
                />
            </View>
        </View>
    );
}

function ExistingPatientItem({
    patientId,
    source,
    colors,
    onPress,
    disabled,
}: {
    patientId: string;
    source: 'created' | 'linked';
    colors: any;
    onPress: () => void;
    disabled?: boolean;
}) {
    const { t } = useTranslation();
    const { displayName, color, icon } = usePatientDisplay(patientId);
    const sourceLabel = source === 'linked' ? t('patients.sourceLinked') : t('patients.sourceCreated');

    return (
        <List.Item
            title={displayName}
            subtitle={sourceLabel + ' • ID: ' + patientId.slice(0, 8)}
            onPress={onPress}
            disabled={disabled}
            leftCmpSize={40}
            leftCmp={<ListItemIcon name={icon} color={color} size="md" />}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    content: {
        // flex: 1,
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingTop: 20,
    },
    inputSection: {
        alignSelf: 'stretch',
        marginBottom: 32,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    textInput: {
        fontSize: 17,
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
    },
    errorContainer: {
        marginTop: 24,
        padding: 16,
        borderRadius: 12,
        alignSelf: 'stretch',
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    fullButton: {
        alignSelf: 'stretch',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
