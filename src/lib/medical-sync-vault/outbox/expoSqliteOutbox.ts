import { getDb, execAsync, runAsync, getAllAsync } from '@/src/lib/db';
import * as Crypto from "expo-crypto";
import type { OutboxPointer, OutboxRecord, OutboxStats, OutboxStore } from "./types";

/**
 * op-sqlite-based outbox for POINTERS (references), not payloads.
 *
 * Stores only:
 * - entity_type, entity_id, op_kind
 * - local_rev (version in local DB)
 * - payload_ref (pointer to encrypted local data)
 *
 * Dedupe:
 * - one row per (entity_type, entity_id) via dedupe_key UNIQUE
 * - new enqueue replaces previous entry (collapses many updates into one)
 *
 * Retry-safe:
 * - each outbox row has a persisted event_id for idempotent retries
 */

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

function makeDedupeKey(entity_type: string, entity_id: string): string {
    return `${entity_type}:${entity_id}`;
}

async function ensureColumn(dbName: string, table: string, columnName: string, columnSql: string): Promise<void> {
    const db = await getDb(dbName);
    const rows = await getAllAsync<{ name: string }>(db, `PRAGMA table_info(${table});`);
    const has = rows.some((r) => String(r.name) === columnName);
    if (has) return;
    await runAsync(db, `ALTER TABLE ${table} ADD COLUMN ${columnSql};`, []);
}

export function createExpoSQLiteOutbox(opts?: { dbName?: string; tableName?: string }): OutboxStore {
    const dbName = opts?.dbName ?? "medical-sync-vault.db";
    const table = opts?.tableName ?? "vault_outbox";

    let inited = false;

    async function init(): Promise<void> {
        if (inited) return;

        const db = await getDb(dbName);

        try {
            await execAsync(db, "PRAGMA journal_mode=WAL;");
        } catch {}

        // Checkpoint WAL on startup to prevent unbounded growth → OOM
        try {
            await execAsync(db, 'PRAGMA wal_checkpoint(TRUNCATE);');
        } catch {}

        await runAsync(db,
            `CREATE TABLE IF NOT EXISTS ${table} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dedupe_key TEXT NOT NULL UNIQUE,
                event_id TEXT,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                op_kind TEXT NOT NULL,
                local_rev INTEGER NOT NULL,
                payload_ref TEXT NOT NULL,
                created_at TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT
            );`, []);

        await runAsync(db, `CREATE INDEX IF NOT EXISTS ${table}_created_at_idx ON ${table}(created_at);`, []);
        await runAsync(db, `CREATE INDEX IF NOT EXISTS ${table}_dedupe_idx ON ${table}(dedupe_key);`, []);

        // Migration: ensure event_id exists (older DBs)
        await ensureColumn(dbName, table, "event_id", "event_id TEXT");

        // Backfill NULL/empty event_id (best effort)
        const ids = await getAllAsync<{ id: number }>(db,
            `SELECT id FROM ${table} WHERE event_id IS NULL OR event_id = '';`);
        if (ids.length) {
            for (const batch of chunk(ids, 200)) {
                for (const r of batch) {
                    await runAsync(db,
                        `UPDATE ${table} SET event_id = ? WHERE id = ?;`,
                        [Crypto.randomUUID(), Number(r.id)]);
                }
            }
        }

        inited = true;
    }

    async function enqueue(items: OutboxPointer[]): Promise<void> {
        if (!items?.length) return;
        await init();

        const db = await getDb(dbName);
        const now = new Date().toISOString();

        for (const batch of chunk(items, 200)) {
            for (const it of batch) {
                const dedupe_key = makeDedupeKey(it.entity_type, it.entity_id);
                const event_id = Crypto.randomUUID();

                await runAsync(db,
                    `INSERT INTO ${table} (dedupe_key, event_id, entity_type, entity_id, op_kind, local_rev, payload_ref, created_at, attempts, last_error)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
                    ON CONFLICT(dedupe_key) DO UPDATE SET
                        event_id = excluded.event_id,
                        op_kind = excluded.op_kind,
                        local_rev = excluded.local_rev,
                        payload_ref = excluded.payload_ref,
                        created_at = excluded.created_at,
                        attempts = 0,
                        last_error = NULL;`,
                    [dedupe_key, event_id, it.entity_type, it.entity_id, it.op_kind,
                     Math.floor(it.local_rev ?? 0), String(it.payload_ref ?? ""), now]
                );
            }
        }
    }

    async function peek(limit: number): Promise<OutboxRecord[]> {
        await init();
        const db = await getDb(dbName);
        const lim = Math.max(1, Math.min(5000, Math.floor(limit)));

        const rows = await getAllAsync<any>(db,
            `SELECT id, dedupe_key, event_id, entity_type, entity_id, op_kind, local_rev, payload_ref, created_at, attempts, last_error
             FROM ${table}
             ORDER BY id ASC LIMIT ?;`,
            [lim]
        );

        return rows.map((r) => ({
            id: Number(r.id),
            dedupe_key: String(r.dedupe_key),
            event_id: String(r.event_id ?? ""),
            entity_type: String(r.entity_type),
            entity_id: String(r.entity_id),
            op_kind: r.op_kind as any,
            local_rev: Number(r.local_rev ?? 0),
            payload_ref: String(r.payload_ref),
            created_at: String(r.created_at),
            attempts: Number(r.attempts ?? 0),
            last_error: r.last_error ?? null
        }));
    }

    async function markSent(ids: number[]): Promise<void> {
        if (!ids?.length) return;
        await init();
        const db = await getDb(dbName);

        for (const batch of chunk(ids, 500)) {
            const placeholders = batch.map(() => "?").join(",");
            await runAsync(db, `DELETE FROM ${table} WHERE id IN (${placeholders});`, batch);
        }
    }

    async function markFailed(ids: number[], error: string): Promise<void> {
        if (!ids?.length) return;
        await init();
        const db = await getDb(dbName);

        const err = String(error ?? "unknown_error").slice(0, 2000);

        for (const batch of chunk(ids, 300)) {
            const placeholders = batch.map(() => "?").join(",");
            await runAsync(db,
                `UPDATE ${table} SET attempts = attempts + 1, last_error = ? WHERE id IN (${placeholders});`,
                [err, ...batch]);
        }
    }

    async function clear(): Promise<void> {
        await init();
        const db = await getDb(dbName);
        await runAsync(db, `DELETE FROM ${table};`, []);
    }

    async function stats(): Promise<OutboxStats> {
        await init();
        const db = await getDb(dbName);
        const rows = await getAllAsync<{ n: number }>(db, `SELECT COUNT(*) as n FROM ${table};`);
        const n = rows?.[0]?.n ?? 0;
        return { pending: Number(n) };
    }

    return { init, enqueue, peek, markSent, markFailed, clear, stats };
}
