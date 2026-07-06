import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert, Platform,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
    View
} from 'react-native';
import { Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { Button, List, Space, Text } from 'react-native-nice-ui';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { BundleCipherError, encryptBundle } from '@/src/lib/medical-sync-vault/crypto/bundleCipher';
import { deriveKeysFromMnemonic } from '@/src/lib/medical-sync-vault/crypto/mnemonic';
import type { MnemonicLanguage } from '@/src/lib/medical-sync-vault/crypto/wordlists';
import { HeaderButton } from "@/src/components/ui/navigation/HeaderButton";
import { getOwnedPatientStore, type OwnedPatientIdentity } from '@/src/stores/ownedPatientStore';
import { getManagedPatientsStore, type ManagedPatient } from '@/src/stores/managedPatientsStore';
import { useAppSync } from '@/src/context/AppSyncProvider';

const MAX_QR_CHARS = 2000;

type ShareBundleV1 = {
    v: 1;
    subject_id: string;
    pubkey_b64: string;
    seckey_b64: string;
    transport_key_b64: string;
    created_at: string;
    mnemonic_words?: string[];
    mnemonic_lang?: string;
};

type BundleOwnerIdentity = {
    patientId: string;
    pubkeyB64: string;
    seckeyB64: string;
    transportKeyB64: string;
    mnemonicWords?: string[];
    mnemonicLang?: MnemonicLanguage;
};

function hasOwnerKeys(identity: ManagedPatient | null): identity is ManagedPatient & Required<Pick<ManagedPatient, 'pubkeyB64' | 'seckeyB64' | 'transportKeyB64'>> {
    return !!identity?.pubkeyB64 && !!identity.seckeyB64 && !!identity.transportKeyB64;
}

function isManagedOwnerIdentity(identity: ManagedPatient): boolean {
    return identity.mode === 'owned' || identity.source === 'created' || !!identity.mnemonicWords?.length;
}

function ownedPatientToBundleIdentity(identity: OwnedPatientIdentity): BundleOwnerIdentity {
    return {
        patientId: identity.patientId,
        pubkeyB64: identity.pubkeyB64,
        seckeyB64: identity.seckeyB64,
        transportKeyB64: identity.transportKeyB64,
        mnemonicWords: identity.mnemonicWords,
        mnemonicLang: identity.mnemonicLang,
    };
}

function managedPatientToBundleIdentity(identity: ManagedPatient): BundleOwnerIdentity {
    return {
        patientId: identity.patientId,
        pubkeyB64: identity.pubkeyB64!,
        seckeyB64: identity.seckeyB64!,
        transportKeyB64: identity.transportKeyB64!,
        mnemonicWords: identity.mnemonicWords,
        mnemonicLang: identity.mnemonicLang,
    };
}

export default function DeviceQRCodeScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const { role, activePatientId } = useAppRole();
    const { ensureDataSynced, fullSync } = useAppSync();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();

    const qrSize = Math.min(width - 80, 320);

    const [bundleText, setBundleText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const qrValue = useMemo(() => {
        if (!bundleText || bundleText.length > MAX_QR_CHARS) return '';
        return bundleText;
    }, [bundleText]);

    const qrTooLarge = useMemo(() => !!bundleText && bundleText.length > MAX_QR_CHARS, [bundleText]);

    const resolveOwnerIdentity = useCallback(async (): Promise<BundleOwnerIdentity | null> => {
        if (role === 'patient') {
            const owned = await getOwnedPatientStore().get();
            if (!owned || (activePatientId && owned.patientId !== activePatientId)) {
                return null;
            }
            return ownedPatientToBundleIdentity(owned);
        }

        if (role === 'caregiver' && activePatientId) {
            const managed = await getManagedPatientsStore().get(activePatientId);
            if (!hasOwnerKeys(managed) || !isManagedOwnerIdentity(managed)) {
                return null;
            }
            return managedPatientToBundleIdentity(managed);
        }

        return null;
    }, [role, activePatientId]);

    const appendVerifiedMnemonic = useCallback((bundle: ShareBundleV1, identity: BundleOwnerIdentity) => {
        if (!identity.mnemonicWords?.length) {
            return;
        }

        const derived = deriveKeysFromMnemonic(identity.mnemonicWords);
        if (
            derived.publicKeyB64 !== identity.pubkeyB64
            || derived.secretKeyB64 !== identity.seckeyB64
            || derived.transportKeyB64 !== identity.transportKeyB64
        ) {
            throw new Error(t('devices.invalidOwnerIdentity'));
        }

        bundle.mnemonic_words = identity.mnemonicWords;
        bundle.mnemonic_lang = identity.mnemonicLang ?? 'en';
    }, [t]);

    const generateBundle = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const synced = await ensureDataSynced();
            if (!synced) {
                throw new Error(t('devices.syncRequired'));
            }
            await fullSync('device qr');

            const identity = await resolveOwnerIdentity();
            if (!identity) {
                throw new Error(t('devices.noOwnerIdentity'));
            }

            const bundle: ShareBundleV1 = {
                v: 1,
                subject_id: identity.patientId,
                pubkey_b64: identity.pubkeyB64,
                seckey_b64: identity.seckeyB64,
                transport_key_b64: identity.transportKeyB64,
                created_at: new Date().toISOString()
            };

            appendVerifiedMnemonic(bundle, identity);

            setBundleText(await encryptBundle(JSON.stringify(bundle)));
        } catch (e: any) {
            if (e instanceof BundleCipherError) {
                setError(t('devices.bundleKeyUnavailable'));
            } else {
                setError(e?.message ?? String(e));
            }
        } finally {
            setIsLoading(false);
        }
    }, [appendVerifiedMnemonic, ensureDataSynced, fullSync, resolveOwnerIdentity, t]);

    useEffect(() => {
        generateBundle();
    }, [generateBundle]);

    const handleCopy = useCallback(async () => {
        if (!bundleText) return;
        await Clipboard.setStringAsync(bundleText);
        Alert.alert(t('devices.copied'), t('devices.copiedMessage'));
    }, [bundleText, t]);

    const handleClose = useCallback(() => {
        router.back();
    }, []);

    return (
        <View style={ [styles.container, { backgroundColor: colors.modalBackground }] }>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: t('devices.showQrCode'),
                        headerRight: () => (
                            <HeaderButton
                                onPress={handleClose}
                                title={t('common.done')}
                            />
                        ),
                    }}
                />
            ) : (
                <Stack.Screen>
                    <Stack.Screen.Title>{t('devices.showQrCode')}</Stack.Screen.Title>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button onPress={handleClose}>{t('common.done')}</Stack.Toolbar.Button>
                    </Stack.Toolbar>
                </Stack.Screen>
            )}

            <ScrollView
                contentContainerStyle={ [styles.scrollContent, { paddingBottom: insets.bottom + 20 }] }
                contentInsetAdjustmentBehavior="automatic"
            >
                { error ? (
                    <View style={ styles.errorContainer }>
                        <AppIcon
                            name="exclamationmark.triangle"
                            tintColor={ colors.textHint }
                            size={ 64 }
                        />
                        <Text style={ [styles.errorTitle, { color: colors.text }] }>
                            { t('devices.qrCodeCreationFailed') }
                        </Text>
                        <Text style={ [styles.errorText, { color: colors.textHint }] }>
                            { error }
                        </Text>
                        <Button
                            title={ t('devices.retry') }
                            onPress={ generateBundle }
                            rounded
                            style={ { marginTop: 20 } }
                        />
                    </View>
                ) : isLoading ? (
                    <View style={ styles.loadingContainer }>
                        <Text style={ [styles.loadingText, { color: colors.textHint }] }>
                            { t('devices.qrCodeCreating') }
                        </Text>
                    </View>
                ) : (
                    <>
                        <List.Wrapper>
                            <Text variant="titleMedium" align="center">
                                { t('devices.qrCodeInstructions') }
                            </Text>
                            <Space size="xl" />
                        </List.Wrapper>

                        { qrValue ? (
                            <View style={ styles.qrContainer }>
                                <View style={ styles.qrBox }>
                                    <QRCode
                                        value={ qrValue }
                                        size={ qrSize }
                                        backgroundColor="white"
                                        color="black"
                                    />
                                </View>
                            </View>
                        ) : qrTooLarge ? (
                            <View style={ styles.qrContainer }>
                                <View style={ [styles.qrPlaceholder, { width: qrSize + 40, height: qrSize + 40, backgroundColor: colors.listItemBackground }] }>
                                    <AppIcon
                                        name="exclamationmark.triangle"
                                        tintColor={ colors.textHint }
                                        size={ 48 }
                                    />
                                    <Text style={ [styles.qrPlaceholderText, { color: colors.textHint }] }>
                                        { t('devices.bundleTooLarge') }
                                    </Text>
                                </View>
                            </View>
                        ) : null }

                        <List.Wrapper>
                            <Button
                                title={ t('devices.copyBundle') }
                                subtitle={ t('devices.copyBundleSubtitle') }
                                onPress={ handleCopy }
                                disabled={ !bundleText }
                                variant="secondary"
                            />
                        </List.Wrapper>
                    </>
                ) }
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    scrollContent: {
        paddingTop: 20
    },
    qrContainer: {
        alignItems: 'center',
        marginBottom: 24
    },
    qrBox: {
        padding: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4
    },
    qrPlaceholder: {
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20
    },
    qrPlaceholderText: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 12
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingTop: 60
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        textAlign: 'center'
    },
    errorText: {
        fontSize: 15,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 22
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60
    },
    loadingText: {
        fontSize: 16
    }
});
