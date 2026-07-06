/**
 * ManagedPatientsStore - Manages encryption keys for patients managed by a caregiver.
 *
 * Each patient has their own encryption key. This allows:
 * - Data isolation between patients
 * - Key transfer if patient later wants their own app
 * - Multiple caregivers to share access to a patient (via key sharing)
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { deriveKeysFromMnemonic } from '../lib/medical-sync-vault/crypto/mnemonic';
import type { MnemonicLanguage } from '../lib/medical-sync-vault/crypto/wordlists';

// Ensure tweetnacl has a PRNG in Expo/RN
nacl.setPRNG((x, n) => {
    const bytes = Crypto.getRandomBytes(n);
    for (let i = 0; i < n; i++) {
        x[i] = bytes[i];
    }
});

const MANAGED_PATIENTS_KEY = 'managed_patients_v2';
const LEGACY_MANAGED_PATIENTS_KEY = 'managed_patients_v1';

export type ManagedPatientSource = 'created' | 'linked';

/**
 * Full patient identity with all keys needed for vault sync.
 * This allows caregivers to switch between patients seamlessly.
 */
export type ManagedPatient = {
    /** Unique patient identifier (UUID) - also used as subject_id for vault */
    patientId: string;
    /** Base64-encoded ed25519 public key for vault auth */
    pubkeyB64?: string;
    /** Base64-encoded ed25519 secret key for vault auth */
    seckeyB64?: string;
    /** Base64-encoded transport key for vault communication */
    transportKeyB64?: string;
    /** How was this patient added? */
    source: ManagedPatientSource;
    /** T-002: "owned" = full identity (created by this caregiver); "granted" = recipient with own keys. */
    mode?: 'owned' | 'granted';
    /** When was this patient added? (ISO string) */
    addedAt: string;
    /** Recovery mnemonic words (only for mnemonic-created patients) */
    mnemonicWords?: string[];
    /** Language of the mnemonic words */
    mnemonicLang?: MnemonicLanguage;
};

/** All keys needed to fully switch to a patient */
export type PatientIdentity = {
    patientId: string;
    pubkeyB64: string;
    seckeyB64: string;
    transportKeyB64: string;
    /** T-002: carries the identity mode so switchPatientIdentity treats granted recipients correctly. */
    mode?: 'owned' | 'granted';
};

function resolveManagedPatientMode(patient: ManagedPatient): 'owned' | 'granted' {
    if (patient.mode === 'owned' || patient.mode === 'granted') {
        return patient.mode;
    }
    if (patient.source === 'created' || patient.mnemonicWords?.length) {
        return 'owned';
    }
    return 'granted';
}

export type ManagedPatientsStore = {
    /** Get all managed patients */
    getAll(): Promise<ManagedPatient[]>;

    /** Get a specific patient by ID */
    get(patientId: string): Promise<ManagedPatient | null>;

    /** Add a new managed patient (creates ALL keys for full identity) */
    create(patientId: string): Promise<ManagedPatient>;

    /** Add a new managed patient with keys derived from mnemonic words */
    createFromMnemonic(patientId: string, words: string[], lang: MnemonicLanguage): Promise<ManagedPatient>;

    /** Add a linked patient (with ALL keys from QR bundle) */
    link(patientId: string, identity: Omit<PatientIdentity, 'patientId'>): Promise<ManagedPatient>;

    /**
     * T-002: link a GRANTED patient — the recipient's OWN ed25519 identity + the
     * unwrapped transport_key. No subject seckey, no medical key.
     */
    linkGranted(
        patientId: string,
        identity: { pubkeyB64: string; seckeyB64: string; transportKeyB64: string }
    ): Promise<ManagedPatient>;

    /** Remove a managed patient */
    remove(patientId: string): Promise<void>;

    /** Get full identity for patient switching (returns null if incomplete) */
    getFullIdentity(patientId: string): Promise<PatientIdentity | null>;

    /** Check if a patient is managed */
    has(patientId: string): Promise<boolean>;

    /** Check if a patient has full identity (all keys for switching) */
    hasFullIdentity(patientId: string): Promise<boolean>;

    /** Clear all managed patients */
    clear(): Promise<void>;

    /** Export patient identity for sharing */
    exportIdentity(patientId: string): Promise<PatientIdentity | null>;
};

/**
 * Creates a managed patients store backed by SecureStore.
 */
