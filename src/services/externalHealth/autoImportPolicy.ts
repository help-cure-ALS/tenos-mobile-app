import type { ExternalHealthAvailability } from './types';

export const EXTERNAL_HEALTH_AUTO_IMPORT_DELAY_MS = 15_000;
export const EXTERNAL_HEALTH_AUTO_IMPORT_COOLDOWN_MS = 6 * 60 * 60_000;

export type ExternalHealthAutoImportState = {
    canUseHealthImport: boolean;
    availability: ExternalHealthAvailability;
    enabled: boolean;
    selectedMetricCount: number;
    isLoading: boolean;
    isSyncing: boolean;
    lastImportedAt?: string;
    lastAutoAttemptAtMs?: number;
};

export function shouldRunExternalHealthAutoImport(
    state: ExternalHealthAutoImportState,
    nowMs = Date.now()
): boolean {
    if (!state.canUseHealthImport) return false;
    if (state.availability !== 'available') return false;
    if (!state.enabled) return false;
    if (state.selectedMetricCount <= 0) return false;
    if (state.isLoading || state.isSyncing) return false;
    if (isWithinCooldown(state.lastAutoAttemptAtMs, nowMs)) return false;
    if (isWithinCooldown(parseTimestampMs(state.lastImportedAt), nowMs)) return false;
    return true;
}

function isWithinCooldown(timestampMs: number | undefined, nowMs: number): boolean {
    return typeof timestampMs === 'number' &&
        Number.isFinite(timestampMs) &&
        nowMs - timestampMs < EXTERNAL_HEALTH_AUTO_IMPORT_COOLDOWN_MS;
}

function parseTimestampMs(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? undefined : timestamp;
}
