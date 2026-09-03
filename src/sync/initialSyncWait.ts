/**
 * Shared wait state for the initial data sync after linking a patient —
 * used by the patient pairing screen (onboarding/patient/scan) and the
 * caregiver/doctor managed-link flow.
 *
 * Module scope on purpose: activating a patient remounts the whole
 * navigator (PatientBoundary tenant key), which wipes component state
 * mid-flow. The freshly mounted screen instance reads the pending flag to
 * keep showing its sync-wait UI instead of falling back to the entry step.
 * Applies ONLY to first-time linking — regular patient switches must never
 * block on a sync cycle.
 */
import { on } from '@/src/lib/bus';

// INACTIVITY timeout: how long to wait WITHOUT any sync progress before
// giving up (fail-open: never trap the user). Every applied page
// ('sync:progress') re-arms the timer, so large initial syncs can take as
// long as they need while making progress.
export const INITIAL_SYNC_INACTIVITY_MS = 45_000;

let pending = false;

/** Arm the wait BEFORE the active patient is set (remount trigger). */
export function beginInitialSyncWait(): void {
    pending = true;
}

/** Drop the wait (error paths). */
export function clearInitialSyncWait(): void {
    pending = false;
}

/** True when a link flow is waiting for its initial sync. */
export function isInitialSyncWaitPending(): boolean {
    return pending;
}

/**
 * Claim the follow-up navigation exactly once. Both waiters — the original
 * flow closure (which survives the remount) and the remounted screen
 * instance — race on this; only the winner navigates.
 */
export function claimInitialSyncNavigation(): boolean {
    if (!pending) return false;
    pending = false;
    return true;
}

/**
 * Resolves when the next full sync cycle completes ('sync:completed' on the
 * app bus), or after a period of INACTIVITY — 'sync:progress' (emitted per
 * applied page) re-arms the timer. Subscribe BEFORE the sync is expected to
 * start so a fast sync cannot slip through unnoticed.
 */
export function waitForInitialSync(inactivityMs = INITIAL_SYNC_INACTIVITY_MS): Promise<void> {
    return new Promise((resolve) => {
        let timer: ReturnType<typeof setTimeout> | null = null;

        const finish = () => {
            if (timer) clearTimeout(timer);
            offCompleted();
            offProgress();
            resolve();
        };
        const armTimer = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(finish, inactivityMs);
        };

        const offCompleted = on('sync:completed', finish);
        const offProgress = on('sync:progress', armTimer);
        armTimer();
    });
}
