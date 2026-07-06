import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Platform,
    StyleSheet,
    ScrollView,
    View
} from "react-native";
import * as Crypto from 'expo-crypto';
import { Stack } from "expo-router";
import { useTranslation } from 'react-i18next';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from "@/src/theme";

import { useAppSync } from "@/src/context/AppSyncProvider";
import { useAppRole } from "@/src/context/AppRoleProvider";
import { useFhirRepo } from "@/src/hooks/useFhirRepo";
import { emit, on } from "@/src/lib/bus";
import { getMetricDefinition } from "@/src/metrics/definitions";
import { metricEntryToFhir } from "@/src/metrics/fhir/metricToFhir";
import { useMetric } from "@/src/metrics/hooks/useMetric";
import { convertMetricValues } from "@/src/metrics/units";
import type { MetricEntry } from "@/src/metrics/types";
import { MonthYearPicker, monthYearToString, type MonthYearValue } from "@/src/components/ui/MonthYearPicker";
import { getCountryLabel } from "@/src/components/ui/CountryPicker";
import { List } from "react-native-nice-ui";
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';

type GenderOption = "male" | "female" | "other" | "unknown";

export type FhirPatientMinimal = {
    resourceType: "Patient";
    id: string;
    birthDate?: string; // YYYY-MM or YYYY-MM-DD (legacy)
    gender?: "male" | "female" | "other" | "unknown";
    address?: Array<{ country?: string }>;
    meta?: { lastUpdated?: string };
    // FHIR Extensions
    extension?: Array<{
        url: string;
        valueBoolean?: boolean;
        valueString?: string;
        valueDecimal?: number;
    }>;
};

const FIRST_SYMPTOMS_EXTENSION_URL = "http://example.org/fhir/StructureDefinition/first-symptoms-date";
const DIAGNOSIS_DATE_EXTENSION_URL = "http://example.org/fhir/StructureDefinition/diagnosis-date";
const HEIGHT_EXTENSION_URL = "http://example.org/fhir/StructureDefinition/body-height-cm";
// Weight is now stored as a metric entry only, not as Patient extension

function formatDecimalForInput(value: number, decimalPlaces: number | undefined, language: string): string {
    const formatted = decimalPlaces !== undefined ? value.toFixed(decimalPlaces) : String(value);
    return language === 'de' ? formatted.replace('.', ',') : formatted;
}

function parseDecimalInput(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = parseFloat(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
}

// MonthYear Extension helpers (stored as "YYYY-MM" string)
function monthYearToYYYYMM(value: MonthYearValue): string {
    return `${value.year}-${String(value.month).padStart(2, '0')}`;
}

function yyyymmToMonthYear(str: string): MonthYearValue | undefined {
    const match = str.match(/^(\d{4})-(\d{2})$/);
    if (!match) return undefined;
    return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) };
}

function getMonthYearExtension(patient: FhirPatientMinimal, url: string): MonthYearValue | undefined {
    const ext = patient.extension?.find(e => e.url === url);
    if (!ext?.valueString) return undefined;
    return yyyymmToMonthYear(ext.valueString);
}

function getDecimalExtension(patient: FhirPatientMinimal, url: string): number | undefined {
    const ext = patient.extension?.find(e => e.url === url);
    return ext?.valueDecimal;
}

function buildExtensions(args: {
    firstSymptoms?: MonthYearValue;
    diagnosisDate?: MonthYearValue;
    heightCm?: number;
}): FhirPatientMinimal["extension"] {
    const exts: NonNullable<FhirPatientMinimal["extension"]> = [];

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

function nowIso() {
    return new Date().toISOString();
}

function birthDateToMonthYear(str?: string): MonthYearValue | undefined {
    if (!str) return undefined;
    // Support both YYYY-MM and YYYY-MM-DD (legacy)
    const match = str.match(/^(\d{4})-(\d{2})/);
    if (!match) return undefined;
    return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) };
}

function makePatientMinimal(args: {
    id: string;
    birthDate?: MonthYearValue;
    gender?: "male" | "female" | "other" | "unknown";
    country?: string;
    firstSymptoms?: MonthYearValue;
    diagnosisDate?: MonthYearValue;
    heightCm?: number;
}): FhirPatientMinimal {
    return {
        resourceType: "Patient",
        id: args.id,
        birthDate: args.birthDate ? monthYearToYYYYMM(args.birthDate) : undefined,
        gender: args.gender,
        address: args.country ? [{ country: args.country }] : undefined,
        extension: buildExtensions({
            firstSymptoms: args.firstSymptoms,
            diagnosisDate: args.diagnosisDate,
            heightCm: args.heightCm,
        }),
        meta: { lastUpdated: nowIso() }
    };
}

