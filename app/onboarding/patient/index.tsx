import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ImageBackground, Platform, ScrollView, StyleSheet, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { List } from 'react-native-nice-ui';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useLoadingOverlay } from '@/src/context/LoadingOverlayProvider';
import { createExpoSecureStore, createKeybag, lookupSubjectByPubkey } from '@/src/lib/medical-sync-vault';
import { getOrCreateStableDeviceId } from '@/src/lib/medical-sync-vault/deviceId';
import { deriveKeysFromMnemonic } from '@/src/lib/medical-sync-vault/crypto/mnemonic';
import { loadMnemonic } from '@/src/lib/medical-sync-vault/crypto/mnemonicStore';
import { createDeviceAccessStore } from '@/src/stores/deviceAccessStore';
import { getOwnedPatientStore, type OwnedPatientIdentity } from '@/src/stores/ownedPatientStore';
import { getDeviceInfo, getDeviceDisplayName } from '@/src/utils/deviceInfo';
import { getKeyProvider } from '@/src/services/keyProvider';

const TRANSPORT_KEY_SS = 'medical_sync_vault_transport_key_b64_v1';

export default function PatientSelectScreen() {
    const { colors, isDark } = useAppTheme();
    const { t } = useTranslation();
    const router = useSafeRouter();
    const [hasExistingAccount, setHasExistingAccount] = useState(false);
    const [resumeIdentity, setResumeIdentity] = useState<OwnedPatientIdentity | null>(null);
    const { setPatient, scope, isLoading: roleLoading } = useAppRole();
    const { cfg, activateIdentity } = useAppSync();
    const { showLoading, hideLoading } = useLoadingOverlay();
    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);
    const ownedPatientStore = useMemo(() => getOwnedPatientStore(), []);

    useEffect(() => {
        if (roleLoading) return;

        let cancelled = false;

        const migrateOwnedPatient = async (): Promise<OwnedPatientIdentity | null> => {
            const existing = await ownedPatientStore.get();
            if (existing) {
                return existing;
            }

            const mnemonic = await loadMnemonic();

            if (scope?.role === 'patient') {
                const [subjectId, pubkeyB64, seckeyB64, transportKeyB64] = await Promise.all([
                    store.get(K.SUBJECT_ID),
                    store.get(K.PUBKEY_B64),
                    store.get(K.SECKEY_B64),
                    SecureStore.getItemAsync(TRANSPORT_KEY_SS),
                ]);

                if (
                    subjectId === scope.subjectId
                    && pubkeyB64
                    && seckeyB64
                    && transportKeyB64
                ) {
                    const now = new Date().toISOString();
                    const migrated: OwnedPatientIdentity = {
                        patientId: subjectId,
                        transportKeyB64,
                        pubkeyB64,
                        seckeyB64,
                        source: 'migrated_scope',
                        addedAt: now,
                        lastUsedAt: now,
                        mnemonicWords: mnemonic?.words,
                        mnemonicLang: mnemonic?.lang,
                    };
                    await ownedPatientStore.save(migrated);
                    return migrated;
                }
            }

            if (!mnemonic?.words?.length) {
                return null;
            }

            const derived = deriveKeysFromMnemonic(mnemonic.words);
            try {
                const result = await lookupSubjectByPubkey(
                    { baseUrl: cfg.baseUrl, appIssueToken: cfg.appIssueToken },
                    derived.publicKeyB64,
                );
                const now = new Date().toISOString();
                const migrated: OwnedPatientIdentity = {
                    patientId: result.subject_id,
                    transportKeyB64: derived.transportKeyB64,
                    pubkeyB64: derived.publicKeyB64,
                    seckeyB64: derived.secretKeyB64,
                    source: 'migrated_mnemonic',
                    addedAt: now,
                    lastUsedAt: now,
                    mnemonicWords: mnemonic.words,
                    mnemonicLang: mnemonic.lang,
                };
                await ownedPatientStore.save(migrated);
                return migrated;
            } catch (e: any) {
                if (e?.code === 'not_found') {
                    return null;
                }
                throw e;
            }
        };

        const loadExistingAccount = async () => {
            const owned = await migrateOwnedPatient();

            if (!cancelled) {
                setResumeIdentity(owned);
                setHasExistingAccount(!!owned);
            }
        };

        loadExistingAccount().catch(() => {
            if (!cancelled) {
                setResumeIdentity(null);
                setHasExistingAccount(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [cfg, scope, roleLoading, ownedPatientStore, store, K]);

    const handleResumeAccount = useCallback(async () => {
        if (!resumeIdentity) return;
        showLoading();
        try {
            await activateIdentity({
                patientId: resumeIdentity.patientId,
                transportKeyB64: resumeIdentity.transportKeyB64,
                pubkeyB64: resumeIdentity.pubkeyB64,
                seckeyB64: resumeIdentity.seckeyB64,
            }, 'resume');

            const deviceId = await getOrCreateStableDeviceId(store, K);
            const info = getDeviceInfo();
            await createDeviceAccessStore(resumeIdentity.patientId).addEntry({
                device_id: deviceId,
                role: 'owner',
                name: getDeviceDisplayName(),
                addedByDeviceId: deviceId,
                ...info,
                lastSeenAt: new Date().toISOString(),
            });

            await ownedPatientStore.touch(resumeIdentity.patientId);
            await setPatient(resumeIdentity.patientId);
            getKeyProvider().setContext({
                role: 'patient',
                activePatientId: resumeIdentity.patientId,
            });
            router.replace('/(tabs)/(metric)');
        }
        catch {
            hideLoading();
        }
        // hideLoading() is called by the target screen (metric/index)
    }, [resumeIdentity, activateIdentity, ownedPatientStore, setPatient, router, showLoading, hideLoading, store, K]);

    const handleCreateNew = () => {
        if (hasExistingAccount) {
            Alert.alert(
                t('alerts.overwriteAccount'),
                t('alerts.overwriteAccountMessage'),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: t('alerts.overwriteAccountConfirm'),
                        style: 'destructive',
                        onPress: () => router.push('/onboarding/patient/mnemonic')
                    }
                ]
            );
        } else {
            router.push('/onboarding/patient/mnemonic');
        }
    };

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
                            icon="person.fill"
                            iconTintColor={ colors.brandColorMuted }
                            title={ t('onboarding.patientSetup.title') }
                            subtitle={ t('onboarding.patientSetup.subtitle') }
                        />

                        <List.Section rounded spaced>
                            { hasExistingAccount && (
                                <List.Item
                                    title={ t('onboarding.patientSetup.resumeAccount') }
                                    titleNumberOfLines={ 2 }
                                    titleStyle={ { fontWeight: '600' } }
                                    subtitle={ t('onboarding.patientSetup.resumeAccountDesc') }
                                    onPress={ handleResumeAccount }
                                    leftCmpSize={ 56 }
                                    leftCmp={ <ListItemIcon name="arrow.right.circle.fill" color={ colors.textPrimary }
                                                            size="lg"
                                                            backgroundColor={ colors.listItemBackgroundMuted } /> }
                                />
                            ) }

                            <List.Item
                                title={ t('onboarding.patientSetup.createNew') }
                                titleNumberOfLines={ 2 }
                                titleStyle={ { fontWeight: '600' } }
                                subtitle={ t('onboarding.patientSetup.createNewDesc') }
                                onPress={ handleCreateNew }
                                leftCmpSize={ 56 }
                                leftCmp={ <ListItemIcon name="person.badge.plus" color={ colors.textPrimary } size="lg"
                                                        backgroundColor={ colors.listItemBackgroundMuted } /> }
                            />

                            <List.Item
                                title={ t('onboarding.patientSetup.linkExisting') }
                                titleNumberOfLines={ 2 }
                                titleStyle={ { fontWeight: '600' } }
                                subtitle={ t('onboarding.patientSetup.linkExistingDesc') }
                                onPress={ () => router.push('/onboarding/patient/scan') }
                                leftCmpSize={ 56 }
                                leftCmp={ <ListItemIcon name="qrcode.viewfinder" color={ colors.textPrimary } size="lg"
                                                        backgroundColor={ colors.listItemBackgroundMuted } /> }
                            />

                            <List.Item
                                title={ t('onboarding.patientSetup.restoreAccount') }
                                titleNumberOfLines={ 2 }
                                titleStyle={ { fontWeight: '600' } }
                                subtitle={ t('onboarding.patientSetup.restoreAccountDesc') }
                                onPress={ () => router.push('/onboarding/patient/restore') }
                                leftCmpSize={ 56 }
                                leftCmp={ <ListItemIcon name="arrow.counterclockwise" color={ colors.textPrimary }
                                                        size="lg"
                                                        backgroundColor={ colors.listItemBackgroundMuted } /> }
                            />
                        </List.Section>
                    </View>
                </ScrollView>
            </ImageBackground>
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
    }
});
