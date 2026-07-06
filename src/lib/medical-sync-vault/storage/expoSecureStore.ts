import * as SecureStore from "expo-secure-store";
import type { Storage } from "./types";

export function createExpoSecureStore(prefix: string): Storage {
    const k = (name: string) => `${prefix}_${name}`;

    return {
        get: (name) => SecureStore.getItemAsync(k(name)),
        set: (name, value) =>
            SecureStore.setItemAsync(k(name), value, {
                keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
            }),
        del: (name) => SecureStore.deleteItemAsync(k(name)).catch(() => {}),
    };
}
