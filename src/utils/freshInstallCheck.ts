import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { SECURE_STORE_KEYS } from './secureStoreKeys';

export const INSTALL_FLAG = 'app_installed_v1';

/**
 * Detects a fresh install by checking an AsyncStorage sentinel flag.
 * On iOS, SecureStore (Keychain) persists across app reinstalls while
 * AsyncStorage is deleted. If the marker is missing, we fail closed and
 * clear vault-related SecureStore keys before proceeding.
 */
export async function clearStaleDataIfFreshInstall(): Promise<void> {
    const flag = await AsyncStorage.getItem(INSTALL_FLAG);
    if (flag) return;

    // Marker missing -> treat as fresh install and wipe stale keychain data.
    await Promise.all(
        SECURE_STORE_KEYS.map(key => SecureStore.deleteItemAsync(key).catch(() => {}))
    );

    // Persist install marker after cleanup.
    await AsyncStorage.setItem(INSTALL_FLAG, '1');
}
