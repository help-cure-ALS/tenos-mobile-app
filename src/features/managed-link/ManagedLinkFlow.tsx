import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-native-nice-ui';

import { AppIcon } from '@/src/components/ui/AppIcon';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { createExpoSecureStore, createKeybag } from '@/src/lib/medical-sync-vault';
import { BundleCipherError, decryptBundle } from '@/src/lib/medical-sync-vault/crypto/bundleCipher';
import { getOrCreateStableDeviceId } from '@/src/lib/medical-sync-vault/deviceId';
import { getKeyProvider } from '@/src/services/keyProvider';
import { createDeviceAccessStore } from '@/src/stores/deviceAccessStore';
import { getManagedPatientsStore, type ManagedPatient } from '@/src/stores/managedPatientsStore';
import { useAppTheme } from '@/src/theme';
import { clearPatientLocalData } from '@/src/utils/clearPatientLocalData';
import { getCaregiverDoctorName, setCaregiverDoctorName } from '@/src/utils/caregiverDoctorName';
import { getDeviceDisplayName, getDeviceInfo } from '@/src/utils/deviceInfo';

import {
    grantedIdentity,
    isOutdatedManagedAccessBundle,
    type ManagedAccessBundleV3,
    type ManagedLinkRole,
    upsertGrantedManagedPatient,
    validateManagedAccessBundleV3,
} from './managedLinkUtils';
import { recipientPair } from './pairing';

type LinkStep = 'scan' | 'name';
type ManagedLinkContext = 'onboarding' | 'settings';

export type ManagedLinkFlowProps = {
    context: ManagedLinkContext;
    expectedRole: ManagedLinkRole;
    existingPatientIds?: string[];
};

