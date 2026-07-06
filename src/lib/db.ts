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

async function getOrCreateDbKey(): Promise<string> {
    let key = await SecureStore.getItemAsync(DB_KEY_STORE);
    if (!key) {
        const bytes = Crypto.getRandomBytes(32);
        key = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        await SecureStore.setItemAsync(DB_KEY_STORE, key, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
    }
    return key;
}

// Cache: one DB instance per name
const _dbs = new Map<string, DB>();
let _keyPromise: Promise<string> | null = null;

export async function getDb(name = 'medical-data.db'): Promise<DB> {
    const existing = _dbs.get(name);
    if (existing) return existing;

    if (!_keyPromise) _keyPromise = getOrCreateDbKey();
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
