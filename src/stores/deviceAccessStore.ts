/**
 * DeviceAccessStore - Manages the list of devices with access to a subject's data.
 *
 * This data is stored encrypted and synced between all devices of a subject.
 * The vault server sees device IDs/status/capability (owner/read_write). The
 * fachliche display role (doctor/caregiver) and names are only in this encrypted list.
 *
 * T-002:
 * - Owner devices use the subject root identity.
 * - Caregiver/doctor devices use their own Ed25519 identity and receive only
 *   the transport_key via the rendezvous grant-wrap flow.
 * - This list carries the encrypted local display role/name only.
 *
 * When a patient revokes access:
 * 1. Disable the device server-side
 * 2. Tombstone the entry in this list
 *
 * SYNC: The list is synced as a FHIR Basic resource with code "device-access-list".
 */
import * as SecureStore from 'expo-secure-store';

function getDeviceAccessKey(patientId: string): string {
    return `device_access_list_v1_${patientId}`;
}

/** Resource type and ID used for syncing DeviceAccessList */
export const DEVICE_ACCESS_RESOURCE_TYPE = 'Basic';
// Fixed UUID for device-access-list (server requires UUID format for entity_id)
export const DEVICE_ACCESS_RESOURCE_ID = '00000000-0000-4000-a000-000000000001';
export const DEVICE_ACCESS_CODE = 'device-access-list';

export type DeviceRole = 'owner' | 'caregiver' | 'doctor';

export type DeviceAccessEntry = {
    /** The device ID */
    device_id: string;
    /** Role of this device */
    role: DeviceRole;
    /** Display name for this device/person */
    name: string;
    /** When this entry was added (ISO string) */
    addedAt: string;
    /** Last time this entry changed locally (ISO string) */
    updatedAt?: string;
    /** Tombstone timestamp. Removed entries stay in the synced list so deletes converge. */
    removedAt?: string;
    /** Which device added this entry */
    addedByDeviceId?: string;
    /** Device model name, e.g. "iPhone 15 Pro" */
    deviceModel?: string;
    /** Platform: ios or android */
    platform?: 'ios' | 'android';
    /** OS version, e.g. "18.2" */
    osVersion?: string;
    /** App version, e.g. "1.2.0" */
    appVersion?: string;
    /** Last time this device completed a sync (ISO string) */
    lastSeenAt?: string;
};

export type DeviceAccessList = {
    /** Version for future migrations */
    version: 1;
    /** List of device access entries */
    entries: DeviceAccessEntry[];
    /** Last updated timestamp */
    updatedAt: string;
};

/** Callback for syncing changes */
export type DeviceAccessSyncCallback = (list: DeviceAccessList) => Promise<void>;

export type DeviceAccessStore = {
    /** Get the full access list */
    getList(): Promise<DeviceAccessList>;

    /** Get a specific entry by device ID */
    getEntry(deviceId: string): Promise<DeviceAccessEntry | null>;

    /** Add a new device access entry */
    addEntry(entry: Omit<DeviceAccessEntry, 'addedAt'>): Promise<void>;

    /** Update an existing entry */
    updateEntry(
        deviceId: string,
        updates: Partial<Pick<DeviceAccessEntry, 'name' | 'role' | 'deviceModel' | 'platform' | 'osVersion' | 'appVersion' | 'lastSeenAt'>>,
        options?: { triggerSync?: boolean },
    ): Promise<void>;

    /** Remove a device access entry */
    removeEntry(deviceId: string): Promise<void>;

    /** Check if a device has access */
    hasAccess(deviceId: string): Promise<boolean>;

    /** Get all entries with a specific role */
    getEntriesByRole(role: DeviceRole): Promise<DeviceAccessEntry[]>;

    /** Clear all entries */
    clear(): Promise<void>;

    /** Import list (for sync - merges with existing entries) */
    importList(list: DeviceAccessList): Promise<void>;

    /** Export list (for sync) */
    exportList(): Promise<DeviceAccessList>;

    /** Set callback to be called when list changes (for sync) */
    setSyncCallback(callback: DeviceAccessSyncCallback | null): void;

    /** Convert list to FHIR Basic resource */
    toFhirResource(): Promise<any>;

    /** Import from FHIR Basic resource */
    fromFhirResource(resource: any): Promise<void>;
};

