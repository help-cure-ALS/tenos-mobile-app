/**
 * FHIR Outbox Store - SQLite-based outbox for FHIR resource sync.
 * Implements the OutboxStore interface from medical-sync-vault library.
 */
import { getDb, execAsync, runAsync, getAllAsync, getFirstAsync } from '@/src/lib/db';
import type { OutboxStore, OutboxRecord, OutboxPointer, OutboxOpKind } from "@/src/lib/medical-sync-vault/outbox/types";

export type FhirPointerOp = "upsert" | "delete";

/** FHIR-specific pointer data stored as JSON in payload_ref column. */
export type FhirOutboxPointer = {
    event_id: string;
    op: FhirPointerOp;
    /** Subject ID (patient) this resource belongs to */
    subject_id: string;
    resource_type: string;
    resource_id: string;
    updated_at: string;
};

const DEFAULT_DB = "medical-data.db";
const TABLE_DEFAULT = "fhir_outbox_v3";

function toOpKind(op: FhirPointerOp): OutboxOpKind {
    return op === "delete" ? "delete" : "upsert";
}

/**
 * Creates an OutboxStore conforming to the library interface.
 * Stores FHIR metadata in payload_ref as JSON-encoded FhirOutboxPointer.
 */
export function createFhirPointerOutbox(opts?: { dbName?: string; tableName?: string }): OutboxStore {
    const dbName = opts?.dbName ?? DEFAULT_DB;
    const table = opts?.tableName ?? TABLE_DEFAULT;

    let initPromise: Promise<void> | null = null;

    async function init(): Promise<void> {
        if (!initPromise) {
            initPromise = doInit();
        }
        return initPromise;
    }

    async function doInit(): Promise<void> {
        const d = await getDb(dbName);

        try {
            await execAsync(d, "PRAGMA journal_mode=WAL;");
        } catch {}

        // Checkpoint WAL on startup to prevent unbounded growth → OOM
        try {
            await execAsync(d, 'PRAGMA wal_checkpoint(TRUNCATE);');
        } catch {}

        await execAsync(d, `
            CREATE TABLE IF NOT EXISTS ${table} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL UNIQUE,
                dedupe_key TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                op_kind TEXT NOT NULL,
                local_rev INTEGER NOT NULL DEFAULT 0,
                payload_ref TEXT NOT NULL,
                created_at TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT
            );
        `);

        await execAsync(d, `CREATE INDEX IF NOT EXISTS ${table}_created_at_idx ON ${table}(created_at);`);
        await execAsync(d, `CREATE UNIQUE INDEX IF NOT EXISTS ${table}_dedupe_idx ON ${table}(dedupe_key);`);

        // Migrate v2 → v3 (preserve pending entries with updated dedupe_key)
        try {
            const oldRows = await getAllAsync<{
                event_id: string;
                entity_type: string;
                entity_id: string;
                op_kind: string;
                local_rev: number;
                payload_ref: string;
                created_at: string;
                attempts: number;
                last_error: string | null;
            }>(d, `SELECT * FROM fhir_outbox_v2;`);

            let failedMigrations = 0;
            for (const row of oldRows) {
                let subjectId = '';
                try {
                    const ptr = JSON.parse(row.payload_ref) as FhirOutboxPointer;
                    subjectId = ptr.subject_id ?? '';
                } catch {
                    console.warn(`fhirOutbox migration: malformed payload_ref for event ${row.event_id}, using empty subject_id`);
                }

                const dedupeKey = `${subjectId}:${row.entity_type}:${row.entity_id}`;
                try {
                    await runAsync(d,
                        `INSERT OR IGNORE INTO ${table}
                            (event_id, dedupe_key, entity_type, entity_id, op_kind,
                             local_rev, payload_ref, created_at, attempts, last_error)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                        [row.event_id, dedupeKey, row.entity_type, row.entity_id, row.op_kind,
                         row.local_rev, row.payload_ref, row.created_at, row.attempts, row.last_error]
                    );
                } catch (insertErr) {
                    failedMigrations += 1;
                    console.error(`fhirOutbox migration: failed to migrate event ${row.event_id}:`, insertErr);
                }
            }

            if (failedMigrations === 0) {
                await execAsync(d, `DROP TABLE IF EXISTS fhir_outbox_v2;`);
            } else {
                console.error(
                    `fhirOutbox migration: ${failedMigrations} events failed to migrate, keeping fhir_outbox_v2 for recovery`
                );
            }
        } catch {
            // v2 table doesn't exist — nothing to migrate
        }
    }

    async function enqueue(items: OutboxPointer[]) {
        if (!items?.length) return;
        await init();
        const d = await getDb(dbName);
        const now = new Date().toISOString();

        for (const p of items) {
            let eventId: string;
            let subjectId: string | undefined;
            try {
                const ptr = JSON.parse(p.payload_ref) as FhirOutboxPointer;
                eventId = ptr.event_id;
                subjectId = ptr.subject_id;
            } catch {
                eventId = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            }

            const dedupeKey = subjectId
                ? `${subjectId}:${p.entity_type}:${p.entity_id}`
                : `${p.entity_type}:${p.entity_id}`;

            await runAsync(d,
                `INSERT INTO ${table} (event_id, dedupe_key, entity_type, entity_id, op_kind, local_rev, payload_ref, created_at, attempts, last_error)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
                ON CONFLICT(dedupe_key) DO UPDATE SET
                    event_id = excluded.event_id,
                    op_kind = excluded.op_kind,
                    local_rev = excluded.local_rev,
                    payload_ref = excluded.payload_ref,
                    created_at = excluded.created_at,
                    attempts = 0,
                    last_error = NULL;`,
                [eventId, dedupeKey, p.entity_type, p.entity_id, p.op_kind, p.local_rev, p.payload_ref, now]
            );
        }
    }

    async function peek(limit: number): Promise<OutboxRecord[]> {
        await init();
        const d = await getDb(dbName);
        const lim = Math.max(1, Math.min(5000, Math.floor(limit)));

        const rows = await getAllAsync<{
            id: number;
            event_id: string;
            dedupe_key: string;
            entity_type: string;
            entity_id: string;
            op_kind: string;
            local_rev: number;
            payload_ref: string;
            created_at: string;
            attempts: number;
            last_error: string | null;
        }>(d,
            `SELECT id, event_id, dedupe_key, entity_type, entity_id, op_kind, local_rev, payload_ref, created_at, attempts, last_error
             FROM ${table}
             ORDER BY id ASC
             LIMIT ?;`,
            [lim]
        );

        return rows.map((r) => ({
            id: r.id,
            event_id: r.event_id,
            dedupe_key: r.dedupe_key,
            entity_type: r.entity_type,
            entity_id: r.entity_id,
            op_kind: r.op_kind as OutboxOpKind,
            local_rev: r.local_rev,
            payload_ref: r.payload_ref,
            created_at: r.created_at,
            attempts: r.attempts,
            last_error: r.last_error,
        }));
    }

    async function markSent(ids: number[]) {
        if (!ids?.length) return;
        await init();
        const d = await getDb(dbName);

        const chunkSize = 300;
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const placeholders = chunk.map(() => "?").join(",");
            await runAsync(d, `DELETE FROM ${table} WHERE id IN (${placeholders});`, chunk);
        }
    }

    async function markFailed(ids: number[], error: string) {
        if (!ids?.length) return;
        await init();
        const d = await getDb(dbName);

        const err = String(error ?? "unknown_error").slice(0, 2000);
        const chunkSize = 200;

        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const placeholders = chunk.map(() => "?").join(",");
            await runAsync(d, `UPDATE ${table} SET attempts = attempts + 1, last_error = ? WHERE id IN (${placeholders});`, [err, ...chunk]);
        }
    }

    async function stats() {
        await init();
        const d = await getDb(dbName);
        const row = await getFirstAsync<{ n: number }>(d, `SELECT COUNT(*) as n FROM ${table};`);
        return { pending: Number(row?.n ?? 0) };
    }

    async function clear() {
        await init();
        const d = await getDb(dbName);
        await runAsync(d, `DELETE FROM ${table};`, []);
    }

    /** Clear entries that have failed multiple times */
    async function clearFailed(minAttempts = 3) {
        await init();
        const d = await getDb(dbName);
        await runAsync(d, `DELETE FROM ${table} WHERE attempts >= ?;`, [minAttempts]);
    }

    return { init, enqueue, peek, markSent, markFailed, stats, clear, clearFailed };
}

export async function clearFhirOutboxForPatient(
    patientId: string,
    opts?: { dbName?: string; tableName?: string },
): Promise<void> {
    const dbName = opts?.dbName ?? DEFAULT_DB;
    const table = opts?.tableName ?? TABLE_DEFAULT;

    const outbox = createFhirPointerOutbox({ dbName, tableName: table });
    await outbox.init();

    const d = await getDb(dbName);
    const rows = await getAllAsync<{ id: number; dedupe_key: string; payload_ref: string }>(d,
        `SELECT id, dedupe_key, payload_ref FROM ${table};`);

    const ids = rows
        .filter((row) => {
            if (String(row.dedupe_key).startsWith(`${patientId}:`)) {
                return true;
            }
            try {
                return (JSON.parse(row.payload_ref) as Partial<FhirOutboxPointer>).subject_id === patientId;
            } catch {
                return false;
            }
        })
        .map((row) => Number(row.id))
        .filter((id) => Number.isFinite(id));

    const chunkSize = 300;
    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => "?").join(",");
        await runAsync(d, `DELETE FROM ${table} WHERE id IN (${placeholders});`, chunk);
    }
}

/** Creates an OutboxPointer with FHIR metadata in payload_ref. */
export function createFhirOutboxPointer(ptr: FhirOutboxPointer): OutboxPointer {
    return {
        entity_type: ptr.resource_type,
        entity_id: ptr.resource_id,
        op_kind: toOpKind(ptr.op),
        local_rev: Date.now(),
        payload_ref: JSON.stringify(ptr),
    };
}

/** Parses payload_ref back to FhirOutboxPointer. */
export function parseFhirOutboxPointer(payload_ref: string): FhirOutboxPointer {
    return JSON.parse(payload_ref) as FhirOutboxPointer;
}
