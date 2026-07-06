/**
 * Medplum Care Server Client
 *
 * Connects to the care server (public studies/clinics data)
 * using client_credentials OAuth2 flow.
 */

import { MedplumClient } from '@medplum/core';

// In-memory storage for React Native (no localStorage)
class MemoryStorage {
    private data: Record<string, string> = {};
    clear(): void { this.data = {}; }
    getString(key: string): string | undefined { return this.data[key]; }
    setString(key: string, value: string | undefined): void {
        if (value === undefined) { delete this.data[key]; } else { this.data[key] = value; }
    }
    getObject<T>(key: string): T | undefined {
        const s = this.data[key];
        return s ? JSON.parse(s) : undefined;
    }
    setObject<T>(key: string, value: T): void {
        this.data[key] = JSON.stringify(value);
    }
}

let client: MedplumClient | null = null;
let authPromise: Promise<MedplumClient> | null = null;

/**
 * Get or create an authenticated MedplumClient for the care server.
 * Uses client_credentials flow — no user login needed.
 */
export async function getCareClient(): Promise<MedplumClient> {
    if (client) return client;
    if (authPromise) return authPromise;

    authPromise = initClient();
    try {
        client = await authPromise;
        return client;
    } finally {
        authPromise = null;
    }
}

async function initClient(): Promise<MedplumClient> {
    const baseUrl = process.env.EXPO_PUBLIC_CARE_BASE_URL;
    const clientId = process.env.EXPO_PUBLIC_CARE_CLIENT_ID;
    const clientSecret = process.env.EXPO_PUBLIC_CARE_CLIENT_SECRET;

    if (!baseUrl || !clientId || !clientSecret) {
        throw new Error(
            'Missing care server config. Set EXPO_PUBLIC_CARE_BASE_URL, ' +
            'EXPO_PUBLIC_CARE_CLIENT_ID, and EXPO_PUBLIC_CARE_CLIENT_SECRET in .env'
        );
    }

    const medplum = new MedplumClient({
        baseUrl,
        clientId,
        storage: new MemoryStorage(),
    });

    await medplum.startClientLogin(clientId, clientSecret);
    return medplum;
}

/** Reset client (e.g. on auth failure) */
export function resetCareClient(): void {
    client = null;
    authPromise = null;
}