export default function ManagedLinkFlow({
    context,
    expectedRole,
    existingPatientIds = [],
}: ManagedLinkFlowProps) {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const {
        activePatientId,
        scope,
        getPatientAlias,
        removePatientAlias,
        setCaregiver,
        setDoctor,
        setPatientAlias,
    } = useAppRole();
    const { activateIdentity, switchPatientIdentity, probePatientAccess } = useAppSync();

    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);
    const managedPatientsStore = useMemo(() => getManagedPatientsStore(), []);
    const cfg = useMemo(() => ({
        baseUrl: process.env.EXPO_PUBLIC_VAULT_BASE_URL ?? '',
        appIssueToken: process.env.EXPO_PUBLIC_VAULT_APP_ISSUE_TOKEN ?? '',
    }), []);

    const [step, setStep] = useState<LinkStep>('scan');
    const [scannedBundle, setScannedBundle] = useState<ManagedAccessBundleV3 | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [caregiverName, setCaregiverName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasStoredName, setHasStoredName] = useState(false);
    const [autoImport, setAutoImport] = useState(false);

    const lockRef = useRef(false);
    // Guards the pairing handshake against re-entrant execution. The autoImport effect
    // re-creates `completeLink` on every render and may fire it multiple times before the
    // first run finishes; without this, two recipientPair() runs generate two box keypairs
    // and overwrite each other's rendezvous offer, leaving one reply un-unwrappable.
    const completingRef = useRef(false);
    const caregiverNameRef = useRef<TextInput>(null);
    const displayNameRef = useRef<TextInput>(null);
    const [permission, requestPermission] = useCameraPermissions();

    const backgroundColor = context === 'onboarding' ? colors.onboardingBackground : colors.modalBackground;
    const scanPaddingTop = context === 'onboarding' ? insets.top + 44 : 20;

    useEffect(() => {
        if (!permission?.granted) {
            requestPermission();
        }
    }, [permission, requestPermission]);

    const prepareBundle = useCallback(async (bundle: ManagedAccessBundleV3) => {
        setScannedBundle(bundle);
        setError(null);

        const storedName = await getCaregiverDoctorName(bundle.role);
        const existingAlias = getPatientAlias(bundle.subject_id);

        if (storedName) {
            setCaregiverName(storedName);
            setHasStoredName(true);
        } else {
            setCaregiverName('');
            setHasStoredName(false);
        }

        if (existingAlias?.localName) {
            setDisplayName(existingAlias.localName);
        } else {
            setDisplayName('');
        }

        if (storedName && existingAlias?.localName) {
            setAutoImport(true);
        } else {
            setAutoImport(false);
            setStep('name');
        }
    }, [getPatientAlias]);

    const parseBundleInput = useCallback(async (rawInput: string, source: 'scan' | 'paste') => {
        if (source === 'scan' && !rawInput.startsWith('{')) {
            throw new Error(t('onboarding.managedLink.invalidQRData'));
        }

        const parsed = JSON.parse(await decryptBundle(rawInput));

        if (!validateManagedAccessBundleV3(parsed)) {
            if (isOutdatedManagedAccessBundle(parsed)) {
                Alert.alert(
                    t('onboarding.managedLink.outdatedFormat'),
                    t('onboarding.managedLink.outdatedFormatMessage'),
                    [{ text: 'OK', onPress: () => { lockRef.current = false; } }]
                );
                return null;
            }
            throw new Error(t('onboarding.managedLink.invalidQRData'));
        }

        if (parsed.role !== expectedRole) {
            const expectedLabel = expectedRole === 'doctor' ? t('roles.doctor') : t('roles.caregiver');
            const actualLabel = parsed.role === 'doctor' ? t('roles.doctor') : t('roles.caregiver');
            Alert.alert(
                t('onboarding.managedLink.wrongRole'),
                t('onboarding.managedLink.wrongRoleMessage', { expected: expectedLabel, actual: actualLabel }),
                [{ text: t('common.ok'), onPress: () => { lockRef.current = false; } }]
            );
            return null;
        }

        return parsed;
    }, [expectedRole, t]);

    const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
        if (lockRef.current) return;
        lockRef.current = true;

        try {
            const parsed = await parseBundleInput(data, 'scan');
            if (!parsed) return;
            await prepareBundle(parsed);
        } catch (e: any) {
            if (e instanceof BundleCipherError) {
                setError(t('onboarding.managedLink.bundleKeyUnavailable'));
            } else {
                setError(e?.message ?? t('onboarding.managedLink.invalidQRData'));
            }
            lockRef.current = false;
        }
    }, [parseBundleInput, prepareBundle, t]);

    const handlePaste = useCallback(async () => {
        if (lockRef.current) return;

        const clipboardContent = await Clipboard.getStringAsync();
        if (!clipboardContent?.trim()) {
            Alert.alert(t('onboarding.managedLink.clipboardEmpty'), t('onboarding.managedLink.clipboardEmptyMessage'));
            return;
        }

        lockRef.current = true;

        try {
            const parsed = await parseBundleInput(clipboardContent, 'paste');
            if (!parsed) return;
            await prepareBundle(parsed);
        } catch (e: any) {
            if (e instanceof BundleCipherError) {
                setError(t('onboarding.managedLink.bundleKeyUnavailable'));
            } else {
                setError(e?.message ?? t('onboarding.managedLink.invalidQRData'));
            }
            lockRef.current = false;
        }
    }, [parseBundleInput, prepareBundle, t]);

    const persistDeviceAccess = useCallback(async (bundle: ManagedAccessBundleV3, ownName: string) => {
        const deviceId = await getOrCreateStableDeviceId(store, K);
        const info = getDeviceInfo();
        await createDeviceAccessStore(bundle.subject_id).addEntry({
            device_id: deviceId,
            role: bundle.role,
            name: ownName || getDeviceDisplayName(),
            addedByDeviceId: deviceId,
            ...info,
            lastSeenAt: new Date().toISOString(),
        });
    }, [store, K]);

    const completeLink = useCallback(async () => {
        if (!scannedBundle) return;

        if (!caregiverName.trim()) {
            setError(t('onboarding.managedLink.enterYourName'));
            if (!hasStoredName) caregiverNameRef.current?.focus();
            return;
        }

        if (!displayName.trim()) {
            setError(t('onboarding.managedLink.enterPersonName'));
            displayNameRef.current?.focus();
            return;
        }

        // Re-entrancy guard: only one handshake at a time (set AFTER validation so an early
        // validation return never leaves the lock stuck).
        if (completingRef.current) return;
        completingRef.current = true;

        setIsLoading(true);
        setError(null);

        try {
            const subjectId = scannedBundle.subject_id;

            // If this patient is ALREADY linked and the grant is still valid (or we can't reach the
            // vault to check it, e.g. offline), REUSE the existing grant instead of pairing again:
            // re-pairing would be redundant and would wipe local data. The grant is role-agnostic
            // (full read_write either way), so we only (re)assign the role + scope below — this is
            // the "take over the existing connection as the new role" path. A grant that is
            // confirmed REVOKED falls through to a self-healing re-pair instead.
            let identity: ReturnType<typeof grantedIdentity> | undefined;
            if (await managedPatientsStore.has(subjectId)) {
                const status = await probePatientAccess(subjectId);
                if (status !== 'revoked') {
                    const existing = await managedPatientsStore.getFullIdentity(subjectId);
                    if (existing) {
                        identity = grantedIdentity({
                            subjectId,
                            ownPubkeyB64: existing.pubkeyB64,
                            ownSeckeyB64: existing.seckeyB64,
                            transportKeyB64: existing.transportKeyB64,
                        });
                    }
                }
            }

            if (!identity) {
                // Fresh link, or self-healing re-pair of a revoked grant: generate our OWN identity
                // and exchange via the rendezvous mailbox. The patient seckey never crosses.
                const paired = await recipientPair(cfg, store, K, scannedBundle.rendezvous_token);
                await upsertGrantedManagedPatient(managedPatientsStore, {
                    subjectId,
                    ownPubkeyB64: paired.ownPubkeyB64,
                    ownSeckeyB64: paired.ownSeckeyB64,
                    transportKeyB64: paired.transportKeyB64,
                });
                identity = grantedIdentity({
                    subjectId,
                    ownPubkeyB64: paired.ownPubkeyB64,
                    ownSeckeyB64: paired.ownSeckeyB64,
                    transportKeyB64: paired.transportKeyB64,
                });
            }

            await activateIdentity(identity, 'switch');
            await persistDeviceAccess(scannedBundle, caregiverName.trim());
            await setCaregiverDoctorName(scannedBundle.role, caregiverName.trim());
            await setPatientAlias({
                patientId: subjectId,
                localName: displayName.trim(),
                addedAt: new Date().toISOString(),
            });

            if (context === 'onboarding') {
                const allPatientIds = [
                    ...existingPatientIds.filter((id) => id !== subjectId),
                    subjectId,
                ];
                if (scannedBundle.role === 'caregiver') {
                    await setCaregiver(subjectId, allPatientIds, subjectId);
                } else {
                    await setDoctor(subjectId, allPatientIds, subjectId);
                }
                getKeyProvider().setContext({ role: scannedBundle.role, activePatientId: subjectId });
                router.replace('/(tabs)/(metric)');
                return;
            }

            if (!scope || (scope.role !== 'caregiver' && scope.role !== 'doctor')) {
                throw new Error(t('patients.notAvailable'));
            }
            if (scope.role === 'caregiver') {
                const nextPatientIds = Array.from(new Set([...scope.patientIds, subjectId]));
                await setCaregiver(scope.caregiverId, nextPatientIds, subjectId);
            } else {
                const nextPatientIds = Array.from(new Set([...scope.grantedPatientIds, subjectId]));
                await setDoctor(scope.doctorId, nextPatientIds, subjectId);
            }
            getKeyProvider().setContext({ role: scope.role, activePatientId: subjectId });
            router.dismissAll();
        } catch (e: any) {
            setError(e?.message ?? t('onboarding.errorOccurred'));
            if (autoImport) {
                setAutoImport(false);
                setStep('name');
            }
        } finally {
            completingRef.current = false;
            setIsLoading(false);
        }
    }, [
        activateIdentity,
        autoImport,
        caregiverName,
        cfg,
        context,
        displayName,
        existingPatientIds,
        K,
        managedPatientsStore,
        persistDeviceAccess,
        probePatientAccess,
        router,
        scannedBundle,
        scope,
        setCaregiver,
        setDoctor,
        setPatientAlias,
        store,
        t,
    ]);

    useEffect(() => {
        if (autoImport && scannedBundle && caregiverName && displayName) {
            completeLink().catch(console.error);
        }
    }, [autoImport, caregiverName, completeLink, displayName, scannedBundle]);

    if (!permission?.granted) {
        return (
            <View style={[styles.container, { backgroundColor }]}>
                <View style={styles.permissionContainer}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.listItemBackground }]}>
                        <AppIcon
                            name="camera.fill"
                            tintColor={colors.primary}
                            size={48}
                        />
                    </View>
                    <Text style={[styles.title, { color: colors.text }]}>
                        {t('onboarding.managedLink.cameraRequired')}
                    </Text>
                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        {t('onboarding.managedLink.cameraDescription')}
                    </Text>
                    <Button
                        title={t('onboarding.managedLink.allowCamera')}
                        onPress={requestPermission}
                        rounded
                    />
                </View>
            </View>
        );
    }

    if (step === 'scan') {
        return (
            <ScrollView
                style={[styles.container, { backgroundColor }]}
                contentContainerStyle={[styles.scanScrollContent, { paddingTop: scanPaddingTop, paddingBottom: insets.bottom + 20 }]}
                keyboardShouldPersistTaps="handled"
                contentInsetAdjustmentBehavior={ context === 'settings' ? 'automatic' : 'never' }
            >
                <View style={styles.bodyWrapper}>
                    <ScreenHeader
                        title={t('onboarding.managedLink.scanTitle')}
                        subtitle={t(`onboarding.managedLink.scanDescription_${expectedRole}`)}
                    />

                    <View style={styles.scanContainer}>
                        <View style={styles.cameraContainer}>
                            <CameraView
                                style={[StyleSheet.absoluteFill]}
                                facing="back"
                                barcodeScannerSettings={{
                                    barcodeTypes: ['qr'],
                                }}
                                onBarcodeScanned={handleBarCodeScanned}
                            />
                            <View style={styles.cameraOverlay}>
                                <View style={[styles.cameraCutout, { borderColor: colors.primary }]} />
                            </View>
                        </View>

                        <Button
                            title={t('onboarding.managedLink.pasteFromClipboard')}
                            onPress={handlePaste}
                            variant="secondary"
                            style={{ marginTop: 20 }}
                        />

                        {error && (
                            <View style={[styles.errorContainer, { backgroundColor: '#FF3B3015' }]}>
                                <Text style={[styles.errorText, { color: '#FF3B30' }]}>
                                    {error}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        );
    }

    const roleLabel = scannedBundle?.role === 'doctor' ? t('roles.doctor') : t('roles.caregiver');

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                contentInsetAdjustmentBehavior="automatic"
            >
                <View style={styles.content}>
                    <View style={[styles.iconContainer, { backgroundColor: '#34C75915' }]}>
                        <AppIcon
                            name="checkmark.circle.fill"
                            tintColor="#34C759"
                            size={48}
                        />
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>
                        {t('onboarding.managedLink.connected')}
                    </Text>

                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        {t('onboarding.managedLink.connectedAs', { role: roleLabel })}
                    </Text>

                    {!hasStoredName && (
                        <View style={styles.inputSection}>
                            <Text style={[styles.inputLabel, { color: colors.text }]}>
                                {t('onboarding.managedLink.yourName')}
                            </Text>
                            <TextInput
                                ref={caregiverNameRef}
                                style={[
                                    styles.textInput,
                                    {
                                        backgroundColor: colors.listItemBackground,
                                        color: colors.text,
                                        borderColor: error && !caregiverName.trim() ? '#FF3B30' : colors.listItemBackground,
                                    },
                                ]}
                                placeholder={t('onboarding.managedLink.yourNamePlaceholder')}
                                placeholderTextColor={colors.textHint}
                                value={caregiverName}
                                onChangeText={setCaregiverName}
                                autoCapitalize="words"
                                autoCorrect={false}
                                autoFocus
                                returnKeyType="next"
                                onSubmitEditing={() => displayNameRef.current?.focus()}
                                blurOnSubmit={false}
                            />
                            <Text style={[styles.inputHint, { color: colors.textHint }]}>
                                {t('onboarding.managedLink.yourNameHint')}
                            </Text>
                        </View>
                    )}

                    <View style={styles.inputSection}>
                        <Text style={[styles.inputLabel, { color: colors.text }]}>
                            {t('onboarding.managedLink.personName')}
                        </Text>
                        <TextInput
                            ref={displayNameRef}
                            style={[
                                styles.textInput,
                                {
                                    backgroundColor: colors.listItemBackground,
                                    color: colors.text,
                                    borderColor: error && !displayName.trim() ? '#FF3B30' : colors.listItemBackground,
                                },
                            ]}
                            placeholder={t('onboarding.managedLink.personNamePlaceholder')}
                            placeholderTextColor={colors.textHint}
                            value={displayName}
                            onChangeText={setDisplayName}
                            autoCapitalize="words"
                            autoCorrect={false}
                            autoFocus={hasStoredName}
                            returnKeyType="done"
                            onSubmitEditing={() => {
                                completeLink().catch(console.error);
                            }}
                        />
                        <Text style={[styles.inputHint, { color: colors.textHint }]}>
                            {t('onboarding.managedLink.personNameHint')}
                        </Text>
                    </View>

                    <View style={styles.infoBox}>
                        <AppIcon
                            name="info.circle.fill"
                            tintColor={colors.primary}
                            size={20}
                        />
                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                            {t('onboarding.managedLink.accessInfo')}
                        </Text>
                    </View>

                    {error && (
                        <View style={[styles.errorContainer, { backgroundColor: '#FF3B3015' }]}>
                            <Text style={[styles.errorText, { color: '#FF3B30' }]}>
                                {error}
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                <Button
                    title={isLoading ? '' : t('onboarding.managedLink.finishConnection')}
                    onPress={() => {
                        completeLink().catch(console.error);
                    }}
                    disabled={isLoading}
                    rounded
                    leftIcon={isLoading ? <ActivityIndicator color="white" /> : undefined}
                />
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    permissionContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 16,
    },
    scanContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    scanScrollContent: {
        flexGrow: 1,
    },
    scanTitle: {
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    scanDescription: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
    },
    cameraContainer: {
        height: 400,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
    },
    bodyWrapper: {
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%',
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFill,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraCutout: {
        width: 250,
        height: 250,
        borderWidth: 3,
        borderRadius: 20,
    },
    scrollContent: {
        flexGrow: 1,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingTop: 40,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
        textAlign: 'center',
        marginBottom: 32,
    },
    inputSection: {
        alignSelf: 'stretch',
        marginBottom: 24,
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
    inputHint: {
        fontSize: 13,
        marginTop: 8,
        lineHeight: 18,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        alignSelf: 'stretch',
        padding: 16,
        backgroundColor: 'rgba(0, 122, 255, 0.08)',
        borderRadius: 12,
        gap: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
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
});
