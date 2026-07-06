import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import {
    Alert, Platform,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
    View
} from 'react-native';
import { Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import * as SecureStore from 'expo-secure-store';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/theme';
import { createExpoSecureStore, createKeybag } from '@/src/lib/medical-sync-vault';
import { Button, List, Space, Text } from 'react-native-nice-ui';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { BundleCipherError, encryptBundle } from '@/src/lib/medical-sync-vault/crypto/bundleCipher';
import { HeaderButton } from "@/src/components/ui/navigation/HeaderButton";
import { generateRendezvousToken } from '@/src/lib/medical-sync-vault/api/rendezvous';
import { patientRespondOnce } from '@/src/features/managed-link/pairing';
import { createDeviceAccessStore } from '@/src/stores/deviceAccessStore';
import { getDeviceInfo, getDeviceDisplayName } from '@/src/utils/deviceInfo';
import type { ManagedAccessBundleV3 } from '@/src/features/managed-link/managedLinkUtils';

const TRANSPORT_KEY_SS = 'medical_sync_vault_transport_key_b64_v1';
const MAX_QR_CHARS = 2000;

function isUuid(s: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s ?? ''));
}

export default function AddCaregiverScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();

    const qrSize = Math.min(width - 80, 320);

    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);

    const [bundleText, setBundleText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const qrValue = useMemo(() => {
        if (!bundleText || bundleText.length > MAX_QR_CHARS) {
            return '';
        }
        return bundleText;
    }, [bundleText]);

    const qrTooLarge = useMemo(() => !!bundleText && bundleText.length > MAX_QR_CHARS, [bundleText]);

    const cfg = useMemo(() => ({
        baseUrl: process.env.EXPO_PUBLIC_VAULT_BASE_URL ?? '',
        appIssueToken: process.env.EXPO_PUBLIC_VAULT_APP_ISSUE_TOKEN ?? '',
    }), []);
    const responderActive = useRef(false);
    const [linked, setLinked] = useState(false);

    const generateBundle = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setLinked(false);

        try {
            const subject_id = await store.get(K.SUBJECT_ID);
            if (!subject_id || !isUuid(subject_id)) {
                throw new Error(t('share.addCaregiver.errorNoAccount'));
            }
            const pubkey_b64 = await store.get(K.PUBKEY_B64);
            const seckey_b64 = await store.get(K.SECKEY_B64);
            if (!pubkey_b64 || !seckey_b64) {
                throw new Error(t('share.addCaregiver.errorNoSigningKeys'));
            }
            const transport_key_b64 = (await SecureStore.getItemAsync(TRANSPORT_KEY_SS)) ?? '';
            if (!transport_key_b64) {
                throw new Error(t('share.addCaregiver.errorNoTransportKey'));
            }

            // T-002: V3 bundle carries NO secrets — only public material + a rendezvous token.
            const rendezvous_token = generateRendezvousToken((n) => Crypto.getRandomBytes(n));
            const bundle: ManagedAccessBundleV3 = {
                v: 3,
                subject_id,
                patient_pubkey_b64: pubkey_b64,
                rendezvous_token,
                role: 'caregiver',
                created_at: new Date().toISOString(),
            };
            setBundleText(await encryptBundle(JSON.stringify(bundle)));

            // Patient responder: authorize the recipient device + wrap transport_key.
            responderActive.current = true;
            void (async () => {
                while (responderActive.current) {
                    try {
                        const res = await patientRespondOnce(cfg, rendezvous_token, {
                            subjectId: subject_id,
                            rootSeckeyB64: seckey_b64,
                            transportKeyB64: transport_key_b64,
                            capability: 'read_write',
                        });
                        if (res) {
                            const deviceAccess = createDeviceAccessStore(subject_id);
                            await deviceAccess.addEntry({
                                device_id: res.deviceId,
                                role: 'caregiver',
                                name: getDeviceDisplayName(),
                                addedByDeviceId: (await store.get(K.DEVICE_ID)) ?? undefined,
                                ...getDeviceInfo(),
                                lastSeenAt: new Date().toISOString(),
                            });
                            responderActive.current = false;
                            setLinked(true);
                            return;
                        }
                    } catch {
                        // keep polling until the screen is closed
                    }
                    await new Promise((r) => setTimeout(r, 2500));
                }
            })();
        }
        catch (e: any) {
            if (e instanceof BundleCipherError) {
                setError(t('share.addCaregiver.bundleKeyUnavailable'));
            } else {
                setError(e?.message ?? String(e));
            }
        }
        finally {
            setIsLoading(false);
        }
    }, [store, K, t, cfg]);

    useEffect(() => () => { responderActive.current = false; }, []);

    useEffect(() => {
        generateBundle();
    }, [generateBundle]);

    const handleCopy = useCallback(async () => {
        if (!bundleText) {
            return;
        }
        await Clipboard.setStringAsync(bundleText);
        Alert.alert(t('share.addCaregiver.copiedTitle'), t('share.addCaregiver.copiedMessage'));
    }, [bundleText, t]);

    const handleClose = useCallback(() => {
        router.back();
    }, []);

    return (
        <View style={ [styles.container, { backgroundColor: colors.modalBackground }] }>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: t('share.addCaregiver.title'),
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
                    <Stack.Screen.Title>{t('share.addCaregiver.title')}</Stack.Screen.Title>
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
                            { t('share.addCaregiver.errorTitle') }
                        </Text>
                        <Text style={ [styles.errorText, { color: colors.textHint }] }>
                            { error }
                        </Text>
                        <Button
                            title={ t('share.addCaregiver.retry') }
                            onPress={ generateBundle }
                            rounded
                            style={ { marginTop: 20 } }
                        />
                    </View>
                ) : isLoading ? (
                    <View style={ styles.loadingContainer }>
                        <Text style={ [styles.loadingText, { color: colors.textHint }] }>
                            { t('share.addCaregiver.loading') }
                        </Text>
                    </View>
                ) : (
                    <>
                        <List.Wrapper>
                            <Text variant="titleMedium" align="center">
                                { t('share.addCaregiver.infoText') }
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
                                        { t('share.addCaregiver.bundleTooLarge') }
                                    </Text>
                                </View>
                            </View>
                        ) : null }

                        <List.Wrapper>
                            <Button
                                title={ t('share.addCaregiver.copyCode') }
                                subtitle={ t('share.addCaregiver.copyCodeSubtitle') }
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
    infoBox: {
        marginHorizontal: 20,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24
    },
    infoText: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22
    },
    qrContainer: {
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 30
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
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center'
    },
    securityNote: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 24,
        paddingHorizontal: 20
    },
    securityText: {
        fontSize: 14
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
        fontSize: 16,
    },
});
