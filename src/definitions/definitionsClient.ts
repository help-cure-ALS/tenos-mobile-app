import { MedplumClient } from '@medplum/core';

class MemoryStorage {
    private data: Record<string, string> = {};
    clear(): void { this.data = {}; }
    getString(key: string): string | undefined { return this.data[key]; }
    setString(key: string, value: string | undefined): void {
        if (value === undefined) {
            delete this.data[key];
        } else {
            this.data[key] = value;
        }
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

export async function getDefinitionsClient(): Promise<MedplumClient> {
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
    const baseUrl = process.env.EXPO_PUBLIC_RESEARCH_BASE_URL;
    const clientId = process.env.EXPO_PUBLIC_RESEARCH_CLIENT_ID;
    const clientSecret = process.env.EXPO_PUBLIC_RESEARCH_CLIENT_SECRET;

    if (!baseUrl || !clientId || !clientSecret) {
        throw new Error(
            'Missing research server config. Set EXPO_PUBLIC_RESEARCH_BASE_URL, ' +
            'EXPO_PUBLIC_RESEARCH_CLIENT_ID, and EXPO_PUBLIC_RESEARCH_CLIENT_SECRET in .env'
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

export function resetDefinitionsClient(): void {
    client = null;
    authPromise = null;
}
