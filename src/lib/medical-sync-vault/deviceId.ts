import * as Crypto from "expo-crypto";

import type { Keybag } from "./storage/keybag";
import type { Storage } from "./storage/types";

export async function getOrCreateStableDeviceId(store: Storage, K: Keybag): Promise<string> {
    const existing = await store.get(K.DEVICE_ID);
    if (existing) {
        return existing;
    }

    const deviceId = Crypto.randomUUID();
    await store.set(K.DEVICE_ID, deviceId);
    return deviceId;
}
