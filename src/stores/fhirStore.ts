// src/stores/fhirStore.ts
import { getDb, execAsync, runAsync, getAllAsync, getFirstAsync } from '@/src/lib/db';

export type StoredResourceRow = {
    resource_type: string;
    resource_id: string;
    updated_at: string; // ISO
    deleted: 0 | 1;
    resource_json: string;
};

export type FhirStore = {
    init(): Promise<void>;

    upsert(resourceType: string, resourceId: string, resource: any, updatedAt?: string): Promise<void>;
    markDeleted(resourceType: string, resourceId: string, updatedAt?: string): Promise<void>;

    get(
        resourceType: string,
        resourceId: string
    ): Promise<{ resource: any; updated_at: string; deleted: boolean } | null>;

    list(
        resourceType?: string,
        opts?: { includeDeleted?: boolean; limit?: number }
    ): Promise<Array<{ resource: any; updated_at: string; deleted: boolean }>>;

    rawStats(): Promise<{ total: number; deleted: number }>;

    clear(): Promise<void>;
};

const DEFAULT_DB = "medical-data.db";
const TABLE = "fhir_resources";

function nowIso() {
    return new Date().toISOString();
}

export function createFhirStore(opts?: { dbName?: string }): FhirStore {
    const dbName = opts?.dbName ?? DEFAULT_DB;

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
            CREATE TABLE IF NOT EXISTS ${TABLE} (
                resource_type TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted INTEGER NOT NULL DEFAULT 0,
                resource_json TEXT NOT NULL,
                PRIMARY KEY (resource_type, resource_id)
            );
        `);

        await execAsync(d, `CREATE INDEX IF NOT EXISTS ${TABLE}_updated_idx ON ${TABLE}(updated_at);`);
        await execAsync(d, `CREATE INDEX IF NOT EXISTS ${TABLE}_type_idx ON ${TABLE}(resource_type);`);
    }

    async function upsert(resourceType: string, resourceId: string, resource: any, updatedAt?: string) {
        await init();
        const d = await getDb(dbName);
        const ts = updatedAt ?? nowIso();
        const resourceJson = JSON.stringify(resource);

        await runAsync(d,
            `INSERT INTO ${TABLE} (resource_type, resource_id, updated_at, deleted, resource_json)
            VALUES (?, ?, ?, 0, ?)
            ON CONFLICT(resource_type, resource_id) DO UPDATE SET
                updated_at = excluded.updated_at,
                deleted = 0,
                resource_json = excluded.resource_json;`,
            [resourceType, resourceId, ts, resourceJson]
        );
    }

    async function markDeleted(resourceType: string, resourceId: string, updatedAt?: string) {
        await init();
        const d = await getDb(dbName);
        const ts = updatedAt ?? nowIso();

        await runAsync(d,
            `UPDATE ${TABLE} SET deleted = 1, updated_at = ?
            WHERE resource_type = ? AND resource_id = ?;`,
            [ts, resourceType, resourceId]
        );
    }

    async function get(resourceType: string, resourceId: string) {
        await init();
        const d = await getDb(dbName);

        const r = await getFirstAsync<StoredResourceRow>(d,
            `SELECT resource_type, resource_id, updated_at, deleted, resource_json
            FROM ${TABLE}
            WHERE resource_type = ? AND resource_id = ?;`,
            [resourceType, resourceId]
        );

        if (!r) return null;

        try {
            const resource = JSON.parse(r.resource_json);
            return { resource, updated_at: r.updated_at, deleted: !!r.deleted };
        } catch {
            return null;
        }
    }

    async function list(resourceType?: string, opts?: { includeDeleted?: boolean; limit?: number }) {
        await init();
        const d = await getDb(dbName);

        const includeDeleted = !!opts?.includeDeleted;
        const limit = Math.max(1, Math.min(5000, Math.floor(opts?.limit ?? 200)));

        const where: string[] = [];
        const params: any[] = [];

        if (resourceType) {
            where.push("resource_type = ?");
            params.push(resourceType);
        }
        if (!includeDeleted) {
            where.push("deleted = 0");
        }

        const sql = `
            SELECT resource_type, resource_id, updated_at, deleted, resource_json
            FROM ${TABLE} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
            ORDER BY updated_at DESC LIMIT ?;
        `;
        params.push(limit);

        const rows = await getAllAsync<StoredResourceRow>(d, sql, params);

        const out: Array<{ resource: any; updated_at: string; deleted: boolean }> = [];
        for (const r of rows) {
            try {
                const resource = JSON.parse(r.resource_json);
                out.push({ resource, updated_at: r.updated_at, deleted: !!r.deleted });
            } catch {
                continue;
            }
        }
        return out;
    }

    async function rawStats() {
        await init();
        const d = await getDb(dbName);

        const totalRow = await getFirstAsync<{ n: number }>(d, `SELECT COUNT(*) as n FROM ${TABLE};`);
        const delRow = await getFirstAsync<{ n: number }>(d, `SELECT COUNT(*) as n FROM ${TABLE} WHERE deleted = 1;`);

        return {
            total: Number(totalRow?.n ?? 0),
            deleted: Number(delRow?.n ?? 0),
        };
    }

    async function clear() {
        await init();
        const d = await getDb(dbName);
        await runAsync(d, `DELETE FROM ${TABLE};`, []);
    }

    return { init, upsert, markDeleted, get, list, rawStats, clear };
}
