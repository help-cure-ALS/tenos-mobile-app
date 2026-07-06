import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { createDeviceAccessStore } from '@/src/stores/deviceAccessStore';
import { createPatientPreferencesStore } from '@/src/stores/patientPreferencesStore';
import { getSortedMetricDefinitions } from '@/src/metrics/definitions';
import { emit } from '@/src/lib/bus';
import { Button, List, Text } from 'react-native-nice-ui';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { MnemonicEditor } from '@/src/components/ui/MnemonicEditor';
import { CloseButton } from '@/src/components/ui/navigation/CloseButton';
import { createExpoSecureStore, createKeybag } from '@/src/lib/medical-sync-vault';
import { getOrCreateStableDeviceId } from '@/src/lib/medical-sync-vault/deviceId';
import { generateMnemonic } from '@/src/lib/medical-sync-vault/crypto/mnemonic';
import { MNEMONIC_LANGUAGES, type MnemonicLanguage } from '@/src/lib/medical-sync-vault/crypto/wordlists';
import { getManagedPatientsStore } from '@/src/stores/managedPatientsStore';
import { useTranslation } from 'react-i18next';
import * as Crypto from 'expo-crypto';
import { clearPatientLocalData } from '@/src/utils/clearPatientLocalData';
import { getCaregiverDoctorName } from '@/src/utils/caregiverDoctorName';
import { getDeviceDisplayName, getDeviceInfo } from '@/src/utils/deviceInfo';
import { getEnabledSharingCategories } from '@/src/features/assistiveAidsFeature';

function getDefaultMnemonicLang(appLang: string): MnemonicLanguage {
    const supported = MNEMONIC_LANGUAGES.find((l) => l.code === appLang);
    return supported ? (appLang as MnemonicLanguage) : 'en';
}

export default function SettingsMnemonicScreen() {
    const { colors } = useAppTheme();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { patientName } = useLocalSearchParams<{ patientName: string }>();

    const { activePatientId, removePatientAlias, scope, setCaregiver, setPatientAlias } = useAppRole();
    const { activateIdentity, switchPatientIdentity } = useAppSync();
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

        const patientId = Crypto.randomUUID();
        let patientCreated = false;
        let identityActivated = false;
        let scopeCommitted = false;
        let previousIdentity: Awaited<ReturnType<typeof managedPatientsStore.getFullIdentity>> = null;

        try {
            if (!scope || scope.role !== 'caregiver') {
                throw new Error(t('patients.caregiverOnly'));
            }
            if (!activePatientId) {
                throw new Error('No active managed patient available');
            }

            previousIdentity = await managedPatientsStore.getFullIdentity(activePatientId);
            if (!previousIdentity) {
                throw new Error('Failed to resolve current managed identity');
            }

            const activeWords = words.filter((w) => w.trim().length > 0);

            // Create patient with mnemonic-derived keys
            await managedPatientsStore.createFromMnemonic(patientId, activeWords, lang);
            patientCreated = true;

            // Get full identity for switching SecureStore keys + auth state
            const identity = await managedPatientsStore.getFullIdentity(patientId);
            if (!identity) {
                throw new Error('Failed to create patient identity');
            }

            // Set local alias for the patient
            await setPatientAlias({
                patientId,
                localName: patientName?.trim() ?? '',
                addedAt: new Date().toISOString(),
            });

            await activateIdentity(identity, 'switch');
            identityActivated = true;

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

            // A caregiver who creates a patient owns their data and must see ALL of it. The
            // onboarding create flow grants this via the sharing dialog (caregiver is forced on);
            // the in-app create flow must do the same — otherwise useSharingFilter, which gives a
            // caregiver only what is explicitly shared with the 'caregiver' target, hides everything.
            const prefsStore = createPatientPreferencesStore(patientId);
            const metricIds = getSortedMetricDefinitions().map((m) => m.id);
            await prefsStore.batchSetSharing('caregiver', true, metricIds, getEnabledSharingCategories(scope.role));
            emit('preferences:changed');

            const nextPatientIds = Array.from(new Set([...scope.patientIds, patientId]));
            await setCaregiver(scope.caregiverId, nextPatientIds, patientId);
            scopeCommitted = true;

            // Close settings after the new patient is active so the app reloads in the new context.
            router.dismissAll();
        } catch (e: any) {
            if (identityActivated && !scopeCommitted && scope?.role === 'caregiver' && previousIdentity) {
                try {
                    await switchPatientIdentity(previousIdentity);
                    await setCaregiver(scope.caregiverId, scope.patientIds, scope.activePatientId);
                } catch (rollbackErr) {
                    console.error('Failed to restore previous managed identity after create error:', rollbackErr);
                }
            }

            await removePatientAlias(patientId).catch(() => {});
            if (patientCreated) {
                await clearPatientLocalData(patientId).catch(() => {});
                await managedPatientsStore.remove(patientId).catch(() => {});
            }
            setError(e?.message ?? t('patientsAdd.errorOccurred'));
        } finally {
            setIsLoading(false);
        }
    }, [
        activePatientId,
        activateIdentity,
        lang,
        managedPatientsStore,
        patientName,
        removePatientAlias,
        router,
        scope,
        setCaregiver,
        setPatientAlias,
        store,
        K,
        switchPatientIdentity,
        t,
        words,
    ]);

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerRight: () => (
                            <CloseButton onPress={() => router.back()} />
                        ),
                    }}
                />
            ) : (
                <Stack.Toolbar placement="right">
                    <Stack.Toolbar.Button icon="xmark" variant="plain" onPress={() => router.back()} />
                </Stack.Toolbar>
            )}

            <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
                <ScrollView
                    contentContainerStyle={styles.scrollView}
                    keyboardShouldPersistTaps="handled"
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <View style={styles.bodyWrapper}>
                        <ScreenHeader
                            icon="key.fill"
                            iconTintColor={colors.brandColorMuted}
                            title={t('onboarding.mnemonic.title')}
                            subtitle={t('onboarding.mnemonic.subtitleCaregiver')}
                        />

                        <MnemonicEditor
                            words={words}
                            lang={lang}
                            onWordsChange={setWords}
                            onLangChange={handleLangChange}
                            onRegenerate={handleRegenerate}
                        />

                        {error && (
                            <List.Wrapper>
                                <View style={[styles.errorContainer, { backgroundColor: '#FF3B3015' }]}>
                                    <Text variant="bodyMedium" style={[styles.errorText, { color: '#FF3B30' }]}>
                                        {error}
                                    </Text>
                                </View>
                            </List.Wrapper>
                        )}
                    </View>
                </ScrollView>

                <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                    <Button
                        title={isLoading ? '' : t('onboarding.mnemonic.continue')}
                        onPress={handleContinue}
                        disabled={!canContinue || isLoading}
                        fullWidth
                        rounded
                        leftIcon={isLoading ? <ActivityIndicator color="white" /> : undefined}
                    />
                </View>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { paddingBottom: Platform.OS === 'ios' ? 80 : 90 },
    bodyWrapper: {
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%',
    },
    errorContainer: {
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
        gap: 12,
        alignItems: 'center',
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%',
    },
});
