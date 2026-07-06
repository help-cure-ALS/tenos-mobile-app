import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    ImageBackground,
    Platform,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { useAppTheme } from '@/src/theme';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useTranslation } from 'react-i18next';
import { emit } from '@/src/lib/bus';
import { getMetricDefinition } from '@/src/metrics/definitions';
import { metricEntryToFhir } from '@/src/metrics/fhir/metricToFhir';
import type { MetricEntry } from '@/src/metrics/types';
import { MonthYearPicker, monthYearToString, type MonthYearValue } from '@/src/components/ui/MonthYearPicker';
import { Button, List } from 'react-native-nice-ui';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';

// Types
type GenderOption = 'male' | 'female' | 'other' | 'unknown';

// FHIR Extension URLs
const FIRST_SYMPTOMS_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/first-symptoms-date';
const DIAGNOSIS_DATE_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/diagnosis-date';
const HEIGHT_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/body-height-cm';

type FhirExtension = {
    url: string;
    valueBoolean?: boolean;
    valueString?: string;
    valueDecimal?: number;
};

function monthYearToYYYYMM(value: MonthYearValue): string {
    return `${ value.year }-${ String(value.month).padStart(2, '0') }`;
}

function buildExtensions(args: {
    firstSymptoms?: MonthYearValue;
    diagnosisDate?: MonthYearValue;
    heightCm?: number;
}): FhirExtension[] | undefined {
    const exts: FhirExtension[] = [];

    if (args.firstSymptoms) {
        exts.push({ url: FIRST_SYMPTOMS_EXTENSION_URL, valueString: monthYearToYYYYMM(args.firstSymptoms) });
    }
    if (args.diagnosisDate) {
        exts.push({ url: DIAGNOSIS_DATE_EXTENSION_URL, valueString: monthYearToYYYYMM(args.diagnosisDate) });
    }
    if (args.heightCm !== undefined && args.heightCm > 0) {
        exts.push({ url: HEIGHT_EXTENSION_URL, valueDecimal: args.heightCm });
    }

    return exts.length > 0 ? exts : undefined;
}

