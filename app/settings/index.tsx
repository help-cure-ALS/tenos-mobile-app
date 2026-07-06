import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { Badge, List } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useAppSync, usePatientStores } from "@/src/context/AppSyncProvider";
import { useAppRole } from "@/src/context/AppRoleProvider";
import { useDisplayMode } from "@/src/context/DisplayModeProvider";
import { useRoleAwareText } from "@/src/hooks/useRoleAwareText";
import { AppIcon } from '@/src/components/ui/AppIcon';
import { clearPatientLocalData } from '@/src/utils/clearPatientLocalData';
import { useNickname, useVerification } from '@/src/hooks/usePatientPreferences';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { CloseButton } from "@/src/components/ui/navigation/CloseButton";
import * as Application from "expo-application";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { DEMO_PATIENT_ID } from '@/src/demo/demoData';
import { NOTIFICATION_STORAGE_KEYS } from '@/src/services/notificationPrefs';
import { emit, on } from '@/src/lib/bus';
import { useLoadingOverlay } from '@/src/context/LoadingOverlayProvider';
import type { PreferredMeasurementSystem } from '@/src/stores/patientPreferencesStore';
import { fmtDateTime } from '@/src/lib/formatDate';
import { getVerification, setVerification } from '@/src/stores/verificationStore';
import { checkTokenStatus } from '@/src/lib/verificationClient';

const checkedVerificationTokensThisSession = new Set<string>();

