import type { MedicationDuration, MedicationItem, MedicationSchedule } from './types';

function atStartOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function parseIsoDateToLocalDay(isoDate: string): Date {
    const d = new Date(isoDate);
    return atStartOfDay(d);
}

function daysBetween(a: Date, b: Date): number {
    const diff = atStartOfDay(a).getTime() - atStartOfDay(b).getTime();
    return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function isWithinDuration(day: Date, duration: MedicationDuration): boolean {
    const start = parseIsoDateToLocalDay(duration.startDate);
    const target = atStartOfDay(day);

    if (target.getTime() < start.getTime()) {
        return false;
    }

    if (!duration.endDate) {
        return true;
    }

    const end = parseIsoDateToLocalDay(duration.endDate);
    return target.getTime() <= end.getTime();
}

export function isMedicationActiveOnDate(medication: MedicationItem, day: Date): boolean {
    if (!medication.isActive) {
        return false;
    }

    if (!isWithinDuration(day, medication.duration)) {
        return false;
    }

    const schedule = medication.schedule;

    switch (schedule.type) {
        case 'daily':
            return true;
        case 'weekly': {
            const weekdays = schedule.weekdays ?? [];
            if (!weekdays.length) {
                return false;
            }
            return weekdays.includes(day.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6);
        }
        case 'every_x_days': {
            const start = parseIsoDateToLocalDay(medication.duration.startDate);
            const diff = daysBetween(day, start);
            const interval = Math.max(1, schedule.intervalDays ?? 1);
            return diff % interval === 0;
        }
        case 'cycle': {
            const start = parseIsoDateToLocalDay(medication.duration.startDate);
            const diff = daysBetween(day, start);
            const on = Math.max(1, schedule.cycleOnDays ?? 1);
            const off = Math.max(1, schedule.cycleOffDays ?? 1);
            const cycleLen = on + off;
            const cyclePos = diff % cycleLen;
            return cyclePos < on;
        }
        case 'as_needed':
            return true;
        default:
            return false;
    }
}

export function getMedicationTimesForDate(medication: MedicationItem, day: Date): string[] {
    if (!isMedicationActiveOnDate(medication, day)) {
        return [];
    }

    const times = medication.schedule.times ?? [];
    return [...times].sort((a, b) => a.localeCompare(b));
}

export function buildScheduledDateTime(day: Date, hhmm: string): Date {
    const [hoursRaw, minutesRaw] = hhmm.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    const safeHours = Number.isFinite(hours) ? Math.max(0, Math.min(23, hours)) : 0;
    const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.min(59, minutes)) : 0;

    return new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        safeHours,
        safeMinutes,
        0,
        0
    );
}

export function getWeekdayLabel(day: number): string {
    const labels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return labels[Math.max(0, Math.min(6, day))];
}

export function getScheduleOptionsLabel(schedule: MedicationSchedule): string {
    switch (schedule.type) {
        case 'daily':
            return 'Jeden Tag';
        case 'weekly':
            return 'An bestimmten Wochentagen';
        case 'every_x_days':
            return `Alle ${Math.max(1, schedule.intervalDays ?? 1)} Tage`;
        case 'cycle':
            return 'Zyklischer Zeitplan';
        case 'as_needed':
            return 'Nach Bedarf';
        default:
            return 'Unbekannt';
    }
}
