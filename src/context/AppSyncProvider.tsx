/**
 * AppSyncProvider - Central sync context for the application.
 * Manages FHIR data storage, outbox queue, and vault synchronization.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

const TRANSPORT_KEY_SS = "medical_sync_vault_transport_key_b64_v1";

import type { CursorV2, VaultEvent, VaultConfig } from "@/src/lib/medical-sync-vault";
import {
    createExpoSecureStore,
    createKeybag,
    getCursorV2,
    setCursorV2,
    clearCursorV2,
    pullEvents,
    pushEvents,
    deactivateDevice,
    deleteSubjectData,
    head as headEvents,
} from "@/src/lib/medical-sync-vault";
import { getOrCreateStableDeviceId } from "@/src/lib/medical-sync-vault/deviceId";
import { issueToken } from "@/src/lib/medical-sync-vault/auth/issueToken";
import type { Storage } from "@/src/lib/medical-sync-vault/storage/types";
import { VaultError, type KeyMismatchDiag } from "@/src/lib/medical-sync-vault/errors";

import { getPatientFhirStore, type PatientFhirStore } from "@/src/stores/patientFhirStore";
import { createFhirPointerOutbox, createFhirOutboxPointer, type FhirOutboxPointer } from "@/src/stores/fhirOutbox";
import { decryptPayloadFromVault, type VaultDecryptFailureReason } from "@/src/services/vaultPayload";
import { flushOutbox } from "@/src/services/flushOutbox";
import { getKeyProvider } from "@/src/services/keyProvider";
import {
    createDeviceAccessStore,
    type DeviceAccessStore,
    type DeviceAccessList,
    DEVICE_ACCESS_RESOURCE_TYPE,
    DEVICE_ACCESS_RESOURCE_ID,
    DEVICE_ACCESS_CODE,
} from "@/src/stores/deviceAccessStore";
import {
    createPatientPreferencesStore,
    type PatientPreferencesStore,
    PATIENT_PREFS_RESOURCE_TYPE,
    PATIENT_PREFS_RESOURCE_ID,
    PATIENT_PREFS_CODE,
} from "@/src/stores/patientPreferencesStore";
import {
    createDonationTrackingStore,
    type DonationTrackingStore,
    DONATION_TRACKING_RESOURCE_TYPE,
    DONATION_TRACKING_RESOURCE_ID,
    DONATION_TRACKING_CODE,
} from "@/src/stores/donationTrackingStore";
import { getManagedPatientsStore } from "@/src/stores/managedPatientsStore";
import { getOwnedPatientStore } from "@/src/stores/ownedPatientStore";
import { clearPatientLocalData } from "@/src/utils/clearPatientLocalData";
import { registerDonationService } from "@/src/services/researchDonation/donationService";
import { registerSupplierExchangeService } from "@/src/services/supplierExchange";
import { createSupplierExchangeStore, type SupplierExchangeStore } from "@/src/stores/supplierExchangeStore";
import { emit, on } from "@/src/lib/bus";
import { DEMO_PATIENT_ID, seedDemoData } from "@/src/demo/demoData";
import { checkIdentityInvariant, decodeJwtIdentity } from "@/src/sync/identityGuard";
import {
    checkRecoveryEligibility,
    markRecoveryAttempt,
    requirePatientIdentity,
} from "@/src/sync/recoveryPolicy";
import { isAssistiveAidsEnabledForRole } from "@/src/features/assistiveAidsFeature";
import type { AppRole } from "@/src/types/appRole";

type SyncStatus = "idle" | "syncing" | "error";
type SyncHealth = "healthy" | "degraded_network" | "blocked_identity";
type SyncBlockReason = "identity_inconsistent" | "missing_patient_identity" | "key_mismatch" | null;
export type ActivateIdentityStrategy = "switch" | "resume" | "fresh";
export type VaultPatientIdentity = {
    patientId: string;
    transportKeyB64: string;
    pubkeyB64: string;
    seckeyB64: string;
    /** T-002: "owned" = full root identity; "granted" = recipient with own keys + wrapped transport_key. */
    mode?: "owned" | "granted";
};

const SYNC_AUTO_REPAIR_ENABLED = process.env.EXPO_PUBLIC_SYNC_AUTO_REPAIR === "1";
const SYNC_ALLOW_HARD_RESET = process.env.EXPO_PUBLIC_SYNC_ALLOW_HARD_RESET === "1";
const SYNC_DEBUG_LOGS = process.env.EXPO_PUBLIC_SYNC_DEBUG_LOGS === "1";
const NETWORK_LOG_COOLDOWN_MS = 30_000;

function debugSyncLog(...args: unknown[]): void {
    if (!SYNC_DEBUG_LOGS) {
        return;
    }
    console.log(...args);
}

/** Check if app is in demo mode via keyProvider context */
function isDemoMode(): boolean {
    return getKeyProvider().getContext().role === 'demo';
}

function isAssistiveAidsFeatureEnabled(): boolean {
    const role = getKeyProvider().getContext().role as AppRole | null;
    return isAssistiveAidsEnabledForRole(role);
}

type VaultCfg = {
    baseUrl: string;
    appIssueToken: string;
};

type AppSyncContextValue = {
    patientFhirStore: PatientFhirStore;
    outbox: ReturnType<typeof createFhirPointerOutbox>;
    cfg: VaultCfg;
    syncEnabled: boolean;
    setSyncEnabled: (v: boolean) => void;
    status: SyncStatus;
    syncHealth: SyncHealth;
    syncBlockReason: SyncBlockReason;
    lastError: VaultError | null;
    lastSyncAt: string | null;
    getOrCreateSubjectId: () => Promise<string>;
    syncNow: (reason?: string) => Promise<VaultEvent[]>;
    fullSync: (reason: string) => Promise<void>;
    push: (events: VaultEvent[]) => Promise<void>;
    reset: () => Promise<void>;
    /** Deactivate current device on server before clearing local data */
    deactivateCurrentDevice: () => Promise<void>;
    /** Delete all server-side data for the current subject (GDPR hard-delete) */
    deleteAccountOnServer: () => Promise<void>;
    /**
     * Ensure all data is synced before switching patients.
     * Returns true if safe to switch, false if there's unsynced data.
     * Throws if sync fails.
     */
    ensureDataSynced: () => Promise<boolean>;
    /**
     * Switch the active patient identity in SecureStore.
     * Call ensureDataSynced() first!
     */
    switchPatientIdentity: (identity: VaultPatientIdentity) => Promise<void>;
    /**
     * Activate a patient identity in the vault layer with an explicit strategy.
     * Scope updates stay with the caller.
     */
    activateIdentity: (identity: VaultPatientIdentity, strategy: ActivateIdentityStrategy) => Promise<void>;
    /**
     * Central patient switch flow: flush outbox → pause sync → switch identity →
     * update scope. fullSync runs after re-render via useEffect.
     */
    switchToPatient: (patientId: string, selectActivePatient: (id: string) => Promise<void>) => Promise<void>;
    /**
     * Probe a (background) managed patient's server-side access WITHOUT switching to it.
     * Returns "revoked" if the vault reports device_disabled (the subject revoked this device),
     * "active" if a token can be issued, "unknown" on network/other errors. Read-only: never
     * mutates the active identity store.
     */
    probePatientAccess: (patientId: string) => Promise<"active" | "revoked" | "unknown">;
    /** Attempt deterministic identity recovery for the active managed patient. */
    recoverActivePatientIdentity: () => Promise<boolean>;
    /**
     * Clear vault identity keys (SUBJECT_ID, signing keys, token, registration, cursor).
     * Reserved for destructive flows (delete/reset/last-patient-removed), not normal role changes.
     * Does NOT clear TRANSPORT_KEY so managed identities can still be recovered locally.
     */
    clearVaultIdentity: () => Promise<void>;
};

