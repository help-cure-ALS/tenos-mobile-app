import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    ImageBackground,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAppTheme } from '@/src/theme';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { createDeviceAccessStore } from '@/src/stores/deviceAccessStore';
import { getOwnedPatientStore } from '@/src/stores/ownedPatientStore';
import { getDeviceInfo, getDeviceDisplayName } from '@/src/utils/deviceInfo';
import { useAuthLock } from '@/src/context/AuthLockProvider';
import { Button, List, Text } from 'react-native-nice-ui';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { createExpoSecureStore, createKeybag } from '@/src/lib/medical-sync-vault';
import { getOrCreateStableDeviceId } from '@/src/lib/medical-sync-vault/deviceId';
import { getKeyProvider } from '@/src/services/keyProvider';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { BundleCipherError, decryptBundle } from '@/src/lib/medical-sync-vault/crypto/bundleCipher';
import { validateBundleFreshness } from '@/src/lib/medical-sync-vault/crypto/bundleFreshness';
import { storeMnemonic } from '@/src/lib/medical-sync-vault/crypto/mnemonicStore';
import { deriveKeysFromMnemonic } from '@/src/lib/medical-sync-vault/crypto/mnemonic';
import type { MnemonicLanguage } from '@/src/lib/medical-sync-vault/crypto/wordlists';

type PairingBundle = {
    v: 1;
    subject_id: string;
    pubkey_b64?: string;
    seckey_b64?: string;
    ed25519_public_key_b64?: string;
    ed25519_secret_key_b64?: string;
    transport_key_b64?: string;
    created_at?: string;
    mnemonic_words?: string[];
    mnemonic_lang?: string;
};

function isUuid(s: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s));
}

function validateBundle(obj: any): obj is PairingBundle {
    if (!obj || typeof obj !== 'object') {
        return false;
    }
    if (obj.v !== 1) {
        return false;
    }
    if (!obj.subject_id || !isUuid(obj.subject_id)) {
        return false;
    }

    const pub = obj.pubkey_b64 ?? obj.ed25519_public_key_b64;
    const sec = obj.seckey_b64 ?? obj.ed25519_secret_key_b64;

    if (!pub || String(pub).length < 8) {
        return false;
    }
    if (!sec || String(sec).length < 8) {
        return false;
    }
    if (!obj.transport_key_b64 || String(obj.transport_key_b64).length < 8) {
        return false;
    }
    if (!validateBundleFreshness(obj.created_at)) {
        return false;
    }

    return true;
}

function getBundleKeys(parsed: PairingBundle) {
    const mnemonicWords = Array.isArray(parsed.mnemonic_words) ? parsed.mnemonic_words
        ?.map((word) => String(word).trim())
        .filter(Boolean) : undefined;

    if (mnemonicWords?.length) {
        const derived = deriveKeysFromMnemonic(mnemonicWords);
        return {
            pubkeyB64: derived.publicKeyB64,
            seckeyB64: derived.secretKeyB64,
            transportKeyB64: derived.transportKeyB64,
            mnemonicWords,
            mnemonicLang: ((parsed.mnemonic_lang as MnemonicLanguage | undefined) ?? 'en'),
        };
    }

    return {
        pubkeyB64: String(parsed.pubkey_b64 ?? parsed.ed25519_public_key_b64),
        seckeyB64: String(parsed.seckey_b64 ?? parsed.ed25519_secret_key_b64),
        transportKeyB64: String(parsed.transport_key_b64),
        mnemonicWords: undefined,
        mnemonicLang: undefined,
    };
}

