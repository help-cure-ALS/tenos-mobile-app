import * as SecureStore from "expo-secure-store";

import type { MnemonicLanguage } from "@/src/lib/medical-sync-vault/crypto/wordlists";

const OWNED_PATIENT_KEY = "owned_patient_v1";
const STORE_OPTS = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type OwnedPatientSource =
    | "created"
    | "restored"
    | "linked"
    | "migrated_scope"
    | "migrated_mnemonic";

export type OwnedPatientIdentity = {
    patientId: string;
    transportKeyB64: string;
    pubkeyB64: string;
    seckeyB64: string;
    source: OwnedPatientSource;
    addedAt: string;
    lastUsedAt: string;
    mnemonicWords?: string[];
    mnemonicLang?: MnemonicLanguage;
};

export type OwnedPatientStore = {
    get(): Promise<OwnedPatientIdentity | null>;
    save(identity: OwnedPatientIdentity): Promise<void>;
    clear(): Promise<void>;
    touch(patientId: string): Promise<void>;
};

function createOwnedPatientStore(): OwnedPatientStore {
    async function get(): Promise<OwnedPatientIdentity | null> {
        const raw = await SecureStore.getItemAsync(OWNED_PATIENT_KEY);
        if (!raw) {
            return null;
        }

        try {
            const parsed = JSON.parse(raw) as OwnedPatientIdentity;
            if (!parsed?.patientId) {
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }

    async function save(identity: OwnedPatientIdentity): Promise<void> {
        await SecureStore.setItemAsync(OWNED_PATIENT_KEY, JSON.stringify(identity), STORE_OPTS);
    }

    async function clear(): Promise<void> {
        await SecureStore.deleteItemAsync(OWNED_PATIENT_KEY);
    }

    async function touch(patientId: string): Promise<void> {
        const current = await get();
        if (!current || current.patientId !== patientId) {
            return;
        }

        await save({
            ...current,
            lastUsedAt: new Date().toISOString(),
        });
    }

    return {
        get,
        save,
        clear,
        touch,
    };
}

let _store: OwnedPatientStore | null = null;

export function getOwnedPatientStore(): OwnedPatientStore {
    if (!_store) {
        _store = createOwnedPatientStore();
    }
    return _store;
}
