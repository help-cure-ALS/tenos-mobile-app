/**
 * DB Adapter Layer - Thin wrapper around op-sqlite with SQLCipher encryption.
 *
 * Provides expo-sqlite-compatible async API surface so existing stores
 * can switch with minimal changes. The encryption key is stored in
 * SecureStore and auto-generated on first use.
 */
import { open, type DB } from '@op-engineering/op-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DB_KEY_STORE = 'hca_db_encryption_key_v1';

/**
 * Keychain reads can fail or come back empty transiently (cold start
 * before the first unlock, protected data briefly unavailable). A
 * failed read must NEVER mint a fresh key — that would permanently
 * lock us out of the existing database (SQLCipher then fails with
 * "hmac check failed", which surfaces as an out-of-memory error and
 * used to trigger the destructive OOM reset). So: retry on errors,
 * and rethrow instead of falling through to key creation.
 */
async function readKeyWithRetry(): Promise<string | null> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await SecureStore.getItemAsync(DB_KEY_STORE);
        } catch (e) {
            lastErr = e;
            await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
        }
    }
    throw lastErr;
}

async function getOrCreateDbKey(): Promise<string> {
    let key = await readKeyWithRetry();
    if (!key) {
        // Double-read before minting: a single flaky null must not
        // rotate the key under an existing database.
        key = await readKeyWithRetry();
    }
    if (!key) {
        const bytes = Crypto.getRandomBytes(32);
        const fresh = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        await SecureStore.setItemAsync(DB_KEY_STORE, fresh, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        // Read back: if a concurrent caller won the race, use the
        // persisted key so all opens share one key.
        key = (await readKeyWithRetry()) ?? fresh;
    }
    return key;
}

// Cache: one DB instance per name
const _dbs = new Map<string, DB>();
let _keyPromise: Promise<string> | null = null;

export async function getDb(name = 'medical-data.db'): Promise<DB> {
    const existing = _dbs.get(name);
    if (existing) return existing;

    if (!_keyPromise) {
        // Reset on failure so the next call retries instead of
        // rejecting forever on a cached failed promise.
        _keyPromise = getOrCreateDbKey().catch((e) => {
            _keyPromise = null;
            throw e;
        });
    }
    const key = await _keyPromise;

    const db = open({ name, encryptionKey: key });

    // ── Memory & WAL limits ──────────────────────────────────────
    // Set BEFORE any schema/data queries to prevent OOM on large databases.
    // cache_size = -2000 → ~2 MB page cache (negative = kibibytes).
    // journal_size_limit caps the WAL file so it cannot grow unbounded
    // (main cause of OOM on developer devices after prolonged use).
    try { db.executeSync('PRAGMA cache_size = -2000;'); } catch {}
    try { db.executeSync('PRAGMA journal_size_limit = 6291456;'); } catch {}

    _dbs.set(name, db);
    return db;
}

/**
 * Close and remove a cached DB instance.
 * Used for error recovery (e.g. OOM during init).
 */
export function closeDb(name = 'medical-data.db'): void {
    const db = _dbs.get(name);
    if (!db) return;
    try { db.close(); } catch {}
    _dbs.delete(name);
}

// Wrapper functions using executeSync (JSI, runs on JS thread → no locking issues)

export async function execAsync(db: DB, sql: string): Promise<void> {
    db.executeSync(sql);
}

export async function runAsync(db: DB, sql: string, params: any[]): Promise<void> {
    db.executeSync(sql, params as any);
}

export async function getAllAsync<T>(db: DB, sql: string, params: any[] = []): Promise<T[]> {
    const result = db.executeSync(sql, params as any);
    return (result.rows ?? []) as T[];
}

export async function getFirstAsync<T>(db: DB, sql: string, params: any[] = []): Promise<T | null> {
    const result = db.executeSync(sql, params as any);
    return (result.rows?.[0] as T) ?? null;
}
