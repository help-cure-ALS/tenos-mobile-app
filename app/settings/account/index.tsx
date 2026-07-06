import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { Badge, List } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useAppRole, usePatientDisplay } from "@/src/context/AppRoleProvider";
import { useAuthLock } from "@/src/context/AuthLockProvider";
import { useVerification } from "@/src/hooks/usePatientPreferences";
import { useFocusEffect } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { useAppSync } from "@/src/context/AppSyncProvider";
import { DEMO_PATIENT_ID } from '@/src/demo/demoData';
import { emit } from '@/src/lib/bus';
import { getManagedPatientsStore } from '@/src/stores/managedPatientsStore';
import { clearPatientLocalData } from '@/src/utils/clearPatientLocalData';
import { SECURE_STORE_KEYS } from '@/src/utils/secureStoreKeys';
import * as SecureStore from 'expo-secure-store';
import { useLoadingOverlay } from '@/src/context/LoadingOverlayProvider';
import { INSTALL_FLAG } from '@/src/utils/freshInstallCheck';
import { NOTIFICATION_STORAGE_KEYS } from '@/src/services/notificationPrefs';

export default function AccountScreen() {
    const { colors } = useAppTheme();
    const { role, reset: resetRole, isDemo, activePatientId } = useAppRole();
    const { patientFhirStore, outbox, reset, deleteAccountOnServer } = useAppSync();
    const router = useSafeRouter();
    const { authLockEnabled, setAuthLockEnabled, biometryType } = useAuthLock();
    const { t } = useTranslation();
    const verification = useVerification();
    useFocusEffect(useCallback(() => { verification.refresh(); }, [verification.refresh]));
    const [activePatientHasMnemonic, setActivePatientHasMnemonic] = useState(false);
    const { showLoading, hideLoading } = useLoadingOverlay();

    useEffect(() => {
        if ((role !== 'caregiver' && role !== 'doctor') || !activePatientId) {
            setActivePatientHasMnemonic(false);
            return;
        }
        getManagedPatientsStore().get(activePatientId).then((mp) => {
            setActivePatientHasMnemonic(!!mp?.mnemonicWords?.length);
        });
    }, [role, activePatientId]);

    function confirmChangeRole() {
        Alert.alert(
            isDemo ? t('settings.endDemo') : t('settings.logout'),
            isDemo ? t('alerts.endDemoMessage') : t('alerts.logoutMessage'),
            [
                { text: t('common.cancel'), style: "cancel" },
                {
                    text: isDemo ? t('settings.endDemo') : t('settings.logout'),
                    onPress: async () => {
                        showLoading();
                        try {
                            // Clear demo data before switching role
                            if (isDemo) {
                                await clearPatientLocalData(DEMO_PATIENT_ID);
                                emit('fhir:changed');
                                await Notifications.cancelAllScheduledNotificationsAsync();
                                await AsyncStorage.multiRemove(Object.values(NOTIFICATION_STORAGE_KEYS));
                            }
                            await resetRole(true);
                            router.replace('/onboarding');
                        } catch {
                            hideLoading();
                        }
                    }
                }
            ]
        );
    }

    function confirmDeleteAccount() {
        Alert.alert(
            t('alerts.deleteAccountTitle'),
            t('alerts.deleteAccountMessage'),
            [
                { text: t('common.cancel'), style: "cancel" },
                {
                    text: t('common.delete'),
                    style: "destructive",
                    onPress: () => {
                        // Second confirmation
                        Alert.alert(
                            t('alerts.deleteAccountFinalTitle'),
                            t('alerts.deleteAccountFinalMessage'),
                            [
                                { text: t('common.cancel'), style: "cancel" },
                                {
                                    text: t('alerts.deleteAccountConfirm'),
                                    style: "destructive",
                                    onPress: async () => {
                                        showLoading();
                                        try {
                                            // Delete all data on vault server (while JWT still valid)
                                            try {
                                                await deleteAccountOnServer();
                                            } catch (e) {
                                                hideLoading();
                                                const confirmed = await new Promise<boolean>((resolve) => {
                                                    Alert.alert(
                                                        t('alerts.serverDeleteFailedTitle'),
                                                        t('alerts.serverDeleteFailedMessage'),
                                                        [
                                                            { text: t('common.cancel'), style: "cancel", onPress: () => resolve(false) },
                                                            { text: t('alerts.deleteLocalOnly'), style: "destructive", onPress: () => resolve(true) },
                                                        ]
                                                    );
                                                });
                                                if (!confirmed) return;
                                                showLoading();
                                            }

                                            // Clear databases
                                            await patientFhirStore.clear();
                                            await outbox.clear();
                                            await reset();

                                            // Clear per-patient local data
                                            const managedPatientsStore = getManagedPatientsStore();
                                            const allPatients = await managedPatientsStore.getAll();
                                            await Promise.all(
                                                allPatients.map(p => clearPatientLocalData(p.patientId).catch(() => {}))
                                            );
                                            await managedPatientsStore.clear();

                                            // Clear SecureStore
                                            await Promise.all(
                                                SECURE_STORE_KEYS.map((key) =>
                                                    SecureStore.deleteItemAsync(key).catch(() => {})
                                                )
                                            );

                                            // Clear ALL AsyncStorage
                                            await AsyncStorage.clear();

                                            // Restore install marker after explicit local wipe.
                                            await AsyncStorage.setItem(INSTALL_FLAG, '1');

                                            // Cancel all scheduled notifications
                                            await Notifications.cancelAllScheduledNotificationsAsync();

                                            // Reset role and navigate to onboarding
                                            await resetRole(false);
                                            router.replace('/onboarding');
                                        } catch (e: unknown) {
                                            hideLoading();
                                            const msg = e instanceof Error ? e.message : String(e);
                                            Alert.alert(t('common.error'), msg);
                                        }
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    }

    return (
        <ScrollView style={ { backgroundColor: colors.modalBackground } }
                    contentContainerStyle={ styles.scrollView }
                    contentInsetAdjustmentBehavior="automatic"
        >
            <ScrollViewContent>
                { role === 'patient' && (
                    <List.Section rounded>
                        <List.Item
                            title={ t('settings.verification') }
                            subtitle={ t('settings.verificationSubtitle') }
                            badge={ verification ? <Badge label={ verification.label } variant={ verification.variant }
                                                          size="small" /> : undefined }
                            badgePosition="top-right"
                            onPress={ () => {
                                router.push('/settings/account/verification');
                            } }
                            lastItem={ true }
                        />
                    </List.Section>
                ) }

                <List.Section rounded>
                    <List.Item
                        title={ t('settings.linkDevices') }
                        onPress={ () => {
                            router.push('/settings/devices');
                        } }
                        lastItem={ role !== 'patient' && role !== 'caregiver' && role !== 'doctor' && !activePatientHasMnemonic }
                    />
                    { role === 'patient' && (
                        <List.Item
                            title={ t('settings.recoveryWords') }
                            subtitle={ t('settings.recoveryWordsSubtitle') }
                            onPress={ () => {
                                router.push('/settings/account/recoveryWords');
                            } }
                        />
                    ) }
                    { activePatientHasMnemonic && activePatientId && (
                        <PatientRecoveryWordsItem patientId={ activePatientId } />
                    ) }
                    { role === 'patient' && (
                        <List.Item
                            title={ biometryType === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
                                ? "Face ID"
                                : biometryType === LocalAuthentication.AuthenticationType.FINGERPRINT
                                    ? "Touch ID"
                                    : t('settings.biometricLock') }
                            subtitle={ t('settings.biometricLockSubtitle') }
                            hideChevron
                            rightCmp={
                                <Switch
                                    value={ authLockEnabled }
                                    onValueChange={ setAuthLockEnabled }
                                />
                            }
                            lastItem={ true }
                        />
                    ) }
                    { (role === 'caregiver' || role === 'doctor') && (
                        <List.Item
                            title={ t('settings.managePatients') }
                            subtitle={ t('settings.managePatientsSubtitle') }
                            onPress={ () => {
                                router.push('/settings/patients');
                            } }
                            lastItem={ true }
                        />
                    ) }
                </List.Section>

                { !isDemo && (
                    <List.Section rounded>
                        <List.Item
                            title={ t('settings.logout') }
                            titleStyle={{ color: colors.red }}
                            subtitle={ t('settings.logoutSubtitle') }
                            onPress={ confirmChangeRole }
                            lastItem
                        />
                    </List.Section>
                ) }

                { role === 'patient' && (
                    <List.Section rounded>
                        <List.Item
                            title={t('settings.deleteAccount')}
                            titleStyle={{ color: colors.red }}
                            subtitle={t('settings.deleteAccountSubtitle')}
                            onPress={confirmDeleteAccount}
                            lastItem={true}
                        />
                    </List.Section>
                )}

            </ScrollViewContent>
        </ScrollView>
    );
}

function PatientRecoveryWordsItem({ patientId }: { patientId: string }) {
    const { t } = useTranslation();
    const router = useSafeRouter();
    const { displayName } = usePatientDisplay(patientId);

    return (
        <List.Item
            title={ t('settings.patientRecoveryWords', { name: displayName }) }
            subtitle={ t('settings.patientRecoveryWordsSubtitle') }
            onPress={ () => {
                router.push(`/settings/patients/recoveryWords?patientId=${ patientId }`);
            } }
        />
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    }
});
