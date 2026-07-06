/**
 * Module-level filter that tracks logged medication doses.
 *
 * The global notification handler (set outside React) cannot access the
 * MedicationsProvider context.  This module bridges the gap: the provider
 * calls `markDoseLogged` / `markDoseUnlogged` / `syncFilterFromLogs`,
 * and the handler calls `isSlotFullyLogged` to decide whether to suppress
 * a medication reminder whose time slot is already fully logged.
 */

// Key format: "YYYY-MM-DD|HH:MM|medicationId"
const loggedDoses = new Set<string>();

function formatDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function extractLocalTime(isoString: string): { dateStr: string; time: string } {
    const d = new Date(isoString);
    return {
        dateStr: formatDateStr(d),
        time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    };
}

function makeKey(dateStr: string, time: string, medicationId: string): string {
    return `${dateStr}|${time}|${medicationId}`;
}

/** Call after a dose is logged (taken or skipped). */
export function markDoseLogged(scheduledFor: string, medicationId: string): void {
    const { dateStr, time } = extractLocalTime(scheduledFor);
    loggedDoses.add(makeKey(dateStr, time, medicationId));
}

/** Call after a dose log is undone / removed. */
export function markDoseUnlogged(scheduledFor: string, medicationId: string): void {
    const { dateStr, time } = extractLocalTime(scheduledFor);
    loggedDoses.delete(makeKey(dateStr, time, medicationId));
}

/**
 * Check if ALL medications in a time slot have been logged today.
 * Called by the notification handler to decide whether to suppress the reminder.
 */
export function isSlotFullyLogged(time: string, medicationIds: string[]): boolean {
    if (medicationIds.length === 0) {
        return false;
    }
    const dateStr = formatDateStr(new Date());
    return medicationIds.every(id => loggedDoses.has(makeKey(dateStr, time, id)));
}

/**
 * Populate the filter from existing dose logs (called on provider load / reload).
 * Only retains entries from today; older entries are discarded.
 */
export function syncFilterFromLogs(
    logs: ReadonlyArray<{ medicationId: string; scheduledFor?: string; status: string }>,
): void {
    const todayStr = formatDateStr(new Date());

    // Clear all existing entries (handles day rollover + undo/reload)
    loggedDoses.clear();

    // Populate from today's logs
    for (const log of logs) {
        if (!log.scheduledFor) {
            continue;
        }
        const { dateStr, time } = extractLocalTime(log.scheduledFor);
        if (dateStr === todayStr && (log.status === 'taken' || log.status === 'skipped')) {
            loggedDoses.add(makeKey(dateStr, time, log.medicationId));
        }
    }
}
