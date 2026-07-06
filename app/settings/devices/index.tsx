import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useFocusEffect } from "expo-router/react-navigation";
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { Button, List, Space } from 'react-native-nice-ui';
import { createExpoSecureStore, createKeybag } from '@/src/lib/medical-sync-vault';
import { disableDevice } from '@/src/lib/medical-sync-vault/api/devices';
import * as Device from 'expo-device';
import type { DeviceAccessEntry, DeviceRole } from '@/src/stores/deviceAccessStore';
import { useAppSync, usePatientStores } from '@/src/context/AppSyncProvider';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { fmtDate } from '@/src/lib/formatDate';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { useActivePatientOwnerAccess } from '@/src/hooks/useActivePatientOwnerAccess';
import { on } from '@/src/lib/bus';

// Device info type (extended with role)
type DeviceInfo = {
    id: string;
    name: string;
    platform: string;
    lastActive?: string;
    isCurrentDevice?: boolean;
    role?: DeviceRole;
};

// Platform icon mapping
function getPlatformIcon(platform: string): keyof typeof Ionicons.glyphMap {
    switch (platform.toLowerCase()) {
        case 'ios':
        case 'iphone':
            return 'phone-portrait-outline';
        case 'ipad':
        case 'tablet':
            return 'tablet-portrait-outline';
        case 'macos':
        case 'mac':
        case 'desktop':
            return 'desktop-outline';
        case 'android':
            return 'phone-portrait-outline';
        case 'web':
            return 'globe-outline';
        default:
            return 'hardware-chip-outline';
    }
}

function formatLastActive(dateStr: string | undefined, t: TFunction, language: string): string {
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

    return t('devices.lastActiveOn', { date: fmtDate(date, language === 'de') });
}

function getCurrentDeviceName(t: TFunction): string {
    if (Device.modelName) {
        return Device.modelName;
    }
    if (Platform.OS === 'ios') {
        return 'iPhone';
    } else if (Platform.OS === 'android') {
        return 'Android';
    }
    return t('devices.unknownDevice');
}

// Role labels for display
function getRoleLabel(role: DeviceRole, t: TFunction): string {
    switch (role) {
        case 'owner':
            return t('devices.roleOwner');
        case 'caregiver':
            return t('devices.roleCaregiver');
        case 'doctor':
            return t('devices.roleDoctor');
    }
}

// Role icons
function getRoleIcon(role?: DeviceRole) {
    switch (role) {
        case 'owner':
            return 'person.fill';
        case 'caregiver':
            return 'person.2.fill';
        case 'doctor':
            return 'stethoscope';
        default:
            return 'laptopcomputer.and.iphone';
    }
}

