import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import i18n from '@/src/i18n';
import { buildMedicationReminderPlan, getHourMinuteFromTime, getMedicationReminderPrefix } from '@/src/medications/reminderPlan';
import type { MedicationItem } from '@/src/medications/types';
import type { ReminderPlanItem } from '@/src/medications/reminderPlan';
import { isMedicationReminderEnabled } from './notificationPrefs';
import { isSlotFullyLogged } from './medicationNotificationFilter';

const MEDICATION_REMINDER_CHANNEL_ID = 'medication-reminders';
const REMINDER_TITLE_FALLBACK = 'Erinnerung: Medikamenteneinnahme';

let syncInFlight: Promise<void> | null = null;

function mapWeekdayToNotificationWeekday(weekday: number): number {
    const clamped = Math.max(0, Math.min(6, weekday));
    return clamped + 1;
}

function makeReminderBody(time: string): string {
    return String(i18n.t('notifications.medicationReminderNotificationBody', {
        time,
        defaultValue: `Es ist an der Zeit, deine Medikamente für ${time} zu protokollieren.`,
    }));
}

function makeReminderTitle(): string {
    return String(i18n.t('notifications.medicationReminderNotificationTitle', {
        defaultValue: REMINDER_TITLE_FALLBACK,
    }));
}

async function ensureMedicationReminderChannel(): Promise<void> {
    if (Platform.OS !== 'android') {
        return;
    }

    await Notifications.setNotificationChannelAsync(MEDICATION_REMINDER_CHANNEL_ID, {
        name: 'Medication reminders',
        importance: Notifications.AndroidImportance.HIGH,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: [0, 250, 250, 250],
    });
}

async function schedulePlanItem(item: ReturnType<typeof buildMedicationReminderPlan>[number]): Promise<void> {
    const notificationData: Record<string, unknown> = {
        type: 'medication_reminder',
        medicationIds: item.medicationIds,
        medicationCount: item.medicationIds.length,
        time: item.time,
    };

    if (item.kind === 'one_time') {
        notificationData.scheduledFor = item.scheduledAt;
    }

    const { hour, minute } = getHourMinuteFromTime(item.time);

    if (item.kind === 'daily') {
        await Notifications.scheduleNotificationAsync({
            identifier: item.identifier,
            content: {
                title: makeReminderTitle(),
                body: makeReminderBody(item.time),
                sound: true,
                data: notificationData,
                interruptionLevel: 'timeSensitive',
                priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                channelId: MEDICATION_REMINDER_CHANNEL_ID,
                hour,
                minute,
            },
        });
        return;
    }

    if (item.kind === 'weekly') {
        await Notifications.scheduleNotificationAsync({
            identifier: item.identifier,
            content: {
                title: makeReminderTitle(),
                body: makeReminderBody(item.time),
                sound: true,
                data: notificationData,
                interruptionLevel: 'timeSensitive',
                priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                channelId: MEDICATION_REMINDER_CHANNEL_ID,
                hour,
                minute,
                weekday: mapWeekdayToNotificationWeekday(item.weekday ?? 0),
            },
        });
        return;
    }

    await Notifications.scheduleNotificationAsync({
        identifier: item.identifier,
        content: {
            title: makeReminderTitle(),
            body: makeReminderBody(item.time),
            sound: true,
            data: notificationData,
            interruptionLevel: 'timeSensitive',
            priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            channelId: MEDICATION_REMINDER_CHANNEL_ID,
            date: new Date(item.scheduledAt),
        },
    });
}

export async function cancelAllMedicationReminders(): Promise<void> {
    const prefix = getMedicationReminderPrefix();
    const existing = await Notifications.getAllScheduledNotificationsAsync();

    for (const notification of existing) {
        if (notification.identifier.startsWith(prefix)) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
    }
}

export async function cancelMedicationRemindersForMedication(medicationId: string): Promise<void> {
    const prefix = `${getMedicationReminderPrefix()}${medicationId}:`;
    const existing = await Notifications.getAllScheduledNotificationsAsync();

    for (const notification of existing) {
        if (notification.identifier.startsWith(prefix)) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
            continue;
        }

        const data = notification.content.data as Record<string, unknown> | undefined;
        const medicationIds = Array.isArray(data?.medicationIds)
            ? data.medicationIds.filter((id): id is string => typeof id === 'string')
            : [];
        if (medicationIds.length === 1 && medicationIds[0] === medicationId) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
    }
}

/**
 * Cancel today's notification for a given time slot and schedule a one-time
 * replacement for the next occurrence so the user still gets reminded
 * tomorrow (or next matching weekday).  The next full
 * `syncMedicationReminders` call (medication change, app restart) will
 * restore the proper repeating trigger.
 */
