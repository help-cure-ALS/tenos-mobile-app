import * as Crypto from 'expo-crypto';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { on } from '@/src/lib/bus';
import { suppressTodayReminder, syncMedicationReminders } from '@/src/services/medicationReminders';
import {
    isSlotFullyLogged,
    markDoseLogged,
    markDoseUnlogged,
    syncFilterFromLogs,
} from '@/src/services/medicationNotificationFilter';
import {
    createMedicationDraft,
    fhirToMedication,
    fhirToMedicationDoseLog,
    medicationDoseLogToFhir,
    medicationToFhir,
    normalizeSchedule,
} from '../fhir/medicationToFhir';
import {
    buildScheduledDateTime,
    getMedicationTimesForDate,
    isMedicationActiveOnDate,
} from '../schedule';
import type { DayMedicationSlot, MedicationDoseLog, MedicationDoseStatus, MedicationItem } from '../types';

export type DoseLogStatus = 'taken' | 'skipped' | 'pending';

export type UseMedicationsResult = {
    medications: MedicationItem[];
    logs: MedicationDoseLog[];
    isLoading: boolean;
    error: string | null;
    reload: () => Promise<void>;
    addMedication: (input: Partial<MedicationItem>) => Promise<MedicationItem>;
    updateMedication: (id: string, updates: Partial<MedicationItem>) => Promise<MedicationItem>;
    archiveMedication: (id: string) => Promise<void>;
    deleteMedication: (id: string) => Promise<void>;
    logDose: (input: {
        medicationId: string;
        status?: MedicationDoseStatus;
        scheduledFor?: string;
        takenAt?: string;
        notes?: string;
    }) => Promise<MedicationDoseLog>;
    logDoses: (inputs: Array<{
        medicationId: string;
        status?: MedicationDoseStatus;
        scheduledFor?: string;
        takenAt?: string;
        notes?: string;
    }>) => Promise<MedicationDoseLog[]>;
    removeDoseLog: (logId: string) => Promise<void>;
    undoDoseLog: (medicationId: string, scheduledFor: string) => Promise<void>;
    getMedicationById: (id: string) => MedicationItem | null;
    getDaySlots: (day: Date) => DayMedicationSlot[];
    getAsNeededMedications: (day: Date) => MedicationItem[];
    getDayLogs: (day: Date) => MedicationDoseLog[];
    getMedicationLogs: (medicationId: string, limit?: number) => MedicationDoseLog[];
    /** @deprecated Use getDoseStatus instead */
    isDoseLogged: (medicationId: string, scheduledFor: string) => boolean;
    getDoseStatus: (medicationId: string, scheduledFor: string) => DoseLogStatus;
    getDoseLog: (medicationId: string, scheduledFor: string) => MedicationDoseLog | null;
};

function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function createScheduledIso(day: Date, hhmm: string): string {
    return buildScheduledDateTime(day, hhmm).toISOString();
}

function sortDoseLogsByDateDesc(arr: MedicationDoseLog[]): MedicationDoseLog[] {
    return [...arr].sort((a, b) => {
        const da = new Date(a.takenAt).getTime();
        const db = new Date(b.takenAt).getTime();
        return db - da;
    });
}

/**
 * After a dose is logged, check whether all medications in the same time slot
 * have now been logged.  If so, cancel the pending OS notification for that slot
 * and schedule a one-time replacement for the next occurrence.
 */
function suppressSlotIfFullyLogged(
    scheduledFor: string,
    getDaySlots: (day: Date) => DayMedicationSlot[],
    syncReminders: (meds: MedicationItem[]) => Promise<void>,
    medications: MedicationItem[],
    alreadySuppressed?: Set<string>,
): void {
    const d = new Date(scheduledFor);
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    // Avoid duplicate suppressions in batch logging
    if (alreadySuppressed?.has(time)) {
        return;
    }

    const slots = getDaySlots(d);
    const slot = slots.find(s => s.time === time);
    if (!slot) {
        return;
    }

    const allMedIds = slot.medications.map(m => m.id);
    const fullyLogged = isSlotFullyLogged(time, allMedIds);

    if (fullyLogged) {
        alreadySuppressed?.add(time);
        // 1) Immediate cancellation of the pending notification
        suppressTodayReminder(time).catch(console.warn);
        // 2) Full re-sync – the sync now checks isSlotFullyLogged and will
        //    NOT re-arm the repeating trigger for this slot.
        syncReminders(medications).catch(console.warn);
    }
}

const MedicationsContext = createContext<UseMedicationsResult | null>(null);

