import type { VaultConfig, VaultEvent } from "../types";
import type { Storage } from "../storage/types";
import type { Keybag } from "../storage/keybag";
import { pushEvents } from "../api/events";
import { VaultError } from "../errors";
import type { OutboxRecord, OutboxStore } from "./types";

/**
 * A resolved payload for the VaultEvent body.
 *
 * Option A (recommended in your case):
 * - your app stores encrypted payload already
 * - resolvePayloadRef returns exactly this envelope
 */
export type EncryptedEnvelope = {
    alg: string;
    nonce_b64: string;
    ciphertext_b64: string;
    ciphertext_hash_b64: string;
};

/**
 * If you want maximum flexibility, provide toVaultEvent().
 * Otherwise, return an EncryptedEnvelope and we build a VaultEvent using defaults.
 */
export type FlushOptions = {
    batchSize?: number;

    /**
     * Resolve the pointer to an already-encrypted payload envelope.
     * This must NOT return plaintext medical data.
     */
    resolvePayloadRef: (payload_ref: string) => Promise<EncryptedEnvelope>;

    /**
     * Optional override to build a VaultEvent.
     * If omitted, we build a standard VaultEvent with:
     * - event_id from OutboxRecord.event_id
     * - entity_type/entity_id/op_kind taken from outbox
     * - device_id must be resolvable from your Storage+Keybag (K.DEVICE_ID)
     */
    toVaultEvent?: (args: {
        record: OutboxRecord;
        device_id: string;
        envelope: EncryptedEnvelope;
        lamport: number;
        client_created_at: string;
    }) => Promise<VaultEvent> | VaultEvent;

    /**
     * Lamport generator (optional). If omitted, Date.now() is used.
     * If you want stronger ordering, keep a lamport counter in your app DB.
     */
    nextLamport?: () => number;
};

export type FlushResult = {
    attempted: number;
    sent: number;
    failed: number;
    ackedEventIds?: string[];
};

function nowIso() {
    return new Date().toISOString();
}

function toServerOpKind(op: string): "create" | "update" | "delete" {
    if (op === "delete") return "delete";
    if (op === "create") return "create";
    // "upsert" and "update" both map to "update"
    return "update";
}

function asServerEntityId(value: string): string | undefined {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
        ? value
        : undefined;
}

function safeMsg(e: any): string {
    return e?.message ?? String(e);
}

/**
 * Flushes up to batchSize records from outbox to server.
 *
 * - Uses server-side idempotency via event_id (stable per outbox row).
 * - On success: removes only those records that were acked (if server provides acked list)
 *   otherwise removes all attempted.
 * - On failure: increments attempts + stores last_error for ALL attempted records.
 */
export async function flushOutbox(
    cfg: VaultConfig,
    store: Storage,
    K: Keybag,
    outbox: OutboxStore,
    opts: FlushOptions
): Promise<FlushResult> {
    const batchSize = Math.max(1, Math.min(5000, Math.floor(opts.batchSize ?? 250)));

    await outbox.init();
    const records = await outbox.peek(batchSize);

    if (!records.length) {
        return { attempted: 0, sent: 0, failed: 0 };
    }

    // We require device_id to build VaultEvent
    const device_id = await store.get(K.DEVICE_ID);
    if (!device_id) {
        // This is not a server error; it’s a local setup error.
        // It also means we should not mark all as failed permanently; but for now we mark failed.
        const err = new VaultError("server_error", "missing_device_id");
        await outbox.markFailed(records.map((r) => r.id), err.message);
        throw err;
    }

    const nextLamport = opts.nextLamport ?? (() => Date.now());

    try {
        const events: VaultEvent[] = [];

        for (const r of records) {
            const envelope = await opts.resolvePayloadRef(r.payload_ref);

            const lamport = nextLamport();
            const client_created_at = nowIso();

            if (opts.toVaultEvent) {
                const ev = await opts.toVaultEvent({ record: r, device_id, envelope, lamport, client_created_at });
                events.push(ev);
            } else {
                // Default mapping:
                // - store encrypted envelope as ciphertext fields
                // - keep metadata from outbox
                events.push({
                    event_id: r.event_id,
                    device_id,

                    lamport,
                    device_seq: undefined,

                    entity_type: r.entity_type,
                    entity_id: asServerEntityId(r.entity_id),
                    op_kind: toServerOpKind(r.op_kind),

                    client_created_at,

                    alg: envelope.alg,
                    nonce_b64: envelope.nonce_b64,
                    ciphertext_b64: envelope.ciphertext_b64,
                    ciphertext_hash_b64: envelope.ciphertext_hash_b64
                });
            }
        }

        const res = await pushEvents(cfg, store, K, events);

        // Prefer acked list if present (server supports it)
        const acked = (res as any)?.acked as string[] | undefined;

        if (acked?.length) {
            const ackedSet = new Set(acked);
            const sentIds = records.filter((r) => ackedSet.has(r.event_id)).map((r) => r.id);
            const failedIds = records.filter((r) => !ackedSet.has(r.event_id)).map((r) => r.id);

            if (sentIds.length) await outbox.markSent(sentIds);
            if (failedIds.length) await outbox.markFailed(failedIds, "not_acked");

            return {
                attempted: records.length,
                sent: sentIds.length,
                failed: failedIds.length,
                ackedEventIds: acked
            };
        }

        // If no ack list, treat whole batch as success
        await outbox.markSent(records.map((r) => r.id));
        return { attempted: records.length, sent: records.length, failed: 0 };
    } catch (e: any) {
        const msg = safeMsg(e);
        await outbox.markFailed(records.map((r) => r.id), msg);
        throw e;
    }
}
