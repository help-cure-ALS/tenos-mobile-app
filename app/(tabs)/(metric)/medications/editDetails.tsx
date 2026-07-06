import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, Text } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { useTranslation } from 'react-i18next';
import { Button, List } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import type { MedicationForm, MedicationItem, MedicationUnit } from '@/src/medications';
import {
    ALL_FORM_KEYS,
    parseMedicationStrengthInput,
    useMedications,
} from '@/src/medications';

const UNIT_KEYS: MedicationUnit[] = ['mg', 'mcg', 'g', 'ml', 'drop', 'tablet', 'capsule', 'other'];

function EditDetailsForm({ medication }: { medication: MedicationItem }) {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const { updateMedication } = useMedications();

    const [form, setForm] = useState<MedicationForm>(medication.form);
    const [strengthValue, setStrengthValue] = useState(
        medication.strengthValue !== undefined ? String(medication.strengthValue) : ''
    );
    const [strengthUnit, setStrengthUnit] = useState<MedicationUnit>(medication.strengthUnit ?? 'mg');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateMedication(medication.id, {
                form,
                strengthValue: parseMedicationStrengthInput(strengthValue),
                strengthUnit,
            });
            router.back();
        } catch (e) {
            console.error('Failed to update details:', e);
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
                        headerTitle: t('medications.editDetailsTitle'),
                        headerBackVisible: false,
                        headerLeft: () => (
                            <HeaderButton icon="xmark" onPress={() => router.back()} />
                        ),
                    }}
                />
            ) : (
                <>
                    <Stack.Screen.Title>{t('medications.editDetailsTitle')}</Stack.Screen.Title>
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
                        {/* Strength */}
                        <List.Section
                            title={t('medications.strength')}
                            titleStyle={[styles.fieldLabel, { color: colors.textPrimary }]}
                            rounded
                        >
                            <List.InputItem
                                value={strengthValue}
                                onChangeText={setStrengthValue}
                                keyboardType="decimal-pad"
                                placeholder={t('medications.strengthPlaceholder')}
                                placeholderTextColor={colors.textHint}
                            />
                        </List.Section>

                        {/* Unit selection */}
                        <List.Section
                            title={t('medications.selectUnit')}
                            titleStyle={[styles.fieldLabel, { color: colors.textPrimary }]}
                            rounded
                        >
                            {UNIT_KEYS.map((unitKey, index) => (
                                <List.Item
                                    key={unitKey}
                                    title={t(`medications.units.${unitKey}`)}
                                    onPress={() => setStrengthUnit(unitKey)}
                                    hideChevron
                                    rightCmp={
                                        strengthUnit === unitKey ? (
                                            <AppIcon name="checkmark" tintColor={colors.tint} size={16} />
                                        ) : undefined
                                    }
                                    lastItem={index === UNIT_KEYS.length - 1}
                                />
                            ))}
                        </List.Section>

                        {/* Form selection */}
                        <List.Section
                            title={t('medications.selectType')}
                            titleStyle={[styles.fieldLabel, { color: colors.textPrimary }]}
                            rounded
                        >
                            {ALL_FORM_KEYS.map((formKey, index) => (
                                <List.Item
                                    key={formKey}
                                    title={t(`medications.forms.${formKey}`)}
                                    onPress={() => setForm(formKey)}
                                    hideChevron
                                    rightCmp={
                                        form === formKey ? (
                                            <AppIcon name="checkmark" tintColor={colors.tint} size={16} />
                                        ) : undefined
                                    }
                                    lastItem={index === ALL_FORM_KEYS.length - 1}
                                />
                            ))}
                        </List.Section>
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

export default function EditDetailsScreen() {
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

    return <EditDetailsForm medication={medication} />;
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
    fieldLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 8,
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