export function MedicationsProvider({ children }: { children: React.ReactNode }) {
    const { list, upsert, markDeleted, activePatientId } = useFhirRepo();

    const [medications, setMedications] = useState<MedicationItem[]>([]);
    const [logs, setLogs] = useState<MedicationDoseLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [medRows, logRows] = await Promise.all([
                list('MedicationStatement', { limit: 2000 }),
                list('MedicationAdministration', { limit: 4000 }),
            ]);

            const parsedMeds = medRows
                .map((row) => fhirToMedication(row.resource))
                .filter((x): x is MedicationItem => !!x)
                .sort((a, b) => a.name.localeCompare(b.name));

            const parsedLogs = sortDoseLogsByDateDesc(
                logRows
                    .map((row) => fhirToMedicationDoseLog(row.resource))
                    .filter((x): x is MedicationDoseLog => !!x)
            );

            setMedications(parsedMeds);
            setLogs(parsedLogs);

            // Populate notification filter so reminders for already-logged
            // time slots are suppressed even after a cold start.
            syncFilterFromLogs(parsedLogs);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setIsLoading(false);
        }
    }, [list]);

    // Debounced reload for fhir:changed events
    const debouncedReload = useMemo(() => {
        let timer: ReturnType<typeof setTimeout>;
        return () => {
            clearTimeout(timer);
            timer = setTimeout(() => reload(), 300);
        };
    }, [reload]);

    useEffect(() => {
        reload();
        const off = on('fhir:changed', debouncedReload);
        return () => off();
    }, [reload, debouncedReload]);

    const getMedicationById = useCallback(
        (id: string) => medications.find((m) => m.id === id) ?? null,
        [medications]
    );

    const getDaySlots = useCallback(
        (day: Date): DayMedicationSlot[] => {
            const slots = new Map<string, MedicationItem[]>();

            for (const med of medications) {
                if (med.schedule.type === 'as_needed') {
                    continue;
                }

                const times = getMedicationTimesForDate(med, day);
                for (const time of times) {
                    const listForTime = slots.get(time) ?? [];
                    listForTime.push(med);
                    slots.set(time, listForTime);
                }
            }

            return Array.from(slots.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([time, meds]) => ({
                    time,
                    medications: meds.sort((a, b) => a.name.localeCompare(b.name)),
                }));
        },
        [medications]
    );

    const syncRemindersSafe = useCallback(async (nextMedications: MedicationItem[]) => {
        try {
            await syncMedicationReminders(nextMedications, activePatientId ?? undefined);
        } catch (error) {
            console.warn('Medication reminder sync failed in hook:', error);
        }
    }, [activePatientId]);

    const addMedication = useCallback(
        async (input: Partial<MedicationItem>) => {
            const draft = createMedicationDraft({
                ...input,
                schedule: normalizeSchedule(input.schedule),
                duration: {
                    startDate: input.duration?.startDate ?? new Date().toISOString(),
                    endDate: input.duration?.endDate,
                },
                isActive: true,
            });

            await upsert('MedicationStatement', draft.id, medicationToFhir(draft), draft.updatedAt);

            // Optimistic update
            setMedications(prev => [...prev.filter(m => m.id !== draft.id), draft].sort((a, b) => a.name.localeCompare(b.name)));

            await syncRemindersSafe([...medications.filter((m) => m.id !== draft.id), draft]);
            return draft;
        },
        [upsert, medications, syncRemindersSafe]
    );

    const updateMedication = useCallback(
        async (id: string, updates: Partial<MedicationItem>) => {
            const existing = medications.find((m) => m.id === id);
            if (!existing) {
                throw new Error('Medikament nicht gefunden');
            }

            const next: MedicationItem = {
                ...existing,
                ...updates,
                schedule: normalizeSchedule(updates.schedule ?? existing.schedule),
                duration: {
                    startDate: updates.duration?.startDate ?? existing.duration.startDate,
                    endDate:
                        updates.duration?.endDate !== undefined
                            ? updates.duration.endDate
                            : existing.duration.endDate,
                },
                updatedAt: new Date().toISOString(),
            };

            await upsert('MedicationStatement', next.id, medicationToFhir(next), next.updatedAt);

            // Optimistic update
            setMedications(prev => prev.map(m => m.id === next.id ? next : m));

            await syncRemindersSafe([...medications.filter((m) => m.id !== next.id), next]);
            return next;
        },
        [medications, upsert, syncRemindersSafe]
    );

    const archiveMedication = useCallback(
        async (id: string) => {
            await updateMedication(id, { isActive: false });
        },
        [updateMedication]
    );

    const deleteMedication = useCallback(
        async (id: string) => {
            await markDeleted('MedicationStatement', id);

            // Optimistic update
            setMedications(prev => prev.filter(m => m.id !== id));

            await syncRemindersSafe(medications.filter((m) => m.id !== id));
        },
        [markDeleted, medications, syncRemindersSafe]
    );

    const logDose = useCallback(
        async (input: {
            medicationId: string;
            status?: MedicationDoseStatus;
            scheduledFor?: string;
            takenAt?: string;
            notes?: string;
        }) => {
            const takenAt = input.takenAt ?? new Date().toISOString();
            const status = input.status ?? 'taken';

            const existing =
                input.scheduledFor
                    ? logs.find(
                          (x) =>
                              x.medicationId === input.medicationId &&
                              x.scheduledFor === input.scheduledFor
                      )
                    : null;

            const log: MedicationDoseLog = {
                id: existing?.id ?? Crypto.randomUUID(),
                medicationId: input.medicationId,
                status,
                scheduledFor: input.scheduledFor,
                takenAt,
                notes: input.notes,
            };

            await upsert('MedicationAdministration', log.id, medicationDoseLogToFhir(log), takenAt);

            // Optimistic update: merge log into state without full reload
            setLogs(prev => sortDoseLogsByDateDesc([
                log,
                ...prev.filter(l => l.id !== log.id),
            ]));

            // Update notification filter and suppress OS notification if slot is fully logged
            if (log.scheduledFor) {
                markDoseLogged(log.scheduledFor, log.medicationId);
                suppressSlotIfFullyLogged(log.scheduledFor, getDaySlots, syncRemindersSafe, medications);
            }

            return log;
        },
        [logs, upsert, getDaySlots, syncRemindersSafe, medications]
    );

    const logDoses = useCallback(
        async (inputs: Array<{
            medicationId: string;
            status?: MedicationDoseStatus;
            scheduledFor?: string;
            takenAt?: string;
            notes?: string;
        }>) => {
            const takenAt = new Date().toISOString();
            const results = inputs.map(input => {
                const existing =
                    input.scheduledFor
                        ? logs.find(
                              (x) =>
                                  x.medicationId === input.medicationId &&
                                  x.scheduledFor === input.scheduledFor
                          )
                        : null;

                const log: MedicationDoseLog = {
                    id: existing?.id ?? Crypto.randomUUID(),
                    medicationId: input.medicationId,
                    status: input.status ?? 'taken',
                    scheduledFor: input.scheduledFor,
                    takenAt: input.takenAt ?? takenAt,
                    notes: input.notes,
                };
                return log;
            });

            await Promise.all(
                results.map(log =>
                    upsert('MedicationAdministration', log.id, medicationDoseLogToFhir(log), log.takenAt),
                ),
            );

            // Optimistic update: merge new logs into state without full reload
            const newIds = new Set(results.map(r => r.id));
            setLogs(prev => sortDoseLogsByDateDesc([
                ...results,
                ...prev.filter(l => !newIds.has(l.id)),
            ]));

            // Update notification filter and suppress OS notifications for fully logged slots
            const suppressedTimes = new Set<string>();
            for (const log of results) {
                if (log.scheduledFor) {
                    markDoseLogged(log.scheduledFor, log.medicationId);
                }
            }
            for (const log of results) {
                if (log.scheduledFor) {
                    suppressSlotIfFullyLogged(log.scheduledFor, getDaySlots, syncRemindersSafe, medications, suppressedTimes);
                }
            }

            return results;
        },
        [logs, upsert, getDaySlots, syncRemindersSafe, medications]
    );

    const removeDoseLog = useCallback(
        async (logId: string) => {
            // Find the log before removing so we can update the notification filter
            const logToRemove = logs.find(l => l.id === logId);

            await markDeleted('MedicationAdministration', logId);

            // Optimistic update
            setLogs(prev => prev.filter(l => l.id !== logId));

            // Re-enable notification for this slot since the dose is no longer logged
            if (logToRemove?.scheduledFor) {
                markDoseUnlogged(logToRemove.scheduledFor, logToRemove.medicationId);
                // Re-sync to restore the repeating trigger that was replaced
                syncRemindersSafe(medications).catch(console.warn);
            }
        },
        [markDeleted, logs, syncRemindersSafe, medications]
    );

    const getAsNeededMedications = useCallback(
        (day: Date) =>
            medications
                .filter((m) => m.schedule.type === 'as_needed' && isMedicationActiveOnDate(m, day))
                .sort((a, b) => a.name.localeCompare(b.name)),
        [medications]
    );

    const getDayLogs = useCallback(
        (day: Date) => logs.filter((log) => isSameDay(new Date(log.takenAt), day)),
        [logs]
    );

    const isDoseLogged = useCallback(
        (medicationId: string, scheduledFor: string) =>
            logs.some(
                (log) =>
                    log.medicationId === medicationId &&
                    log.scheduledFor === scheduledFor &&
                    log.status === 'taken'
            ),
        [logs]
    );

    const getDoseLog = useCallback(
        (medicationId: string, scheduledFor: string): MedicationDoseLog | null =>
            logs.find(
                (log) =>
                    log.medicationId === medicationId &&
                    log.scheduledFor === scheduledFor
            ) ?? null,
        [logs]
    );

    const getDoseStatus = useCallback(
        (medicationId: string, scheduledFor: string): DoseLogStatus => {
            const log = getDoseLog(medicationId, scheduledFor);
            if (!log) return 'pending';
            return log.status;
        },
        [getDoseLog]
    );

    const undoDoseLog = useCallback(
        async (medicationId: string, scheduledFor: string) => {
            const log = getDoseLog(medicationId, scheduledFor);
            if (log) {
                await markDeleted('MedicationAdministration', log.id);

                // Optimistic update
                setLogs(prev => prev.filter(l => l.id !== log.id));

                // Re-enable notification for this slot since the dose is no longer logged
                if (log.scheduledFor) {
                    markDoseUnlogged(log.scheduledFor, log.medicationId);
                    // Re-sync to restore the repeating trigger that was replaced
                    syncRemindersSafe(medications).catch(console.warn);
                }
            }
        },
        [getDoseLog, markDeleted, syncRemindersSafe, medications]
    );

    const getMedicationLogs = useCallback(
        (medicationId: string, limit?: number): MedicationDoseLog[] => {
            const filtered = logs.filter((log) => log.medicationId === medicationId);
            return limit ? filtered.slice(0, limit) : filtered;
        },
        [logs]
    );

    const reminderSignature = useMemo(
        () =>
            medications
                .map((m) => `${m.id}|${m.isActive}|${m.updatedAt}|${m.schedule.type}|${m.schedule.times.join(',')}`)
                .sort()
                .join('||'),
        [medications]
    );

    useEffect(() => {
        if (isLoading) {
            return;
        }
        syncRemindersSafe(medications).catch(console.warn);
    }, [reminderSignature, medications, isLoading, syncRemindersSafe]);

    // Restore repeating triggers when the app returns to the foreground.
    // suppressTodayReminder replaces a daily/weekly trigger with a one-time;
    // a full re-sync here ensures the repeating schedule is restored.
    const syncTriggeredRef = useRef(false);
    useEffect(() => {
        if (isLoading || medications.length === 0) {
            return;
        }
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active' && !syncTriggeredRef.current) {
                syncTriggeredRef.current = true;
                syncFilterFromLogs(logs);
                syncRemindersSafe(medications)
                    .catch(console.warn)
                    .finally(() => { syncTriggeredRef.current = false; });
            }
        });
        return () => subscription.remove();
    }, [isLoading, medications, logs, syncRemindersSafe]);

    const contextValue = useMemo<UseMedicationsResult>(() => ({
        medications,
        logs,
        isLoading,
        error,
        reload,
        addMedication,
        updateMedication,
        archiveMedication,
        deleteMedication,
        logDose,
        logDoses,
        removeDoseLog,
        undoDoseLog,
        getMedicationById,
        getDaySlots,
        getAsNeededMedications,
        getDayLogs,
        getMedicationLogs,
        isDoseLogged,
        getDoseStatus,
        getDoseLog,
    }), [
        medications, logs, isLoading, error, reload,
        addMedication, updateMedication, archiveMedication, deleteMedication,
        logDose, logDoses, removeDoseLog, undoDoseLog,
        getMedicationById, getDaySlots, getAsNeededMedications, getDayLogs,
        getMedicationLogs, isDoseLogged, getDoseStatus, getDoseLog,
    ]);

    return (
        <MedicationsContext.Provider value={contextValue}>
            {children}
        </MedicationsContext.Provider>
    );
}

export function useMedications(): UseMedicationsResult {
    const ctx = useContext(MedicationsContext);
    if (!ctx) throw new Error('useMedications must be used within MedicationsProvider');
    return ctx;
}

export function getScheduledSlotIso(day: Date, hhmm: string): string {
    return createScheduledIso(day, hhmm);
}
