import AsyncStorage from '@react-native-async-storage/async-storage';

/** Base key names (without patient suffix) */
export const NOTIFICATION_STORAGE_KEYS = {
    TODO_REMINDER: 'notifications_todo_reminder',
    TODO_REMINDER_TIME: 'notifications_todo_reminder_time',
    MEDICATION_REMINDER: 'notifications_medication_reminder',
    APPOINTMENT_REMINDER: 'notifications_appointment_reminder',
} as const;

/** Get patient-scoped key. Falls back to global key when no patientId. */
function scopedKey(baseKey: string, patientId?: string): string {
    return patientId ? `${baseKey}:${patientId}` : baseKey;
}

/** Get all scoped keys for a patient (for bulk deletion) */
export function getNotificationKeysForPatient(patientId: string): string[] {
    return Object.values(NOTIFICATION_STORAGE_KEYS).map(k => `${k}:${patientId}`);
}

export async function isMedicationReminderEnabled(patientId?: string): Promise<boolean> {
    const value = await AsyncStorage.getItem(scopedKey(NOTIFICATION_STORAGE_KEYS.MEDICATION_REMINDER, patientId));
    return value === 'true';
}

export async function setMedicationReminderEnabled(enabled: boolean, patientId?: string): Promise<void> {
    await AsyncStorage.setItem(scopedKey(NOTIFICATION_STORAGE_KEYS.MEDICATION_REMINDER, patientId), String(enabled));
}

export async function isTodoReminderEnabled(patientId?: string): Promise<boolean> {
    const value = await AsyncStorage.getItem(scopedKey(NOTIFICATION_STORAGE_KEYS.TODO_REMINDER, patientId));
    return value === 'true';
}

export async function setTodoReminderEnabled(enabled: boolean, patientId?: string): Promise<void> {
    await AsyncStorage.setItem(scopedKey(NOTIFICATION_STORAGE_KEYS.TODO_REMINDER, patientId), String(enabled));
}

export async function getTodoReminderTime(patientId?: string): Promise<string> {
    const value = await AsyncStorage.getItem(scopedKey(NOTIFICATION_STORAGE_KEYS.TODO_REMINDER_TIME, patientId));
    return value ?? '09:00';
}

export async function setTodoReminderTime(time: string, patientId?: string): Promise<void> {
    await AsyncStorage.setItem(scopedKey(NOTIFICATION_STORAGE_KEYS.TODO_REMINDER_TIME, patientId), time);
}

export async function isAppointmentReminderEnabled(patientId?: string): Promise<boolean> {
    const value = await AsyncStorage.getItem(scopedKey(NOTIFICATION_STORAGE_KEYS.APPOINTMENT_REMINDER, patientId));
    return value === 'true';
}

export async function setAppointmentReminderEnabled(enabled: boolean, patientId?: string): Promise<void> {
    await AsyncStorage.setItem(scopedKey(NOTIFICATION_STORAGE_KEYS.APPOINTMENT_REMINDER, patientId), String(enabled));
}
