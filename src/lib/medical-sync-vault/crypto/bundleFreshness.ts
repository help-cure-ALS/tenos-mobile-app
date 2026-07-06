const DEFAULT_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_FUTURE_SKEW_MS = 2 * 60 * 1000; // 2 minutes

export type BundleFreshnessOptions = {
    maxAgeMs?: number;
    maxFutureSkewMs?: number;
    nowMs?: number;
};

/**
 * Checks whether a bundle timestamp is fresh enough to be accepted.
 * - rejects missing/invalid timestamps
 * - rejects timestamps too far in the future (clock skew guard)
 * - rejects expired timestamps
 */
export function validateBundleFreshness(createdAt: unknown, opts?: BundleFreshnessOptions): boolean {
    if (typeof createdAt !== "string" || createdAt.length < 8) {
        return false;
    }

    const ts = Date.parse(createdAt);
    if (!Number.isFinite(ts)) {
        return false;
    }

    const now = opts?.nowMs ?? Date.now();
    const maxAge = opts?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    const maxFutureSkew = opts?.maxFutureSkewMs ?? DEFAULT_MAX_FUTURE_SKEW_MS;

    if (ts > now + maxFutureSkew) {
        return false;
    }

    if (now - ts > maxAge) {
        return false;
    }

    return true;
}
