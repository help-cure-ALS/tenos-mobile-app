import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { AppDateTimePicker } from '@/src/components/ui/AppDateTimePicker';
import { useAppTheme } from '@/src/theme';
import { Button, List, Space } from 'react-native-nice-ui';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useMedications } from '@/src/medications';
import { cancelAllMedicationReminders, syncMedicationReminders } from '@/src/services/medicationReminders';
import {
    isTodoReminderEnabled,
    setTodoReminderEnabled,
    getTodoReminderTime,
    setTodoReminderTime,
    isMedicationReminderEnabled,
    setMedicationReminderEnabled,
    isAppointmentReminderEnabled,
    setAppointmentReminderEnabled,
} from '@/src/services/notificationPrefs';
import { useActivePatientId } from '@/src/context/AppRoleProvider';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { getAppLocale, uses24HourClock } from '@/src/lib/formatDate';

function parseTimeString(time: string): Date {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
}

export default function NotificationsScreen() {
    const { colors, isDark } = useAppTheme();
    const { t, i18n } = useTranslation();
    const activePatientId = useActivePatientId();
    const pickerLocale = getAppLocale(i18n.language);
    const use24HourClock = uses24HourClock(i18n.language);

    const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
    const [isLoading, setIsLoading] = useState(true);

    // Notification settings
    const [todoReminder, setTodoReminder] = useState(false);
    const [todoReminderTime, setTodoReminderTimeState] = useState('09:00');
    const [medicationReminder, setMedicationReminder] = useState(false);
    const [appointmentReminder, setAppointmentReminder] = useState(false);
    const { medications } = useMedications();

    // Check permission status
    const checkPermission = useCallback(async () => {
        const { status } = await Notifications.getPermissionsAsync();
        setPermissionStatus(status);
        return status;
    }, []);

    // Load saved settings (patient-scoped)
    const loadSettings = useCallback(async () => {
        try {
            const pid = activePatientId ?? undefined;
            const [todo, time, medication, appointment] = await Promise.all([
                isTodoReminderEnabled(pid),
                getTodoReminderTime(pid),
                isMedicationReminderEnabled(pid),
                isAppointmentReminderEnabled(pid),
            ]);

            setTodoReminder(todo);
            setTodoReminderTimeState(time);
            setMedicationReminder(medication);
            setAppointmentReminder(appointment);
        }
        catch (e) {
            console.error('Failed to load notification settings:', e);
        }
    }, [activePatientId]);

    // Initial load
    useEffect(() => {
        Promise.all([checkPermission(), loadSettings()]).finally(() => {
            setIsLoading(false);
        });
    }, [checkPermission, loadSettings]);

    // Request permission
    const requestPermission = useCallback(async () => {
        const { status } = await Notifications.requestPermissionsAsync();
        setPermissionStatus(status);

        if (status === 'denied') {
            Alert.alert(
                t('notifications.permissionRequired'),
                t('notifications.permissionMessage'),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.openSettings'), onPress: () => Linking.openSettings() }
                ]
            );
        }

        return status;
    }, [t]);

    // Schedule todo reminder notification
    const scheduleTodoReminder = useCallback(async (enabled: boolean, time: string) => {
        // Cancel existing todo notifications
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const notification of scheduled) {
            if (notification.identifier.startsWith('todo-')) {
                await Notifications.cancelScheduledNotificationAsync(notification.identifier);
            }
        }

        if (!enabled) {
            return;
        }

        await Notifications.scheduleNotificationAsync({
            identifier: 'todo-reminder',
            content: {
                title: t('notifications.todoReminderTitle'),
                body: t('notifications.todoReminderBody'),
                sound: true
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: parseInt(time.split(':')[0]),
                minute: parseInt(time.split(':')[1]),
            }
        });
    }, [t]);

    // Handle todo reminder toggle
    const handleTodoToggle = useCallback(async (enabled: boolean) => {
        if (enabled && permissionStatus !== 'granted') {
            const status = await requestPermission();
            if (status !== 'granted') {
                return;
            }
        }

        setTodoReminder(enabled);
        await setTodoReminderEnabled(enabled, activePatientId ?? undefined);
        await scheduleTodoReminder(enabled, todoReminderTime);
    }, [permissionStatus, requestPermission, todoReminderTime, scheduleTodoReminder, activePatientId]);

    // Handle time change
    const handleTimeChange = useCallback(async (selectedDate: Date) => {
        const hours = String(selectedDate.getHours()).padStart(2, '0');
        const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
        const newTime = `${hours}:${minutes}`;
        setTodoReminderTimeState(newTime);
        await setTodoReminderTime(newTime, activePatientId ?? undefined);
        await scheduleTodoReminder(true, newTime);
    }, [activePatientId, scheduleTodoReminder]);

    // Handle medication reminder toggle
    const handleMedicationToggle = useCallback(async (enabled: boolean) => {
        if (enabled && permissionStatus !== 'granted') {
            const status = await requestPermission();
            if (status !== 'granted') {
                return;
            }
        }

        setMedicationReminder(enabled);
        await setMedicationReminderEnabled(enabled, activePatientId ?? undefined);

        if (enabled) {
            await syncMedicationReminders(medications, activePatientId ?? undefined);
        } else {
            await cancelAllMedicationReminders();
        }
    }, [permissionStatus, requestPermission, medications, activePatientId]);

    // Handle appointment reminder toggle
    const handleAppointmentToggle = useCallback(async (enabled: boolean) => {
        if (enabled && permissionStatus !== 'granted') {
            const status = await requestPermission();
            if (status !== 'granted') {
                return;
            }
        }

        setAppointmentReminder(enabled);
        await setAppointmentReminderEnabled(enabled, activePatientId ?? undefined);
    }, [permissionStatus, requestPermission, activePatientId]);

    const permissionGranted = permissionStatus === 'granted';

    return (
        <ScrollView
            style={ { backgroundColor: colors.modalBackground } }
            contentContainerStyle={ styles.scrollView }
            contentInsetAdjustmentBehavior="automatic"
        >

            <ScrollViewContent>
                <ScreenHeader
                    icon="message.badge"
                    iconTintColor={ colors.brandColorMuted }
                    subtitle={ t('notifications.headerText') }
                />

                {/* Permission Status */ }
                { !permissionGranted && !isLoading && (

                        <List.Wrapper>
                            <Space size="xl" />
                            <Button
                                title={ t('notifications.enableNotifications') }
                                onPress={ requestPermission }
                                rounded
                            />
                        </List.Wrapper>

                ) }

                {/* Todo Reminder */ }
                <List.Section title={ t('notifications.dailyTracking') } rounded>
                    <List.Item
                        title={ t('notifications.todoReminder') }
                        subtitle={ t('notifications.todoReminderDesc') }
                        subtitleNumberOfLines={ 2 }
                        hideChevron
                        rightCmp={
                            <Switch
                                value={ todoReminder }
                                onValueChange={ handleTodoToggle }
                            />
                        }
                    />
                    { todoReminder && (
                        <List.Item
                            title={ t('notifications.reminderTime') }
                            hideChevron
                            rightCmp={
                                <AppDateTimePicker
                                    value={ parseTimeString(todoReminderTime) }
                                    mode="time"
                                    onChange={ handleTimeChange }
                                />
                            }
                        />
                    ) }
                </List.Section>
                <List.Wrapper>
                    <List.Text>
                        { t('notifications.todoInfo') }
                    </List.Text>
                </List.Wrapper>

                {/* Other Reminders */ }
                <List.Section title={ t('notifications.otherReminders') } rounded>
                    <List.Item
                        title={ t('notifications.medicationReminder') }
                        subtitle={ t('notifications.medicationReminderDesc') }
                        subtitleNumberOfLines={ 2 }
                        hideChevron
                        rightCmp={
                            <Switch
                                value={ medicationReminder }
                                onValueChange={ handleMedicationToggle }
                            />
                        }
                    />
                    <List.Item
                        title={ t('notifications.appointmentReminder') }
                        subtitle={ t('notifications.appointmentReminderDesc') }
                        subtitleNumberOfLines={ 2 }
                        hideChevron
                        rightCmp={
                            <Switch
                                value={ false }
                                disabled
                            />
                        }
                    />
                </List.Section>
                <List.Wrapper>
                    <List.Text>
                        { t('notifications.moreOptionsInfo') }
                    </List.Text>
                </List.Wrapper>
            </ScrollViewContent>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    permissionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 16
    },
    permissionText: {
        fontSize: 15
    }
});
