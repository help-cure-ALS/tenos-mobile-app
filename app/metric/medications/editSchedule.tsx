import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { Button } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import type { MedicationItem, MedicationSchedule } from '@/src/medications';
import { ScheduleEditor, useMedications } from '@/src/medications';

function EditScheduleForm({ medication }: { medication: MedicationItem }) {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const { updateMedication } = useMedications();

    const [schedule, setSchedule] = useState<MedicationSchedule>(medication.schedule);
    const [dosageText, setDosageText] = useState(medication.dosageText ?? '');
    const [startDate, setStartDate] = useState<Date>(new Date(medication.duration.startDate));
    const [endDate, setEndDate] = useState<Date | null>(
        medication.duration.endDate ? new Date(medication.duration.endDate) : null
    );
    const [saving, setSaving] = useState(false);

    const handleScheduleChange = useCallback((s: MedicationSchedule) => {
        setSchedule(s);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateMedication(medication.id, {
                schedule,
                dosageText: dosageText.trim() || undefined,
                duration: {
                    startDate: startDate.toISOString(),
                    endDate: endDate ? endDate.toISOString() : undefined,
                },
            });
            router.back();
        } catch (e) {
            console.error('Failed to update schedule:', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.modalBackground }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: t('medications.editScheduleTitle'),
                        headerBackVisible: false,
                        headerLeft: () => (
                            <HeaderButton icon="xmark" onPress={() => router.back()} />
                        ),
                    }}
                />
            ) : (
                <>
                    <Stack.Screen.Title>{t('medications.editScheduleTitle')}</Stack.Screen.Title>
                    <Stack.Toolbar placement="left">
                        <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} />
                    </Stack.Toolbar>
                </>
            )}

            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                <View style={[styles.sheet, { backgroundColor: colors.background }]}>
                    <View style={styles.contentWrapper}>
                        <ScheduleEditor
                            initialSchedule={schedule}
                            onScheduleChange={handleScheduleChange}
                            dosageText={dosageText}
                            onDosageTextChange={setDosageText}
                            startDate={startDate}
                            endDate={endDate}
                            onStartDateChange={setStartDate}
                            onEndDateChange={setEndDate}
                        />
                    </View>
                </View>
            </ScrollView>

            <View style={[styles.footer, { backgroundColor: colors.modalBackground }]}>
                <View style={styles.contentWrapper}>
                    <Button
                        title={saving ? t('common.saving') : t('common.save')}
                        rounded
                        disabled={saving}
                        onPress={() => handleSave().catch(console.error)}
                        style={styles.saveButton}
                    />
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

export default function EditScheduleScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const params = useLocalSearchParams<{ medicationId: string }>();
    const medicationId = String(params.medicationId ?? '');
    const { getMedicationById } = useMedications();

    const medication = useMemo(() => getMedicationById(medicationId), [getMedicationById, medicationId]);

    if (!medication) {
        return (
            <View style={[styles.empty, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.textPrimary }}>{t('medications.medicationNotFound')}</Text>
            </View>
        );
    }

    return <EditScheduleForm medication={medication} />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingBottom: 24,
    },
    sheet: {
        paddingTop: 14,
        paddingBottom: 24,
    },
    contentWrapper: {
        maxWidth: 620,
        marginHorizontal: 'auto',
        width: '100%',
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    },
    saveButton: {
        width: '100%',
    },
});
