/**
 * PatientFhirStore - A patient-aware FHIR store that supports multi-patient scenarios.
 *
 * Key differences from the basic fhirStore:
 * - Each resource is associated with a subject_id (patient ID)
 * - Queries can be filtered by subject_id
 *
 * Storage: op-sqlite + SQLCipher (AES-256 full-DB encryption).
 * NaCl column-level encryption is no longer needed for local data.
 * NaCl remains for vault transport (server communication).
 */
import { getDb, closeDb, execAsync, runAsync, getAllAsync, getFirstAsync } from '@/src/lib/db';

export type StoredResourceRowV2 = {
    subject_id: string;
    resource_type: string;
    resource_id: string;
    updated_at: string;
    deleted: 0 | 1;
    resource_json: string;
};

export type PatientFhirStore = {
    init(): Promise<void>;

    /**
     * Upsert a resource for a specific patient.
     * @param tag - Optional tag for SQL-level filtering (e.g. 'q:alsfrs-r')
     */
    upsert(
        subjectId: string,
        resourceType: string,
        resourceId: string,
        resource: any,
        updatedAt?: string,
        tag?: string | null
    ): Promise<void>;

    /**
     * Mark a resource as deleted.
     */
    markDeleted(
        subjectId: string,
        resourceType: string,
        resourceId: string,
        updatedAt?: string
    ): Promise<void>;

    /**
     * Get a specific resource.
     */
    get(
        subjectId: string,
        resourceType: string,
        resourceId: string
    ): Promise<{ resource: any; updated_at: string; deleted: boolean } | null>;

    /**
     * List resources for a specific patient.
     */
    list(
        subjectId: string,
        resourceType?: string,
        opts?: {
            includeDeleted?: boolean;
            limit?: number;
            tag?: string;
            metricTag?: string;
            fromDate?: string;
            toDate?: string;
            source?: string;
            orderBy?: 'updated_at' | 'effective_date';
        }
    ): Promise<Array<{ resource: any; updated_at: string; deleted: boolean }>>;

    /**
     * Count resources for a specific patient without decrypting/parsing resource_json.
     */
    count(
        subjectId: string,
        resourceType?: string,
        opts?: {
            includeDeleted?: boolean;
            tag?: string;
            metricTag?: string;
            fromDate?: string;
            toDate?: string;
            source?: string;
        }
    ): Promise<number>;

    /**
     * List resources across all accessible patients (for caregivers/doctors).
     * @param subjectIds - Array of patient IDs to include
     */
    listMultiple(
        subjectIds: string[],
        resourceType?: string,
        opts?: { includeDeleted?: boolean; limit?: number }
    ): Promise<Array<{ subjectId: string; resource: any; updated_at: string; deleted: boolean }>>;

    /**
     * Get raw stats for a specific patient.
     */
    rawStats(subjectId?: string): Promise<{ total: number; deleted: number }>;

    /**
     * Clear all resources for a specific patient.
     */
    clearForPatient(subjectId: string): Promise<void>;

    /**
     * Clear all resources.
     */
    clear(): Promise<void>;

    /**
     * Migrate data from old fhirStore (without subject_id) to new format.
     * This assigns all existing data to the specified patient.
     */
    migrateFromLegacy(subjectId: string): Promise<number>;

    /**
     * List all resources for export (no limit, no paging).
     * Supports optional tag/metricTag/tagPrefix filters.
     */
    listForExport(
        subjectId: string,
        resourceType: string,
        opts?: { tag?: string; metricTag?: string; tagPrefix?: string }
    ): Promise<Array<{ resource: any; updated_at: string; deleted: boolean }>>;

    /**
     * Backfill tags for existing untagged Observation/QuestionnaireResponse rows.
     * Reads each row, checks for questionnaire-id extension, and sets the tag.
     */
    backfillTags(subjectId: string): Promise<number>;

    /**
     * Backfill effective_date and source for existing rows where these columns are NULL.
     * Reads each row and extracts metadata.
     */
    backfillMetadata(subjectId: string): Promise<number>;

    /**
     * Backfill metric_tag for all Observations that don't have one.
     * Reads each row, detects LOINC code, and stores metric_tag.
     */
    backfillMetricTags(subjectId: string): Promise<number>;
};

const DEFAULT_DB = 'medical-data.db';
const TABLE = 'fhir_resources_v2';
const LEGACY_TABLE = 'fhir_resources';
const QUESTIONNAIRE_ID_EXT_URL = 'urn:medical-sync-vault:questionnaire-id';