export async function suppressTodayReminder(time: string): Promise<void> {
    const prefix = getMedicationReminderPrefix();
    const { hour, minute } = getHourMinuteFromTime(time);
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    // Build replacement content from the existing notification data
    function makeReplacementContent(match: Notifications.NotificationRequest): Notifications.NotificationContentInput {
        return {
            title: match.content.title ?? makeReminderTitle(),
            body: match.content.body ?? makeReminderBody(time),
            sound: true,
            data: match.content.data as Record<string, unknown>,
            interruptionLevel: 'timeSensitive',
            priority: Notifications.AndroidNotificationPriority.HIGH,
        };
    }

    // --- daily trigger ---
    const dailyId = `${prefix}group:daily:${time}`;
    const dailyMatch = scheduled.find(n => n.identifier === dailyId);
    if (dailyMatch) {
        await Notifications.cancelScheduledNotificationAsync(dailyId);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(hour, minute, 0, 0);
        await Notifications.scheduleNotificationAsync({
            identifier: `${prefix}next:daily:${time}`,
            content: makeReplacementContent(dailyMatch),
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                channelId: MEDICATION_REMINDER_CHANNEL_ID,
                date: tomorrow,
            },
        }).catch(console.warn);
    }

    // --- weekly trigger for today's weekday ---
    const todayWeekday = new Date().getDay();
    const weeklyId = `${prefix}group:weekly:${todayWeekday}:${time}`;
    const weeklyMatch = scheduled.find(n => n.identifier === weeklyId);
    if (weeklyMatch) {
        await Notifications.cancelScheduledNotificationAsync(weeklyId);
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(hour, minute, 0, 0);
        await Notifications.scheduleNotificationAsync({
            identifier: `${prefix}next:weekly:${todayWeekday}:${time}`,
            content: makeReplacementContent(weeklyMatch),
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                channelId: MEDICATION_REMINDER_CHANNEL_ID,
                date: nextWeek,
            },
        }).catch(console.warn);
    }

    // --- one-time triggers for today at this time ---
    const today = new Date();
    for (const n of scheduled) {
        if (!n.identifier.startsWith(`${prefix}group:once:`)) {
            continue;
        }
        const data = n.content.data as Record<string, unknown> | undefined;
        if (data?.time !== time) {
            continue;
        }
        const sf = typeof data?.scheduledFor === 'string' ? new Date(data.scheduledFor) : null;
        if (sf &&
            sf.getFullYear() === today.getFullYear() &&
            sf.getMonth() === today.getMonth() &&
            sf.getDate() === today.getDate()) {
            await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
    }
}

/**
 * Schedule a one-time DATE trigger for the next occurrence of a repeating
 * reminder whose today-slot has already been fully logged.  This avoids
 * re-arming a DAILY / WEEKLY trigger that would fire again today.
 */
async function scheduleNextOccurrence(item: ReminderPlanItem): Promise<void> {
    const { hour, minute } = getHourMinuteFromTime(item.time);
    const next = new Date();

    if (item.kind === 'daily') {
        next.setDate(next.getDate() + 1);
    } else if (item.kind === 'weekly') {
        next.setDate(next.getDate() + 7);
    }

    next.setHours(hour, minute, 0, 0);

    const identifier = `${getMedicationReminderPrefix()}next:${item.kind}:${item.time}`;

    await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
            title: makeReminderTitle(),
            body: makeReminderBody(item.time),
            sound: true,
            data: {
                type: 'medication_reminder',
                medicationIds: item.medicationIds,
                medicationCount: item.medicationIds.length,
                time: item.time,
            },
            interruptionLevel: 'timeSensitive',
            priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            channelId: MEDICATION_REMINDER_CHANNEL_ID,
            date: next,
        },
    });
}

export async function syncMedicationReminders(medications: MedicationItem[], patientId?: string): Promise<void> {
    const run = async () => {
        const enabled = await isMedicationReminderEnabled(patientId);
        if (!enabled) {
            await cancelAllMedicationReminders();
            return;
        }

        const permission = await Notifications.getPermissionsAsync();
        if (permission.status !== 'granted') {
            return;
        }

        await ensureMedicationReminderChannel();

        const activeMeds = medications.filter((m) => m.isActive);
        const plan = buildMedicationReminderPlan(activeMeds, { lookaheadDays: 30 });

        await cancelAllMedicationReminders();

        for (const item of plan) {
            try {
                // For repeating triggers (daily/weekly), check if today's slot
                // is already fully logged.  If so, skip the repeating trigger
                // (which would fire again today) and schedule a one-time DATE
                // trigger for the next occurrence instead.
                if (
                    (item.kind === 'daily' || item.kind === 'weekly') &&
                    isSlotFullyLogged(item.time, item.medicationIds)
                ) {
                    await scheduleNextOccurrence(item);
                } else {
                    await schedulePlanItem(item);
                }
            } catch (error) {
                console.warn('Failed to schedule medication reminder', item.identifier, error);
            }
        }
    };

    if (syncInFlight) {
        await syncInFlight;
    }

    syncInFlight = run()
        .catch((error) => {
            console.warn('Medication reminder sync failed:', error);
        })
        .finally(() => {
            syncInFlight = null;
        });

    await syncInFlight;
}
