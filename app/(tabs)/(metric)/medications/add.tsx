import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    View
} from 'react-native';
import { Stack } from 'expo-router';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { useTranslation } from 'react-i18next';
import { Button, List, Space } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import type {
    MedicationForm,
    MedicationSchedule,
    MedicationUnit,
} from '@/src/medications';
import {
    getMedicationFormIcon,
    ALL_FORM_KEYS,
    parseMedicationStrengthInput,
    ScheduleEditor,
    useMedications
} from '@/src/medications';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Step = 0 | 1 | 2 | 3;

const UNIT_KEYS: MedicationUnit[] = ['mg', 'mcg', 'g', 'ml', 'drop', 'tablet', 'capsule', 'other'];

export default function MedicationAddScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { addMedication } = useMedications();

    const [step, setStep] = useState<Step>(0);
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState('');
    const [form, setForm] = useState<MedicationForm>('tablet');
    const [strengthValue, setStrengthValue] = useState('');
    const [strengthUnit, setStrengthUnit] = useState<MedicationUnit>('mg');
    const [dosageText, setDosageText] = useState('');
    const dosageEditedByUser = useRef(false);
    const [schedule, setSchedule] = useState<MedicationSchedule>({ type: 'daily', times: ['09:30'] });
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date | null>(null);

    const handleScheduleChange = useCallback((s: MedicationSchedule) => {
        setSchedule(s);
    }, []);

    const handleDosageChange = useCallback((text: string) => {
        dosageEditedByUser.current = true;
        setDosageText(text);
    }, []);

    const canContinue = useMemo(() => {
        if (step === 0) {
            return name.trim().length > 0;
        }

        if (step === 3) {
            if (schedule.type === 'as_needed') {
                return true;
            }
            return schedule.times.length > 0;
        }

        return true;
    }, [name, schedule, step]);

    const nextButtonTitle = step === 3 ? (saving ? t('common.saving') : t('common.done')) : t('common.next');

    const handleNext = async () => {
        if (step < 3) {
            let nextStep = (step + 1) as Step;
            // Set default dosage when entering step 3
            if (nextStep === 3 && !dosageEditedByUser.current) {
                const unit = t(`medications.defaultDosage.${form}`);
                setDosageText(form === 'liquid' && strengthValue
                    ? `${strengthValue} ${unit}`
                    : unit
                );
            }
            setStep(nextStep);
            return;
        }

        setSaving(true);
        try {
            await addMedication({
                name: name.trim(),
                form,
                strengthValue: parseMedicationStrengthInput(strengthValue),
                strengthUnit,
                dosageText: dosageText.trim() || undefined,
                schedule,
                duration: {
                    startDate: startDate.toISOString(),
                    endDate: endDate ? endDate.toISOString() : undefined
                },
                isActive: true,
            });

            router.replace('/(tabs)/(metric)/medications');
        }
        catch (e) {
            console.error('Failed to add medication:', e);
        }
        finally {
            setSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={ [styles.container, { backgroundColor: colors.modalBackground }] }
            behavior={ Platform.OS === 'ios' ? 'padding' : undefined }
            keyboardVerticalOffset={ 20 }
        >
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={ {
                        headerTitle: name.trim() || t('medications.medication'),
                        ...(step > 0 ? {
                            headerBackVisible: false,
                            headerLeft: () => (
                                <HeaderButton icon="chevron.left" onPress={() => setStep((step - 1) as Step)} />
                            )
                        } : {}),
                        headerRight: () => (
                            <HeaderButton icon="xmark" onPress={() => router.back()} />
                        )
                    } }
                />
            ) : (
                <>
                    <Stack.Screen.Title>{name.trim() || t('medications.medication')}</Stack.Screen.Title>
                    {step > 0 && (
                        <Stack.Toolbar placement="left">
                            <Stack.Toolbar.Button icon="chevron.left" onPress={() => setStep((step - 1) as Step)} />
                        </Stack.Toolbar>
                    )}
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} />
                    </Stack.Toolbar>
                </>
            )}

            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={ styles.content }
                keyboardShouldPersistTaps="handled"
            >
                <View style={ [styles.sheet, { backgroundColor: colors.background }] }>
                    <View style={ styles.contentWrapper }>
                        <ScreenHeader
                            icon={ getMedicationFormIcon(form) }
                            iconTintColor={ colors.tint }
                            iconContainerColor={ colors.tint + '22' }
                            title={ t(`medications.stepTitles.${step}`) }
                            subtitle={ t(`medications.stepSubtitles.${step}`) }
                            textAlign="left"
                        />

                        { step === 0 && (
                            <List.Wrapper>
                                <Space size="lg" />
                                <TextInput
                                    style={ [
                                        styles.input,
                                        {
                                            backgroundColor: colors.listItemBackground,
                                            color: colors.textPrimary
                                        }
                                    ] }
                                    placeholder={ t('medications.namePlaceholder') }
                                    placeholderTextColor={ colors.textHint }
                                    value={ name }
                                    onChangeText={ setName }
                                    autoFocus
                                />
                            </List.Wrapper>
                        ) }

                        { step === 1 && (
                            <List.Section title={ t('medications.selectType') }
                                          titleStyle={ [styles.fieldLabel, { color: colors.textPrimary }] } rounded>
                                { ALL_FORM_KEYS.map((formKey, index) => (
                                    <List.Item
                                        key={ formKey }
                                        title={ t(`medications.forms.${formKey}`) }
                                        onPress={ () => setForm(formKey) }
                                        hideChevron
                                        rightCmp={
                                            form === formKey ? (
                                                <AppIcon name="checkmark" tintColor={ colors.tint } size={ 16 } />
                                            ) : undefined
                                        }
                                        lastItem={ index === ALL_FORM_KEYS.length - 1 }
                                    />
                                )) }
                            </List.Section>
                        ) }

                        { step === 2 && (
                            <View>
                                <List.Section title={ t('medications.strength') }
                                              titleStyle={ [styles.fieldLabel, { color: colors.textPrimary }] } rounded>
                                    <List.InputItem
                                        value={ strengthValue }
                                        onChangeText={ setStrengthValue }
                                        keyboardType="decimal-pad"
                                        placeholder={ t('medications.strengthPlaceholder') }
                                        placeholderTextColor={ colors.textHint }
                                    />
                                </List.Section>

                                <List.Section title={ t('medications.selectUnit') }
                                              titleStyle={ [styles.fieldLabel, { color: colors.textPrimary }] } rounded>
                                    { UNIT_KEYS.map((unitKey, index) => (
                                        <List.Item
                                            key={ unitKey }
                                            title={ t(`medications.units.${unitKey}`) }
                                            onPress={ () => setStrengthUnit(unitKey) }
                                            hideChevron
                                            rightCmp={
                                                strengthUnit === unitKey ? (
                                                    <AppIcon name="checkmark" tintColor={ colors.tint } size={ 16 } />
                                                ) : undefined
                                            }
                                            lastItem={ index === UNIT_KEYS.length - 1 }
                                        />
                                    )) }
                                </List.Section>
                            </View>
                        ) }

                        { step === 3 && (
                            <ScheduleEditor
                                initialSchedule={ schedule }
                                onScheduleChange={ handleScheduleChange }
                                dosageText={ dosageText }
                                onDosageTextChange={ handleDosageChange }
                                startDate={ startDate }
                                endDate={ endDate }
                                onStartDateChange={ setStartDate }
                                onEndDateChange={ setEndDate }
                            />
                        ) }
                    </View>
                </View>
            </ScrollView>

            <View style={ [styles.footer, { backgroundColor: colors.modalBackground, paddingBottom: insets.bottom + 20 }] }>
                <View style={ styles.contentWrapper }>
                    <View style={ styles.footerPrimaryCol }>
                        <Button
                            title={ nextButtonTitle }
                            rounded
                            disabled={ !canContinue || saving }
                            onPress={ () => {
                                handleNext().catch(console.error);
                            } }
                            style={ styles.footerPrimaryButton }
                        />

                        { step === 2 && (
                            <Button
                                title={ t('common.skip') }
                                rounded
                                variant="ghost"
                                onPress={ () => {
                                    setStep(3);
                                } }
                                style={ styles.skipButton }
                            />
                        ) }
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    content: {
        paddingBottom: 24
    },
    sheet: {
        paddingTop: 14,
        paddingBottom: 24
    },
    contentWrapper: {
        maxWidth: 620,
        marginHorizontal: 'auto',
        width: '100%',
    },
    fieldLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 8
    },
    input: {
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 17
    },
    footer: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 10,
        alignItems: 'flex-end'
    },
    footerPrimaryCol: {
        flex: 1.4,
        gap: 8
    },
    footerPrimaryButton: {
        width: '100%'
    },
    skipButton: {
        width: '100%'
    },
});