/** Auto-detect tag from resource extensions if not explicitly provided */
function detectTag(resource: any): string | null {
    const ext = resource?.meta?.extension;
    if (!Array.isArray(ext)) return null;
    const qExt = ext.find((e: any) => e?.url === QUESTIONNAIRE_ID_EXT_URL);
    if (qExt?.valueString) return `q:${qExt.valueString}`;
    return null;
}

/** Detect LOINC/metric code from Observation resource */
function detectMetricTag(resource: any): string | null {
    if (resource?.resourceType !== 'Observation') return null;
    const coding = resource?.code?.coding;
    if (!Array.isArray(coding) || coding.length === 0) return null;
    const c = coding[0];
    if (!c?.system || !c?.code) return null;
    return `${c.system}|${c.code}`;
}

/** Extract effective date from a FHIR resource */
function detectEffectiveDate(resource: any): string | null {
    return resource?.effectiveDateTime
        ?? resource?.effectivePeriod?.start
        ?? resource?.meta?.lastUpdated
        ?? null;
}

/** Extract source/device display from a FHIR resource */
function detectSource(resource: any): string | null {
    return resource?.device?.display ?? null;
}

function nowIso() {
    return new Date().toISOString();
}

export function createPatientFhirStore(opts?: { dbName?: string }): PatientFhirStore {
    const dbName = opts?.dbName ?? DEFAULT_DB;

    let initPromise: Promise<void> | null = null;

    async function init(): Promise<void> {
        if (!initPromise) {
            initPromise = doInit().catch((e) => {
                initPromise = null; // allow retry on next call
                throw e;
            });
        }
        return initPromise;
    }

    async function doInit(): Promise<void> {
        try {
            await doInitSchema();
        } catch (e: any) {
            const msg = String(e?.message ?? '');
            if (!msg.includes('out of memory')) throw e;

            // OOM recovery: close DB, reopen (memory limits from getDb apply),
            // try WAL checkpoint, then retry schema creation.
            console.warn('patientFhirStore: OOM during init — attempting recovery');
            closeDb(dbName);

            const d2 = await getDb(dbName);
            try { await execAsync(d2, 'PRAGMA wal_checkpoint(TRUNCATE);'); } catch {}

            try {
                await doInitSchema();
            } catch (_retryErr: any) {
                // If still OOM, delete the database entirely and start fresh.
                // Data will be re-synced from the server on next fullSync.
                console.error('patientFhirStore: OOM recovery failed — resetting database');
                try {
                    const d3 = await getDb(dbName);
                    d3.delete();
                } catch {}
                closeDb(dbName);
                // Re-create from scratch
                await doInitSchema();
            }
        }
    }

    async function doInitSchema(): Promise<void> {
        const d = await getDb(dbName);

        try {
            await execAsync(d, 'PRAGMA journal_mode=WAL;');
        } catch {}

        // Checkpoint and truncate WAL on startup to prevent OOM from large WAL files.
        // On developer devices the WAL can grow very large between app restarts.
        try {
            await execAsync(d, 'PRAGMA wal_checkpoint(TRUNCATE);');
        } catch {}

        await execAsync(d, `
            CREATE TABLE IF NOT EXISTS ${TABLE} (
                subject_id TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted INTEGER NOT NULL DEFAULT 0,
                resource_json TEXT NOT NULL,
                tag TEXT DEFAULT NULL,
                metric_tag TEXT DEFAULT NULL,
                effective_date TEXT DEFAULT NULL,
                source TEXT DEFAULT NULL,
                PRIMARY KEY (subject_id, resource_type, resource_id)
            );
        `);

        await execAsync(d, `CREATE INDEX IF NOT EXISTS ${TABLE}_subject_idx ON ${TABLE}(subject_id);`);
        await execAsync(d, `CREATE INDEX IF NOT EXISTS ${TABLE}_updated_idx ON ${TABLE}(updated_at);`);
        await execAsync(d, `CREATE INDEX IF NOT EXISTS ${TABLE}_type_idx ON ${TABLE}(resource_type);`);
        await execAsync(d, `CREATE INDEX IF NOT EXISTS ${TABLE}_tag_idx ON ${TABLE}(subject_id, resource_type, tag);`);
        await execAsync(d, `CREATE INDEX IF NOT EXISTS ${TABLE}_effective_idx ON ${TABLE}(subject_id, resource_type, effective_date);`);
        await execAsync(d, `CREATE INDEX IF NOT EXISTS ${TABLE}_source_idx ON ${TABLE}(subject_id, resource_type, source);`);
        await execAsync(d, `CREATE INDEX IF NOT EXISTS ${TABLE}_metric_tag_idx ON ${TABLE}(subject_id, resource_type, metric_tag);`);
    }

    async function upsert(
        subjectId: string,
        resourceType: string,
        resourceId: string,
        resource: any,
        updatedAt?: string,
        tag?: string | null
    ): Promise<void> {
        await init();
        const d = await getDb(dbName);
        const ts = updatedAt ?? nowIso();
        const resolvedTag = tag !== undefined ? tag : detectTag(resource);
        const metricTag = detectMetricTag(resource);
        const effectiveDate = detectEffectiveDate(resource);
        const source = detectSource(resource);
        const resourceJson = JSON.stringify(resource);

        await runAsync(d,
            `INSERT INTO ${TABLE} (subject_id, resource_type, resource_id, updated_at, deleted,
                resource_json, tag, metric_tag, effective_date, source)
            VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
            ON CONFLICT(subject_id, resource_type, resource_id) DO UPDATE SET
                updated_at = excluded.updated_at,
                deleted = 0,
                resource_json = excluded.resource_json,
                tag = excluded.tag,
                metric_tag = excluded.metric_tag,
                effective_date = excluded.effective_date,
                source = excluded.source;`,
            [subjectId, resourceType, resourceId, ts, resourceJson,
             resolvedTag, metricTag, effectiveDate, source]
        );
    }

    async function markDeleted(
        subjectId: string,
        resourceType: string,
        resourceId: string,
        updatedAt?: string
    ): Promise<void> {
        await init();
        const d = await getDb(dbName);
        const ts = updatedAt ?? nowIso();

        await runAsync(d,
            `UPDATE ${TABLE}
            SET deleted = 1, updated_at = ?
            WHERE subject_id = ? AND resource_type = ? AND resource_id = ?;`,
            [ts, subjectId, resourceType, resourceId]
        );
    }

    async function get(
        subjectId: string,
        resourceType: string,
        resourceId: string
    ): Promise<{ resource: any; updated_at: string; deleted: boolean } | null> {
        await init();
        const d = await getDb(dbName);

        const r = await getFirstAsync<StoredResourceRowV2>(d,
            `SELECT subject_id, resource_type, resource_id, updated_at, deleted, resource_json
            FROM ${TABLE}
            WHERE subject_id = ? AND resource_type = ? AND resource_id = ?;`,
            [subjectId, resourceType, resourceId]
        );

        if (!r) return null;

        try {
            const resource = JSON.parse(r.resource_json);
            return { resource, updated_at: r.updated_at, deleted: !!r.deleted };
        } catch {
            return null;
        }
    }

    async function list(
        subjectId: string,
        resourceType?: string,
        opts?: {
            includeDeleted?: boolean;
            limit?: number;
            tag?: string;
            metricTag?: string;
            fromDate?: string;
            toDate?: string;
            source?: string;
            orderBy?: 'updated_at' | 'effective_date';
        }
    ): Promise<Array<{ resource: any; updated_at: string; deleted: boolean }>> {
        await init();
        const d = await getDb(dbName);

        const includeDeleted = !!opts?.includeDeleted;
        const limit = Math.max(1, Math.min(5000, Math.floor(opts?.limit ?? 200)));

        const where: string[] = ['subject_id = ?'];
        const params: any[] = [subjectId];

        if (resourceType) {
            where.push('resource_type = ?');
            params.push(resourceType);
        }
        if (!includeDeleted) {
            where.push('deleted = 0');
        }
        if (opts?.tag) {
            where.push('tag = ?');
            params.push(opts.tag);
        }
        if (opts?.metricTag) {
            where.push('metric_tag = ?');
            params.push(opts.metricTag);
        }
        if (opts?.fromDate) {
            where.push('effective_date >= ?');
            params.push(opts.fromDate);
        }
        if (opts?.toDate) {
            where.push('effective_date <= ?');
            params.push(opts.toDate);
        }
        if (opts?.source) {
            where.push('source = ?');
            params.push(opts.source);
        }

        const orderExpr = opts?.orderBy === 'effective_date' ? 'COALESCE(effective_date, updated_at)' : 'updated_at';

        const sql = `
            SELECT subject_id, resource_type, resource_id, updated_at, deleted, resource_json
            FROM ${TABLE}
            WHERE ${where.join(' AND ')}
            ORDER BY ${orderExpr} DESC
            LIMIT ?;
        `;
        params.push(limit);

        const rows = await getAllAsync<StoredResourceRowV2>(d, sql, params);

        const out: Array<{ resource: any; updated_at: string; deleted: boolean }> = [];
        for (const r of rows) {
            try {
                const resource = JSON.parse(r.resource_json);
                out.push({ resource, updated_at: r.updated_at, deleted: !!r.deleted });
            } catch {
                // Skip corrupt rows
            }
        }
        return out;
    }

    async function count(
        subjectId: string,
        resourceType?: string,
        opts?: {
            includeDeleted?: boolean;
            tag?: string;
            metricTag?: string;
            fromDate?: string;
            toDate?: string;
            source?: string;
        }
    ): Promise<number> {
        await init();
        const d = await getDb(dbName);

        const includeDeleted = !!opts?.includeDeleted;
        const where: string[] = ['subject_id = ?'];
        const params: any[] = [subjectId];

        if (resourceType) {
            where.push('resource_type = ?');
            params.push(resourceType);
        }
        if (!includeDeleted) {
            where.push('deleted = 0');
        }
        if (opts?.tag) {
            where.push('tag = ?');
            params.push(opts.tag);
        }
        if (opts?.metricTag) {
            where.push('metric_tag = ?');
            params.push(opts.metricTag);
        }
        if (opts?.fromDate) {
            where.push('effective_date >= ?');
            params.push(opts.fromDate);
        }
        if (opts?.toDate) {
            where.push('effective_date <= ?');
            params.push(opts.toDate);
        }
        if (opts?.source) {
            where.push('source = ?');
            params.push(opts.source);
        }

        const row = await getFirstAsync<{ n: number }>(
            d,
            `SELECT COUNT(*) AS n
            FROM ${TABLE}
            WHERE ${where.join(' AND ')};`,
            params
        );

        return row?.n ?? 0;
    }

    async function listForExport(
        subjectId: string,
        resourceType: string,
        opts?: { tag?: string; metricTag?: string; tagPrefix?: string }
    ): Promise<Array<{ resource: any; updated_at: string; deleted: boolean }>> {
        await init();
        const d = await getDb(dbName);

        const where: string[] = ['subject_id = ?', 'resource_type = ?', 'deleted = 0'];
        const params: any[] = [subjectId, resourceType];

        if (opts?.tag) {
            where.push('tag = ?');
            params.push(opts.tag);
        }
        if (opts?.metricTag) {
            where.push('metric_tag = ?');
            params.push(opts.metricTag);
        }
        if (opts?.tagPrefix) {
            where.push('tag LIKE ?');
            params.push(`${opts.tagPrefix}%`);
        }

        const sql = `
            SELECT resource_type, resource_id, updated_at, deleted, resource_json
            FROM ${TABLE}
            WHERE ${where.join(' AND ')}
            ORDER BY updated_at DESC;
        `;
        const rows = await getAllAsync<StoredResourceRowV2>(d, sql, params);

        const out: Array<{ resource: any; updated_at: string; deleted: boolean }> = [];
        for (const r of rows) {
            try {
                out.push({ resource: JSON.parse(r.resource_json), updated_at: r.updated_at, deleted: false });
            } catch { /* skip corrupt */ }
        }
        return out;
    }

    async function listMultiple(
        subjectIds: string[],
        resourceType?: string,
        opts?: { includeDeleted?: boolean; limit?: number }
    ): Promise<Array<{ subjectId: string; resource: any; updated_at: string; deleted: boolean }>> {
        if (!subjectIds.length) return [];

        await init();
        const d = await getDb(dbName);

        const includeDeleted = !!opts?.includeDeleted;
        const limit = Math.max(1, Math.min(5000, Math.floor(opts?.limit ?? 200)));

        const placeholders = subjectIds.map(() => '?').join(', ');
        const where: string[] = [`subject_id IN (${placeholders})`];
        const params: any[] = [...subjectIds];

        if (resourceType) {
            where.push('resource_type = ?');
            params.push(resourceType);
        }
        if (!includeDeleted) {
            where.push('deleted = 0');
        }

        const sql = `
            SELECT subject_id, resource_type, resource_id, updated_at, deleted, resource_json
            FROM ${TABLE}
            WHERE ${where.join(' AND ')}
            ORDER BY updated_at DESC
            LIMIT ?;
        `;
        params.push(limit);

        const rows = await getAllAsync<StoredResourceRowV2>(d, sql, params);

        const out: Array<{ subjectId: string; resource: any; updated_at: string; deleted: boolean }> = [];
        for (const r of rows) {
            try {
                const resource = JSON.parse(r.resource_json);
                out.push({
                    subjectId: r.subject_id,
                    resource,
                    updated_at: r.updated_at,
                    deleted: !!r.deleted,
                });
            } catch {
                // Skip corrupt rows
            }
        }
        return out;
    }

    async function rawStats(subjectId?: string): Promise<{ total: number; deleted: number }> {
        await init();
        const d = await getDb(dbName);

        const totalRow = await getFirstAsync<{ n: number }>(d,
            subjectId
                ? `SELECT COUNT(*) as n FROM ${TABLE} WHERE subject_id = ?`
                : `SELECT COUNT(*) as n FROM ${TABLE}`,
            subjectId ? [subjectId] : []
        );
        const delRow = await getFirstAsync<{ n: number }>(d,
            subjectId
                ? `SELECT COUNT(*) as n FROM ${TABLE} WHERE deleted = 1 AND subject_id = ?`
                : `SELECT COUNT(*) as n FROM ${TABLE} WHERE deleted = 1`,
            subjectId ? [subjectId] : []
        );

        return {
            total: Number(totalRow?.n ?? 0),
            deleted: Number(delRow?.n ?? 0),
        };
    }

    async function clearForPatient(subjectId: string): Promise<void> {
        await init();
        const d = await getDb(dbName);
        await runAsync(d, `DELETE FROM ${TABLE} WHERE subject_id = ?;`, [subjectId]);
    }

    async function clear(): Promise<void> {
        await init();
        const d = await getDb(dbName);
        await runAsync(d, `DELETE FROM ${TABLE};`, []);
    }

    async function migrateFromLegacy(subjectId: string): Promise<number> {
        await init();
        const d = await getDb(dbName);

        const tableExists = await getFirstAsync<{ name: string }>(d,
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
            [LEGACY_TABLE]
        );

        if (!tableExists) return 0;

        const rows = await getAllAsync<{
            resource_type: string;
            resource_id: string;
            updated_at: string;
            deleted: number;
            resource_json: string;
        }>(d, `SELECT * FROM ${LEGACY_TABLE};`);

        if (!rows?.length) return 0;

        let migrated = 0;
        for (const row of rows) {
            try {
                await runAsync(d,
                    `INSERT OR IGNORE INTO ${TABLE}
                    (subject_id, resource_type, resource_id, updated_at, deleted, resource_json)
                    VALUES (?, ?, ?, ?, ?, ?);`,
                    [subjectId, row.resource_type, row.resource_id, row.updated_at, row.deleted, row.resource_json]
                );
                migrated++;
            } catch (e) {
                console.warn('Failed to migrate row:', e);
            }
        }

        return migrated;
    }

    async function backfillTags(subjectId: string): Promise<number> {
        await init();
        const d = await getDb(dbName);

        const countRow = await getFirstAsync<{ n: number }>(d,
            `SELECT COUNT(*) as n FROM ${TABLE}
             WHERE subject_id = ? AND tag IS NULL
             AND resource_type IN ('Observation', 'QuestionnaireResponse')`,
            [subjectId]
        );
        if (!countRow || countRow.n === 0) return 0;

        const rows = await getAllAsync<StoredResourceRowV2>(d,
            `SELECT subject_id, resource_type, resource_id, updated_at, deleted, resource_json
             FROM ${TABLE}
             WHERE subject_id = ? AND tag IS NULL
             AND resource_type IN ('Observation', 'QuestionnaireResponse')`,
            [subjectId]
        );

        const updates: Array<[string, string, string, string]> = [];
        for (const r of rows) {
            try {
                const resource = JSON.parse(r.resource_json);
                const tag = detectTag(resource);
                if (!tag) continue;
                updates.push([tag, subjectId, r.resource_type, r.resource_id]);
            } catch {
                continue;
            }
        }

        if (updates.length === 0) return 0;

        // Batch updates to prevent WAL from growing too large (OOM risk)
        const BATCH = 500;
        for (let i = 0; i < updates.length; i += BATCH) {
            const batch = updates.slice(i, i + BATCH);
            await execAsync(d, 'BEGIN TRANSACTION');
            try {
                for (const params of batch) {
                    await runAsync(d,
                        `UPDATE ${TABLE} SET tag = ?
                         WHERE subject_id = ? AND resource_type = ? AND resource_id = ?`,
                        params
                    );
                }
                await execAsync(d, 'COMMIT');
            } catch (e) {
                await execAsync(d, 'ROLLBACK');
                throw e;
            }
        }

        return updates.length;
    }

    const _backfilledMetadata = new Set<string>();

    async function backfillMetadata(subjectId: string): Promise<number> {
        if (_backfilledMetadata.has(subjectId)) return 0;
        _backfilledMetadata.add(subjectId);

        await init();
        const d = await getDb(dbName);

        const countRow = await getFirstAsync<{ n: number }>(d,
            `SELECT COUNT(*) as n FROM ${TABLE}
             WHERE subject_id = ? AND effective_date IS NULL
             AND resource_type IN ('Observation', 'QuestionnaireResponse', 'MedicationAdministration')`,
            [subjectId]
        );
        if (!countRow || countRow.n === 0) return 0;

        const rows = await getAllAsync<StoredResourceRowV2>(d,
            `SELECT subject_id, resource_type, resource_id, updated_at, deleted, resource_json
             FROM ${TABLE}
             WHERE subject_id = ? AND effective_date IS NULL
             AND resource_type IN ('Observation', 'QuestionnaireResponse', 'MedicationAdministration')`,
            [subjectId]
        );

        const updates: Array<[string | null, string | null, string, string, string]> = [];
        for (const r of rows) {
            try {
                const resource = JSON.parse(r.resource_json);
                const effDate = detectEffectiveDate(resource);
                const src = detectSource(resource);
                if (!effDate && !src) continue;
                updates.push([effDate, src, subjectId, r.resource_type, r.resource_id]);
            } catch {
                continue;
            }
        }

        if (updates.length === 0) return 0;

        const BATCH = 500;
        for (let i = 0; i < updates.length; i += BATCH) {
            const batch = updates.slice(i, i + BATCH);
            await execAsync(d, 'BEGIN TRANSACTION');
            try {
                for (const params of batch) {
                    await runAsync(d,
                        `UPDATE ${TABLE} SET effective_date = ?, source = ?
                         WHERE subject_id = ? AND resource_type = ? AND resource_id = ?`,
                        params
                    );
                }
                await execAsync(d, 'COMMIT');
            } catch (e) {
                await execAsync(d, 'ROLLBACK');
                throw e;
            }
        }

        return updates.length;
    }

    async function backfillMetricTags(subjectId: string): Promise<number> {
        await init();
        const d = await getDb(dbName);

        const rows = await getAllAsync<StoredResourceRowV2>(d,
            `SELECT subject_id, resource_type, resource_id, updated_at, deleted, resource_json
             FROM ${TABLE}
             WHERE subject_id = ? AND metric_tag IS NULL AND resource_type = 'Observation'`,
            [subjectId]
        );

        if (!rows || rows.length === 0) return 0;

        const updates: Array<[string, string, string, string]> = [];
        for (const r of rows) {
            try {
                const resource = JSON.parse(r.resource_json);
                const metricTag = detectMetricTag(resource);
                if (!metricTag) continue;
                updates.push([metricTag, subjectId, r.resource_type, r.resource_id]);
            } catch {
                continue;
            }
        }

        if (updates.length === 0) return 0;

        const BATCH = 500;
        for (let i = 0; i < updates.length; i += BATCH) {
            const batch = updates.slice(i, i + BATCH);
            await execAsync(d, 'BEGIN TRANSACTION');
            try {
                for (const params of batch) {
                    await runAsync(d,
                        `UPDATE ${TABLE} SET metric_tag = ?
                         WHERE subject_id = ? AND resource_type = ? AND resource_id = ?`,
                        params
                    );
                }
                await execAsync(d, 'COMMIT');
            } catch (e) {
                await execAsync(d, 'ROLLBACK');
                throw e;
            }
        }

        return updates.length;
    }

    return {
        init,
        upsert,
        markDeleted,
        get,
        list,
        count,
        listForExport,
        listMultiple,
        rawStats,
        clearForPatient,
        clear,
        migrateFromLegacy,
        backfillTags,
        backfillMetadata,
        backfillMetricTags,
    };
}

// Singleton instance
let _store: PatientFhirStore | null = null;

export function getPatientFhirStore(): PatientFhirStore {
    if (!_store) {
        _store = createPatientFhirStore();
    }
    return _store;
}