export default function HealthInformationScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const { syncEnabled, fullSync, getOrCreateSubjectId } = useAppSync();
    const { activePatientId: rolePatientId, isDemo } = useAppRole();
    const fhirRepo = useFhirRepo();
    const router = useSafeRouter();

    const genderOptions: { value: GenderOption; label: string }[] = useMemo(() => [
        { value: "male", label: t('healthInfo.genderMale') },
        { value: "female", label: t('healthInfo.genderFemale') },
        { value: "other", label: t('healthInfo.genderOther') },
        { value: "unknown", label: t('healthInfo.genderUnknown') }
    ], [t]);

    const getGenderLabel = useCallback((value: GenderOption): string => {
        return genderOptions.find(o => o.value === value)?.label ?? t('healthInfo.genderUnknown');
    }, [genderOptions, t]);

    // Load weight from metrics (single source of truth)
    const {
        latestDisplayEntry: latestWeightEntry,
        displayDefinition: weightDisplayDefinition,
        displayUnit: weightDisplayUnit,
        isLoading: weightLoading
    } = useMetric({ metricId: 'weight' });

    const [patientId, setPatientId] = useState<string>("");
    const [birthDate, setBirthDate] = useState<MonthYearValue | undefined>();
    const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
    const [heightCm, setHeightCm] = useState<string>("");
    const [weightKg, setWeightKg] = useState<string>("");
    const [weightKgInitialized, setWeightKgInitialized] = useState(false);
    const [gender, setGender] = useState<GenderOption>("unknown");
    const [firstSymptoms, setFirstSymptoms] = useState<MonthYearValue | undefined>();
    const [diagnosisDate, setDiagnosisDate] = useState<MonthYearValue | undefined>();
    const [showFirstSymptomsPicker, setShowFirstSymptomsPicker] = useState(false);
    const [showDiagnosisPicker, setShowDiagnosisPicker] = useState(false);

    const showGenderPicker = useCallback(() => {
        if (Platform.OS === "ios") {
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

    const [country, setCountry] = useState("");

    const handleSelectCountry = useCallback(() => {
        router.push({
            pathname: '/settings/profile/countryPicker',
            params: {
                selected: country,
                allowClear: '1',
                prioritizeForLanguage: i18n.language,
            },
        });
    }, [country, i18n.language, router]);

    const loadingRef = useRef(false);
    const initialLoadDone = useRef(false);

    // Initialize weight from metric when loaded
    useEffect(() => {
        if (!weightLoading && !weightKgInitialized) {
            const metricWeight = latestWeightEntry?.values?.value;
            const decimals = weightDisplayDefinition?.fields[0]?.decimalPlaces;
            const weightStr = metricWeight !== undefined
                ? formatDecimalForInput(metricWeight, decimals, i18n.language)
                : "";
            setWeightKg(weightStr);
            setWeightKgInitialized(true);
            // Also update original value ref
            if (originalValuesRef.current) {
                originalValuesRef.current.weightKg = weightStr;
            }
        }
    }, [weightLoading, latestWeightEntry, weightDisplayDefinition, weightKgInitialized, i18n.language]);

    // Track original values to detect changes
    type OriginalValues = {
        birthDate: MonthYearValue | undefined;
        heightCm: string;
        weightKg: string;
        gender: GenderOption;
        country: string;
        firstSymptoms: MonthYearValue | undefined;
        diagnosisDate: MonthYearValue | undefined;
    };
    const originalValuesRef = useRef<OriginalValues | null>(null);

    const ensurePatientId = useCallback(async () => {
        // In demo mode, use the fixed demo patient ID (matches how demo data is stored)
        if (isDemo && rolePatientId) {
            setPatientId(rolePatientId);
            return rolePatientId;
        }
        const sid = await getOrCreateSubjectId();
        setPatientId((prev) => (prev === sid ? prev : sid));
        return sid;
    }, [getOrCreateSubjectId, isDemo, rolePatientId]);

    // Store fhirRepo in a ref to avoid re-creating loadPatient on every render
    const fhirRepoRef = useRef(fhirRepo);
    fhirRepoRef.current = fhirRepo;

    const loadPatient = useCallback(async () => {
        if (loadingRef.current) {
            return;
        }
        loadingRef.current = true;

        try {
            const pid = await ensurePatientId();
            const row = await fhirRepoRef.current.get("Patient", pid);

            if (!row || row.deleted) {
                const emptyValues: OriginalValues = {
                    birthDate: undefined,
                    heightCm: "",
                    weightKg: "", // Will be loaded from metric hook
                    gender: "unknown",
                    country: "",
                    firstSymptoms: undefined,
                    diagnosisDate: undefined,
                };
                setBirthDate(emptyValues.birthDate);
                setHeightCm(emptyValues.heightCm);
                // Don't set weightKg here - it's loaded from the metric hook
                setGender(emptyValues.gender);
                setCountry(emptyValues.country);
                setFirstSymptoms(emptyValues.firstSymptoms);
                setDiagnosisDate(emptyValues.diagnosisDate);
                originalValuesRef.current = emptyValues;
                return;
            }

            const p = row.resource as FhirPatientMinimal;
            const loadedBirthDate = birthDateToMonthYear(p.birthDate);
            const height = getDecimalExtension(p, HEIGHT_EXTENSION_URL);
            // Weight is now loaded from metric via useMetric hook, not from Patient extension
            const loadedHeightCm = height !== undefined ? String(height) : "";
            const loadedGender = p.gender ?? "unknown";
            const loadedCountry = p.address?.[0]?.country ?? "";
            const loadedFirstSymptoms = getMonthYearExtension(p, FIRST_SYMPTOMS_EXTENSION_URL);
            const loadedDiagnosisDate = getMonthYearExtension(p, DIAGNOSIS_DATE_EXTENSION_URL);

            setBirthDate(loadedBirthDate);
            setHeightCm(loadedHeightCm);
            // Don't set weightKg here - it's loaded from the metric hook
            setGender(loadedGender);
            setCountry(loadedCountry);
            setFirstSymptoms(loadedFirstSymptoms);
            setDiagnosisDate(loadedDiagnosisDate);

            // Store original values for change detection
            // Weight will be updated separately when metric loads
            originalValuesRef.current = {
                birthDate: loadedBirthDate,
                heightCm: loadedHeightCm,
                weightKg: "", // Will be updated by metric hook effect
                gender: loadedGender,
                country: loadedCountry,
                firstSymptoms: loadedFirstSymptoms,
                diagnosisDate: loadedDiagnosisDate,
            };
        }
        catch (e) {
            console.error(e);
        }
        finally {
            loadingRef.current = false;
        }
    }, [ensurePatientId]);

    // Initial load only once
    useEffect(() => {
        if (!initialLoadDone.current) {
            initialLoadDone.current = true;
            loadPatient();
        }
    }, [loadPatient]);

    // Check if there are unsaved changes
    const hasChanges = useMemo(() => {
        const orig = originalValuesRef.current;
        if (!orig) return false;

        if (orig.birthDate?.year !== birthDate?.year || orig.birthDate?.month !== birthDate?.month) return true;

        if (orig.heightCm !== heightCm) return true;
        if (orig.weightKg !== weightKg) return true;
        if (orig.gender !== gender) return true;
        if (orig.country !== country) return true;

        // Compare MonthYearValue objects
        const firstSymptomsChanged =
            (orig.firstSymptoms?.year !== firstSymptoms?.year) ||
            (orig.firstSymptoms?.month !== firstSymptoms?.month);
        if (firstSymptomsChanged) return true;

        const diagnosisDateChanged =
            (orig.diagnosisDate?.year !== diagnosisDate?.year) ||
            (orig.diagnosisDate?.month !== diagnosisDate?.month);
        if (diagnosisDateChanged) return true;

        return false;
    }, [birthDate, heightCm, weightKg, gender, country, firstSymptoms, diagnosisDate]);

    // Subscribe to events separately (without loadPatient as dependency)
    useEffect(() => {
        const unsubscribeCountry = on("country:selected", (code: string) => {
            setCountry(code);
        });

        // Reload when FHIR data changes (e.g. from sync)
        const unsubscribeFhir = on("fhir:changed", () => {
            loadPatient();
        });

        return () => {
            unsubscribeCountry();
            unsubscribeFhir();
        };
    }, [loadPatient]);

    const onSave = useCallback(async () => {
        try {
            const pid = await ensurePatientId();

            const parsedHeight = parseDecimalInput(heightCm);
            const parsedWeight = parseDecimalInput(weightKg);

            const patient = makePatientMinimal({
                id: pid,
                birthDate,
                gender,
                country: country.trim() || undefined,
                firstSymptoms,
                diagnosisDate,
                heightCm: parsedHeight && !isNaN(parsedHeight) ? parsedHeight : undefined,
            });

            // fhirRepo handles: store + outbox + emit("fhir:changed")
            await fhirRepo.upsert("Patient", pid, patient, patient.meta?.lastUpdated);

            // If weight was changed, create a metric entry
            const originalWeight = originalValuesRef.current?.weightKg;
            if (parsedWeight && !isNaN(parsedWeight) && originalWeight !== weightKg) {
                const weightDef = getMetricDefinition('weight', i18n.language);
                if (weightDef) {
                    const id = Crypto.randomUUID();
                    const canonicalValues = convertMetricValues(
                        { value: parsedWeight },
                        weightDisplayUnit ?? weightDef.defaultUnit,
                        weightDef.defaultUnit,
                        weightDef
                    );
                    const entry: MetricEntry = {
                        id,
                        values: canonicalValues,
                        date: new Date(),
                        unit: weightDef.defaultUnit,
                        source: 'profile',
                        addedAt: new Date(),
                    };
                    const fhir = metricEntryToFhir(entry, weightDef, `Patient/${pid}`);
                    await fhirRepo.upsert('Observation', id, fhir, fhir.meta?.lastUpdated);
                }
            }

            // Emit change event to update all listeners (metrics cache, etc.)
            emit('fhir:changed');

            // sync to server if enabled
            if (syncEnabled) {
                await fullSync("patient save");
            }

            // Close screen after saving
            router.back();
        }
        catch (e: any) {
            console.error(e);
            Alert.alert(t('common.error'), e?.message ?? String(e));
        }
    }, [t, i18n.language, fhirRepo, ensurePatientId, birthDate, heightCm, weightKg, gender, country, firstSymptoms, diagnosisDate, syncEnabled, fullSync, weightDisplayUnit]);

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerRight: () => (
                            <HeaderButton icon="checkmark" variant="done" disabled={!hasChanges} onPress={onSave} />
                        ),
                    }}
                />
            ) : (
                <Stack.Toolbar placement="right">
                    <Stack.Toolbar.Button icon="checkmark" variant="done" disabled={!hasChanges} onPress={onSave} />
                </Stack.Toolbar>
            )}
            <ScrollView style={ { backgroundColor: colors.modalBackground } }
                        contentContainerStyle={ [styles.scrollView, {}] }
                        contentInsetAdjustmentBehavior="automatic"
            >

                <ScrollViewContent>
                    <ScreenHeader
                        icon="stethoscope"
                        iconTintColor={ colors.brandColorMuted }
                        subtitle={t('healthInfo.headerText')}
                    />

                    <List.Section rounded>
                        <List.Item
                            title={t('healthInfo.birthDate')}
                            onPress={() => setShowBirthDatePicker(true)}
                            hideChevron
                            rightTitle={birthDate ? monthYearToString(birthDate, i18n.language) : t('healthInfo.select')}
                        />
                        <List.Item
                            title={t('healthInfo.gender')}
                            onPress={ showGenderPicker }
                            hideChevron
                            rightTitle={ getGenderLabel(gender) }
                        />
                        <List.Item
                            title={t('healthInfo.country')}
                            onPress={ handleSelectCountry }
                            hideChevron
                            rightTitle={country ? getCountryLabel(country) : t('healthInfo.select')}
                        />
                        <List.InputItem
                            label={t('healthInfo.height')}
                            value={heightCm}
                            onChangeText={setHeightCm}
                            placeholder="cm"
                            keyboardType="numeric"
                            returnKeyType="done"
                            inline
                        />
                        <List.InputItem
                            label={t('healthInfo.weight')}
                            value={weightKg}
                            onChangeText={setWeightKg}
                            placeholder={weightDisplayUnit ?? "kg"}
                            keyboardType="numeric"
                            returnKeyType="done"
                            inline
                        />
                    </List.Section>

                    <List.Section rounded>
                        <List.Item
                            title={t('healthInfo.firstSymptoms')}
                            subtitle={t('healthInfo.firstSymptomsSubtitle')}
                            onPress={() => setShowFirstSymptomsPicker(true)}
                            hideChevron
                            rightTitle={firstSymptoms ? monthYearToString(firstSymptoms, i18n.language) : t('healthInfo.select')}
                        />
                        <List.Item
                            title={t('healthInfo.diagnosis')}
                            subtitle={t('healthInfo.diagnosisSubtitle')}
                            onPress={() => setShowDiagnosisPicker(true)}
                            hideChevron
                            rightTitle={diagnosisDate ? monthYearToString(diagnosisDate, i18n.language) : t('healthInfo.select')}
                            lastItem={ true }
                        />
                    </List.Section>

                </ScrollViewContent>
            </ScrollView>

            <MonthYearPicker
                visible={showFirstSymptomsPicker}
                value={firstSymptoms}
                title={t('healthInfo.firstSymptoms')}
                onSelect={setFirstSymptoms}
                onClose={() => setShowFirstSymptomsPicker(false)}
            />

            <MonthYearPicker
                visible={showDiagnosisPicker}
                value={diagnosisDate}
                title={t('healthInfo.diagnosisDate')}
                onSelect={setDiagnosisDate}
                onClose={() => setShowDiagnosisPicker(false)}
            />

            <MonthYearPicker
                visible={showBirthDatePicker}
                value={birthDate}
                defaultValue={{ month: new Date().getMonth() + 1, year: new Date().getFullYear() - 50 }}
                title={t('healthInfo.birthDate')}
                onSelect={setBirthDate}
                onClose={() => setShowBirthDatePicker(false)}
            />
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    numberInput: {
        fontSize: 17,
        textAlign: 'right',
        minWidth: 60,
        paddingVertical: 8,
    },
});
