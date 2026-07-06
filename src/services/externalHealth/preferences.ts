import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ExternalHealthImportPreferences } from './types';

const STORAGE_KEY = 'tenos_external_health_import_preferences_v1';

const DEFAULT_PREFS: ExternalHealthImportPreferences = {
    enabled: false,
    enabledMetricIds: [],
};

export async function getExternalHealthPreferences(): Promise<ExternalHealthImportPreferences> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;

    try {
        const parsed = JSON.parse(raw) as Partial<ExternalHealthImportPreferences>;
        return {
            enabled: parsed.enabled === true,
            enabledMetricIds: Array.isArray(parsed.enabledMetricIds) ? parsed.enabledMetricIds.filter((id): id is string => typeof id === 'string') : [],
            authorizedReadTypes: Array.isArray(parsed.authorizedReadTypes) ? parsed.authorizedReadTypes.filter((id): id is string => typeof id === 'string') : undefined,
            lastImportedAt: typeof parsed.lastImportedAt === 'string' ? parsed.lastImportedAt : undefined,
            lastObservedAtByMetricId: parseStringRecord(parsed.lastObservedAtByMetricId),
        };
    } catch {
        return DEFAULT_PREFS;
    }
}

export async function setExternalHealthPreferences(
    prefs: ExternalHealthImportPreferences
): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export async function clearExternalHealthPreferences(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
}

function parseStringRecord(value: unknown): Record<string, string> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const result: Record<string, string> = {};
    for (const [key, raw] of Object.entries(value)) {
        if (typeof raw === 'string') {
            result[key] = raw;
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
