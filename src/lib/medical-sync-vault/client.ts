import * as Crypto from "expo-crypto";
import type { VaultConfig, CursorV2, VaultEvent } from "./types";
import { VaultError } from "./errors";

import { createExpoSecureStore } from "./storage/expoSecureStore";
import { createKeybag } from "./storage/keybag";
import type { Storage } from "./storage/types";

import { getOrCreateEd25519Keypair } from "./crypto/ed25519";
import { getCursorV2, setCursorV2, clearCursorV2 } from "./cursor/cursor";
import { getOrCreateStableDeviceId } from "./deviceId";
import { ensureToken } from "./auth/issueToken";
import { pushEvents, pullEvents, head } from "./api/events";
import { baseUrlNoSlash } from "./util";

function uuidv4() {
    return Crypto.randomUUID();
}

async function getOrCreateUuid(store: Storage, key: string): Promise<string> {
    const existing = await store.get(key);

    if (existing) {
        return existing;
    }

    const v = uuidv4();
    await store.set(key, v);
    return v;
}

export function createVaultClient(cfg: VaultConfig) {
    const prefix = cfg.storePrefix ?? "medical_sync_vault";
    const store = createExpoSecureStore(prefix);
    const K = createKeybag();

    return {
        async hasSubjectId(): Promise<boolean> {
            return !!(await store.get(K.SUBJECT_ID));
        },

        async ensureIdentity(): Promise<{ subject_id: string; device_id: string; publicKeyB64: string }> {
            const subject_id = await getOrCreateUuid(store, K.SUBJECT_ID);
            const device_id = await getOrCreateStableDeviceId(store, K);
            const { publicKeyB64 } = await getOrCreateEd25519Keypair(store, K);
            return { subject_id, device_id, publicKeyB64 };
        },

        async resetAuthState(): Promise<void> {
            await store.del(K.ACCESS_TOKEN);
            await store.del(K.SUBJECT_REGISTERED);
            await store.del(K.SUBJECT_ID);
            await store.del(K.PUBKEY_B64);
            await store.del(K.SECKEY_B64);
            await clearCursorV2(store, K);
        },

        // cursor
        cursor: {
            get: () => getCursorV2(store, K),
            set: (c: CursorV2) => setCursorV2(store, K, c),
            clear: () => clearCursorV2(store, K)
        },

        // auth
        ensureToken: () => ensureToken(cfg, store, K),

        // endpoints
        async health() {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds

            try {
                const res = await fetch(`${ baseUrlNoSlash(cfg.baseUrl) }/healthz`, {
                    signal: controller.signal
                });

                if (!res.ok) {
                    throw new VaultError("server_error", `healthz failed: ${ res.status }`, { status: res.status });
                }

                return res.json();
            } catch (e: any) {
                if (e instanceof VaultError) throw e;
                if (e?.name === "AbortError") {
                    throw new VaultError("network_error", "Health check timeout");
                }
                throw new VaultError("network_error", e?.message ?? "network_error");
            } finally {
                clearTimeout(timeoutId);
            }
        },

        head: () => head(cfg, store, K),

        pull: (opts?: { cursor?: CursorV2 | null; limit?: number }) => pullEvents(cfg, store, K, opts),

        push: (events: VaultEvent[]) => pushEvents(cfg, store, K, events),
    };
}
