import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ImageBackground,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { useAppTheme } from '@/src/theme';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { createDeviceAccessStore } from '@/src/stores/deviceAccessStore';
import { getOwnedPatientStore } from '@/src/stores/ownedPatientStore';
import { getDeviceInfo, getDeviceDisplayName } from '@/src/utils/deviceInfo';
import { useAuthLock } from '@/src/context/AuthLockProvider';
import { Button, List, Space, Text } from 'react-native-nice-ui';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { createExpoSecureStore, createKeybag } from '@/src/lib/medical-sync-vault';
import { getOrCreateStableDeviceId } from '@/src/lib/medical-sync-vault/deviceId';
import { loadMnemonic } from '@/src/lib/medical-sync-vault/crypto/mnemonicStore';
import { getKeyProvider } from '@/src/services/keyProvider';
import { useTranslation } from 'react-i18next';

const TRANSPORT_KEY_SS = 'medical_sync_vault_transport_key_b64_v1';

export default function PatientCreateScreen() {
    const { colors, isDark } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { setPatient } = useAppRole();
    const { activateIdentity } = useAppSync();
    const { setAuthLockEnabled, biometryType } = useAuthLock();
    const router = useSafeRouter();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [enableFaceId, setEnableFaceId] = useState(false);
    const [hasBiometry, setHasBiometry] = useState(false);

    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);

    useEffect(() => {
        checkBiometry();
    }, []);

    const checkBiometry = async () => {
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            setHasBiometry(hasHardware && isEnrolled);
        }
        catch {
            setHasBiometry(false);
        }
    };

    const getBiometryLabel = (): string => {
        if (biometryType === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) {
            return 'Face ID';
        }
        if (biometryType === LocalAuthentication.AuthenticationType.FINGERPRINT) {
            return 'Touch ID';
        }
        return t('onboarding.patientSetup.biometricLock');
    };

    const handleCreateAccount = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const pubkeyB64 = await store.get(K.PUBKEY_B64);
            const seckeyB64 = await store.get(K.SECKEY_B64);
            const transportKeyB64 = await SecureStore.getItemAsync(TRANSPORT_KEY_SS);

            if (!pubkeyB64 || !seckeyB64 || !transportKeyB64) {
                throw new Error(t('onboarding.errorOccurred'));
            }

            const subjectId = Crypto.randomUUID();
            await activateIdentity({
                patientId: subjectId,
                pubkeyB64,
                seckeyB64,
                transportKeyB64,
            }, 'fresh');

            await setPatient(subjectId);

            const keyProvider = getKeyProvider();
            keyProvider.setContext({
                role: 'patient',
                activePatientId: subjectId
            });

            const deviceId = await getOrCreateStableDeviceId(store, K);
            const devAccessStore = createDeviceAccessStore(subjectId);
            const info = getDeviceInfo();
            await devAccessStore.addEntry({
                device_id: deviceId,
                role: 'owner',
                name: getDeviceDisplayName(),
                addedByDeviceId: deviceId,
                ...info,
                lastSeenAt: new Date().toISOString()
            });

            const mnemonic = await loadMnemonic();
            const now = new Date().toISOString();
            await getOwnedPatientStore().save({
                patientId: subjectId,
                transportKeyB64,
                pubkeyB64,
                seckeyB64,
                source: 'created',
                addedAt: now,
                lastUsedAt: now,
                mnemonicWords: mnemonic?.words,
                mnemonicLang: mnemonic?.lang,
            });

            if (enableFaceId) {
                await setAuthLockEnabled(true);
            }

            router.push('/onboarding/patient/health');
        }
        catch (e: any) {
            setError(e?.message ?? t('onboarding.errorOccurred'));
        }
        finally {
            setIsLoading(false);
        }
    }, [activateIdentity, setPatient, enableFaceId, setAuthLockEnabled, store, K, t]);

    return (
        <>
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') }
                             style={ [{ flex: 1 }, { backgroundColor: colors.onboardingBackground }] }>
                <ScrollView
                    contentContainerStyle={ styles.scrollView }
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <View style={ styles.bodyWrapper }>
                        <ScreenHeader
                            icon="person.fill"
                            iconTintColor={ colors.brandColorMuted }
                            title={ t('onboarding.patientSetup.createTitle') }
                            subtitle={ t('onboarding.patientSetup.createSubtitle') }
                        />

                        <Space size="xl" />

                        { hasBiometry && (
                            <List.Section rounded>
                                <List.Item
                                    title={ getBiometryLabel() + ' ' + t('onboarding.patientSetup.enableBiometry') }
                                    titleNumberOfLines={ 2 }
                                    titleStyle={ { fontWeight: '600' } }
                                    subtitle={ t('onboarding.patientSetup.protectOnOpen') }
                                    onPress={ () => setEnableFaceId(!enableFaceId) }
                                    hideChevron
                                    leftCmpSize={ 56 }
                                    leftCmp={
                                        <ListItemIcon
                                            name={ biometryType === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION ? 'faceid' : 'touchid' }
                                            color={ colors.brandColorMuted }
                                            size="lg"
                                            backgroundColor={ colors.listItemBackgroundMuted }
                                        />
                                    }
                                    rightCmp={
                                        <Switch
                                            value={ enableFaceId }
                                            onValueChange={ setEnableFaceId }
                                        />
                                    }
                                />
                            </List.Section>
                        ) }

                        { error && (
                            <List.Wrapper>
                                <View style={ [styles.errorContainer, { backgroundColor: '#FF3B3015' }] }>
                                    <Text variant="bodyMedium" style={ [styles.errorText, { color: '#FF3B30' }] }>
                                        { error }
                                    </Text>
                                </View>
                            </List.Wrapper>
                        ) }
                    </View>
                </ScrollView>
            </ImageBackground>
            <View style={ [styles.footer, { paddingBottom: insets.bottom + 20 }] }>
                <Button
                    title={ isLoading ? '' : t('onboarding.patientSetup.createButton') }
                    onPress={ handleCreateAccount }
                    disabled={ isLoading }
                    fullWidth
                    rounded
                    leftIcon={ isLoading ? <ActivityIndicator color="white" /> : undefined }
                />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    image: {
        flex: 1
    },
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
    }
});
