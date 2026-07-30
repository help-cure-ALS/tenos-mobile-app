/**
 * App version gate — forces a store update when the installed native version
 * is below the server-defined minimum.
 *
 * Config source: GET {EXPO_PUBLIC_VAULT_BASE_URL}/app-config (Sync Vault,
 * unauthenticated). The last successful response is cached so the gate also
 * works offline. Fail-open by design: if the endpoint is unreachable and no
 * cache exists, the app starts normally — a patient must never be locked out
 * by a server problem.
 *
 * Compared is the NATIVE binary version. With EAS Update active,
 * Constants.expoConfig.version can diverge from the installed binary after
 * an OTA update, so we use Updates.runtimeVersion (equals the native app
 * version under the "appVersion" runtimeVersion policy) and fall back to
 * expoConfig.version only in dev, where no update runtime is embedded.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

const APP_CONFIG_CACHE_KEY = 'app_version_gate_config_v1';
const FETCH_TIMEOUT_MS = 5000;

export type AppConfig = {
    min_version: { ios: string | null; android: string | null };
    store_url: { ios: string | null; android: string | null };
};

export type VersionGateResult = {
    updateRequired: boolean;
    storeUrl: string | null;
};

/** Installed native binary version, or null when it cannot be determined. */
export function getInstalledNativeVersion(): string | null {
    // runtimeVersion policy is "appVersion", so this equals the binary version
    const runtimeVersion = Updates.runtimeVersion;
    if (typeof runtimeVersion === 'string' && runtimeVersion.length > 0) {
        return runtimeVersion;
    }
    return Constants.expoConfig?.version ?? null;
}

/**
 * Numeric segment-wise semver comparison ("1.2.10" > "1.2.9").
 * Returns negative when a < b, 0 when equal, positive when a > b.
 * Non-numeric segments count as 0.
 */
export function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map((s) => parseInt(s, 10) || 0);
    const pb = b.split('.').map((s) => parseInt(s, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0) {
            return diff;
        }
    }
    return 0;
}

function isValidConfig(value: unknown): value is AppConfig {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const config = value as Partial<AppConfig>;
    return typeof config.min_version === 'object' && config.min_version !== null
        && typeof config.store_url === 'object' && config.store_url !== null;
}

async function fetchAppConfig(): Promise<AppConfig | null> {
    const baseUrl = process.env.EXPO_PUBLIC_VAULT_BASE_URL?.trim();
    if (!baseUrl) {
        return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/app-config`, {
            signal: controller.signal,
        });
        if (!response.ok) {
            return null;
        }
        const json: unknown = await response.json();
        return isValidConfig(json) ? json : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

async function readCachedConfig(): Promise<AppConfig | null> {
    try {
        const raw = await SecureStore.getItemAsync(APP_CONFIG_CACHE_KEY);
        if (!raw) {
            return null;
        }
        const json: unknown = JSON.parse(raw);
        return isValidConfig(json) ? json : null;
    } catch {
        return null;
    }
}

async function writeCachedConfig(config: AppConfig): Promise<void> {
    try {
        await SecureStore.setItemAsync(APP_CONFIG_CACHE_KEY, JSON.stringify(config));
    } catch {
        // Cache is best-effort only
    }
}

function evaluate(config: AppConfig): VersionGateResult {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const minVersion = config.min_version[platform];
    const installed = getInstalledNativeVersion();

    // Fail-open: no minimum configured or unknown installed version
    if (!minVersion || !installed) {
        return { updateRequired: false, storeUrl: null };
    }

    return {
        updateRequired: compareVersions(installed, minVersion) < 0,
        storeUrl: config.store_url[platform],
    };
}

/**
 * Fetches the current config (falling back to the cached copy) and decides
 * whether the running binary must be updated via the store.
 */
export async function checkVersionGate(): Promise<VersionGateResult> {
    const fetched = await fetchAppConfig();
    if (fetched) {
        await writeCachedConfig(fetched);
        return evaluate(fetched);
    }

    const cached = await readCachedConfig();
    if (cached) {
        return evaluate(cached);
    }

    return { updateRequired: false, storeUrl: null };
}
