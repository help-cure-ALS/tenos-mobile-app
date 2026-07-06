import { Platform } from 'react-native';

import type { ExternalHealthAdapter } from '../types';
import { appleHealthKitAdapter } from './appleHealthKit';
import { healthConnectAdapter } from './healthConnect';

export function getExternalHealthAdapter(): ExternalHealthAdapter | null {
    if (Platform.OS === 'ios') return appleHealthKitAdapter;
    if (Platform.OS === 'android') return healthConnectAdapter;
    return null;
}