const AppSyncContext = createContext<AppSyncContextValue | null>(null);

// Patient-scoped stores exposed via Context (rendering) + Ref (async ops)
export type PatientStoresValue = {
    patientPreferencesStore: PatientPreferencesStore | null;
    deviceAccessStore: DeviceAccessStore | null;
    donationTrackingStore: DonationTrackingStore | null;
    supplierExchangeStore: SupplierExchangeStore | null;
};

const PatientStoresContext = createContext<PatientStoresValue>({
    patientPreferencesStore: null,
    deviceAccessStore: null,
    donationTrackingStore: null,
    supplierExchangeStore: null,
});

export function usePatientStores(): PatientStoresValue {
    return useContext(PatientStoresContext);
}

const SYNC_ENABLED_KEY = "medical_sync_vault_sync_enabled";
const LAST_SYNC_AT_KEY_PREFIX = "medical_sync_vault_last_sync_at_v1";

function nowIso() {
    return new Date().toISOString();
}

function lastSyncAtKey(patientId: string): string {
    return `${LAST_SYNC_AT_KEY_PREFIX}:${patientId}`;
}

function coerceVaultError(e: unknown): VaultError {
    if (e instanceof VaultError) return e;
    return new VaultError("server_error", (e as Error)?.message ?? String(e));
}

function isSubjectAccessLostError(code: string | undefined): boolean {
    return code === "device_disabled" || code === "unknown_subject" || code === "subject_disabled";
}

/**
 * T-002: this device's access was revoked (vault returns 403 device_disabled).
 * Best-effort local wipe — remove the subject's data, the grant, and auth state so
 * the device stops syncing and shows no stale snapshot.
 */
async function handleDeviceRevoked(
    store: ReturnType<typeof createExpoSecureStore>,
    K: ReturnType<typeof createKeybag>,
    patientIdOverride?: string | null,
): Promise<void> {
    try {
        const sid = patientIdOverride ?? await store.get(K.SUBJECT_ID);
        if (sid) {
            // Encrypted FHIR rows for this subject + the managed grant.
            await clearPatientLocalData(sid).catch(() => {});
            await getManagedPatientsStore().remove(sid).catch(() => {});
            // If the revoked subject IS the device's owned patient account, wipe it too
            // (root identity + mnemonic). Do NOT touch it for a managed/granted subject.
            const owned = await getOwnedPatientStore().get();
            if (owned && owned.patientId === sid) {
                await getOwnedPatientStore().clear().catch(() => {});
            }
        }
        // Wipe the active vault identity + cached keys so the device stops syncing and
        // keeps no decryptable snapshot of the revoked subject.
        await SecureStore.deleteItemAsync(TRANSPORT_KEY_SS).catch(() => {});
        await store.del(K.ACCESS_TOKEN).catch(() => {});
        await store.del(K.SUBJECT_REGISTERED).catch(() => {});
        await store.del(K.SUBJECT_ID).catch(() => {});
        await store.del(K.PUBKEY_B64).catch(() => {});
        await store.del(K.SECKEY_B64).catch(() => {});
        await clearCursorV2(store, K).catch(() => {});
    } catch {
        // best-effort
    }
}

/**
 * Provides sync functionality to the application.
 * Handles FHIR storage, outbox management, and vault synchronization.
 */
