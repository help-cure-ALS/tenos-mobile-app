import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { AppDateTimePicker } from '@/src/components/ui/AppDateTimePicker';
import { useTranslation } from 'react-i18next';
import { List } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { on } from '@/src/lib/bus';
import { fmtDayMonthLong, getAppLocale, uses24HourClock } from '@/src/lib/formatDate';
import type { MedicationSchedule, ScheduleType } from '../types';

export type ScheduleEditorProps = {
    initialSchedule: MedicationSchedule;
    onScheduleChange: (schedule: MedicationSchedule) => void;
    dosageText: string;
    onDosageTextChange: (text: string) => void;
    startDate: Date;
    endDate: Date | null;
    onStartDateChange: (date: Date) => void;
    onEndDateChange: (date: Date | null) => void;
};

export function formatTime(date: Date): string {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

export function parseTimeString(time: string): Date {
    const [h, m] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    return date;
}

export function formatDateDisplay(date: Date, locale: string, todaySuffix: string): string {
    const today = new Date();
    const isToday =
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

    const dayStr = fmtDayMonthLong(date, locale.startsWith('de'));
    return isToday ? `${dayStr} ${todaySuffix}` : dayStr;
}

export function getNextDefaultTime(existingTimes: string[]): string {
    const defaultTimes = ['08:00', '12:00', '18:00', '22:00', '09:00', '13:00', '19:00', '21:00'];
    for (const time of defaultTimes) {
        if (!existingTimes.includes(time)) {
            return time;
        }
    }
    for (let h = 6; h <= 22; h++) {
        const time = `${h.toString().padStart(2, '0')}:00`;
        if (!existingTimes.includes(time)) {
            return time;
        }
    }
    return '12:00';
}

export function ScheduleEditor({
    initialSchedule,
    onScheduleChange,
    dosageText,
    onDosageTextChange,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
}: ScheduleEditorProps) {
    const { t, i18n } = useTranslation();
    const { colors, isDark } = useAppTheme();
    const router = useSafeRouter();
    const locale = getAppLocale(i18n.language);
    const use24HourClock = uses24HourClock(i18n.language);

    const [scheduleType, setScheduleType] = useState<ScheduleType>(initialSchedule.type);
    const [times, setTimes] = useState<string[]>(initialSchedule.times);
    const [weekdays, setWeekdays] = useState<number[]>(initialSchedule.weekdays ?? [1, 2, 3, 4, 5]);
    const [intervalDays, setIntervalDays] = useState(
        String(initialSchedule.intervalDays ?? 2)
    );
    const [cycleOnDays, setCycleOnDays] = useState(
        String(initialSchedule.cycleOnDays ?? 21)
    );
    const [cycleOffDays, setCycleOffDays] = useState(
        String(initialSchedule.cycleOffDays ?? 7)
    );

    // Listen for bus events from modal screens
    useEffect(() => {
        const unsubSchedule = on('medication:scheduleType:selected', (value: ScheduleType) => {
            setScheduleType(value);
        });

        const unsubDuration = on('medication:duration:selected', (data: {
            startDate: string;
            endDate: string | null;
        }) => {
            onStartDateChange(new Date(data.startDate));
            onEndDateChange(data.endDate ? new Date(data.endDate) : null);
        });

        return () => {
            unsubSchedule();
            unsubDuration();
        };
    }, [onStartDateChange, onEndDateChange]);

    // Compose schedule and notify parent on any change
    const schedule = useMemo<MedicationSchedule>(() => {
        const base: MedicationSchedule = {
            type: scheduleType,
            times: scheduleType === 'as_needed' ? [] : times,
        };

        if (scheduleType === 'weekly') {
            base.weekdays = weekdays as Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
        }

        if (scheduleType === 'every_x_days') {
            base.intervalDays = Math.max(1, Number(intervalDays) || 1);
        }

        if (scheduleType === 'cycle') {
            base.cycleOnDays = Math.max(1, Number(cycleOnDays) || 1);
            base.cycleOffDays = Math.max(1, Number(cycleOffDays) || 1);
        }

        return base;
    }, [scheduleType, times, weekdays, intervalDays, cycleOnDays, cycleOffDays]);

    useEffect(() => {
        onScheduleChange(schedule);
    }, [schedule, onScheduleChange]);

    return (
        <View style={styles.section}>
            {/* Schedule Type Row */}
            <List.Section
                title={t('medications.whenDoYouTake')}
                titleStyle={[styles.fieldLabel, { color: colors.textPrimary }]}
                rounded
            >
                <View style={[styles.scheduleRow, { backgroundColor: colors.listItemBackground }]}>
                    <Text style={[styles.scheduleRowText, { color: colors.textPrimary }]}>
                        {t(`medications.scheduleTypes.${scheduleType}`)}
                    </Text>
                    <Pressable
                        onPress={() =>
                            router.push({
                                pathname: '/(tabs)/(metric)/medications/scheduleType',
                                params: { current: scheduleType },
                            })
                        }
                    >
                        <Text style={[styles.changeButton, { color: colors.tint }]}>
                            {t('common.change')}
                        </Text>
                    </Pressable>
                </View>
            </List.Section>

            {/* Weekday selector */}
            {scheduleType === 'weekly' && (
                <List.Section
                    title={t('medications.onWhichDays')}
                    titleStyle={[styles.fieldLabel, { color: colors.textPrimary }]}
                    rounded
                >
                    <View style={[styles.weekdayRow, { backgroundColor: colors.listItemBackground }]}>
                        {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                            const selected = weekdays.includes(day);
                            return (
                                <Pressable
                                    key={`wd-${day}`}
                                    style={[
                                        styles.weekdayChip,
                                        { backgroundColor: selected ? colors.tint : colors.listItemBackgroundMuted },
                                    ]}
                                    onPress={() => {
                                        setWeekdays((prev) =>
                                            prev.includes(day) ? prev.filter((x) => x !== day) : [...prev, day]
                                        );
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: selected ? '#fff' : colors.textPrimary,
                                            fontWeight: '600',
                                            fontSize: 13,
                                        }}
                                    >
                                        {t(`medications.weekdaysShort.${day}`)}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </List.Section>
            )}

            {/* Interval input */}
            {scheduleType === 'every_x_days' && (
                <List.Section
                    title={t('medications.everyHowManyDays')}
                    titleStyle={[styles.fieldLabel, { color: colors.textPrimary }]}
                    rounded
                >
                    <List.InputItem
                        value={intervalDays}
                        rightLabel={t('medications.days')}
                        inline
                        onChangeText={setIntervalDays}
                        keyboardType="number-pad"
                        placeholder="2"
                        placeholderTextColor={colors.textHint}
                        selectTextOnFocus
                    />
                </List.Section>
            )}

            {/* Cycle config */}
            {scheduleType === 'cycle' && (
                <List.Section
                    title={t('medications.configureCycle')}
                    titleStyle={[styles.fieldLabel, { color: colors.textPrimary }]}
                    rounded
                >
                    <View style={[styles.cycleRow, { backgroundColor: colors.listItemBackground }]}>
                        <View style={styles.cycleItem}>
                            <Text style={[styles.cycleLabel, { color: colors.textSecondary }]}>
                                {t('medications.intake')}
                            </Text>
                            <View style={styles.cycleInputRow}>
                                <TextInput
                                    style={[
                                        styles.cycleInput,
                                        {
                                            backgroundColor: colors.listItemBackgroundMuted,
                                            color: colors.textPrimary,
                                        },
                                    ]}
                                    value={cycleOnDays}
                                    onChangeText={setCycleOnDays}
                                    keyboardType="number-pad"
                                    selectTextOnFocus
                                />
                                <Text style={[styles.cycleUnit, { color: colors.textSecondary }]}>
                                    {t('medications.days')}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.cycleItem}>
                            <Text style={[styles.cycleLabel, { color: colors.textSecondary }]}>
                                {t('medications.break')}
                            </Text>
                            <View style={styles.cycleInputRow}>
                                <TextInput
                                    style={[
                                        styles.cycleInput,
                                        {
                                            backgroundColor: colors.listItemBackgroundMuted,
                                            color: colors.textPrimary,
                                        },
                                    ]}
                                    value={cycleOffDays}
                                    onChangeText={setCycleOffDays}
                                    keyboardType="number-pad"
                                    selectTextOnFocus
                                />
                                <Text style={[styles.cycleUnit, { color: colors.textSecondary }]}>
                                    {t('medications.days')}
                                </Text>
                            </View>
                        </View>
                    </View>
                </List.Section>
            )}

            {/* Times editor */}
            {scheduleType !== 'as_needed' && (
                <>
                    <List.Section
                        title={t('medications.atWhatTime')}
                        titleStyle={[styles.fieldLabel, { color: colors.textPrimary }]}
                        rounded
                    >
                        <View style={[styles.timeRowWrapper, { backgroundColor: colors.listItemBackground }]}>
                            {times.map((time, index) => (
                                <View
                                    key={`time-${index}`}
                                    style={[
                                        styles.timeRow,
                                        {
                                            borderBottomWidth: StyleSheet.hairlineWidth,
                                            borderBottomColor: colors.listItemBorder,
                                        },
                                    ]}
                                >
                                    <Pressable
                                        style={styles.timeRemoveButton}
                                        onPress={() => setTimes((prev) => prev.filter((_, i) => i !== index))}
                                    >
                                        <AppIcon name="minus.circle.fill" tintColor="#FF3B30" size={22} />
                                    </Pressable>
                                    <AppDateTimePicker
                                        value={parseTimeString(time)}
                                        mode="time"
                                        onChange={(selectedDate) => {
                                            const newTime = formatTime(selectedDate);
                                            if (newTime === times[index]) return;
                                            setTimes((prev) => {
                                                const updated = [...prev];
                                                updated[index] = newTime;
                                                return updated.sort();
                                            });
                                        }}
                                    />
                                    <TextInput
                                        style={[styles.timeDosage, { color: colors.tint }]}
                                        value={dosageText}
                                        onChangeText={onDosageTextChange}
                                        textAlign="right"
                                        returnKeyType="done"
                                        selectTextOnFocus
                                    />
                                </View>
                            ))}
                            <Pressable
                                style={styles.addTimeButton}
                                onPress={() => {
                                    const newTime = getNextDefaultTime(times);
                                    setTimes((prev) => [...prev, newTime].sort());
                                }}
                            >
                                <AppIcon name="plus.circle.fill" tintColor={colors.tint} size={22} />
                                <Text style={[styles.addTimeText, { color: colors.tint }]}>
                                    {t('medications.addTime')}
                                </Text>
                            </Pressable>
                        </View>
                    </List.Section>
                    <List.Wrapper>
                        <List.Text>{t('medications.timeNotificationHint')}</List.Text>
                    </List.Wrapper>
                </>
            )}

            {/* Duration section */}
            <List.Section
                title={t('medications.duration')}
                titleStyle={[styles.fieldLabel, { color: colors.textPrimary }]}
                rounded
            >
                <View style={[styles.durationCard, { backgroundColor: colors.listItemBackground }]}>
                    <View style={styles.durationRow}>
                        <View style={styles.durationItem}>
                            <Text style={[styles.durationLabel, { color: colors.textSecondary }]}>
                                {t('medications.startDate').toUpperCase()}
                            </Text>
                            <Text style={[styles.durationValue, { color: colors.textPrimary }]}>
                                {formatDateDisplay(startDate, locale, t('common.today'))}
                            </Text>
                        </View>
                        <View style={styles.durationItem}>
                            <Text style={[styles.durationLabel, { color: colors.textSecondary }]}>
                                {t('medications.endDate').toUpperCase()}
                            </Text>
                            <Text style={[styles.durationValue, { color: colors.textPrimary }]}>
                                {endDate
                                    ? formatDateDisplay(endDate, locale, t('common.today'))
                                    : t('common.none')}
                            </Text>
                        </View>
                    </View>
                    <Pressable
                        onPress={() =>
                            router.push({
                                pathname: '/(tabs)/(metric)/medications/duration',
                                params: {
                                    startDate: startDate.toISOString(),
                                    endDate: endDate ? endDate.toISOString() : 'null',
                                },
                            })
                        }
                        style={styles.durationEditButton}
                    >
                        <Text style={[styles.changeButton, { color: colors.tint }]}>
                            {t('common.edit')}
                        </Text>
                    </Pressable>
                </View>
            </List.Section>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {},
    fieldLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 8,
    },
    scheduleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    scheduleRowText: {
        fontSize: 17,
    },
    changeButton: {
        fontSize: 17,
        fontWeight: '500',
    },
    weekdayRow: {
        padding: 14,
        justifyContent: 'space-between',
        flexDirection: 'row',
        gap: 6,
    },
    weekdayChip: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cycleRow: {
        padding: 18,
        flexDirection: 'row',
        gap: 16,
    },
    cycleItem: {
        flex: 1,
    },
    cycleLabel: {
        fontSize: 13,
        marginBottom: 4,
    },
    cycleInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cycleInput: {
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 17,
        width: 60,
        textAlign: 'center',
    },
    cycleUnit: {
        fontSize: 15,
    },
    timeRowWrapper: {},
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 18,
    },
    timeRemoveButton: {},
    timeDosage: {
        flex: 1,
        textAlign: 'right',
        fontSize: 17,
    },
    addTimeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 19,
    },
    addTimeText: {
        fontSize: 17,
    },
    durationRow: {
        flexDirection: 'row',
        gap: 16,
    },
    durationItem: {
        flex: 1,
    },
    durationLabel: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    durationValue: {
        fontSize: 17,
    },
    durationCard: {
        padding: 18,
    },
    durationEditButton: {
        marginTop: 12,
        alignItems: 'flex-start',
    },
});
