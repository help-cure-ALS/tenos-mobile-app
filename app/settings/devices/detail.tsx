import React, { useCallback, useMemo } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { createExpoSecureStore, createKeybag } from '@/src/lib/medical-sync-vault';
import { disableDevice } from '@/src/lib/medical-sync-vault/api/devices';
import { useAppSync, usePatientStores } from '@/src/context/AppSyncProvider';
import { fmtDate } from '@/src/lib/formatDate';
import { Button, List, Space } from 'react-native-nice-ui';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';

function getPlatformIcon(platform: string): string {
    switch (platform.toLowerCase()) {
        case 'ios':
        case 'iphone':
            return 'iphone';
        case 'ipad':
        case 'tablet':
            return 'ipad';
        case 'macos':
        case 'mac':
        case 'desktop':
            return 'desktopcomputer';
        case 'android':
            return 'smartphone';
        case 'web':
            return 'globe';
        default:
            return 'laptopcomputer';
    }
}

function getPlatformLabel(platform: string): string {
    switch (platform.toLowerCase()) {
        case 'ios':
            return 'iPhone';
        case 'ipad':
            return 'iPad';
        case 'macos':
            return 'Mac';
        case 'android':
            return 'Android';
        case 'web':
            return 'Web';
        default:
            return platform;
    }
}

function formatLastActive(dateStr: string | undefined, t: (key: string, options?: any) => string): string {
    if (!dateStr) {
        return t('devices.unknown');
    }

    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
        return t('devices.justNowActive');
    }
    if (diffMins < 60) {
        return t('devices.minutesAgoActive', { count: diffMins });
    }
    if (diffHours < 24) {
        return t('devices.hoursAgoActive', { count: diffHours });
    }
    if (diffDays === 1) {
        return t('devices.yesterdayActive');
    }
    if (diffDays < 7) {
        return t('devices.daysAgoActive', { count: diffDays });
    }

    return t('devices.lastActiveOn', { date: fmtDate(date, true) });
}

export default function DeviceDetailScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const params = useLocalSearchParams<{
        deviceId: string;
        deviceName: string;
        platform: string;
        lastActive?: string;
        isCurrentDevice?: string;
    }>();

    const isCurrentDevice = params.isCurrentDevice === '1';

    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);
    const cfg = useMemo(() => ({
        baseUrl: process.env.EXPO_PUBLIC_VAULT_BASE_URL ?? '',
        appIssueToken: process.env.EXPO_PUBLIC_VAULT_APP_ISSUE_TOKEN ?? '',
    }), []);
    const { ensureDataSynced, fullSync } = useAppSync();
    const { deviceAccessStore } = usePatientStores();

    const handleRemoveDevice = useCallback(() => {
        if (isCurrentDevice || !params.deviceId) {
            return;
        }
        Alert.alert(
            t('devices.removeDeviceTitle'),
            t('devices.removeDeviceMessage', { name: params.deviceName }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.remove'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (!deviceAccessStore) {
                                throw new Error('device_access_store_unavailable');
                            }
                            // T-002: disable server-side (owner-only) THEN drop the local entry.
                            await disableDevice(cfg, store, K, params.deviceId);
                            await deviceAccessStore.removeEntry(params.deviceId);
                            const synced = await ensureDataSynced();
                            if (!synced) {
                                throw new Error('device_access_remove_sync_pending');
                            }
                            await fullSync('device remove');
                            router.back();
                        } catch (e) {
                            console.error('Failed to remove device:', e);
                            Alert.alert(t('common.error'), t('devices.removeAccessError'));
                        }
                    }
                }
            ]
        );
    }, [params.deviceId, params.deviceName, t, cfg, store, K, deviceAccessStore, ensureDataSynced, fullSync, isCurrentDevice, router]);

    return (
        <ScrollView
            style={ { backgroundColor: colors.modalBackground } }
            contentContainerStyle={ styles.scrollView }
            contentInsetAdjustmentBehavior="automatic"
        >
            <ScrollViewContent>
                <ScreenHeader
                    icon={ getPlatformIcon(params.platform ?? 'unknown') }
                    iconTintColor={ colors.brandColorMuted }
                />

                {/* Device Name */ }
                <List.Section title={ t('devices.deviceName') } rounded>
                    <List.Item
                        title={ params.deviceName || t('devices.unknownDevice') }
                        hideChevron
                        lastItem
                    />
                </List.Section>

                {/* Device Status */ }
                <List.Section title={ t('devices.deviceStatus') } rounded>
                    <List.Item
                        title={ t('devices.activity') }
                        rightTitle={ formatLastActive(params.lastActive, t) }
                        hideChevron
                    />
                    <List.Item
                        title={ t('devices.platform') }
                        rightTitle={ getPlatformLabel(params.platform ?? 'unknown') }
                        hideChevron
                    />
                    { params.deviceId && (
                        <List.Item
                            title={ t('devices.deviceId') }
                            subtitle={ params.deviceId }
                            subtitleNumberOfLines={ 2 }
                            hideChevron
                            lastItem
                        />
                    ) }
                </List.Section>

                { isCurrentDevice ? (
                    <List.Wrapper>
                        <List.Text>
                            { t('devices.currentDeviceHint') }
                        </List.Text>
                    </List.Wrapper>
                ) : (
                    <>
                        <Space />
                        <List.Wrapper>
                            <Button
                                title={ t('devices.removeDevice') }
                                onPress={ handleRemoveDevice }
                                variant="danger"
                                rounded
                            />
                        </List.Wrapper>
                        <List.Wrapper>
                            <List.Text>
                                { t('devices.removeDeviceHint') }
                            </List.Text>
                        </List.Wrapper>
                    </>
                ) }
            </ScrollViewContent>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    }
});