export default function Index() {
    const { syncEnabled, status: syncStatus, syncHealth, lastSyncAt, fullSync } = useAppSync();
    const { patientPreferencesStore } = usePatientStores();
    const { colors, deviceTheme } = useAppTheme();
    const { role, reset: resetRole, activePatientId, getPatientAlias, isDemo } = useAppRole();
    const router = useSafeRouter();
    const { mode } = useDisplayMode();
    const roleText = useRoleAwareText();
    const { t, i18n } = useTranslation();
    const verification = useVerification();
    const { nickname, profileIcon, profileColor } = useNickname();
    const { showLoading, hideLoading } = useLoadingOverlay();
    const [measurementSystem, setMeasurementSystem] = useState<PreferredMeasurementSystem>('auto');
    const [manualSyncRunning, setManualSyncRunning] = useState(false);
    const [manualSyncFailed, setManualSyncFailed] = useState(false);

    const checkVerificationRevocationOnce = useCallback(async () => {
        if (role !== 'patient' || !patientPreferencesStore) {
            return;
        }

        const current = await getVerification(patientPreferencesStore);
        if (current?.status !== 'verified' || !current.tokenId) {
            return;
        }

        const checkKey = `${activePatientId ?? 'patient'}:${current.tokenId}`;
        if (checkedVerificationTokensThisSession.has(checkKey)) {
            return;
        }

        try {
            const tokenStatus = await checkTokenStatus(current.tokenId);
            checkedVerificationTokensThisSession.add(checkKey);

            if (tokenStatus === 'revoked') {
                await setVerification(patientPreferencesStore, {
                    ...current,
                    status: 'revoked',
                });
                emit('verification:changed');
            }
        } catch {
            // Visual-only check: keep the local status if the care server is unavailable.
        }
    }, [activePatientId, patientPreferencesStore, role]);

    useFocusEffect(useCallback(() => {
        verification.refresh();
        checkVerificationRevocationOnce().catch(() => {});
    }, [checkVerificationRevocationOnce, verification.refresh]));

    const loadMeasurementSystem = useCallback(async () => {
        if (!patientPreferencesStore) {
            setMeasurementSystem('auto');
            return;
        }
        setMeasurementSystem(await patientPreferencesStore.getMeasurementSystem());
    }, [patientPreferencesStore]);

    useEffect(() => {
        loadMeasurementSystem();
        const offFhir = on('fhir:changed', loadMeasurementSystem);
        const offPrefs = on('preferences:changed', loadMeasurementSystem);
        return () => {
            offFhir();
            offPrefs();
        };
    }, [loadMeasurementSystem]);

    // Get patient display info for non-patient/non-demo roles
    const showPatientHeader = role !== 'patient' && role !== 'demo' && activePatientId;
    const showOwnProfileHeader = role === 'patient' || role === 'demo';
    const patientAlias = showPatientHeader ? getPatientAlias(activePatientId) : null;
    const patientDisplayName = patientAlias?.localName ?? `Patient ${ activePatientId?.slice(0, 6) ?? '' }`;
    const patientIcon = patientAlias?.icon ?? 'person.fill';
    const patientColor = patientAlias?.color ?? colors.text;
    const syncFooterText = (() => {
        if (isDemo) return t('settings.syncDemo');
        if (!syncEnabled) return t('settings.syncDisabled');
        if (manualSyncRunning || syncStatus === 'syncing') return t('settings.syncingVault');
        if (manualSyncFailed) return t('settings.syncFailed');
        if (syncHealth === 'degraded_network') return t('settings.syncNetworkError');
        if (syncHealth === 'blocked_identity') return t('settings.syncBlocked');
        if (lastSyncAt) {
            const date = new Date(lastSyncAt);
            if (!Number.isNaN(date.getTime())) {
                return t('settings.syncLastAt', {
                    date: fmtDateTime(date, i18n.language.startsWith('de'))
                });
            }
        }
        return t('settings.syncNever');
    })();

    const handleFooterSync = useCallback(async () => {
        if (isDemo || !syncEnabled || manualSyncRunning || syncStatus === 'syncing') {
            return;
        }
        setManualSyncFailed(false);
        setManualSyncRunning(true);
        try {
            await fullSync('settings footer');
        } catch {
            setManualSyncFailed(true);
        } finally {
            setManualSyncRunning(false);
        }
    }, [fullSync, isDemo, manualSyncRunning, syncEnabled, syncStatus]);

    function confirmChangeRole() {
        Alert.alert(
            t('settings.endDemo'),
            t('alerts.endDemoMessage'),
            [
                { text: t('common.cancel'), style: "cancel" },
                {
                    text: t('settings.endDemo'),
                    onPress: async () => {
                        showLoading();
                        try {
                            // Clear demo-local data and legacy global notification keys
                            // before returning to role selection.
                            await clearPatientLocalData(DEMO_PATIENT_ID);
                            emit('fhir:changed');
                            await Notifications.cancelAllScheduledNotificationsAsync();
                            await AsyncStorage.multiRemove(Object.values(NOTIFICATION_STORAGE_KEYS));

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

    return (
        <>
            {
                Platform.OS === 'android' ? (
                    <Stack.Screen
                        options={ {
                            headerTransparent: false,
                            headerBackVisible: false,
                            headerRight: () => (
                                <CloseButton onPress={ () => router.back() } />
                            )
                        } }
                    />
                ) : (
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button icon="xmark" variant="plain" onPress={() => router.back()} />
                    </Stack.Toolbar>
                )
            }
            <ScrollView style={ { backgroundColor: colors.modalBackground } }
                        contentContainerStyle={ [styles.scrollView, {}] }
                        contentInsetAdjustmentBehavior="automatic"
            >
                <ScrollViewContent>
                    {/* Header Section */ }
                    { showOwnProfileHeader ? (
                        <Pressable style={ styles.headerSection } onPress={ () => router.push('/settings/nickname') }>
                            <View
                                style={ [styles.illustrationContainer, { backgroundColor: (profileColor ?? colors.text) + '20' }] }>
                                <AppIcon
                                    name={ profileIcon ?? "figure.boxing" }
                                    tintColor={ profileColor ?? colors.text }
                                    type="multicolor"
                                    size={48}
                                />
                            </View>
                            <Text style={ [styles.headerText, { color: nickname ? colors.text : colors.textSecondary }] }>
                                { nickname || t('settings.personalizeProfile') }
                            </Text>
                        </Pressable>
                    ) : showPatientHeader ? (
                        <View style={ styles.headerSection }>
                            <View
                                style={ [styles.illustrationContainer, { backgroundColor: patientColor + '20' }] }>
                                <AppIcon
                                    name={ patientIcon }
                                    tintColor={ patientColor }
                                    type="multicolor"
                                    size={48}
                                />
                            </View>
                            <Text style={ [styles.headerText, { color: colors.text }] }>
                                { patientDisplayName }
                            </Text>
                        </View>
                    ) : (
                        <View style={ styles.headerSection }>
                            <View
                                style={ [styles.illustrationContainer, { backgroundColor: colors.listItemBackground }] }>
                                <AppIcon
                                    name="figure.martial.arts"
                                    tintColor={ colors.text }
                                    type="multicolor"
                                    size={48}
                                />
                            </View>
                            <Text style={ [styles.headerText, { color: colors.textSecondary }] }>
                                {t('settings.headerText')}
                            </Text>
                        </View>
                    ) }

                    <List.Section rounded>
                        <List.Item
                            title={isDemo ? t('settings.endDemo') : t('settings.account')}
                            subtitle={isDemo ? t('settings.endDemoSubtitle') : t('settings.accountSubtitle')}
                            rightTitle={ role ? t(`roles.${role}`) : t('common.notSet') }
                            badge={role === 'patient' && verification ? <Badge label={verification.label} variant={verification.variant} size="small" /> : undefined}
                            badgePosition="top-right"
                            onPress={ isDemo ? confirmChangeRole : () => {
                                router.push('/settings/account');
                            } }
                            lastItem={ true }
                        />
                    </List.Section>

                    <List.Section rounded>
                        <List.Item
                            title={ roleText.healthData }
                            onPress={ () => {
                                router.push('/settings/profile');
                            } }
                        />
                        <List.Item
                            title={ roleText.careProvider }
                            onPress={ () => {
                                router.push('/settings/careProvider');
                            } }
                        />
                    </List.Section>

                    <List.Section rounded>
                        <List.Item
                            title={t('settings.notifications')}
                            onPress={ () => {
                                router.push('/settings/notifications');
                            } }
                            lastItem={ !(role === 'patient' && !isDemo) }
                        />
                        {role === 'patient' && !isDemo && (
                            <List.Item
                                title={t('settings.healthImport')}
                                subtitle={t('healthImport.settingsSubtitle')}
                                onPress={ () => {
                                    router.push('/settings/healthImport');
                                } }
                                lastItem
                            />
                        )}
                    </List.Section>

                    <List.Section rounded>
                        <List.Item
                            title={t('settings.displayMode')}
                            subtitle={ roleText.displayModeSubtitle }
                            rightTitle={ t(`displayModes.${mode}`) }
                            onPress={ () => {
                                router.push('/settings/displayMode');
                            } }
                        />
                        <List.Item
                            title={t('settings.units')}
                            subtitle={t('units.settingsSubtitle')}
                            rightTitle={t(`units.${measurementSystem}`)}
                            onPress={ () => {
                                router.push('/settings/units');
                            } }
                        />
                        <List.Item
                            title={t('settings.appearance')}
                            rightTitle={ t(`appearance.${deviceTheme}`) }
                            onPress={ () => {
                                router.push('/settings/appearance');
                            } }
                        />
                        <List.Item
                            title={t('settings.language')}
                            rightTitle={ t('languageName') }
                            onPress={ () => {
                                router.push('/settings/language');
                            } }
                        />
                    </List.Section>

                    <List.Section rounded>
                        <List.Item
                            title={t('settings.website')}
                            onPress={ () => {
                                Linking.openURL('https://www.help-cure-als.org/').catch(() => {});
                            } }
                        />
                        <List.Item
                            title={t('settings.imprint')}
                            onPress={ () => {
                                router.push('/settings/legal/imprint');
                            } }
                        />
                        <List.Item
                            title={t('settings.privacy')}
                            onPress={ () => {
                                router.push('/settings/legal/privacyInfo');
                            } }
                        />
                        {/*<List.Item*/}
                        {/*    title={t('settings.privacyPolicy')}*/}
                        {/*    onPress={ () => {*/}
                        {/*        router.push('/settings/legal/privacy');*/}
                        {/*    } }*/}
                        {/*/>*/}
                    </List.Section>

                    <List.Wrapper>
                        <Pressable
                            onPress={handleFooterSync}
                            disabled={isDemo || !syncEnabled || manualSyncRunning || syncStatus === 'syncing'}
                            hitSlop={8}
                            style={({ pressed }) => [
                                styles.syncFooterButton,
                                pressed && styles.syncFooterButtonPressed
                            ]}
                        >
                            <List.Text align="center">
                                {syncFooterText}{"\n"}
                                Version {Application.nativeApplicationVersion ?? '?'} Build {Application.nativeBuildVersion ?? '?'}
                            </List.Text>
                        </Pressable>
                    </List.Wrapper>
                </ScrollViewContent>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    headerSection: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16
    },
    illustrationContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    headerText: {
        fontSize: 17,
        lineHeight: 22,
        fontWeight: 500,
        textAlign: 'center'
    },
    syncFooterButton: {
        alignItems: 'center',
        paddingVertical: 4
    },
    syncFooterButtonPressed: {
        opacity: 0.6
    },
    footerText: {
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center'
    }
});
