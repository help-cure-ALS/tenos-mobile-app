/**
 * Access Log Modal
 *
 * Shows the access log for a shared doctor or caregiver,
 * with the option to remove access.
 */

import React, { useCallback, useMemo } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, List, Space, Text } from 'react-native-nice-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppSync, usePatientStores } from '@/src/context/AppSyncProvider';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { HeaderButton } from "@/src/components/ui/navigation/HeaderButton";
import { createExpoSecureStore, createKeybag } from '@/src/lib/medical-sync-vault';
import { disableDevice } from '@/src/lib/medical-sync-vault/api/devices';

export default function AccessLogScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { ensureDataSynced, fullSync } = useAppSync();
    const { deviceAccessStore } = usePatientStores();

    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);
    const cfg = useMemo(() => ({
        baseUrl: process.env.EXPO_PUBLIC_VAULT_BASE_URL ?? '',
        appIssueToken: process.env.EXPO_PUBLIC_VAULT_APP_ISSUE_TOKEN ?? '',
    }), []);

    const params = useLocalSearchParams<{ role: string; name: string; deviceId: string }>();
    const role = params.role === 'caregiver' ? 'caregiver' : 'doctor';
    const displayName = params.name ?? '';
    const deviceId = params.deviceId ?? '';

    const handleClose = useCallback(() => {
        router.back();
    }, [router]);

    const handleRemoveAccess = useCallback(() => {
        const title = role === 'doctor'
            ? t('share.sharingSettings.removeDoctor')
            : t('share.sharingSettings.removeCaregiver');
        const message = role === 'doctor'
            ? t('share.sharingSettings.removeDoctorMessage', { name: displayName })
            : t('share.sharingSettings.removeCaregiverMessage', { name: displayName });

        Alert.alert(title, message, [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: title,
                style: 'destructive',
                onPress: async () => {
                    // T-002: the server-side disable MUST succeed before we remove the local
                    // entry — otherwise the patient would think access is gone while the
                    // device can still sync. On failure: warn and keep the entry.
                    if (deviceId) {
                        try {
                            await disableDevice(cfg, store, K, deviceId);
                        } catch (e) {
                            console.error('disableDevice failed', e);
                            Alert.alert(t('common.error'), t('share.accessLog.revokeFailed'));
                            return;
                        }
                    }
                    if (deviceAccessStore && deviceId) {
                        try {
                            await deviceAccessStore.removeEntry(deviceId);
                            const synced = await ensureDataSynced();
                            if (!synced) {
                                throw new Error('device_access_remove_sync_pending');
                            }
                            await fullSync('access remove');
                        } catch (e) {
                            console.error('removeEntry failed', e);
                            Alert.alert(t('common.error'), t('share.accessLog.revokeFailed'));
                            return;
                        }
                    }
                    router.back();
                },
            },
        ]);
    }, [deviceAccessStore, deviceId, role, displayName, router, t, cfg, store, K, ensureDataSynced, fullSync]);

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: '',
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
                    <Stack.Screen.Title></Stack.Screen.Title>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button onPress={handleClose}>{t('common.done')}</Stack.Toolbar.Button>
                    </Stack.Toolbar>
                </Stack.Screen>
            )}

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScreenHeader
                    icon={role === 'doctor' ? 'stethoscope' : 'person.2.fill'}
                    iconTintColor={colors.brandColorMuted}
                    title={displayName}
                    subtitle={t('share.accessLog.connectedSince', {
                        date: new Date().toLocaleDateString()
                    })}
                />

                <List.Section
                    title={t('share.accessLog.title')}
                    rounded
                >
                    <List.Item
                        title={t('share.accessLog.noEntries')}
                        subtitle={t('share.accessLog.noEntriesDesc')}
                        subtitleNumberOfLines={2}
                        hideChevron
                    />
                </List.Section>

                <Space size="xl" />

                <List.Wrapper>
                    <Button
                        title={role === 'doctor'
                            ? t('share.sharingSettings.removeDoctor')
                            : t('share.sharingSettings.removeCaregiver')}
                        onPress={handleRemoveAccess}
                        variant="danger"
                        rounded
                    />
                </List.Wrapper>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 20,
    },
});
