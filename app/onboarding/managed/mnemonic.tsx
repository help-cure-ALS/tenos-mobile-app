import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ImageBackground,
    Platform,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { Button, List, Text } from 'react-native-nice-ui';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { MnemonicEditor } from '@/src/components/ui/MnemonicEditor';
import { createExpoSecureStore, createKeybag } from '@/src/lib/medical-sync-vault';
import { getOrCreateStableDeviceId } from '@/src/lib/medical-sync-vault/deviceId';
import { generateMnemonic } from '@/src/lib/medical-sync-vault/crypto/mnemonic';
import { MNEMONIC_LANGUAGES, type MnemonicLanguage } from '@/src/lib/medical-sync-vault/crypto/wordlists';
import { createDeviceAccessStore } from '@/src/stores/deviceAccessStore';
import { getManagedPatientsStore } from '@/src/stores/managedPatientsStore';
import { getKeyProvider } from '@/src/services/keyProvider';
import { useTranslation } from 'react-i18next';
import * as Crypto from 'expo-crypto';
import { getCaregiverDoctorName } from '@/src/utils/caregiverDoctorName';
import { getDeviceDisplayName, getDeviceInfo } from '@/src/utils/deviceInfo';

function getDefaultMnemonicLang(appLang: string): MnemonicLanguage {
    const supported = MNEMONIC_LANGUAGES.find((l) => l.code === appLang);
    return supported ? (appLang as MnemonicLanguage) : 'en';
}

// Caregiver-only: create a new patient via mnemonic-derived keys.
// Navigated from managed/createPatient.tsx.
export default function ManagedMnemonicScreen() {
    const { colors, isDark } = useAppTheme();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { patientName, existingPatientIds } = useLocalSearchParams<{
        patientName: string;
        existingPatientIds?: string
    }>();

    const { setCaregiver, setPatientAlias } = useAppRole();
    const { activateIdentity } = useAppSync();

    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);
    const managedPatientsStore = getManagedPatientsStore();

    const [lang, setLang] = useState<MnemonicLanguage>(() => getDefaultMnemonicLang(i18n.language));
    const [words, setWords] = useState<string[]>(() => generateMnemonic(lang));
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const filledCount = words.filter((w) => w.trim().length > 0).length;
    const canContinue = filledCount >= MnemonicEditor.MIN_WORDS;

    const handleLangChange = useCallback((newLang: MnemonicLanguage) => {
        setLang(newLang);
        setWords(generateMnemonic(newLang));
        setError(null);
    }, []);

    const handleRegenerate = useCallback(() => {
        setWords(generateMnemonic(lang));
        setError(null);
    }, [lang]);

    const handleContinue = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        // Yield to let React render the loading state before CPU-intensive key derivation
        await new Promise<void>(resolve => setTimeout(resolve, 10));

        try {
            const activeWords = words.filter((w) => w.trim().length > 0);
            const patientId = Crypto.randomUUID();

            // Create patient with mnemonic-derived keys
            await managedPatientsStore.createFromMnemonic(patientId, activeWords, lang);

            // Get full identity for setting up SecureStore
            const identity = await managedPatientsStore.getFullIdentity(patientId);
            if (!identity) {
                throw new Error('Failed to create patient identity');
            }

            await activateIdentity(identity, 'switch');
            const deviceId = await getOrCreateStableDeviceId(store, K);
            const caregiverName = await getCaregiverDoctorName('caregiver');
            const info = getDeviceInfo();
            await createDeviceAccessStore(patientId).addEntry({
                device_id: deviceId,
                role: 'owner',
                name: caregiverName ?? getDeviceDisplayName(),
                addedByDeviceId: deviceId,
                ...info,
                lastSeenAt: new Date().toISOString(),
            });

            // Build full patient list: existing patients + new patient.
            const priorIds = existingPatientIds ? existingPatientIds.split(',').filter(Boolean) : [];
            const allPatientIds = [...priorIds, patientId];

            // Set caregiver role with all patients, new patient as active
            await setCaregiver(patientId, allPatientIds, patientId);

            // Set local alias for the patient
            await setPatientAlias({
                patientId,
                localName: patientName?.trim() ?? '',
                addedAt: new Date().toISOString()
            });

            // Set keyProvider context
            const keyProvider = getKeyProvider();
            keyProvider.setContext({
                role: 'caregiver',
                activePatientId: patientId
            });

            // Navigate to sharing preferences
            router.replace('/onboarding/managed/sharing');
        }
        catch (e: any) {
            setError(e?.message ?? t('onboarding.errorOccurred'));
        }
        finally {
            setIsLoading(false);
        }
    }, [words, lang, activateIdentity, store, K, setCaregiver, setPatientAlias, patientName, existingPatientIds, managedPatientsStore, t]);

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
                        <ScreenHeader
                            icon="key.fill"
                            iconTintColor={ colors.brandColorMuted }
                            title={ t('onboarding.mnemonic.title') }
                            subtitle={ t('onboarding.mnemonic.subtitleCaregiver') }
                        />

                        <MnemonicEditor
                            words={ words }
                            lang={ lang }
                            onWordsChange={ setWords }
                            onLangChange={ handleLangChange }
                            onRegenerate={ handleRegenerate }
                        />

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
                    title={ isLoading ? '' : t('onboarding.mnemonic.continue') }
                    onPress={ handleContinue }
                    disabled={ !canContinue || isLoading }
                    fullWidth
                    rounded
                    leftIcon={ isLoading ? <ActivityIndicator color="white" /> : undefined }
                />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    image: { flex: 1 },
    scrollView: { paddingBottom: Platform.OS === 'ios' ? 80 : 90 },
    bodyWrapper: {
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    container: { flex: 1 },
    errorContainer: {
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
