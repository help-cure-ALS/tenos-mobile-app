export type OutboxOpKind = "create" | "update" | "delete" | "upsert";

/**
 * Minimal "pointer" payload that references the real data in your local store.
 *
 * Examples:
 * - payload_ref: "fhir://Observation/123"
 * - payload_ref: "sqlite:fhir_resources:Observation:123"
 * - payload_ref: "file://.../encrypted.blob"
 *
 * The Outbox NEVER stores medical/FHIR payload data itself.
 */
export type OutboxPointer = {
    entity_type: string;   // e.g. "FHIR/Observation"
    entity_id: string;     // e.g. "123"
    op_kind: OutboxOpKind; // create/update/delete/upsert
    local_rev: number;     // monotonically increasing local revision/version
    payload_ref: string;   // pointer to encrypted local data
};

export type OutboxRecord = {
    /** SQLite row id (stable identifier for marking sent/failed). */
    id: number;

    /** Stable event id (persisted) for idempotent retries. */
    event_id: string;

    /** Convenience key for dedupe (entity_type + ":" + entity_id). */
    dedupe_key: string;

    entity_type: string;
    entity_id: string;
    op_kind: OutboxOpKind;

    local_rev: number;
    payload_ref: string;

    created_at: string; // ISO
    attempts: number;
    last_error?: string | null;
};

export type OutboxStats = {
    pending: number;
};

export type OutboxStore = {
    /** Ensure DB + table exist (idempotent). Call once on startup. */
    init(): Promise<void>;

    /**
     * Insert one or many pointers.
     *
     * DEDUPE behavior:
     * - unique per (entity_type, entity_id)
     * - on conflict, it REPLACES the row with the newest pointer
     * - event_id is replaced too (because the “latest change” supersedes previous unsent change)
     * - attempts resets to 0 and last_error clears
     */
    enqueue(items: OutboxPointer[]): Promise<void>;

    /** Get the oldest pending outbox records (does not remove). */
    peek(limit: number): Promise<OutboxRecord[]>;

    /** Remove records that were successfully sent (by row id). */
    markSent(ids: number[]): Promise<void>;

    /** Increment attempts + store last_error for troubleshooting (by row id). */
    markFailed(ids: number[], error: string): Promise<void>;

    /** Delete everything in the outbox. */
    clear(): Promise<void>;

    /** Delete entries that have failed multiple times. */
    clearFailed?(minAttempts?: number): Promise<void>;

    /** Lightweight stats for UI. */
    stats(): Promise<OutboxStats>;
};