export default function PatientHealthScreen() {
    const { t, i18n } = useTranslation();
    const { colors, isDark } = useAppTheme();
    const { syncEnabled, fullSync, getOrCreateSubjectId } = useAppSync();
    const fhirRepo = useFhirRepo();
    const router = useSafeRouter();

    const [birthDate, setBirthDate] = useState<MonthYearValue | undefined>();
    const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
    const [heightCm, setHeightCm] = useState('');
    const [weightKg, setWeightKg] = useState('');
    const [gender, setGender] = useState<GenderOption>('unknown');
    const [firstSymptoms, setFirstSymptoms] = useState<MonthYearValue | undefined>();
    const [diagnosisDate, setDiagnosisDate] = useState<MonthYearValue | undefined>();
    const [showFirstSymptomsPicker, setShowFirstSymptomsPicker] = useState(false);
    const [showDiagnosisPicker, setShowDiagnosisPicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Gender options
    const genderOptions: { value: GenderOption; label: string }[] = useMemo(() => [
        { value: 'male', label: t('healthInfo.genderMale') },
        { value: 'female', label: t('healthInfo.genderFemale') },
        { value: 'other', label: t('healthInfo.genderOther') },
        { value: 'unknown', label: t('healthInfo.genderUnknown') }
    ], [t]);

    const getGenderLabel = useCallback((value: GenderOption): string => {
        return genderOptions.find(o => o.value === value)?.label ?? t('healthInfo.genderUnknown');
    }, [genderOptions, t]);

    const showGenderPicker = useCallback(() => {
        if (Platform.OS === 'ios') {
            const { ActionSheetIOS } = require('react-native');
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: [t('common.cancel'), ...genderOptions.map(o => o.label)],
                    cancelButtonIndex: 0
                },
                (buttonIndex) => {
                    if (buttonIndex > 0) {
                        setGender(genderOptions[buttonIndex - 1].value);
                    }
                }
            );
        } else {
            Alert.alert(
                t('healthInfo.gender'),
                t('healthInfo.selectGender'),
                genderOptions.map(o => ({
                    text: o.label,
                    onPress: () => setGender(o.value)
                }))
            );
        }
    }, [t, genderOptions]);

    const handleSkip = useCallback(() => {
        router.replace('/onboarding/patient/sharing');
    }, []);

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        try {
            const pid = await getOrCreateSubjectId();
            const parsedHeight = heightCm ? parseFloat(heightCm) : undefined;
            const parsedWeight = weightKg ? parseFloat(weightKg) : undefined;

            const now = new Date().toISOString();
            const patient = {
                resourceType: 'Patient' as const,
                id: pid,
                birthDate: birthDate ? monthYearToYYYYMM(birthDate) : undefined,
                gender,
                extension: buildExtensions({
                    firstSymptoms,
                    diagnosisDate,
                    heightCm: parsedHeight && !isNaN(parsedHeight) ? parsedHeight : undefined,
                }),
                meta: { lastUpdated: now }
            };

            await fhirRepo.upsert('Patient', pid, patient, now);

            // Store weight as metric entry if provided
            if (parsedWeight && !isNaN(parsedWeight)) {
                const weightDef = getMetricDefinition('weight', i18n.language);
                if (weightDef) {
                    const id = Crypto.randomUUID();
                    const entry: MetricEntry = {
                        id,
                        values: { value: parsedWeight },
                        date: new Date(),
                        unit: weightDef.defaultUnit,
                        source: 'profile',
                        addedAt: new Date()
                    };
                    const fhir = metricEntryToFhir(entry, weightDef, `Patient/${ pid }`);
                    await fhirRepo.upsert('Observation', id, fhir, fhir.meta?.lastUpdated);
                }
            }

            emit('fhir:changed');

            if (syncEnabled) {
                await fullSync('onboarding health save');
            }

            router.replace('/onboarding/patient/sharing');
        }
        catch (e: any) {
            console.error(e);
            Alert.alert(t('common.error'), e?.message ?? String(e));
        }
        finally {
            setIsSaving(false);
        }
    }, [t, fhirRepo, getOrCreateSubjectId, birthDate, heightCm, weightKg, gender, firstSymptoms, diagnosisDate, syncEnabled, fullSync, i18n.language]);

    return (
        <>
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') }
                             style={ [{ flex: 1 }, { backgroundColor: colors.onboardingBackground }] }>
                <ScrollView
                    // style={{ backgroundColor: colors.modalBackground }}
                    contentContainerStyle={ styles.scrollView }
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <ScrollViewContent>
                        <ScreenHeader
                            icon="stethoscope"
                            iconTintColor={ colors.brandColorMuted }
                            subtitle={ t('onboarding.health.subtitle') }
                        />

                        <List.Section rounded>
                            <List.Item
                                title={ t('healthInfo.birthDate') }
                                onPress={ () => setShowBirthDatePicker(true) }
                                hideChevron
                                rightTitle={ birthDate ? monthYearToString(birthDate, i18n.language) : t('healthInfo.select') }
                            />
                            <List.Item
                                title={ t('healthInfo.gender') }
                                onPress={ showGenderPicker }
                                hideChevron
                                rightTitle={ getGenderLabel(gender) }
                            />
                            <List.InputItem
                                label={ t('healthInfo.height') }
                                value={ heightCm }
                                onChangeText={ setHeightCm }
                                placeholder="cm"
                                keyboardType="numeric"
                                returnKeyType="done"
                                inline
                            />
                            <List.InputItem
                                label={ t('healthInfo.weight') }
                                value={ weightKg }
                                onChangeText={ setWeightKg }
                                placeholder="kg"
                                keyboardType="numeric"
                                returnKeyType="done"
                                inline
                            />
                        </List.Section>

                        <List.Section rounded>
                            <List.Item
                                title={ t('healthInfo.firstSymptoms') }
                                subtitle={ t('healthInfo.firstSymptomsSubtitle') }
                                onPress={ () => setShowFirstSymptomsPicker(true) }
                                hideChevron
                                rightTitle={ firstSymptoms ? monthYearToString(firstSymptoms, i18n.language) : t('healthInfo.select') }
                            />
                            <List.Item
                                title={ t('healthInfo.diagnosis') }
                                subtitle={ t('healthInfo.diagnosisSubtitle') }
                                onPress={ () => setShowDiagnosisPicker(true) }
                                hideChevron
                                rightTitle={ diagnosisDate ? monthYearToString(diagnosisDate, i18n.language) : t('healthInfo.select') }
                                lastItem
                            />
                        </List.Section>

                        <List.Wrapper>
                            <View style={ styles.buttonContainer }>
                                <Button
                                    title={ t('onboarding.health.save') }
                                    onPress={ handleSave }
                                    disabled={ isSaving }
                                    fullWidth
                                    rounded
                                />
                                <Button
                                    title={ t('onboarding.health.skip') }
                                    onPress={ handleSkip }
                                    variant="tinted"
                                    fullWidth
                                    rounded
                                />

                            </View>
                        </List.Wrapper>
                    </ScrollViewContent>
                </ScrollView>
            </ImageBackground>
            <MonthYearPicker
                visible={ showFirstSymptomsPicker }
                value={ firstSymptoms }
                title={ t('healthInfo.firstSymptoms') }
                onSelect={ setFirstSymptoms }
                onClose={ () => setShowFirstSymptomsPicker(false) }
            />

            <MonthYearPicker
                visible={ showDiagnosisPicker }
                value={ diagnosisDate }
                title={ t('healthInfo.diagnosisDate') }
                onSelect={ setDiagnosisDate }
                onClose={ () => setShowDiagnosisPicker(false) }
            />

            <MonthYearPicker
                visible={ showBirthDatePicker }
                value={ birthDate }
                defaultValue={ { month: new Date().getMonth() + 1, year: new Date().getFullYear() - 50 } }
                title={ t('healthInfo.birthDate') }
                onSelect={ setBirthDate }
                onClose={ () => setShowBirthDatePicker(false) }
            />
        </>
    );
}

const styles = StyleSheet.create({
    image: {
        flex: 1
    },
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    buttonContainer: {
        paddingTop: 24,
        gap: 12,
        alignItems: 'center'
    },
    skipButton: {
        paddingVertical: 12,
        paddingHorizontal: 16
    },
    skipText: {
        fontSize: 16,
        fontWeight: '500'
    }
});