export function createManagedPatientsStore(): ManagedPatientsStore {
    let migrationDone = false;

    /**
     * Load patients from SecureStore.
     * @param safe - If true, catches errors and returns []. If false, throws on error.
     *               Use safe=false in write paths (create, link) to prevent silent data loss.
     */
    async function loadPatients(safe = true): Promise<ManagedPatient[]> {
        try {
            // Try v2 first
            let json = await SecureStore.getItemAsync(MANAGED_PATIENTS_KEY);
            if (json) {
                return JSON.parse(json) as ManagedPatient[];
            }

            // Migrate from v1 if exists (only once)
            if (!migrationDone) {
                migrationDone = true;
                const legacyJson = await SecureStore.getItemAsync(LEGACY_MANAGED_PATIENTS_KEY);
                if (legacyJson) {
                    const legacyPatients = JSON.parse(legacyJson) as ManagedPatient[];
                    // Save to v2
                    await SecureStore.setItemAsync(MANAGED_PATIENTS_KEY, JSON.stringify(legacyPatients), {
                        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
                    });
                    return legacyPatients;
                }
            }

            return [];
        } catch (e) {
            if (!safe) throw e;
            return [];
        }
    }

    async function savePatients(patients: ManagedPatient[]): Promise<void> {
        await SecureStore.setItemAsync(MANAGED_PATIENTS_KEY, JSON.stringify(patients), {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
    }

    async function getAll(): Promise<ManagedPatient[]> {
        return loadPatients();
    }

    async function get(patientId: string): Promise<ManagedPatient | null> {
        const patients = await loadPatients();
        return patients.find((p) => p.patientId === patientId) ?? null;
    }

    async function create(patientId: string): Promise<ManagedPatient> {
        const patients = await loadPatients(false);

        // Check if already exists
        if (patients.some((p) => p.patientId === patientId)) {
            throw new Error(`Patient ${patientId} already exists`);
        }

        // Generate keys for the patient identity
        const transportKey = nacl.randomBytes(nacl.secretbox.keyLength);
        const ed25519Keypair = nacl.sign.keyPair();

        const patient: ManagedPatient = {
            patientId,
            transportKeyB64: encodeBase64(transportKey),
            pubkeyB64: encodeBase64(ed25519Keypair.publicKey),
            seckeyB64: encodeBase64(ed25519Keypair.secretKey),
            source: 'created',
            mode: 'owned',
            addedAt: new Date().toISOString(),
        };

        patients.push(patient);
        await savePatients(patients);

        return patient;
    }

    async function createFromMnemonic(
        patientId: string,
        words: string[],
        lang: MnemonicLanguage,
    ): Promise<ManagedPatient> {
        const patients = await loadPatients(false);

        if (patients.some((p) => p.patientId === patientId)) {
            throw new Error(`Patient ${patientId} already exists`);
        }

        const keys = deriveKeysFromMnemonic(words);

        const patient: ManagedPatient = {
            patientId,
            transportKeyB64: keys.transportKeyB64,
            pubkeyB64: keys.publicKeyB64,
            seckeyB64: keys.secretKeyB64,
            source: 'created',
            mode: 'owned',
            addedAt: new Date().toISOString(),
            mnemonicWords: words,
            mnemonicLang: lang,
        };

        patients.push(patient);
        await savePatients(patients);

        return patient;
    }

    async function link(patientId: string, identity: Omit<PatientIdentity, 'patientId'>): Promise<ManagedPatient> {
        const patients = await loadPatients(false);

        // Check if already exists
        if (patients.some((p) => p.patientId === patientId)) {
            throw new Error(`Patient ${patientId} already exists`);
        }

        const patient: ManagedPatient = {
            patientId,
            transportKeyB64: identity.transportKeyB64,
            pubkeyB64: identity.pubkeyB64,
            seckeyB64: identity.seckeyB64,
            source: 'linked',
            mode: 'owned',
            addedAt: new Date().toISOString(),
        };

        patients.push(patient);
        await savePatients(patients);

        return patient;
    }

    async function linkGranted(
        patientId: string,
        identity: { pubkeyB64: string; seckeyB64: string; transportKeyB64: string }
    ): Promise<ManagedPatient> {
        const patients = await loadPatients(false);
        const filtered = patients.filter((p) => p.patientId !== patientId);

        const patient: ManagedPatient = {
            patientId,
            pubkeyB64: identity.pubkeyB64,
            seckeyB64: identity.seckeyB64,
            transportKeyB64: identity.transportKeyB64,
            source: 'linked',
            mode: 'granted',
            addedAt: new Date().toISOString(),
        };

        filtered.push(patient);
        await savePatients(filtered);
        return patient;
    }

    async function remove(patientId: string): Promise<void> {
        const patients = await loadPatients(false);
        const filtered = patients.filter((p) => p.patientId !== patientId);
        await savePatients(filtered);
    }

    async function getFullIdentity(patientId: string): Promise<PatientIdentity | null> {
        const patient = await get(patientId);
        if (!patient) return null;

        // Check if all keys are present
        if (!patient.pubkeyB64 || !patient.seckeyB64 || !patient.transportKeyB64) {
            return null;
        }

        return {
            patientId: patient.patientId,
            pubkeyB64: patient.pubkeyB64,
            seckeyB64: patient.seckeyB64,
            transportKeyB64: patient.transportKeyB64,
            mode: resolveManagedPatientMode(patient),
        };
    }

    async function has(patientId: string): Promise<boolean> {
        const patient = await get(patientId);
        return patient !== null;
    }

    async function hasFullIdentity(patientId: string): Promise<boolean> {
        const identity = await getFullIdentity(patientId);
        return identity !== null;
    }

    async function clear(): Promise<void> {
        await SecureStore.deleteItemAsync(MANAGED_PATIENTS_KEY);
        await SecureStore.deleteItemAsync(LEGACY_MANAGED_PATIENTS_KEY);
    }

    async function exportIdentity(patientId: string): Promise<PatientIdentity | null> {
        return getFullIdentity(patientId);
    }

    return {
        getAll,
        get,
        create,
        createFromMnemonic,
        link,
        linkGranted,
        remove,
        getFullIdentity,
        has,
        hasFullIdentity,
        clear,
        exportIdentity,
    };
}

// Singleton instance
let _store: ManagedPatientsStore | null = null;

export function getManagedPatientsStore(): ManagedPatientsStore {
    if (!_store) {
        _store = createManagedPatientsStore();
    }
    return _store;
}
