import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { AppDateTimePicker } from '@/src/components/ui/AppDateTimePicker';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import {
    formatMedicationStrength,
    getMedicationFormIcon,
    getMedicationFormLabel,
    getScheduledSlotIso,
    useMedications,
    parseTimeString,
    formatTime,
} from '@/src/medications';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { fmtWeekdayLong, fmtDayMonthShort, fmtTime, getAppLocale, uses24HourClock } from '@/src/lib/formatDate';

function formatDateHeader(date: Date, locale: string): string {
    const isDE = locale.startsWith('de');
    return `${fmtWeekdayLong(date, isDE)}, ${fmtDayMonthShort(date, isDE)}`;
}

function formatLogTime(isoString: string, _locale: string): string {
    const date = new Date(isoString);
    return fmtTime(date);
}

export default function LogDoseModal() {
    const { t, i18n } = useTranslation();
    const { colors, isDark } = useAppTheme();
    const router = useSafeRouter();
    const params = useLocalSearchParams<{ time: string; date: string; medicationId?: string }>();
    const locale = i18n.language === 'de' ? 'de-DE' : 'en-US';

    const slotTime = params.time ?? '08:00';
    const appLocale = getAppLocale(i18n.language);
    const use24Hour = uses24HourClock(i18n.language);
    const selectedDate = useMemo(() => {
        if (params.date) {
            return new Date(params.date);
        }
        return new Date();
    }, [params.date]);
    const currentTime = useMemo(() => formatTime(new Date()), []);
    const [editedTime, setEditedTime] = useState<string | null>(null);
    const displayTime = editedTime ?? currentTime;

    const { getDaySlots, getDoseStatus, getDoseLog, logDose, logDoses, undoDoseLog, getMedicationById } = useMedications();

    const singleMed = params.medicationId
        ? getMedicationById(params.medicationId)
        : null;

    const daySlots = useMemo(() => singleMed ? [] : getDaySlots(selectedDate), [singleMed, getDaySlots, selectedDate]);
    const currentSlot = useMemo(
        () => daySlots.find((s) => s.time === slotTime),
        [daySlots, slotTime]
    );

    const medications = singleMed ? [singleMed] : (currentSlot?.medications ?? []);
    // scheduledFor always uses the original slot time (for matching / deduplication).
    // The edited time goes into takenAt when logging (retroactive logging).
    const scheduledFor = getScheduledSlotIso(selectedDate, slotTime);

    const [isBusy, setIsBusy] = useState(false);

    const allLogged = medications.every((med) => getDoseStatus(med.id, scheduledFor) !== 'pending');

    const handleLogAll = async () => {
        if (isBusy) return;
        setIsBusy(true);
        try {
            const takenAt = editedTime ? getScheduledSlotIso(selectedDate, editedTime) : undefined;
            const pending = medications.filter(med => getDoseStatus(med.id, scheduledFor) === 'pending');
            await logDoses(pending.map(med => ({
                medicationId: med.id,
                scheduledFor,
                ...(takenAt ? { takenAt } : {}),
                status: 'taken' as const,
            })));
        } finally {
            setIsBusy(false);
        }
    };

    const handleLog = async (medicationId: string, status: 'taken' | 'skipped') => {
        if (isBusy) return;
        setIsBusy(true);
        try {
            const takenAt = editedTime ? getScheduledSlotIso(selectedDate, editedTime) : undefined;
            await logDose({ medicationId, scheduledFor, ...(takenAt ? { takenAt } : {}), status });
        } finally {
            setIsBusy(false);
        }
    };

    const handleUndo = async (medicationId: string) => {
        if (isBusy) return;
        setIsBusy(true);
        try {
            await undoDoseLog(medicationId, scheduledFor);
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: formatDateHeader(selectedDate, locale),
                        headerRight: () => (
                            <HeaderButton icon="xmark" onPress={() => router.back()} />
                        ),
                    }}
                />
            ) : (
                <>
                    <Stack.Screen.Title>{formatDateHeader(selectedDate, locale)}</Stack.Screen.Title>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} />
                    </Stack.Toolbar>
                </>
            )}

            <ScrollView
                style={styles.scroll}
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <ScreenHeader
                    icon="pills.fill"
                    iconTintColor={colors.tint}
                    title={singleMed
                        ? singleMed.name
                        : t('medications.medicationsAt')}
                    subtitle={singleMed
                        ? undefined
                        : t('medications.medicationCount', { count: medications.length })}
                />

                {/* Editable time picker */}
                <View style={styles.timePickerRow}>
                    <AppDateTimePicker
                        value={parseTimeString(displayTime)}
                        mode="time"
                        onChange={(date) => setEditedTime(formatTime(date))}
                    />
                </View>

                {/* Log All Link */}
                {!allLogged && medications.length > 1 && !singleMed && (
                    <Pressable
                        onPress={() => handleLogAll().catch(console.error)}
                        disabled={isBusy}
                        style={[styles.logAllLink, isBusy && { opacity: 0.4 }]}
                    >
                        <Text style={[styles.logAllText, { color: colors.tint }]}>
                            {t('medications.logAllAsTaken')}
                        </Text>
                    </Pressable>
                )}

                {/* Medication Cards */}
                <View style={styles.cardList}>
                    {medications.map((med) => {
                        const status = getDoseStatus(med.id, scheduledFor);
                        const log = getDoseLog(med.id, scheduledFor);
                        const formIcon = getMedicationFormIcon(med.form);

                        const isLogged = status !== 'pending';

                        return (
                            <View
                                key={med.id}
                                style={[styles.card, { backgroundColor: colors.listItemBackground }]}
                            >
                                {/* Medication Info */}
                                <View style={styles.medRow}>
                                    <View style={[styles.pillIcon, { backgroundColor: colors.tint + '22' }]}>
                                        <AppIcon name={formIcon} tintColor={colors.tint} size={20} />
                                    </View>
                                    <View style={styles.medInfo}>
                                        <Text style={[styles.medName, { color: colors.textPrimary }]}>
                                            {med.name}
                                        </Text>
                                        <Text style={[styles.medMeta, { color: colors.textSecondary }]}>
                                            {getMedicationFormLabel(med.form)}, {formatMedicationStrength(med)}
                                        </Text>
                                        {isLogged && log && (
                                            <Pressable
                                                style={styles.statusRow}
                                                onPress={() => handleUndo(med.id).catch(console.error)}
                                            >
                                                <Text style={[styles.statusText, { color: colors.tint }]}>
                                                    {status === 'taken'
                                                        ? t('medications.doseAt', { dose: med.dosageText ?? t('medications.defaultDosage.other'), time: formatLogTime(log.takenAt, locale) })
                                                        : t('medications.skippedAt', { time: formatLogTime(log.takenAt, locale) })}
                                                </Text>
                                                <AppIcon
                                                    name={"chevron.right"}
                                                    tintColor={colors.tint}
                                                    size={12}
                                                />
                                            </Pressable>
                                        )}
                                    </View>
                                </View>

                                {/* Notes */}
                                {med.notes && (
                                    <Text style={[styles.notes, { color: colors.textSecondary }]}>
                                        {med.notes}
                                    </Text>
                                )}

                                {/* Action Buttons */}
                                {!isLogged ? (
                                    <View style={styles.buttonRow}>
                                        {!singleMed && (
                                            <Button
                                                title={t('medications.skipped')}
                                                variant="tinted"
                                                rounded
                                                disabled={isBusy}
                                                onPress={() => handleLog(med.id, 'skipped').catch(console.error)}
                                                style={styles.actionBtn}
                                            />
                                        )}
                                        <Button
                                            title={t('medications.taken')}
                                            rounded
                                            disabled={isBusy}
                                            onPress={() => handleLog(med.id, 'taken').catch(console.error)}
                                            style={styles.actionBtn}
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.doneRow}>
                                        <Text style={[styles.doneText, { color: colors.textHint }]}>
                                            {t('common.done')}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        alignItems: 'center',
        maxWidth: 620,
        marginHorizontal: 'auto',
        width: '100%',
    },
    headerIcon: {
        marginTop: 20,
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 34,
    },
    subtitle: {
        fontSize: 15,
        marginTop: 4,
    },
    timePickerRow: {
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 4,
    },
    logAllLink: {
        marginTop: 16,
        marginBottom: 8,
    },
    logAllText: {
        fontSize: 16,
        fontWeight: '500',
    },
    cardList: {
        width: '100%',
        gap: 12,
        marginTop: 20,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        gap: 12,
    },
    medRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    pillIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    medInfo: {
        flex: 1,
        gap: 2,
    },
    medName: {
        fontSize: 18,
        fontWeight: '600',
    },
    medMeta: {
        fontSize: 14,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '500',
    },
    notes: {
        fontSize: 14,
        marginLeft: 56,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
    },
    actionBtn: {
        flex: 1,
    },
    doneRow: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    doneText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
