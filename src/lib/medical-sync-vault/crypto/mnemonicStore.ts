import * as SecureStore from "expo-secure-store";
import type { DerivedKeys } from "./mnemonic";
import type { Storage } from "../storage/types";
import type { Keybag } from "../storage/keybag";
import type { MnemonicLanguage } from "./wordlists";

export const MNEMONIC_SS = "medical_sync_vault_mnemonic_v1";

const TRANSPORT_KEY_SS = "medical_sync_vault_transport_key_b64_v1";

const STORE_OPTS = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type StoredMnemonic = { words: string[]; lang: MnemonicLanguage };

/** Store mnemonic + language in SecureStore */
export async function storeMnemonic(words: string[], lang: MnemonicLanguage): Promise<void> {
    await SecureStore.setItemAsync(
        MNEMONIC_SS,
        JSON.stringify({ words, lang }),
        STORE_OPTS,
    );
}

/** Load mnemonic from SecureStore (backward-compatible with old array format) */
export async function loadMnemonic(): Promise<StoredMnemonic | null> {
    const raw = await SecureStore.getItemAsync(MNEMONIC_SS);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        // New format: { words, lang }
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.words)) {
            return { words: parsed.words, lang: parsed.lang ?? "en" };
        }
        // Old format: plain string[]
        if (Array.isArray(parsed) && parsed.every((w: unknown) => typeof w === "string")) {
            return { words: parsed, lang: "en" };
        }
        return null;
    } catch {
        return null;
    }
}

/** Store derived keys in existing SecureStore slots */
export async function storeDerivedKeys(
    keys: DerivedKeys,
    store: Storage,
    K: Keybag,
): Promise<void> {
    await store.set(K.PUBKEY_B64, keys.publicKeyB64);
    await store.set(K.SECKEY_B64, keys.secretKeyB64);
    await SecureStore.setItemAsync(TRANSPORT_KEY_SS, keys.transportKeyB64, STORE_OPTS);
}