export default function DevicesScreen() {
    const { colors } = useAppTheme();
    const { t, i18n } = useTranslation();
    const { role, isDemo } = useAppRole();
    const router = useSafeRouter();
    const { hasOwnerAccess, isLoaded: ownerAccessLoaded } = useActivePatientOwnerAccess();

    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);
    const cfg = useMemo(() => ({
        baseUrl: process.env.EXPO_PUBLIC_VAULT_BASE_URL ?? '',
        appIssueToken: process.env.EXPO_PUBLIC_VAULT_APP_ISSUE_TOKEN ?? '',
    }), []);
    const { ensureDataSynced, fullSync } = useAppSync();
    const { deviceAccessStore } = usePatientStores();

    const [deviceId, setDeviceId] = useState<string>('');
    const [hasKeys, setHasKeys] = useState(false);
    const [devices, setDevices] = useState<DeviceInfo[]>([]);
    const [accessEntries, setAccessEntries] = useState<DeviceAccessEntry[]>([]);

    // Patient-owned devices and caregiver-created patients can manage patient devices.
    const isOwner = role === 'patient' || (role === 'caregiver' && ownerAccessLoaded && hasOwnerAccess);

    const loadDeviceInfo = useCallback(async () => {
        if (!deviceAccessStore) {
            return;
        }

        try {
            const did = (await store.get(K.DEVICE_ID)) ?? '';
            const pub = (await store.get((K as any).PUBKEY_B64)) ?? '';
            const sec = (await store.get((K as any).SECKEY_B64)) ?? '';

            setDeviceId(did);
            setHasKeys(!!pub && !!sec);

            // Load device access entries
            const accessList = await deviceAccessStore.getList();
            setAccessEntries(accessList.entries);

            // Build device list - current device + entries from access store
            const deviceList: DeviceInfo[] = [];

            // Add current device
            if (did) {
                // Check if current device is in access list
                const currentEntry = accessList.entries.find(e => e.device_id === did);
                deviceList.push({
                    id: did,
                    name: currentEntry?.name ?? getCurrentDeviceName(t),
                    platform: Platform.OS,
                    lastActive: new Date().toISOString(),
                    isCurrentDevice: true,
                    role: currentEntry?.role
                });
            }

            // Add other devices from access list (not current device)
            // Doctors only see their own device.
            // Caregivers see all devices only if they created the patient (entry role 'owner'),
            // otherwise they only see their own device.
            const myEntry = accessList.entries.find(e => e.device_id === did);
            const showAllDevices = role === 'patient'
                || (role === 'caregiver' && myEntry?.role === 'owner');
            if (showAllDevices) {
                for (const entry of accessList.entries) {
                    if (entry.device_id !== did) {
                        deviceList.push({
                            id: entry.device_id,
                            name: entry.name,
                            platform: entry.platform ?? 'unknown',
                            lastActive: entry.lastSeenAt ?? entry.addedAt,
                            isCurrentDevice: false,
                            role: entry.role
                        });
                    }
                }
            }

            setDevices(deviceList);
        }
        catch (e) {
            console.error('Failed to load device info:', e);
        }
    }, [store, K, deviceAccessStore, role, t]);

    useEffect(() => {
        loadDeviceInfo();
    }, [loadDeviceInfo]);

    useFocusEffect(
        useCallback(() => {
            loadDeviceInfo();
            fullSync('devices focus').catch(console.error);
        }, [fullSync, loadDeviceInfo])
    );

    useEffect(() => {
        const off = on('fhir:changed', loadDeviceInfo);
        return off;
    }, [loadDeviceInfo]);

    const showDemoAlert = useCallback(() => {
        Alert.alert(t('common.demoModeTitle'), t('common.demoModeMessage'), [{ text: t('common.ok') }]);
    }, [t]);

    const handleAddDevice = useCallback(() => {
        if (isDemo) {
            showDemoAlert();
            return;
        }
        if (!isOwner) {
            Alert.alert(t('devices.notAvailable'), t('devices.noOwnerIdentity'));
            return;
        }
        router.push('/settings/devices/qrCode');
    }, [isDemo, isOwner, router, showDemoAlert, t]);

    const handleDevicePress = useCallback((device: DeviceInfo) => {
        router.push({
            pathname: '/settings/devices/detail',
            params: {
                deviceId: device.id,
                deviceName: device.name,
                platform: device.platform,
                lastActive: device.lastActive,
                isCurrentDevice: device.isCurrentDevice ? '1' : '0'
            }
        });
    }, []);

    const handleRemoveAccess = useCallback((device: DeviceInfo) => {
        if (!deviceAccessStore) {
            return;
        }
        if (!isOwner) {
            return;
        }
        if (device.isCurrentDevice) {
            return;
        }

        const roleName = device.role ? getRoleLabel(device.role, t) : t('devices.unknownDevice');

        Alert.alert(
            t('devices.removeAccess'),
            t('devices.removeAccessMessage', { name: device.name, role: roleName }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.remove'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // T-002: disable on the server FIRST (owner-only). Works for
                            // recipient AND the patient's own other devices. Only on success
                            // do we drop the local access-list entry.
                            await disableDevice(cfg, store, K, device.id);
                            await deviceAccessStore.removeEntry(device.id);
                            const synced = await ensureDataSynced();
                            if (!synced) {
                                throw new Error('device_access_remove_sync_pending');
                            }
                            await fullSync('device remove');
                            await loadDeviceInfo();
                        }
                        catch (e) {
                            console.error('Failed to remove access:', e);
                            Alert.alert(t('common.error'), t('devices.removeAccessError'));
                        }
                    }
                }
            ]
        );
    }, [isOwner, deviceAccessStore, ensureDataSynced, fullSync, loadDeviceInfo, t, cfg, store, K]);

    return (
        <ScrollView
            style={ { backgroundColor: colors.modalBackground } }
            contentContainerStyle={ styles.scrollView }
            contentInsetAdjustmentBehavior="automatic"
        >
            <ScrollViewContent>
                <ScreenHeader
                    icon="point.3.connected.trianglepath.dotted"
                    iconTintColor={ colors.brandColorMuted }
                    subtitle={ t('devices.headerText') }
                />

                <Space />

                {/* Add Device Button */ }
                <List.Wrapper>
                    { isOwner && (
                        <Button
                            title={ '+ ' + t('devices.addDevice') }
                            onPress={ handleAddDevice }
                            rounded
                        />
                    ) }
                </List.Wrapper>

                {/* Linked Devices */ }
                { devices.length > 0 && (
                    <List.Section title={ t('devices.linkedDevices') } rounded>
                        { devices.map((device, index) => {
                            // Build subtitle: show role if present, plus "This device" if current
                            let subtitle: string;
                            if (device.isCurrentDevice) {
                                subtitle = device.role
                                    ? `${ getRoleLabel(device.role, t) } · ${ t('devices.thisDevice') }`
                                    : t('devices.thisDevice');
                            } else if (device.role) {
                                subtitle = getRoleLabel(device.role, t);
                            } else {
                                subtitle = formatLastActive(device.lastActive, t, i18n.language);
                            }

                            const canRemove = isOwner && !device.isCurrentDevice && device.role !== 'owner';

                            return (
                                <List.Item
                                    key={ device.id }
                                    title={ device.name }
                                    subtitle={ subtitle }
                                    onPress={ canRemove ? () => handleRemoveAccess(device) : () => handleDevicePress(device) }
                                    leftCmpSize={40}
                                    leftCmp={
                                        device.role ? (
                                            <ListItemIcon name={getRoleIcon(device.role)} color={colors.brandColorMuted} size="md" backgroundColor={colors.listItemBackgroundMuted} />
                                        ) : (
                                            <View style={[styles.deviceIcon, { backgroundColor: colors.listItemBackgroundMuted }]}>
                                                <Ionicons name={getPlatformIcon(device.platform)} size={22} color={colors.text} />
                                            </View>
                                        )
                                    }
                                    rightCmp={ canRemove ? (
                                        <AppIcon
                                            name="trash"
                                            tintColor="#FF3B30"
                                            size={ 18 }
                                        />
                                    ) : undefined }
                                    hideChevron={ canRemove }
                                    lastItem={ index === devices.length - 1 }
                                />
                            );
                        }) }
                    </List.Section>
                ) }

                <List.Wrapper>
                    {/* Info Text */ }
                    <List.Text>
                        { t('devices.infoText') }
                    </List.Text>

                    { isOwner && accessEntries.some(e => e.role === 'caregiver' || e.role === 'doctor') && (
                        <List.Text>
                            { t('devices.accessRemovalHint') }
                        </List.Text>
                    ) }

                    { !hasKeys && (
                        <List.Text>
                            { t('devices.syncRequired') }
                        </List.Text>
                    ) }
                </List.Wrapper>

            </ScrollViewContent>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    headerText: {
        fontSize: 17,
        lineHeight: 22,
        fontWeight: 500,
        textAlign: 'center'
    },
    deviceIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