/**
 * Creates a device access store backed by SecureStore.
 * When patientId is provided, uses a per-patient SecureStore key.
 * Data arrives via FHIR sync — no local migration needed.
 */
export function createDeviceAccessStore(patientId: string): DeviceAccessStore {
    let syncCallback: DeviceAccessSyncCallback | null = null;
    const storageKey = getDeviceAccessKey(patientId);

    async function loadList(): Promise<DeviceAccessList> {
        try {
            const json = await SecureStore.getItemAsync(storageKey);
            if (!json) {
                return {
                    version: 1,
                    entries: [],
                    updatedAt: new Date().toISOString(),
                };
            }
            return JSON.parse(json) as DeviceAccessList;
        } catch {
            return {
                version: 1,
                entries: [],
                updatedAt: new Date().toISOString(),
            };
        }
    }

    function activeEntries(entries: DeviceAccessEntry[]): DeviceAccessEntry[] {
        return entries.filter((entry) => !entry.removedAt);
    }

    async function saveList(list: DeviceAccessList, triggerSync = true, touchList = true): Promise<void> {
        if (touchList) {
            list.updatedAt = new Date().toISOString();
        }
        await SecureStore.setItemAsync(storageKey, JSON.stringify(list), {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });

        // Trigger sync callback if set
        if (triggerSync && syncCallback) {
            try {
                await syncCallback(list);
            } catch (e) {
                console.warn('DeviceAccessStore sync callback failed:', e);
            }
        }
    }

    async function getList(): Promise<DeviceAccessList> {
        const list = await loadList();
        return {
            ...list,
            entries: activeEntries(list.entries),
        };
    }

    async function getEntry(deviceId: string): Promise<DeviceAccessEntry | null> {
        const list = await loadList();
        return list.entries.find((e) => e.device_id === deviceId && !e.removedAt) ?? null;
    }

    async function addEntry(entry: Omit<DeviceAccessEntry, 'addedAt'>): Promise<void> {
        const list = await loadList();
        const now = new Date().toISOString();

        const existingIndex = list.entries.findIndex((e) => e.device_id === entry.device_id);
        if (existingIndex !== -1) {
            // Device already registered — update role and metadata
            list.entries[existingIndex] = {
                ...list.entries[existingIndex],
                ...entry,
                addedAt: list.entries[existingIndex].addedAt, // keep original addedAt
                updatedAt: now,
                removedAt: undefined,
            };
            await saveList(list);
            return;
        }

        const newEntry: DeviceAccessEntry = {
            ...entry,
            addedAt: now,
            updatedAt: now,
        };

        list.entries.push(newEntry);
        await saveList(list);
    }

    async function updateEntry(
        deviceId: string,
        updates: Partial<Pick<DeviceAccessEntry, 'name' | 'role' | 'deviceModel' | 'platform' | 'osVersion' | 'appVersion' | 'lastSeenAt'>>,
        options?: { triggerSync?: boolean },
    ): Promise<void> {
        const list = await loadList();
        const index = list.entries.findIndex((e) => e.device_id === deviceId);

        if (index === -1) {
            throw new Error(`Device ${deviceId} not found`);
        }

        list.entries[index] = {
            ...list.entries[index],
            ...updates,
            updatedAt: new Date().toISOString(),
        };

        await saveList(list, options?.triggerSync ?? true);
    }

    async function removeEntry(deviceId: string): Promise<void> {
        const list = await loadList();
        const index = list.entries.findIndex((e) => e.device_id === deviceId);
        if (index === -1) {
            return;
        }
        const now = new Date().toISOString();
        list.entries[index] = {
            ...list.entries[index],
            updatedAt: now,
            removedAt: now,
        };
        await saveList(list);
    }

    async function hasAccess(deviceId: string): Promise<boolean> {
        const entry = await getEntry(deviceId);
        return entry !== null;
    }

    async function getEntriesByRole(role: DeviceRole): Promise<DeviceAccessEntry[]> {
        const list = await loadList();
        return list.entries.filter((e) => e.role === role && !e.removedAt);
    }

    async function clear(): Promise<void> {
        await SecureStore.deleteItemAsync(storageKey);
    }

    async function importList(list: DeviceAccessList): Promise<void> {
        const existing = await loadList();

        const merged = mergeAccessLists(existing, list);
        if (sameList(existing, merged)) {
            return;
        }

        await saveList(merged, false, false);
    }

    async function exportList(): Promise<DeviceAccessList> {
        return loadList();
    }

    function setSyncCallback(callback: DeviceAccessSyncCallback | null): void {
        syncCallback = callback;
    }

    async function toFhirResource(): Promise<any> {
        const list = await loadList();
        return {
            resourceType: DEVICE_ACCESS_RESOURCE_TYPE,
            id: DEVICE_ACCESS_RESOURCE_ID,
            meta: {
                lastUpdated: list.updatedAt,
            },
            code: {
                coding: [{
                    system: 'urn:medical-sync-vault',
                    code: DEVICE_ACCESS_CODE,
                }],
            },
            // Store the actual list in an extension
            extension: [{
                url: 'urn:medical-sync-vault:device-access-list',
                valueString: JSON.stringify(list),
            }],
        };
    }

    async function fromFhirResource(resource: any): Promise<void> {
        if (resource?.resourceType !== DEVICE_ACCESS_RESOURCE_TYPE) return;
        if (resource?.code?.coding?.[0]?.code !== DEVICE_ACCESS_CODE) return;

        const ext = resource.extension?.find(
            (e: any) => e.url === 'urn:medical-sync-vault:device-access-list'
        );
        if (!ext?.valueString) return;

        try {
            const list = JSON.parse(ext.valueString) as DeviceAccessList;
            await importList(list);
        } catch (e) {
            console.warn('Failed to parse DeviceAccessList from FHIR resource:', e);
        }
    }

    return {
        getList,
        getEntry,
        addEntry,
        updateEntry,
        removeEntry,
        hasAccess,
        getEntriesByRole,
        clear,
        importList,
        exportList,
        setSyncCallback,
        toFhirResource,
        fromFhirResource,
    };
}