export default function PatientScanScreen() {
    const { colors, isDark } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { setPatient } = useAppRole();
    const { activateIdentity } = useAppSync();
    const { setAuthLockEnabled } = useAuthLock();
    const router = useSafeRouter();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [enableFaceId] = useState(false);

    const [permission, requestPermission] = useCameraPermissions();
    const [scanLocked, setScanLocked] = useState(false);
    const lockRef = useRef(false);

    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);

    // Request camera permission on mount
    useEffect(() => {
        if (!permission?.granted) {
            requestPermission();
        }
    }, []);

    const importBundle = useCallback(async (parsed: PairingBundle) => {
        setIsLoading(true);
        setError(null);

        try {
            const keys = getBundleKeys(parsed);

            if (keys.mnemonicWords?.length) {
                await storeMnemonic(keys.mnemonicWords, keys.mnemonicLang ?? 'en');
            }

            await activateIdentity({
                patientId: parsed.subject_id,
                transportKeyB64: keys.transportKeyB64,
                pubkeyB64: keys.pubkeyB64,
                seckeyB64: keys.seckeyB64,
            }, 'switch');

            await setPatient(parsed.subject_id);

            const keyProvider = getKeyProvider();
            keyProvider.setContext({
                role: 'patient',
                activePatientId: parsed.subject_id
            });

            const deviceId = await getOrCreateStableDeviceId(store, K);
            const devAccessStore = createDeviceAccessStore(parsed.subject_id);
            const info = getDeviceInfo();
            await devAccessStore.addEntry({
                device_id: deviceId,
                role: 'owner',
                name: getDeviceDisplayName(),
                addedByDeviceId: deviceId,
                ...info,
                lastSeenAt: new Date().toISOString()
            });

            const now = new Date().toISOString();
            await getOwnedPatientStore().save({
                patientId: parsed.subject_id,
                transportKeyB64: keys.transportKeyB64,
                pubkeyB64: keys.pubkeyB64,
                seckeyB64: keys.seckeyB64,
                source: 'linked',
                addedAt: now,
                lastUsedAt: now,
                mnemonicWords: keys.mnemonicWords,
                mnemonicLang: keys.mnemonicLang,
            });

            if (enableFaceId) {
                await setAuthLockEnabled(true);
            }

            router.replace('/(tabs)/(metric)');
        }
        catch (e: any) {
            setError(e?.message ?? t('onboarding.errorOccurred'));
            lockRef.current = false;
            setScanLocked(false);
        }
        finally {
            setIsLoading(false);
        }
    }, [activateIdentity, store, K, setPatient, enableFaceId, setAuthLockEnabled, t]);

    const handleBarcodeScanned = useCallback(async (payload: { data: string }) => {
        if (lockRef.current) {
            return;
        }

        const data = payload?.data ?? '';
        lockRef.current = true;
        setScanLocked(true);

        let parsed: any;
        try {
            parsed = JSON.parse(await decryptBundle(data));
        }
        catch (e: any) {
            const message = e instanceof BundleCipherError
                ? t('onboarding.scan.bundleKeyUnavailable')
                : t('onboarding.scan.invalidQRMessage');
            Alert.alert(t('onboarding.scan.invalidQR'), message, [
                {
                    text: t('onboarding.scan.rescan'), onPress: () => {
                        lockRef.current = false;
                        setScanLocked(false);
                    }
                }
            ]);
            return;
        }

        if (!validateBundle(parsed)) {
            Alert.alert(t('onboarding.scan.invalidBundle'), t('onboarding.scan.invalidBundleMessage'), [
                {
                    text: t('onboarding.scan.rescan'), onPress: () => {
                        lockRef.current = false;
                        setScanLocked(false);
                    }
                }
            ]);
            return;
        }

        Alert.alert(
            t('onboarding.scan.linkDevice'),
            t('onboarding.scan.linkDeviceMessage'),
            [
                {
                    text: t('common.cancel'),
                    style: 'cancel',
                    onPress: () => {
                        lockRef.current = false;
                        setScanLocked(false);
                    }
                },
                {
                    text: t('onboarding.scan.link'),
                    onPress: () => importBundle(parsed)
                }
            ]
        );
    }, [importBundle, t]);

    const handlePaste = useCallback(async () => {
        if (lockRef.current) {
            return;
        }

        const clipboardContent = await Clipboard.getStringAsync();
        if (!clipboardContent?.trim()) {
            Alert.alert(t('onboarding.scan.clipboardEmpty'), t('onboarding.scan.clipboardEmptyMessage'));
            return;
        }

        lockRef.current = true;
        setScanLocked(true);

        let parsed: any;
        try {
            parsed = JSON.parse(await decryptBundle(clipboardContent));
        }
        catch (e: any) {
            const message = e instanceof BundleCipherError
                ? t('onboarding.scan.bundleKeyUnavailable')
                : t('onboarding.scan.invalidDataMessage');
            Alert.alert(t('onboarding.scan.invalidData'), message, [
                {
                    text: t('common.ok'), onPress: () => {
                        lockRef.current = false;
                        setScanLocked(false);
                    }
                }
            ]);
            return;
        }

        if (!validateBundle(parsed)) {
            Alert.alert(t('onboarding.scan.invalidBundle'), t('onboarding.scan.invalidBundleMessage'), [
                {
                    text: t('common.ok'), onPress: () => {
                        lockRef.current = false;
                        setScanLocked(false);
                    }
                }
            ]);
            return;
        }

        Alert.alert(
            t('onboarding.scan.linkDevice'),
            t('onboarding.scan.linkDeviceMessage'),
            [
                {
                    text: t('common.cancel'),
                    style: 'cancel',
                    onPress: () => {
                        lockRef.current = false;
                        setScanLocked(false);
                    }
                },
                {
                    text: t('onboarding.scan.link'),
                    onPress: () => importBundle(parsed)
                }
            ]
        );
    }, [importBundle, t]);

    const canUseCamera = !!permission?.granted;

    return (
        <>
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') }
                             style={ [{ flex: 1 }, { backgroundColor: colors.onboardingBackground }] }>
                <ScrollView
                    contentContainerStyle={ styles.scrollView }
                    keyboardShouldPersistTaps="handled"
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <View style={ styles.bodyWrapper }>
                        { !canUseCamera ? (
                            <View style={ styles.permissionContainer }>
                                <View style={ [styles.iconContainer, { backgroundColor: colors.listItemBackground }] }>
                                    <AppIcon
                                        name="camera.fill"
                                        tintColor={ colors.primary }
                                        size={ 48 }
                                    />
                                </View>
                                <Text style={ [styles.title, { color: colors.text }] }>
                                    { t('onboarding.scan.cameraRequired') }
                                </Text>
                                <Text style={ [styles.description, { color: colors.textSecondary }] }>
                                    { t('onboarding.scan.cameraDescription') }
                                </Text>
                                <Button
                                    title={ t('onboarding.scan.allowAccess') }
                                    onPress={ requestPermission }
                                    rounded
                                    style={ { marginTop: 20 } }
                                />
                                <Pressable onPress={ handlePaste } style={ styles.pasteButton }>
                                    <Text style={ [styles.pasteText, { color: colors.primary }] }>
                                        { t('onboarding.scan.pasteFromClipboard') }
                                    </Text>
                                </Pressable>
                            </View>
                        ) : (
                            <>
                                <ScreenHeader
                                    title={ t('onboarding.scan.title') }
                                    subtitle={ t('onboarding.scan.description') }
                                />

                                <List.Wrapper>
                                    <View style={ styles.scanContent }>
                                        <View style={ styles.cameraContainer }>
                                            <CameraView
                                                style={ StyleSheet.absoluteFill }
                                                barcodeScannerSettings={ { barcodeTypes: ['qr'] } }
                                                onBarcodeScanned={ scanLocked ? undefined : handleBarcodeScanned }
                                            />
                                            <View style={ styles.cameraOverlay }>
                                                <View
                                                    style={ [styles.cameraCutout, { borderColor: colors.primary }] } />
                                            </View>
                                            { scanLocked && (
                                                <View style={ styles.statusContainer }>
                                                    <View
                                                        style={ [styles.statusBadge, { backgroundColor: colors.textHint }] }>
                                                        <Text style={ styles.statusText }>
                                                            { t('onboarding.scan.processing') }
                                                        </Text>
                                                    </View>
                                                </View>
                                            ) }
                                        </View>

                                        { error && (
                                            <View style={ [styles.errorContainer, { backgroundColor: '#FF3B3015' }] }>
                                                <Text style={ [styles.errorText, { color: '#FF3B30' }] }>
                                                    { error }
                                                </Text>
                                            </View>
                                        ) }
                                    </View>

                                    <Button
                                        title={ t('onboarding.scan.pasteFromClipboard') }
                                        onPress={ handlePaste }
                                        variant="secondary"
                                    />
                                </List.Wrapper>
                            </>
                        ) }
                    </View>
                </ScrollView>
            </ImageBackground>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    container: {
        flex: 1
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center'
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
        textAlign: 'center',
        marginBottom: 32
    },
    permissionContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 12
    },
    scanContent: {
        flex: 1,
        paddingTop: 16,
        paddingBottom: 32
    },
    scanTitle: {
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8
    },
    scanDescription: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24
    },
    cameraContainer: {
        minHeight: 350,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        maxHeight: 400
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFill,
        justifyContent: 'center',
        alignItems: 'center'
    },
    cameraCutout: {
        width: 250,
        height: 250,
        borderWidth: 3,
        borderRadius: 20
    },
    statusContainer: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        alignItems: 'center'
    },
    statusBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20
    },
    statusText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14
    },
    errorContainer: {
        marginTop: 24,
        padding: 16,
        borderRadius: 12,
        alignSelf: 'stretch'
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center'
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        gap: 12,
        alignItems: 'center',
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    pasteButton: {
        paddingVertical: 8,
        paddingHorizontal: 16
    },
    pasteText: {
        fontSize: 15,
        fontWeight: '500'
    }
});
