import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type DeviceInfoSnapshot = {
    deviceModel: string;
    platform: 'ios' | 'android';
    osVersion: string;
    appVersion: string;
};

export function getDeviceInfo(): DeviceInfoSnapshot {
    return {
        deviceModel: Device.modelName ?? (Platform.OS === 'ios' ? 'iPhone' : 'Android'),
        platform: Platform.OS as 'ios' | 'android',
        osVersion: Device.osVersion ?? String(Platform.Version),
        appVersion: Constants.expoConfig?.version ?? 'unknown',
    };
}

export function getDeviceDisplayName(): string {
    return Device.modelName ?? (Platform.OS === 'ios' ? 'iPhone' : 'Android');
}
