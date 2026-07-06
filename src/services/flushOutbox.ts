/**
 * Outbox flush service - resolves FHIR payloads and pushes to vault.
 * Wraps the library's flushOutbox with FHIR-specific payload resolution.
 */
import * as Crypto from "expo-crypto";
import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";
import * as SecureStore from "expo-secure-store";
import { sha256 } from "@noble/hashes/sha2.js";

import type { VaultConfig } from "@/src/lib/medical-sync-vault";
import type { Storage } from "@/src/lib/medical-sync-vault/storage/types";
import type { Keybag } from "@/src/lib/medical-sync-vault/storage/keybag";
import type { OutboxStore } from "@/src/lib/medical-sync-vault/outbox/types";
import type { EncryptedEnvelope, FlushResult } from "@/src/lib/medical-sync-vault/outbox/flush";
import { flushOutbox as libraryFlushOutbox } from "@/src/lib/medical-sync-vault/outbox/flush";
import { parseFhirOutboxPointer } from "@/src/stores/fhirOutbox";

// Configure tweetnacl PRNG for Expo/React Native
nacl.setPRNG((x, n) => {
    const bytes = Crypto.getRandomBytes(n);
    for (let i = 0; i < n; i++) x[i] = bytes[i];
});

const TRANSPORT_KEY_SS = "medical_sync_vault_transport_key_b64_v1";
const FLUSH_BATCH_SIZE = 200;
const MAX_FLUSH_BATCHES_PER_RUN = 25;

async function getOrCreateTransportKey(): Promise<Uint8Array> {
    const existing = await SecureStore.getItemAsync(TRANSPORT_KEY_SS);
    if (existing) {
        const key = decodeBase64(existing);
        if (key.length === nacl.secretbox.keyLength) {
            return key;
        }
    }

    const key = nacl.randomBytes(nacl.secretbox.keyLength);
    await SecureStore.setItemAsync(TRANSPORT_KEY_SS, encodeBase64(key), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return key;
}

function sha256B64(bytes: Uint8Array): string {
    return encodeBase64(sha256(bytes));
}

async function encryptPayload(payload: unknown): Promise<EncryptedEnvelope> {
    const key = await getOrCreateTransportKey();
    const json = JSON.stringify(payload);
    const msg = new TextEncoder().encode(json);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const box = nacl.secretbox(msg, nonce, key);

    return {
        alg: "nacl-secretbox-v1",
        nonce_b64: encodeBase64(nonce),
        ciphertext_b64: encodeBase64(box),
        ciphertext_hash_b64: sha256B64(box),
    };
}

type PatientFhirStoreReader = {
    get: (subjectId: string, type: string, id: string) => Promise<{ resource: unknown; deleted: boolean; updated_at: string } | null>;
};

export type FlushOutboxDeps = {
    cfg: VaultConfig;
    store: Storage;
    K: Keybag;
    outbox: OutboxStore;
    patientFhirStore: PatientFhirStoreReader;
};

/**
 * Flushes the FHIR outbox to the vault server.
 * Resolves pointers to FHIR resources, encrypts payloads, and pushes events.
 */
export async function flushOutbox(deps: FlushOutboxDeps): Promise<FlushResult> {
    const { cfg, store, K, outbox, patientFhirStore } = deps;

    const resolvePayloadRef = async (payload_ref: string): Promise<EncryptedEnvelope> => {
        const ptr = parseFhirOutboxPointer(payload_ref);
        let payload: unknown;

        if (ptr.op === "delete") {
            payload = {
                kind: "FHIR_PTR",
                op: "delete",
                resourceType: ptr.resource_type,
                id: ptr.resource_id,
                at: ptr.updated_at,
            };
        } else {
            // Use subject_id from the pointer to get the correct resource
            const got = await patientFhirStore.get(ptr.subject_id, ptr.resource_type, ptr.resource_id);

            if (!got || got.deleted) {
                payload = {
                    kind: "FHIR_PTR",
                    op: "delete",
                    resourceType: ptr.resource_type,
                    id: ptr.resource_id,
                    at: ptr.updated_at,
                };
            } else {
                payload = {
                    kind: "FHIR_RESOURCE",
                    op: "upsert",
                    resourceType: ptr.resource_type,
                    id: ptr.resource_id,
                    resource: got.resource,
                    at: got.updated_at,
                };
            }
        }

        return encryptPayload(payload);
    };

    const aggregate: FlushResult = {
        attempted: 0,
        sent: 0,
        failed: 0,
        ackedEventIds: [],
    };

    for (let i = 0; i < MAX_FLUSH_BATCHES_PER_RUN; i++) {
        const result = await libraryFlushOutbox(cfg, store, K, outbox, {
            batchSize: FLUSH_BATCH_SIZE,
            resolvePayloadRef,
        });

        aggregate.attempted += result.attempted;
        aggregate.sent += result.sent;
        aggregate.failed += result.failed;
        if (result.ackedEventIds?.length) {
            aggregate.ackedEventIds?.push(...result.ackedEventIds);
        }

        if (result.attempted < FLUSH_BATCH_SIZE) {
            break;
        }
    }

    if (!aggregate.ackedEventIds?.length) {
        delete aggregate.ackedEventIds;
    }

    return aggregate;
}
