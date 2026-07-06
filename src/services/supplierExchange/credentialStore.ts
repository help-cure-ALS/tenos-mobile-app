// SecureStore wrapper for supplier integration tokens
// Tokens are device-local and NOT synced between devices

import * as SecureStore from 'expo-secure-store';

function tokenKey(integrationId: string): string {
    return `supplier_token_${integrationId}`;
}

export async function getToken(integrationId: string): Promise<string | null> {
    return SecureStore.getItemAsync(tokenKey(integrationId));
}

export async function setToken(integrationId: string, token: string): Promise<void> {
    await SecureStore.setItemAsync(tokenKey(integrationId), token, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
}

export async function deleteToken(integrationId: string): Promise<void> {
    await SecureStore.deleteItemAsync(tokenKey(integrationId));
}

export async function hasToken(integrationId: string): Promise<boolean> {
    const token = await getToken(integrationId);
    return token != null;
}