function entryClock(entry: DeviceAccessEntry): number {
    return Math.max(
        new Date(entry.addedAt).getTime(),
        entry.updatedAt ? new Date(entry.updatedAt).getTime() : 0,
        entry.removedAt ? new Date(entry.removedAt).getTime() : 0,
    );
}

function mergeAccessLists(a: DeviceAccessList, b: DeviceAccessList): DeviceAccessList {
    const entriesMap = new Map<string, DeviceAccessEntry>();

    for (const entry of a.entries) {
        entriesMap.set(entry.device_id, entry);
    }

    for (const entry of b.entries) {
        const existing = entriesMap.get(entry.device_id);
        if (!existing || entryClock(entry) > entryClock(existing)) {
            entriesMap.set(entry.device_id, entry);
        }
    }

    return {
        version: 1,
        entries: Array.from(entriesMap.values()),
        updatedAt: new Date(Math.max(
            new Date(a.updatedAt).getTime(),
            new Date(b.updatedAt).getTime()
        )).toISOString(),
    };
}

function sameList(a: DeviceAccessList, b: DeviceAccessList): boolean {
    return JSON.stringify(a.entries) === JSON.stringify(b.entries)
        && a.updatedAt === b.updatedAt;
}

/** Delete per-patient data from SecureStore (for cleanup on patient removal) */
export async function deleteDeviceAccessData(patientId: string): Promise<void> {
    await SecureStore.deleteItemAsync(getDeviceAccessKey(patientId));
}
