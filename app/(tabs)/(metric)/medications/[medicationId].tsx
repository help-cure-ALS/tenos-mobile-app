import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useTranslation } from 'react-i18next';
import { Button, List } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import {
    formatMedicationStrength,
    getMedicationFormIcon,
    getMedicationFormLabel,
    getScheduleLabel,
    useMedications,
} from '@/src/medications';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmtDateShort, fmtTime } from '@/src/lib/formatDate';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';
import { ListItemIcon } from "@/src/components/ui/ListItemIcon";

export default function MedicationDetailScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { isFiltering, isLoaded: sharingLoaded, canSeeCategory } = useSharingFilter();
    const params = useLocalSearchParams<{ medicationId: string }>();
    const medicationId = String(params.medicationId ?? '');
    const locale = i18n.language === 'de' ? 'de-DE' : 'en-US';

    const {
        getMedicationById,
        getMedicationLogs,
        updateMedication,
        archiveMedication,
        deleteMedication
    } = useMedications();

    const medication = useMemo(() => getMedicationById(medicationId), [getMedicationById, medicationId]);
    const recentLogs = useMemo(() => getMedicationLogs(medicationId, 7), [getMedicationLogs, medicationId]);

    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!medication) return;
        setName(medication.name);
        setNotes(medication.notes ?? '');
    }, [medication]);

    if (!sharingLoaded || (isFiltering && !canSeeCategory('medications'))) {
        if (isFiltering && sharingLoaded) router.back();
        return null;
    }

    if (!medication) {
        return (
            <View style={[styles.empty, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.textPrimary }}>{t('medications.medicationNotFound')}</Text>
            </View>
        );
    }

    const handleSave = async () => {
        try {
            await updateMedication(medication.id, {
                name: name.trim() || medication.name,
                notes: notes.trim() || undefined,
            });
            router.back();
        } catch (e) {
            console.error('Failed to update medication:', e);
        }
    };

    const handleToggleActive = () => {
        if (medication.isActive) {
            Alert.alert(t('medications.pauseMedicationTitle'), t('medications.pauseMedicationMessage'), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('medications.pause'),
                    style: 'destructive',
                    onPress: () => {
                        archiveMedication(medication.id)
                            .then(() => router.back())
                            .catch(console.error);
                    },
                },
            ]);
        } else {
            updateMedication(medication.id, { isActive: true })
                .then(() => router.back())
                .catch(console.error);
        }
    };

    const handleDelete = () => {
        Alert.alert(t('medications.deleteMedicationTitle'), t('medications.deleteMedicationMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => {
                    deleteMedication(medication.id)
                        .then(() => router.replace('/(tabs)/(metric)/medications'))
                        .catch(console.error);
                },
            },
        ]);
    };

    const navigateEdit = (screen: string) => {
        router.push({
            pathname: `/(tabs)/(metric)/medications/${screen}` as any,
            params: { medicationId: medication.id },
        });
    };

    return (
        <>
            <Stack.Screen
                options={{
                    headerTitle: medication.name,
                    headerLargeTitle: false,
                }}
            />

            <ScrollView
                style={{ backgroundColor: colors.background }}
                contentContainerStyle={styles.scrollView}
                contentInsetAdjustmentBehavior="automatic"
            >
                <View style={ [styles.bodyWrapper,
                    {
                        // We add the insets to the padding so that the content
                        // doesn't disappear under the sidebar.
                        paddingLeft: insets.left,
                        paddingRight: insets.right
                    },
                    insets.left > 200 && { maxWidth: 940 + insets.left }
                ] }>
                    {/* Icon Preview */}
                    <View style={styles.previewContainer}>
                        <View style={[styles.previewIcon, { backgroundColor: colors.tint + '22' }]}>
                            <AppIcon
                                name={getMedicationFormIcon(medication.form)}
                                tintColor={colors.tint}
                                size={40}
                            />
                        </View>
                        <Text style={[styles.previewName, { color: colors.textPrimary }]}>
                            {medication.name}
                        </Text>
                        <Text style={[styles.previewMeta, { color: colors.textSecondary }]}>
                            {getMedicationFormLabel(medication.form)}, {formatMedicationStrength(medication)}
                        </Text>
                    </View>

                    {/* Recent Logs */}
                    <List.Section title={t('medications.recentIntakes')} rounded>
                        {recentLogs.slice(0, 5).map((log, index) => {
                            const date = new Date(log.takenAt);
                            const isDE = locale.startsWith('de');
                            const dateStr = fmtDateShort(date, isDE);
                            const timeStr = fmtTime(date);
                            return (
                                <List.Item
                                    key={log.id}
                                    title={`${dateStr} ${t('medications.takenAt', { time: timeStr })}`}
                                    subtitle={
                                        log.status === 'taken'
                                            ? t('medications.taken')
                                            : t('medications.skipped')
                                    }
                                    leftCmpSize={ 32 }
                                    leftCmp={
                                        <ListItemIcon
                                            name={
                                            log.status === 'taken'
                                                ? 'checkmark.circle.fill'
                                                : 'xmark.circle.fill'
                                        }
                                                      color={ colors.tint }
                                                      backgroundColor={ colors.tint + '22' } />
                                    }
                                />
                            );
                        })}
                        <List.Item
                            title={t('medications.logNewDose')}
                            leftCmpSize={ 32 }
                            leftCmp={
                                <ListItemIcon
                                    name="plus.circle.fill"
                                    color={ colors.tint }
                                    backgroundColor={ colors.tint + '22' } />
                            }
                            onPress={() => {
                                const now = new Date();
                                const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                router.push({
                                    pathname: '/(tabs)/(metric)/medications/log',
                                    params: {
                                        time,
                                        date: now.toISOString(),
                                        medicationId: medication.id,
                                    },
                                });
                            }}
                            lastItem
                        />
                    </List.Section>

                    {/* Schedule Section */}
                    <List.Section
                        title={t('medications.schedule')}
                        rightCmp={
                            <Pressable onPress={() => navigateEdit('editSchedule')}>
                                <Text style={[styles.editLink, { color: colors.tint }]}>
                                    {t('common.edit')}
                                </Text>
                            </Pressable>
                        }
                        rounded
                    >
                        <List.Item
                            title={t('medications.frequency')}
                            subtitle={getScheduleLabel(medication.schedule)}
                            hideChevron
                            lastItem={medication.schedule.times.length === 0}
                        />
                        {medication.schedule.times.map((time, index) => (
                            <List.Item
                                key={`schedule-time-${time}-${index}`}
                                title={time}
                                hideChevron
                                rightCmp={
                                    medication.dosageText ? (
                                        <Text style={[styles.dosageLabel, { color: colors.textSecondary }]}>
                                            {medication.dosageText}
                                        </Text>
                                    ) : undefined
                                }
                                lastItem={index === medication.schedule.times.length - 1}
                            />
                        ))}
                    </List.Section>

                    {/* Details — tappable to edit */}
                    <List.Section
                        title={t('medications.details')}
                        rightCmp={
                            <Pressable onPress={() => navigateEdit('editDetails')}>
                                <Text style={[styles.editLink, { color: colors.tint }]}>
                                    {t('common.edit')}
                                </Text>
                            </Pressable>
                        }
                        rounded
                    >
                        <List.Item
                            title={t('medications.type')}
                            subtitle={getMedicationFormLabel(medication.form)}
                            hideChevron
                        />
                        <List.Item
                            title={t('medications.strength')}
                            subtitle={formatMedicationStrength(medication)}
                            hideChevron
                            lastItem
                        />
                    </List.Section>

                    {/* Name + Notes editing */}
                    <View style={styles.formSection}>
                        <Text style={[styles.label, { color: colors.textPrimary }]}>
                            {t('medications.name')}
                        </Text>
                        <TextInput
                            style={[
                                styles.input,
                                { backgroundColor: colors.listItemBackground, color: colors.textPrimary },
                            ]}
                            value={name}
                            onChangeText={setName}
                        />

                        <Text style={[styles.label, { color: colors.textPrimary }]}>
                            {t('medications.note')}
                        </Text>
                        <TextInput
                            style={[
                                styles.input,
                                styles.textArea,
                                { backgroundColor: colors.listItemBackground, color: colors.textPrimary },
                            ]}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                        />
                    </View>

                    <View style={styles.actionRow}>
                        <Button
                            title={t('common.save')}
                            rounded
                            onPress={() => handleSave().catch(console.error)}
                            style={styles.actionBtn}
                        />
                        <Button
                            title={medication.isActive ? t('medications.pause') : t('medications.resume')}
                            rounded
                            variant="tinted"
                            onPress={handleToggleActive}
                            style={styles.actionBtn}
                        />
                    </View>

                    <Button
                        title={t('medications.deleteMedication')}
                        rounded
                        variant="ghost"
                        onPress={handleDelete}
                        style={styles.deleteBtn}
                    />
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90,
    },
    bodyWrapper: {
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%',
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewContainer: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    previewIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewName: {
        fontSize: 24,
        fontWeight: '700',
        marginTop: 12,
    },
    previewMeta: {
        fontSize: 15,
        marginTop: 4,
    },
    editLink: {
        fontSize: 17,
        fontWeight: '500',
    },
    dosageLabel: {
        fontSize: 17,
    },
    formSection: {
        paddingHorizontal: 16,
        marginTop: 14,
        gap: 8,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 8,
    },
    input: {
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
    },
    textArea: {
        minHeight: 90,
        textAlignVertical: 'top',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        marginTop: 18,
    },
    actionBtn: {
        flex: 1,
    },
    deleteBtn: {
        marginHorizontal: 16,
        marginTop: 12,
    },
});