export function AppSyncProvider({ cfg, activePatientId: propActivePatientId, onDeviceRevoked, children }: { cfg: VaultCfg; activePatientId: string | null; onDeviceRevoked?: () => void | Promise<void>; children: React.ReactNode }) {
    const patientFhirStore = useMemo(() => getPatientFhirStore(), []);
    const outbox = useMemo(() => createFhirPointerOutbox({ dbName: "medical-data.db" }), []);
    const store = useMemo(() => createExpoSecureStore("medical_sync_vault"), []);
    const K = useMemo(() => createKeybag(), []);

    // T-002: after a device_disabled wipe, let the role layer reset the scope for the
    // revoked subject (remove patient / reset role). Kept in a ref so the poll
    // callbacks don't need it as a dependency.
    const onDeviceRevokedRef = useRef(onDeviceRevoked);
    useEffect(() => { onDeviceRevokedRef.current = onDeviceRevoked; }, [onDeviceRevoked]);
    const deviceRevokedRef = useRef(false);

    useEffect(() => {
        if (propActivePatientId) {
            deviceRevokedRef.current = false;
        }
    }, [propActivePatientId]);

    const handleActiveDeviceRevoked = useCallback(async () => {
        if (deviceRevokedRef.current) {
            return;
        }
        deviceRevokedRef.current = true;
        const revokedPatientId = propActivePatientId ?? await store.get(K.SUBJECT_ID);

        setLastError(null);
        setStatus("idle");
        setSyncHealth("healthy");
        setSyncBlockReason(null);

        try {
            await onDeviceRevokedRef.current?.();
        } catch (e) {
            console.warn("Device revoked: role reset/navigation failed:", e);
        }

        await handleDeviceRevoked(store, K, revokedPatientId);
    }, [propActivePatientId, store, K]);

    const shouldExitForLostActiveIdentity = useCallback(async (ve: VaultError): Promise<boolean> => {
        if (ve.code === "missing_patient_identity") {
            return true;
        }

        if (ve.code !== "identity_inconsistent" && ve.code !== "key_mismatch" && ve.code !== "bad_signature") {
            return false;
        }

        const role = getKeyProvider().getContext().role;
        if (role !== "caregiver" && role !== "doctor") {
            return false;
        }
        if (!propActivePatientId) {
            return false;
        }

        return !(await getManagedPatientsStore().getFullIdentity(propActivePatientId));
    }, [propActivePatientId]);

    // Pre-warm SQLite database so init() is done before first data access.
    // In demo mode, re-seed if the DB was reset (e.g. after device restore
    // where the SecureStore encryption key no longer matches the DB file).
    useEffect(() => {
        patientFhirStore.init()
            .then(async () => {
                if (propActivePatientId !== DEMO_PATIENT_ID) return;
                const { total } = await patientFhirStore.rawStats(DEMO_PATIENT_ID);
                if (total === 0) {
                    console.warn('patientFhirStore: demo DB empty — re-seeding demo data');
                    await seedDemoData(patientFhirStore);
                    emit('fhir:changed');
                }
            })
            .catch(console.warn);
    }, [patientFhirStore, propActivePatientId]);

    const [syncEnabled, setSyncEnabledState] = useState(true);
    const [status, setStatus] = useState<SyncStatus>("idle");
    const [syncHealth, setSyncHealth] = useState<SyncHealth>("healthy");
    const [syncBlockReason, setSyncBlockReason] = useState<SyncBlockReason>(null);
    const [lastError, setLastError] = useState<VaultError | null>(null);
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

    const syncingRef = useRef(false);
    const queuedRef = useRef(false);
    const loadedRef = useRef(false);
    const missingActivePatientLogRef = useRef(false);
    const lastNetworkLogAtRef = useRef(0);
    const recoveryAttemptsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        let cancelled = false;

        if (!propActivePatientId || propActivePatientId === DEMO_PATIENT_ID || isDemoMode()) {
            setLastSyncAt(null);
            return;
        }

        AsyncStorage.getItem(lastSyncAtKey(propActivePatientId))
            .then((value) => {
                if (!cancelled) {
                    setLastSyncAt(value);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setLastSyncAt(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [propActivePatientId]);

    const markSyncCompleted = useCallback(() => {
        const completedAt = nowIso();
        setLastSyncAt(completedAt);

        if (!propActivePatientId || propActivePatientId === DEMO_PATIENT_ID || isDemoMode()) {
            return;
        }

        AsyncStorage.setItem(lastSyncAtKey(propActivePatientId), completedAt).catch(() => {});
    }, [propActivePatientId]);

    // Load persisted sync preference
    useEffect(() => {
        AsyncStorage.getItem(SYNC_ENABLED_KEY)
            .then((val) => {
                if (val === "1") setSyncEnabledState(true);
                loadedRef.current = true;
            })
            .catch(() => {
                loadedRef.current = true;
            });
    }, []);

    const setSyncEnabled = useCallback((next: boolean) => {
        if (isDemoMode()) return; // Never allow sync in demo mode
        setSyncEnabledState(next);
        if (loadedRef.current) {
            AsyncStorage.setItem(SYNC_ENABLED_KEY, next ? "1" : "0").catch(() => {});
        }
    }, []);

    const hasActivePatient = !!propActivePatientId;

    // Patient-scoped store initialization: re-create when activePatientId changes.
    // No storesRef needed — fullSync runs AFTER re-render via useEffect,
    // so applyPulledEvents always has the correct stores from its closure.
    const patientStores = useMemo<PatientStoresValue>(() => {
        return propActivePatientId ? {
            patientPreferencesStore: createPatientPreferencesStore(propActivePatientId),
            deviceAccessStore: createDeviceAccessStore(propActivePatientId),
            donationTrackingStore: createDonationTrackingStore(propActivePatientId),
            supplierExchangeStore: createSupplierExchangeStore(propActivePatientId),
        } : {
            patientPreferencesStore: null,
            deviceAccessStore: null,
            donationTrackingStore: null,
            supplierExchangeStore: null,
        };
    }, [propActivePatientId]);

    // Destructure for internal usage (sync callbacks, etc.)
    const { patientPreferencesStore, deviceAccessStore, donationTrackingStore, supplierExchangeStore } = patientStores;

    // Ref to pause sync during patient switch
    const isSwitchingRef = useRef(false);

    // Set up DeviceAccessStore sync callback
    useEffect(() => {
        if (!deviceAccessStore) return;

        const handleDeviceAccessSync = async (list: DeviceAccessList) => {
            if (isDemoMode()) return;

            // Get subject_id for storing the resource
            const subjectId = await store.get(K.SUBJECT_ID);
            if (!subjectId) {
                debugSyncLog('DeviceAccessStore sync: No subject_id available');
                return;
            }

            // Ensure keyProvider context is set
            const keyProvider = getKeyProvider();
            const ctx = keyProvider.getContext();
            if (!ctx.activePatientId) {
                keyProvider.setContext({
                    role: ctx.role ?? 'patient',
                    activePatientId: subjectId,
                });
            }

            // Convert to FHIR resource and save
            const resource = await deviceAccessStore.toFhirResource();
            await patientFhirStore.upsert(
                subjectId,
                DEVICE_ACCESS_RESOURCE_TYPE,
                DEVICE_ACCESS_RESOURCE_ID,
                resource,
                list.updatedAt
            );

            // Queue to outbox for pushing to vault
            const fhirPtr: FhirOutboxPointer = {
                event_id: Crypto.randomUUID(),
                op: 'upsert',
                subject_id: subjectId,
                resource_type: DEVICE_ACCESS_RESOURCE_TYPE,
                resource_id: DEVICE_ACCESS_RESOURCE_ID,
                updated_at: list.updatedAt,
            };
            const outboxPtr = createFhirOutboxPointer(fhirPtr);
            await outbox.enqueue([outboxPtr]);

            // Trigger sync if enabled
            if (syncEnabled) {
                emit('fhir:changed');
            }
        };

        deviceAccessStore.setSyncCallback(handleDeviceAccessSync);

        // Initial push: onboarding screens (create/scan/restore/link) create a fresh
        // store without syncCallback, so addEntry only saves to SecureStore.
        // Push the local list now that the sync callback is ready.
        // Safe on re-mount: outbox deduplicates by resource key.
        deviceAccessStore.getList().then(list => {
            if (list.entries.length > 0 && !isDemoMode()) {
                handleDeviceAccessSync(list).catch(e =>
                    console.warn('DeviceAccessStore initial push failed:', e)
                );
            }
        });

        return () => {
            deviceAccessStore.setSyncCallback(null);
        };
    }, [deviceAccessStore, patientFhirStore, store, K, syncEnabled, outbox]);

    // Set up PatientPreferencesStore sync callback
    useEffect(() => {
        if (!patientPreferencesStore) return;
        patientPreferencesStore.setSyncCallback(async (prefs) => {
            if (isDemoMode()) return;

            // Get subject_id for storing the resource
            const subjectId = await store.get(K.SUBJECT_ID);
            if (!subjectId) {
                debugSyncLog('PatientPreferencesStore sync: No subject_id available');
                return;
            }

            // Ensure keyProvider context is set
            const keyProvider = getKeyProvider();
            const ctx = keyProvider.getContext();
            if (!ctx.activePatientId) {
                keyProvider.setContext({
                    role: ctx.role ?? 'patient',
                    activePatientId: subjectId,
                });
            }

            // Convert to FHIR resource and save
            const resource = await patientPreferencesStore.toFhirResource();
            await patientFhirStore.upsert(
                subjectId,
                PATIENT_PREFS_RESOURCE_TYPE,
                PATIENT_PREFS_RESOURCE_ID,
                resource,
                prefs.updatedAt
            );

            // Queue to outbox for pushing to vault
            const fhirPtr: FhirOutboxPointer = {
                event_id: Crypto.randomUUID(),
                op: 'upsert',
                subject_id: subjectId,
                resource_type: PATIENT_PREFS_RESOURCE_TYPE,
                resource_id: PATIENT_PREFS_RESOURCE_ID,
                updated_at: prefs.updatedAt,
            };
            const outboxPtr = createFhirOutboxPointer(fhirPtr);
            await outbox.enqueue([outboxPtr]);

            // Trigger sync if enabled
            if (syncEnabled) {
                emit('fhir:changed');
            }
        });

        return () => {
            patientPreferencesStore.setSyncCallback(null);
        };
    }, [patientPreferencesStore, patientFhirStore, store, K, syncEnabled, outbox]);

    // Set up DonationTrackingStore sync callback
    useEffect(() => {
        if (!donationTrackingStore) return;
        donationTrackingStore.setSyncCallback(async (state) => {
            if (isDemoMode()) return;

            // Get subject_id for storing the resource
            const subjectId = await store.get(K.SUBJECT_ID);
            if (!subjectId) {
                debugSyncLog('DonationTrackingStore sync: No subject_id available');
                return;
            }

            // Ensure keyProvider context is set
            const keyProvider = getKeyProvider();
            const ctx = keyProvider.getContext();
            if (!ctx.activePatientId) {
                keyProvider.setContext({
                    role: ctx.role ?? 'patient',
                    activePatientId: subjectId,
                });
            }

            // Convert to FHIR resource and save
            const resource = await donationTrackingStore.toFhirResource();
            await patientFhirStore.upsert(
                subjectId,
                DONATION_TRACKING_RESOURCE_TYPE,
                DONATION_TRACKING_RESOURCE_ID,
                resource,
                state.updatedAt
            );

            // Queue to outbox for pushing to vault
            const fhirPtr: FhirOutboxPointer = {
                event_id: Crypto.randomUUID(),
                op: 'upsert',
                subject_id: subjectId,
                resource_type: DONATION_TRACKING_RESOURCE_TYPE,
                resource_id: DONATION_TRACKING_RESOURCE_ID,
                updated_at: state.updatedAt,
            };
            const outboxPtr = createFhirOutboxPointer(fhirPtr);
            await outbox.enqueue([outboxPtr]);

            // Trigger sync if enabled
            if (syncEnabled) {
                emit('fhir:changed');
            }
        });

        return () => {
            donationTrackingStore.setSyncCallback(null);
        };
    }, [donationTrackingStore, patientFhirStore, store, K, syncEnabled, outbox]);

    const libCfg = useMemo<VaultConfig>(
        () => ({ baseUrl: cfg.baseUrl, appIssueToken: cfg.appIssueToken }),
        [cfg.baseUrl, cfg.appIssueToken]
    );

    const ensureIdentity = useCallback(async () => {
        if (!propActivePatientId) return;

        const deviceId = await getOrCreateStableDeviceId(store, K);

        const subjectId = await store.get(K.SUBJECT_ID);
        const pubkeyB64 = await store.get(K.PUBKEY_B64);
        const seckeyB64 = await store.get(K.SECKEY_B64);
        const accessToken = await store.get(K.ACCESS_TOKEN);
        const role = getKeyProvider().getContext().role;
        const jwtIdentity = decodeJwtIdentity(accessToken);

        if (!jwtIdentity.valid) {
            throw new VaultError("identity_inconsistent", "identity_inconsistent:invalid_token_payload");
        }

        const invariant = checkIdentityInvariant({
            activePatientId: propActivePatientId,
            subjectId,
            pubkeyB64,
            seckeyB64,
            deviceId,
            tokenSub: jwtIdentity.sub,
            tokenDeviceId: jwtIdentity.deviceId,
            hasAccessToken: !!accessToken,
            requireSigningKeys: true,
        });

        if (!invariant.ok) {
            throw new VaultError("identity_inconsistent", `identity_inconsistent:${invariant.reason}`);
        }

        if (role === "caregiver" || role === "doctor") {
            const expected = requirePatientIdentity(
                propActivePatientId,
                await getManagedPatientsStore().getFullIdentity(propActivePatientId)
            );

            const transportKeyB64 = await SecureStore.getItemAsync(TRANSPORT_KEY_SS);
            // T-002: medical_key is no longer part of the identity match (legacy/unused;
            // granted recipients never have one). Match on signing + transport keys only.
            if (
                expected.pubkeyB64 !== pubkeyB64
                || expected.seckeyB64 !== seckeyB64
                || expected.transportKeyB64 !== transportKeyB64
            ) {
                throw new VaultError("identity_inconsistent", "identity_inconsistent:managed_identity_mismatch");
            }
        }
    }, [store, K, propActivePatientId]);

    const getOrCreateSubjectId = useCallback(async () => {
        // In demo mode, always use the fixed demo patient ID
        // (avoids creating a random UUID that won't match the seeded data)
        if (isDemoMode()) return DEMO_PATIENT_ID;

        let sid = await store.get(K.SUBJECT_ID);
        if (!sid) {
            sid = Crypto.randomUUID();
            await store.set(K.SUBJECT_ID, sid);
        }
        return sid;
    }, [store, K]);

    const applyPulledEvents = useCallback(
        async (evs: VaultEvent[]): Promise<boolean> => {
            let changed = false;
            let preferencesChanged = false;
            let decryptSkipped = 0;
            const decryptReasons: Partial<Record<VaultDecryptFailureReason, number>> = {};

            // Stores from closure are correct because fullSync runs AFTER re-render
            // (via prevPatientIdRef useEffect), so the closure always has fresh stores.
            const das = deviceAccessStore;
            const pps = patientPreferencesStore;
            const dts = donationTrackingStore;

            // Get subject_id for storing events
            const subjectId = await store.get(K.SUBJECT_ID);
            if (!subjectId) {
                debugSyncLog("applyPulledEvents: No subject_id available");
                return false;
            }

            // Ensure keyProvider context is set for patientFhirStore to work
            const keyProvider = getKeyProvider();
            const ctx = keyProvider.getContext();
            if (!ctx.activePatientId) {
                keyProvider.setContext({
                    role: ctx.role ?? 'patient',
                    activePatientId: subjectId,
                });
            }

            for (const ev of evs) {
                const decrypted = await decryptPayloadFromVault(ev);
                if (!decrypted.ok) {
                    decryptSkipped += 1;
                    decryptReasons[decrypted.reason] = (decryptReasons[decrypted.reason] ?? 0) + 1;
                    continue;
                }
                const payload = decrypted.payload;

                if (payload.kind === "FHIR_RESOURCE" && payload.op === "upsert") {
                    if (
                        das &&
                        payload.resourceType === DEVICE_ACCESS_RESOURCE_TYPE &&
                        payload.id === DEVICE_ACCESS_RESOURCE_ID &&
                        payload.resource?.code?.coding?.[0]?.code === DEVICE_ACCESS_CODE
                    ) {
                        // Store merges pulled + local entries and manages its own
                        // patientFhirStore writes via sync callback. Skip generic
                        // upsert below to prevent overwriting the merged result.
                        await das.fromFhirResource(payload.resource);
                    } else {
                        if (
                            pps &&
                            payload.resourceType === PATIENT_PREFS_RESOURCE_TYPE &&
                            payload.id === PATIENT_PREFS_RESOURCE_ID &&
                            payload.resource?.code?.coding?.[0]?.code === PATIENT_PREFS_CODE
                        ) {
                            await pps.fromFhirResource(payload.resource);
                            preferencesChanged = true;
                        }

                        if (
                            dts &&
                            payload.resourceType === DONATION_TRACKING_RESOURCE_TYPE &&
                            payload.id === DONATION_TRACKING_RESOURCE_ID &&
                            payload.resource?.code?.coding?.[0]?.code === DONATION_TRACKING_CODE
                        ) {
                            await dts.fromFhirResource(payload.resource);
                        }

                        await patientFhirStore.upsert(subjectId, payload.resourceType, payload.id, payload.resource, payload.at);
                    }
                    changed = true;
                } else if (payload.kind === "FHIR_PTR" && payload.op === "delete") {
                    await patientFhirStore.markDeleted(subjectId, payload.resourceType, payload.id, payload.at);
                    changed = true;
                }
            }

            if (evs.length > 0) {
                const reasonSummary = Object.entries(decryptReasons)
                    .map(([reason, count]) => `${reason}:${count}`)
                    .join(",");
                debugSyncLog(
                    `applyPulledEvents: received=${evs.length}, changed=${changed ? 1 : 0}, decrypt_skipped=${decryptSkipped}${reasonSummary ? `, reasons=${reasonSummary}` : ""}`
                );
                if (!changed && decryptSkipped === evs.length) {
                    debugSyncLog("applyPulledEvents: all pulled events failed to decrypt (possible transport key mismatch)");
                }
            }

            if (preferencesChanged) {
                emit("preferences:changed");
            }

            return changed;
        },
        [patientFhirStore, store, K, deviceAccessStore, patientPreferencesStore, donationTrackingStore]
    );

    const syncNow = useCallback(
        async (reason = "manual"): Promise<VaultEvent[]> => {
            if (deviceRevokedRef.current) return [];
            if (!syncEnabled || isDemoMode() || !hasActivePatient) {
                if (!hasActivePatient && !missingActivePatientLogRef.current) {
                    debugSyncLog(`syncNow(${reason}): skipped, no active patient`);
                    missingActivePatientLogRef.current = true;
                }
                return [];
            }
            missingActivePatientLogRef.current = false;
            if (isSwitchingRef.current) return []; // Skip during patient switch

            if (syncingRef.current) {
                queuedRef.current = true;
                return [];
            }

            syncingRef.current = true;
            setStatus("syncing");
            setLastError(null);

            try {
                await ensureIdentity();

                let cursor: CursorV2 | null = await getCursorV2(store, K);

                // HEAD-First: Check if there are new events before doing full pull
                // This saves bandwidth when there are no changes (common case)
                // If HEAD fails (e.g., endpoint not available), fall through to normal pull
                try {
                    const { head } = await headEvents(libCfg, store, K);

                    if (head && cursor) {
                        // Compare server head with local cursor
                        // If they match, no new events - skip the full pull
                        if (head.since_id === cursor.since_id && head.since_ts === cursor.since_ts) {
                            markSyncCompleted();
                            setStatus("idle");
                            return [];
                        }
                    }
                } catch (headError) {
                    const ve = coerceVaultError(headError);
                    if (isSubjectAccessLostError(ve.code)) {
                        throw ve;
                    }
                    // HEAD endpoint might not be available - continue with normal pull
                    debugSyncLog("HEAD check failed, falling back to full pull:", headError);
                }

                // There are new events (or first sync), do full pull
                const allEvents: VaultEvent[] = [];

                while (true) {
                    const pulled = await pullEvents(libCfg, store, K, { cursor, limit: 500 });
                    const evs = (pulled.events ?? []) as VaultEvent[];
                    if (evs.length) allEvents.push(...evs);

                    const next = pulled.next as CursorV2 | null;

                    if (!next) {
                        if (evs.length) {
                            const lastEv = evs[evs.length - 1] as Record<string, unknown>;
                            const ts = lastEv.server_received_at as string;
                            if (ts) {
                                await setCursorV2(store, K, { since_ts: ts, since_id: lastEv.event_id as string });
                            }
                        }
                        break;
                    }

                    const sameCursor = !!cursor && next.since_id === cursor.since_id && next.since_ts === cursor.since_ts;

                    if (sameCursor) {
                        // Cursor unchanged — no new events. Existing cursor is already correct.
                        break;
                    }

                    await setCursorV2(store, K, next);
                    cursor = next;
                }

                debugSyncLog(`syncNow(${reason}): pulled_events=${allEvents.length}`);

                markSyncCompleted();
                setStatus("idle");
                setSyncHealth("healthy");
                setSyncBlockReason(null);
                return allEvents;
            } catch (e) {
                const ve = coerceVaultError(e);
                if (isSubjectAccessLostError(ve.code)) {
                    await handleActiveDeviceRevoked();
                    return [];
                }
                if (await shouldExitForLostActiveIdentity(ve)) {
                    await handleActiveDeviceRevoked();
                    return [];
                }
                setLastError(ve);
                setStatus("error");
                if (ve.code === "network_error") {
                    setSyncHealth("degraded_network");
                } else if (ve.code === "identity_inconsistent" || ve.code === "missing_patient_identity" || ve.code === "key_mismatch" || ve.code === "bad_signature") {
                    setSyncHealth("blocked_identity");
                    setSyncBlockReason(
                        ve.code === "missing_patient_identity"
                            ? "missing_patient_identity"
                            : ve.code === "key_mismatch"
                                ? "key_mismatch"
                                : "identity_inconsistent"
                    );
                }
                throw ve;
            } finally {
                syncingRef.current = false;
                if (queuedRef.current) {
                    queuedRef.current = false;
                    await syncNow("queued");
                }
            }
        },
        [libCfg, syncEnabled, store, K, ensureIdentity, hasActivePatient, handleActiveDeviceRevoked, shouldExitForLostActiveIdentity, markSyncCompleted]
    );

    const push = useCallback(
        async (events: VaultEvent[]) => {
            if (deviceRevokedRef.current) return;
            if (!syncEnabled || isDemoMode() || !hasActivePatient || !events?.length) return;

            setLastError(null);

            try {
                await ensureIdentity();
                await pushEvents(libCfg, store, K, events);
            } catch (e) {
                const ve = coerceVaultError(e);
                if (isSubjectAccessLostError(ve.code)) {
                    await handleActiveDeviceRevoked();
                    return;
                }
                if (await shouldExitForLostActiveIdentity(ve)) {
                    await handleActiveDeviceRevoked();
                    return;
                }
                setLastError(ve);
                setStatus("error");
                if (ve.code === "network_error") {
                    setSyncHealth("degraded_network");
                } else if (ve.code === "identity_inconsistent" || ve.code === "missing_patient_identity" || ve.code === "key_mismatch" || ve.code === "bad_signature") {
                    setSyncHealth("blocked_identity");
                    setSyncBlockReason(
                        ve.code === "missing_patient_identity"
                            ? "missing_patient_identity"
                            : ve.code === "key_mismatch"
                                ? "key_mismatch"
                                : "identity_inconsistent"
                    );
                }
                throw ve;
            }
        },
        [libCfg, syncEnabled, store, K, ensureIdentity, hasActivePatient, handleActiveDeviceRevoked, shouldExitForLostActiveIdentity]
    );

    const reset = useCallback(async () => {
        await clearCursorV2(store, K);
        if (propActivePatientId) {
            await AsyncStorage.removeItem(lastSyncAtKey(propActivePatientId)).catch(() => {});
        }
        setLastError(null);
        setLastSyncAt(null);
        setStatus("idle");
        setSyncHealth("healthy");
        setSyncBlockReason(null);
    }, [store, K, propActivePatientId]);

    const deactivateCurrentDevice = useCallback(async () => {
        try {
            await deactivateDevice(libCfg, store, K);
        } catch (e) {
            // Log but don't throw - we still want to clear local data even if server call fails
            console.warn("Failed to deactivate device on server:", e);
        }
    }, [libCfg, store, K]);

    const deleteAccountOnServer = useCallback(async () => {
        if (isDemoMode()) return;
        try {
            await deleteSubjectData(libCfg, store, K);
        } catch (e) {
            console.warn("Failed to delete account data on server:", e);
            throw e; // Caller decides whether error is blocking
        }
    }, [libCfg, store, K]);

    const ensureDataSynced = useCallback(async (): Promise<boolean> => {
        // Check if there's pending data in the outbox
        const stats = await outbox.stats();
        if (stats.pending === 0) {
            return true; // No pending data, safe to switch
        }

        // Try to flush the outbox
        try {
            await flushOutbox({ cfg: libCfg, store, K, outbox, patientFhirStore });

            // Check again after flush
            const statsAfter = await outbox.stats();
            return statsAfter.pending === 0;
        } catch (e) {
            console.error("ensureDataSynced: flush failed:", e);
            // Re-check stats - some items might have been sent
            const statsAfter = await outbox.stats();
            return statsAfter.pending === 0;
        }
    }, [libCfg, store, K, outbox, patientFhirStore]);

    const switchPatientIdentity = useCallback(async (identity: VaultPatientIdentity) => {
        // Update K.SUBJECT_ID
        await store.set(K.SUBJECT_ID, identity.patientId);

        // Update ed25519 keys
        await store.set(K.PUBKEY_B64, identity.pubkeyB64);
        await store.set(K.SECKEY_B64, identity.seckeyB64);

        // Update transport key
        await SecureStore.setItemAsync(TRANSPORT_KEY_SS, identity.transportKeyB64, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
        });

        // Clear access token (force re-auth with new identity)
        await store.del(K.ACCESS_TOKEN);

        // SUBJECT_REGISTERED flag:
        // - granted (T-002 recipient): the subject is ALREADY registered (by the patient) and the
        //   recipient device was authorized via /devices/authorize. The recipient must NOT call
        //   /subjects/register with its own pubkey (the vault would reject it as a key mismatch).
        //   Mark as registered so issueToken() skips register and goes straight to challenge/issue.
        // - owned: new subject must be registered → clear the flag.
        if (identity.mode === "granted") {
            await store.set(K.SUBJECT_REGISTERED, "1");
        } else {
            await store.del(K.SUBJECT_REGISTERED);
        }

        // Clear cursor (will re-sync from new patient's vault)
        await clearCursorV2(store, K);

        // Reset sync state
        setLastError(null);
        setLastSyncAt(null);
        setStatus("idle");
        setSyncHealth("healthy");
        setSyncBlockReason(null);
    }, [store, K]);

    // T-002: check whether a background managed patient still grants this device access.
    // Used by the "Patienten verwalten" screen to surface revocations proactively instead of
    // only discovering them when the doctor activates the patient. Runs against an ephemeral,
    // in-memory identity seeded from the stored grant — the real active store is never touched.
    const probePatientAccess = useCallback(async (
        patientId: string,
    ): Promise<"active" | "revoked" | "unknown"> => {
        try {
            const identity = await getManagedPatientsStore().getFullIdentity(patientId);
            // Only granted (recipient) identities can be revoked server-side; an owned subject
            // cannot revoke itself, so treat it as active without a network round-trip.
            if (!identity) return "unknown";
            if (identity.mode !== "granted") return "active";

            const deviceId = await getOrCreateStableDeviceId(store, K);
            if (!deviceId) return "unknown";

            const mem = new Map<string, string>();
            const ephemeral: Storage = {
                get: async (key) => mem.get(key) ?? null,
                set: async (key, value) => { mem.set(key, value); },
                del: async (key) => { mem.delete(key); },
            };
            await ephemeral.set(K.SUBJECT_ID, patientId);
            await ephemeral.set(K.DEVICE_ID, deviceId);
            await ephemeral.set(K.PUBKEY_B64, identity.pubkeyB64);
            await ephemeral.set(K.SECKEY_B64, identity.seckeyB64);
            // The subject is already registered by the patient; skip /subjects/register.
            await ephemeral.set(K.SUBJECT_REGISTERED, "1");

            await issueToken(libCfg, ephemeral, K);
            return "active";
        } catch (e: any) {
            if (isSubjectAccessLostError(e?.code)) return "revoked";
            return "unknown";
        }
    }, [libCfg, store, K]);

    const activateIdentity = useCallback(async (
        identity: VaultPatientIdentity,
        strategy: ActivateIdentityStrategy,
    ) => {
        isSwitchingRef.current = true;

        try {
            if (strategy === "fresh") {
                await outbox.clear();
            } else {
                const isSafe = await ensureDataSynced();
                if (!isSafe) {
                    throw new Error("Could not sync current patient data before switching");
                }
            }

            await getOrCreateStableDeviceId(store, K);
            await switchPatientIdentity(identity);
        } finally {
            isSwitchingRef.current = false;
        }
    }, [ensureDataSynced, outbox, store, K, switchPatientIdentity]);

    const recoverActivePatientIdentity = useCallback(async (): Promise<boolean> => {
        const activePatientId = propActivePatientId;
        const role = getKeyProvider().getContext().role ?? null;
        const stats = await outbox.stats();

        const eligibility = checkRecoveryEligibility({
            enabled: SYNC_AUTO_REPAIR_ENABLED,
            activePatientId,
            role,
            isSwitching: isSwitchingRef.current,
            pendingOutbox: stats.pending,
            attemptedPatientIds: recoveryAttemptsRef.current,
        });
        if (!eligibility.ok || !activePatientId) {
            return false;
        }

        if (!markRecoveryAttempt(recoveryAttemptsRef.current, activePatientId)) {
            return false;
        }

        const storedIdentity = await getManagedPatientsStore().getFullIdentity(activePatientId);
        if (!storedIdentity) {
            await handleActiveDeviceRevoked();
            return true;
        }

        const identity = requirePatientIdentity(activePatientId, storedIdentity);

        await switchPatientIdentity(identity);
        await flushOutbox({ cfg: libCfg, store, K, outbox, patientFhirStore });
        const evs = await syncNow("identity-recovery");
        if (evs?.length) {
            const changed = await applyPulledEvents(evs);
            if (changed) emit("fhir:changed");
        }
        emit("sync:completed");
        setSyncHealth("healthy");
        setSyncBlockReason(null);
        return true;
    }, [propActivePatientId, outbox, switchPatientIdentity, libCfg, store, K, patientFhirStore, syncNow, applyPulledEvents, handleActiveDeviceRevoked]);

    const fullSyncRef = useRef(false);

    const fullSync = useCallback(
        async (reason: string) => {
            if (deviceRevokedRef.current) return;
            if (!hasActivePatient) {
                if (!missingActivePatientLogRef.current) {
                    debugSyncLog(`fullSync(${reason}): skipped, no active patient`);
                    missingActivePatientLogRef.current = true;
                }
                return;
            }
            missingActivePatientLogRef.current = false;
            if (fullSyncRef.current) return;
            fullSyncRef.current = true;

            try {
                await flushOutbox({ cfg: libCfg, store, K, outbox, patientFhirStore });
                const evs = await syncNow(reason);
                if (evs?.length) {
                    const changed = await applyPulledEvents(evs);
                    if (changed) emit("fhir:changed");
                }
                setSyncHealth("healthy");
                setSyncBlockReason(null);
                // Signal that a full sync cycle completed (triggers donation service)
                emit("sync:completed");
            } catch (e: any) {
                if (isSubjectAccessLostError(e?.code)) {
                    await handleActiveDeviceRevoked();
                    return;
                }

                if (e?.code === "network_error") {
                    setSyncHealth("degraded_network");
                    const now = Date.now();
                    if (now - lastNetworkLogAtRef.current > NETWORK_LOG_COOLDOWN_MS) {
                        debugSyncLog(`fullSync(${reason}) network_error:`, e?.message ?? e);
                        lastNetworkLogAtRef.current = now;
                    }
                    return;
                }

                if (e?.code === "key_mismatch" || e?.code === "identity_inconsistent" || e?.code === "missing_patient_identity" || e?.code === "bad_signature") {
                    const ve = e instanceof VaultError ? e : coerceVaultError(e);
                    if (await shouldExitForLostActiveIdentity(ve)) {
                        await handleActiveDeviceRevoked();
                        return;
                    }

                    const diag = (ve.code === "key_mismatch" ? ve.diag : undefined) as KeyMismatchDiag | undefined;
                    console.error(
                        `fullSync(${reason}) ${ve.code}:`,
                        ve.message ?? ve,
                        ve.status ? `status=${String(ve.status)}` : "",
                        ve.bodyText ? `body=${String(ve.bodyText)}` : "",
                        diag?.incoming_pubkey_fpr ? `incoming_pubkey_fpr=${diag.incoming_pubkey_fpr}` : "",
                        diag?.existing_pubkey_fpr ? `existing_pubkey_fpr=${diag.existing_pubkey_fpr}` : ""
                    );

                    setLastError(ve);
                    setStatus("error");
                    setSyncHealth("blocked_identity");
                    setSyncBlockReason(
                        e?.code === "missing_patient_identity"
                            ? "missing_patient_identity"
                            : e?.code === "key_mismatch"
                                ? "key_mismatch"
                                : "identity_inconsistent"
                    );

                    if (e?.code !== "missing_patient_identity") {
                        try {
                            const recovered = await recoverActivePatientIdentity();
                            if (recovered) {
                                return;
                            }
                        } catch (repairErr: any) {
                            console.error(`fullSync(${reason}) identity recovery failed:`, repairErr);
                        }
                    } else if (SYNC_ALLOW_HARD_RESET) {
                        // Optional development-only hard reset to fail closed on irreparable local identity state.
                        await store.del(K.SUBJECT_ID);
                        await store.del(K.PUBKEY_B64);
                        await store.del(K.SECKEY_B64);
                        await store.del(K.ACCESS_TOKEN);
                        await store.del(K.SUBJECT_REGISTERED);
                        await clearCursorV2(store, K);
                        await SecureStore.deleteItemAsync(TRANSPORT_KEY_SS).catch(() => {});
                        console.warn("fullSync: hard reset of local vault identity executed (EXPO_PUBLIC_SYNC_ALLOW_HARD_RESET=1)");
                    }
                    return;
                }

                // Log unexpected errors with full details
                console.error(`fullSync(${reason}) failed:`, e);
                if (e?.bodyText) {
                    console.error(`Server response body:`, e.bodyText);
                }
                if (e?.status) {
                    console.error(`HTTP status:`, e.status);
                }
            } finally {
                fullSyncRef.current = false;
            }
        },
        [libCfg, store, K, outbox, patientFhirStore, syncNow, applyPulledEvents, hasActivePatient, recoverActivePatientIdentity, handleActiveDeviceRevoked, shouldExitForLostActiveIdentity]
    );

    // Track previous patient to trigger the right full-sync reason.
    const prevPatientIdRef = useRef<string | null>(null);

    // After React re-renders with a newly active patient, run fullSync.
    // At this point all hooks have correct closures, so fhir:changed
    // events will trigger reloads with the correct activePatientId.
    useEffect(() => {
        const prevPatientId = prevPatientIdRef.current;

        if (!propActivePatientId) {
            prevPatientIdRef.current = null;
            return;
        }

        if (!prevPatientId) {
            prevPatientIdRef.current = propActivePatientId;
            fullSync('startup').catch(console.error);
            return;
        }

        if (prevPatientId !== propActivePatientId) {
            prevPatientIdRef.current = propActivePatientId;
            fullSync('patient switch').catch(console.error);
            return;
        }

        prevPatientIdRef.current = propActivePatientId;
    }, [propActivePatientId, fullSync]);

    /**
     * Central patient switch flow.
     * Ensures proper ordering: flush outbox → pause sync → switch identity → update scope.
     *
     * fullSync runs via useEffect (prevPatientIdRef) after React re-renders with the
     * new activePatientId. At that point all closures have fresh stores from useMemo.
     * PatientProvider key={activePatientId} forces UI remount — no manual cache
     * invalidation needed.
     */
    const switchToPatient = useCallback(
        async (patientId: string, selectActivePatient: (id: string) => Promise<void>) => {
            if (patientId === propActivePatientId) return;

            const identity = requirePatientIdentity(
                patientId,
                await getManagedPatientsStore().getFullIdentity(patientId)
            );
            await activateIdentity(identity, "switch");

            // Update scope (activePatientId) — triggers React re-render
            // → useMemo creates fresh stores
            // → PatientProvider key changes → UI remounts
            // → useEffect triggers fullSync('patient switch')
            await selectActivePatient(patientId);
        },
        [propActivePatientId, activateIdentity]
    );

    /**
     * Clear the active vault session for destructive flows.
     * Preserves TRANSPORT_KEY for managedPatientsStore recovery.
     */
    const clearVaultIdentity = useCallback(async () => {
        await store.del(K.SUBJECT_ID);
        await store.del(K.PUBKEY_B64);
        await store.del(K.SECKEY_B64);
        await store.del(K.ACCESS_TOKEN);
        await store.del(K.SUBJECT_REGISTERED);
        await clearCursorV2(store, K);
        setSyncHealth("healthy");
        setSyncBlockReason(null);
    }, [store, K]);

    // Register research donation service (listens for sync:completed)
    useEffect(() => {
        if (!donationTrackingStore || !patientPreferencesStore) return;

        const getSubjectId = async () => {
            return (await store.get(K.SUBJECT_ID)) ?? null;
        };

        const unsubscribe = registerDonationService({
            patientFhirStore,
            donationTrackingStore,
            patientPreferencesStore,
            getSubjectId,
        });

        return unsubscribe;
    }, [patientFhirStore, donationTrackingStore, patientPreferencesStore, store, K]);

    // Register supplier exchange service (listens for sync:completed)
    useEffect(() => {
        if (!isAssistiveAidsFeatureEnabled()) return;
        if (!patientPreferencesStore || !supplierExchangeStore || !propActivePatientId) return;

        const unsubscribe = registerSupplierExchangeService({
            patientPreferencesStore,
            supplierExchangeStore,
            patientId: propActivePatientId,
        });

        return unsubscribe;
    }, [patientPreferencesStore, supplierExchangeStore, propActivePatientId]);

    // Update lastSeenAt on current device after each successful sync
    useEffect(() => {
        if (!deviceAccessStore) return;

        const unsubscribe = on('sync:completed', async () => {
            try {
                const did = await store.get(K.DEVICE_ID);
                if (!did) return;
                const entry = await deviceAccessStore.getEntry(did);
                if (!entry) return;
                await deviceAccessStore.updateEntry(
                    did,
                    { lastSeenAt: new Date().toISOString() },
                    { triggerSync: false },
                );
            } catch {
                // Non-critical — ignore silently
            }
        });

        return unsubscribe;
    }, [deviceAccessStore, store, K]);

    // Sync when toggle switches from off to on
    const prevSyncEnabledRef = useRef<boolean | null>(null);

    useEffect(() => {
        if (prevSyncEnabledRef.current === null) {
            prevSyncEnabledRef.current = syncEnabled;
            return;
        }

        if (!prevSyncEnabledRef.current && syncEnabled && !isDemoMode()) {
            fullSync("sync enabled").catch(console.error);
        }

        prevSyncEnabledRef.current = syncEnabled;
    }, [syncEnabled, fullSync]);

    // Sync when network connectivity is restored
    const wasOnlineRef = useRef<boolean | null>(null);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            const isConnected = state.isConnected ?? false;

            if (wasOnlineRef.current === null) {
                wasOnlineRef.current = isConnected;
                return;
            }

            if (!wasOnlineRef.current && isConnected && syncEnabled && !isDemoMode()) {
                fullSync("network restored").catch(console.error);
            }

            wasOnlineRef.current = isConnected;
        });

        return () => unsubscribe();
    }, [syncEnabled, fullSync]);

    // Polling with exponential backoff - uses fullSync to flush outbox AND pull
    const pollingRef = useRef(false);

    useEffect(() => {
        if (!syncEnabled || isDemoMode() || !hasActivePatient) return;

        const BASE_INTERVAL_MS = 30000;  // 30s polling interval
        const MAX_INTERVAL_MS = 120000; // 2 min max bei Fehlern
        let currentIntervalMs = BASE_INTERVAL_MS;
        let consecutiveErrors = 0;
        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        async function tick() {
            if (pollingRef.current || cancelled) return;
            pollingRef.current = true;

            try {
                // Use fullSync to flush outbox (push) and then pull
                await fullSync("poll");
                if (cancelled) return;

                consecutiveErrors = 0;
                currentIntervalMs = BASE_INTERVAL_MS;
            } catch {
                consecutiveErrors++;
                currentIntervalMs = Math.min(BASE_INTERVAL_MS * Math.pow(2, consecutiveErrors), MAX_INTERVAL_MS);
            } finally {
                pollingRef.current = false;
                if (!cancelled) {
                    timeoutId = setTimeout(tick, currentIntervalMs);
                }
            }
        }

        tick();

        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [syncEnabled, fullSync, hasActivePatient]);

    const value = useMemo<AppSyncContextValue>(
        () => ({
            patientFhirStore,
            outbox,
            cfg,
            syncEnabled: syncEnabled && !isDemoMode(),
            setSyncEnabled,
            status,
            syncHealth,
            syncBlockReason,
            lastError,
            lastSyncAt,
            getOrCreateSubjectId,
            syncNow,
            fullSync,
            push,
            reset,
            deactivateCurrentDevice,
            deleteAccountOnServer,
            ensureDataSynced,
            switchPatientIdentity,
            activateIdentity,
            switchToPatient,
            probePatientAccess,
            recoverActivePatientIdentity,
            clearVaultIdentity,
        }),
        [
            patientFhirStore,
            outbox,
            cfg,
            syncEnabled,
            status,
            syncHealth,
            syncBlockReason,
            lastError,
            lastSyncAt,
            getOrCreateSubjectId,
            syncNow,
            fullSync,
            push,
            reset,
            deactivateCurrentDevice,
            deleteAccountOnServer,
            ensureDataSynced,
            switchPatientIdentity,
            activateIdentity,
            switchToPatient,
            probePatientAccess,
            recoverActivePatientIdentity,
            clearVaultIdentity
        ]
    );

    return (
        <AppSyncContext.Provider value={value}>
            <PatientStoresContext.Provider value={patientStores}>
                {children}
            </PatientStoresContext.Provider>
        </AppSyncContext.Provider>
    );
}

/**
 * Hook to access sync context. Must be used within AppSyncProvider.
 */
export function useAppSync() {
    const ctx = useContext(AppSyncContext);
    if (!ctx) throw new Error("useAppSync must be used inside <AppSyncProvider>");
    return ctx;
}
