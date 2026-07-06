import { buildScheduledDateTime, getMedicationTimesForDate, isMedicationActiveOnDate } from './schedule';
import type { MedicationItem } from './types';

export type ReminderPlanItem = {
    identifier: string;
    medicationIds: string[];
    medicationNames: string[];
    scheduledAt: string;
    time: string;
    kind: 'daily' | 'weekly' | 'one_time';
    weekday?: number;
};

type ReminderPlanCandidate = {
    medicationId: string;
    medicationName: string;
    scheduledAt: string;
    time: string;
    kind: 'daily' | 'weekly' | 'one_time';
    weekday?: number;
};

export type ReminderPlanOptions = {
    now?: Date;
    lookaheadDays?: number;
};

const MEDICATION_REMINDER_PREFIX = 'med-reminder:';

function asLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function parseTime(time: string): { hour: number; minute: number } {
    const [hRaw, mRaw] = time.split(':');
    const hour = Math.max(0, Math.min(23, Number(hRaw) || 0));
    const minute = Math.max(0, Math.min(59, Number(mRaw) || 0));
    return { hour, minute };
}

function makeDailyIdentifier(time: string): string {
    return `${MEDICATION_REMINDER_PREFIX}group:daily:${time}`;
}

function makeWeeklyIdentifier(weekday: number, time: string): string {
    return `${MEDICATION_REMINDER_PREFIX}group:weekly:${weekday}:${time}`;
}

function makeOneTimeIdentifier(scheduledAtIso: string): string {
    return `${MEDICATION_REMINDER_PREFIX}group:once:${scheduledAtIso}`;
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function shouldUseRepeatingPlan(medication: MedicationItem): boolean {
    return medication.schedule.type === 'daily' || medication.schedule.type === 'weekly';
}

function buildRepeatingPlan(medication: MedicationItem, now: Date): ReminderPlanCandidate[] {
    const out: ReminderPlanCandidate[] = [];

    if (medication.schedule.type === 'daily') {
        for (const time of medication.schedule.times) {
            const dt = buildScheduledDateTime(now, time);
            out.push({
                medicationId: medication.id,
                medicationName: medication.name,
                scheduledAt: dt.toISOString(),
                time,
                kind: 'daily',
            });
        }
        return out;
    }

    if (medication.schedule.type === 'weekly') {
        const weekdays = medication.schedule.weekdays ?? [];
        for (const weekday of weekdays) {
            for (const time of medication.schedule.times) {
                const dt = buildScheduledDateTime(now, time);
                out.push({
                    medicationId: medication.id,
                    medicationName: medication.name,
                    scheduledAt: dt.toISOString(),
                    time,
                    kind: 'weekly',
                    weekday,
                });
            }
        }
    }

    return out;
}

function buildRollingOneTimePlan(medication: MedicationItem, now: Date, lookaheadDays: number): ReminderPlanCandidate[] {
    const out: ReminderPlanCandidate[] = [];
    const start = asLocalDay(now);

    for (let dayOffset = 0; dayOffset <= lookaheadDays; dayOffset++) {
        const day = addDays(start, dayOffset);

        if (!isMedicationActiveOnDate(medication, day)) {
            continue;
        }

        const times = getMedicationTimesForDate(medication, day);
        for (const time of times) {
            const scheduledAt = buildScheduledDateTime(day, time);
            if (scheduledAt.getTime() <= now.getTime()) {
                continue;
            }

            out.push({
                medicationId: medication.id,
                medicationName: medication.name,
                scheduledAt: scheduledAt.toISOString(),
                time,
                kind: 'one_time',
            });
        }
    }

    return out;
}

function groupCandidates(candidates: ReminderPlanCandidate[]): ReminderPlanItem[] {
    const dailyTimes = new Set(candidates.filter((item) => item.kind === 'daily').map((item) => item.time));
    const weeklySlots = new Set(
        candidates
            .filter((item) => item.kind === 'weekly')
            .map((item) => `${item.weekday ?? 0}:${item.time}`)
    );

    const groups = new Map<string, ReminderPlanItem>();

    for (const item of candidates) {
        if (item.kind === 'weekly' && dailyTimes.has(item.time)) {
            continue;
        }

        if (item.kind === 'one_time') {
            const scheduled = new Date(item.scheduledAt);
            const weekday = scheduled.getDay();
            if (dailyTimes.has(item.time) || weeklySlots.has(`${weekday}:${item.time}`)) {
                continue;
            }
        }

        const identifier =
            item.kind === 'daily'
                ? makeDailyIdentifier(item.time)
                : item.kind === 'weekly'
                    ? makeWeeklyIdentifier(item.weekday ?? 0, item.time)
                    : makeOneTimeIdentifier(item.scheduledAt);

        const existing = groups.get(identifier);
        if (existing) {
            existing.medicationIds.push(item.medicationId);
            existing.medicationNames.push(item.medicationName);
            existing.scheduledAt = existing.scheduledAt.localeCompare(item.scheduledAt) <= 0
                ? existing.scheduledAt
                : item.scheduledAt;
            continue;
        }

        groups.set(identifier, {
            identifier,
            medicationIds: [item.medicationId],
            medicationNames: [item.medicationName],
            scheduledAt: item.scheduledAt,
            time: item.time,
            kind: item.kind,
            weekday: item.weekday,
        });
    }

    return Array.from(groups.values())
        .map((item) => ({
            ...item,
            medicationIds: [...new Set(item.medicationIds)],
            medicationNames: [...new Set(item.medicationNames)].sort((a, b) => a.localeCompare(b)),
        }))
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export function buildMedicationReminderPlan(
    medications: MedicationItem[],
    options?: ReminderPlanOptions
): ReminderPlanItem[] {
    const now = options?.now ?? new Date();
    const lookaheadDays = Math.max(1, options?.lookaheadDays ?? 30);
    const plan: ReminderPlanCandidate[] = [];

    for (const medication of medications) {
        if (!medication.isActive) {
            continue;
        }

        if (medication.schedule.type === 'as_needed') {
            continue;
        }

        if (!medication.schedule.times?.length) {
            continue;
        }

        if (shouldUseRepeatingPlan(medication)) {
            plan.push(...buildRepeatingPlan(medication, now));
        } else {
            plan.push(...buildRollingOneTimePlan(medication, now, lookaheadDays));
        }
    }

    return groupCandidates(plan);
}

export function getMedicationReminderPrefix(): string {
    return MEDICATION_REMINDER_PREFIX;
}

export function getHourMinuteFromTime(time: string): { hour: number; minute: number } {
    return parseTime(time);
}
