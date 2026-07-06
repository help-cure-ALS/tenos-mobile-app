import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { List, useTheme } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/src/components/ui/AppIcon';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { MonthYearPicker, monthYearToString, type MonthYearValue } from '@/src/components/ui/MonthYearPicker';
import { getQuestionnaireDefinition } from '@/src/questionnaires/definitions';
import { useALSGeneticBackground } from '@/src/questionnaires/structured/alsGeneticBackground/hooks/useALSGeneticBackground';
import {
    counselingStatusLabel,
    diseaseFormLabel,
    familyHistoryLabel,
    geneLabel,
    sourceLabel,
    testingStatusLabel,
} from '@/src/questionnaires/structured/alsGeneticBackground/labels';
import type {
    ALSDiseaseForm,
    ALSFamilyHistory,
    ALSGeneticCounselingStatus,
    ALSGeneticSource,
    ALSGeneticTestingStatus,
    ALSKnownGene,
} from '@/src/questionnaires/structured/alsGeneticBackground/types';
import {
    structuredFieldInfoFromDefinition,
    structuredFieldLabelFromDefinition,
    structuredFieldPlaceholderFromDefinition,
    structuredOptionValuesFromDefinition,
} from '@/src/questionnaires/structured/structuredFieldLabels';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';

const DISEASE_FORMS: ALSDiseaseForm[] = ['sporadic', 'familial', 'suspected_familial', 'unclear'];
const FAMILY_HISTORIES: ALSFamilyHistory[] = ['none_known', 'als', 'ftd', 'als_ftd', 'other_mnd', 'other_neurodegenerative'];
const TESTING_STATUSES: ALSGeneticTestingStatus[] = ['not_tested', 'planned', 'pending', 'negative', 'vus', 'pathogenic'];
const GENES: ALSKnownGene[] = ['C9orf72', 'SOD1', 'FUS', 'TARDBP', 'TBK1', 'OPTN', 'VCP', 'other'];
const SOURCES: ALSGeneticSource[] = ['patient_reported', 'clinician_documented', 'lab_report'];
const COUNSELING_STATUSES: ALSGeneticCounselingStatus[] = ['completed', 'recommended', 'not_done'];

function monthYearToYYYYMM(value: MonthYearValue | undefined): string | undefined {
    if (!value) return undefined;
    return `${value.year}-${String(value.month).padStart(2, '0')}`;
}

function parseYYYYMM(value: string | undefined): MonthYearValue | undefined {
    if (!value) return undefined;
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) return undefined;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) return undefined;
    return { year, month };
}

export default function ALSGeneticBackgroundAddScreen() {
    const { colors } = useTheme();
    const { i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { entryId } = useLocalSearchParams<{ entryId?: string }>();
    const { role, isDemo, canWriteForActive } = useAppRole();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();
    const { saveEntry, entries, isLoading } = useALSGeneticBackground();
    const isDE = i18n.language === 'de';
    const definition = useMemo(() => getQuestionnaireDefinition('als_genetic_background', i18n.language), [i18n.language]);
    const isReadOnly = !!entryId;
    const hasMetricAccess = sharingLoaded && (!isFiltering || canSeeMetric('als_genetic_background'));
    const canCreate = hasMetricAccess && (canWriteForActive || isDemo);
    const canAccess = canCreate || (isReadOnly && hasMetricAccess);
    const viewedEntry = useMemo(
        () => entryId ? entries.find((entry) => entry.id === entryId) : null,
        [entries, entryId]
    );
    const diseaseForms = useMemo(() => structuredOptionValuesFromDefinition<ALSDiseaseForm>(definition, 'diseaseForm', DISEASE_FORMS), [definition]);
    const familyHistories = useMemo(() => structuredOptionValuesFromDefinition<ALSFamilyHistory>(definition, 'familyHistory', FAMILY_HISTORIES), [definition]);
    const testingStatuses = useMemo(() => structuredOptionValuesFromDefinition<ALSGeneticTestingStatus>(definition, 'testingStatus', TESTING_STATUSES), [definition]);
    const genes = useMemo(() => structuredOptionValuesFromDefinition<ALSKnownGene>(definition, 'gene', GENES), [definition]);
    const sources = useMemo(() => structuredOptionValuesFromDefinition<ALSGeneticSource>(definition, 'source', SOURCES), [definition]);
    const counselingStatuses = useMemo(
        () => structuredOptionValuesFromDefinition<ALSGeneticCounselingStatus>(definition, 'counselingStatus', COUNSELING_STATUSES),
        [definition]
    );
    const fieldLabel = useCallback((fieldId: string, fallback: string) => structuredFieldLabelFromDefinition(definition, fieldId, fallback), [definition]);
    const fieldInfo = useCallback((fieldId: string) => structuredFieldInfoFromDefinition(definition, fieldId), [definition]);
    const fieldPlaceholder = useCallback((fieldId: string, fallback: string) => structuredFieldPlaceholderFromDefinition(definition, fieldId, fallback), [definition]);

    const [diseaseForm, setDiseaseForm] = useState<ALSDiseaseForm | undefined>();
    const [familyHistory, setFamilyHistory] = useState<ALSFamilyHistory | undefined>();
    const [testingStatus, setTestingStatus] = useState<ALSGeneticTestingStatus | undefined>();
    const [gene, setGene] = useState<ALSKnownGene | undefined>();
    const [otherGene, setOtherGene] = useState('');
    const [variantText, setVariantText] = useState('');
    const [testDate, setTestDate] = useState<MonthYearValue | undefined>();
    const [showTestDatePicker, setShowTestDatePicker] = useState(false);
    const [source, setSource] = useState<ALSGeneticSource | undefined>();
    const [counselingStatus, setCounselingStatus] = useState<ALSGeneticCounselingStatus | undefined>();
    const [note, setNote] = useState('');
    const requiresGene = testingStatus === 'pathogenic' || testingStatus === 'vus';
    const canSave = !!(
        !isReadOnly &&
        diseaseForm &&
        familyHistory &&
        testingStatus &&
        source &&
        counselingStatus &&
        (!requiresGene || gene) &&
        (gene !== 'other' || otherGene.trim().length > 0)
    );

    useEffect(() => {
        if (!sharingLoaded) return;
        if (!canAccess) {
            router.back();
        }
    }, [canAccess, router, sharingLoaded]);

    useEffect(() => {
        if (!isReadOnly || !viewedEntry) return;
        setDiseaseForm(viewedEntry.diseaseForm);
        setFamilyHistory(viewedEntry.familyHistory);
        setTestingStatus(viewedEntry.testingStatus);
        setGene(viewedEntry.gene);
        setOtherGene(viewedEntry.otherGene ?? '');
        setVariantText(viewedEntry.variantText ?? '');
        setTestDate(parseYYYYMM(viewedEntry.testDate));
        setSource(viewedEntry.source);
        setCounselingStatus(viewedEntry.counselingStatus);
        setNote(viewedEntry.note ?? '');
    }, [isReadOnly, viewedEntry]);

    useEffect(() => {
        if (isReadOnly && !isLoading && !viewedEntry) {
            router.back();
        }
    }, [isReadOnly, isLoading, router, viewedEntry]);

    const onSave = useCallback(async () => {
        if (isReadOnly) return;
        if (!canSave || !diseaseForm || !familyHistory || !testingStatus || !source || !counselingStatus) {
            Alert.alert(
                isDE ? 'Angaben vervollständigen' : 'Complete entry',
                isDE ? 'Bitte alle Pflichtfelder auswählen.' : 'Please select all required fields.'
            );
            return;
        }

        try {
            await saveEntry({
                assessedAt: new Date().toISOString(),
                recordedByRole: getRecordedByRole(role, isDemo),
                diseaseForm,
                familyHistory,
                testingStatus,
                gene: requiresGene ? gene : undefined,
                otherGene: gene === 'other' ? otherGene : undefined,
                variantText,
                testDate: monthYearToYYYYMM(testDate),
                source,
                counselingStatus,
                note,
            });
            router.back();
        } catch (e: any) {
            Alert.alert(isDE ? 'Fehler' : 'Error', e?.message ?? String(e));
        }
    }, [
        canSave,
        counselingStatus,
        diseaseForm,
        familyHistory,
        gene,
        isDE,
        isDemo,
        isReadOnly,
        note,
        otherGene,
        role,
        router,
        saveEntry,
        source,
        requiresGene,
        testDate,
        testingStatus,
        variantText,
    ]);

    if (!sharingLoaded || !canAccess || (isReadOnly && (isLoading || !viewedEntry))) return null;

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: isReadOnly
                            ? (definition?.name ?? (isDE ? 'ALS-Form & Genetik' : 'ALS form & genetics'))
                            : (isDE ? `${definition?.name ?? 'ALS-Form & Genetik'} erfassen` : `Record ${definition?.name ?? 'ALS form & genetics'}`),
                        headerBackVisible: false,
                        headerLeft: () => (
                            <HeaderButton icon="xmark" onPress={() => router.back()} />
                        ),
                        headerRight: () => isReadOnly ? null : (
                            <HeaderButton icon="checkmark" variant="done" onPress={onSave} disabled={!canSave} />
                        ),
                    }}
                />
            ) : (
                <>
                    <Stack.Screen.Title>
                        {isReadOnly
                            ? (definition?.name ?? (isDE ? 'ALS-Form & Genetik' : 'ALS form & genetics'))
                            : (isDE ? `${definition?.name ?? 'ALS-Form & Genetik'} erfassen` : `Record ${definition?.name ?? 'ALS form & genetics'}`)}
                    </Stack.Screen.Title>
                    <Stack.Toolbar placement="left">
                        <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} />
                    </Stack.Toolbar>
                    {!isReadOnly && (
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="checkmark" variant="done" onPress={onSave} disabled={!canSave} />
                        </Stack.Toolbar>
                    )}
                </>
            )}
            <ScrollView
                style={{ backgroundColor: colors.background }}
                contentContainerStyle={styles.scrollView}
                contentInsetAdjustmentBehavior="automatic"
            >
                <View style={[styles.bodyWrapper, { paddingLeft: insets.left, paddingRight: insets.right }, insets.left > 200 && { maxWidth: 620 + insets.left }]}>
                    <ChoiceSection
                        title={fieldLabel('diseaseForm', isDE ? 'ALS-Form' : 'ALS form')}
                        info={fieldInfo('diseaseForm')}
                        values={diseaseForms}
                        value={diseaseForm}
                        onChange={setDiseaseForm}
                        label={(v) => diseaseFormLabel(v, i18n.language)}
                        readOnly={isReadOnly}
                    />

                    <ChoiceSection
                        title={fieldLabel('familyHistory', isDE ? 'Familienanamnese' : 'Family history')}
                        info={fieldInfo('familyHistory')}
                        values={familyHistories}
                        value={familyHistory}
                        onChange={setFamilyHistory}
                        label={(v) => familyHistoryLabel(v, i18n.language)}
                        readOnly={isReadOnly}
                    />

                    <ChoiceSection
                        title={fieldLabel('testingStatus', isDE ? 'Genetische Testung' : 'Genetic testing')}
                        info={fieldInfo('testingStatus')}
                        values={testingStatuses}
                        value={testingStatus}
                        onChange={setTestingStatus}
                        label={(v) => testingStatusLabel(v, i18n.language)}
                        readOnly={isReadOnly}
                    />

                    {requiresGene && (
                        <>
                            <ChoiceSection
                                title={fieldLabel('gene', isDE ? 'Gen' : 'Gene')}
                                info={fieldInfo('gene')}
                                values={genes}
                                value={gene}
                                onChange={setGene}
                                label={(v) => geneLabel({ gene: v }, i18n.language)}
                                readOnly={isReadOnly}
                            />

                            {gene === 'other' && (
                                <List.Section title={fieldLabel('otherGene', isDE ? 'Anderes Gen' : 'Other gene')} rounded>
                                    <View style={styles.inputWrapper}>
                                        <TextInput
                                            value={otherGene}
                                            onChangeText={setOtherGene}
                                            editable={!isReadOnly}
                                            placeholder={fieldPlaceholder('otherGene', isDE ? 'Genname' : 'Gene name')}
                                            placeholderTextColor={colors.textHint}
                                            autoCapitalize="characters"
                                            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.listItemBackground }]}
                                        />
                                    </View>
                                </List.Section>
                            )}

                            <List.Section title={fieldLabel('variantText', isDE ? 'Variante' : 'Variant')} rounded>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        value={variantText}
                                        onChangeText={setVariantText}
                                        editable={!isReadOnly}
                                        placeholder={fieldPlaceholder('variantText', isDE ? 'Optionaler kurzer Befundtext' : 'Optional short finding text')}
                                        placeholderTextColor={colors.textHint}
                                        multiline
                                        style={[styles.note, { color: colors.textPrimary }]}
                                    />
                                </View>
                            </List.Section>
                        </>
                    )}

                    <List.Section
                        title={fieldLabel('source', isDE ? 'Quelle' : 'Source')}
                        rightCmp={sectionInfoButton(
                            fieldLabel('source', isDE ? 'Quelle' : 'Source'),
                            fieldInfo('source'),
                            colors.textHint
                        )}
                        rounded
                    >
                        {sources.map((value, index) => (
                            <List.Item
                                key={value}
                                title={sourceLabel(value, i18n.language)}
                                onPress={isReadOnly ? undefined : () => setSource(value)}
                                type="checkbox"
                                checked={source === value}
                                hideChevron
                                lastItem={index === sources.length - 1}
                            />
                        ))}
                    </List.Section>

                    <List.Section
                        title={fieldLabel('counselingStatus', isDE ? 'Humangenetische Beratung' : 'Genetic counseling')}
                        rightCmp={sectionInfoButton(
                            fieldLabel('counselingStatus', isDE ? 'Humangenetische Beratung' : 'Genetic counseling'),
                            fieldInfo('counselingStatus'),
                            colors.textHint
                        )}
                        rounded
                    >
                        {counselingStatuses.map((value, index) => (
                            <List.Item
                                key={value}
                                title={counselingStatusLabel(value, i18n.language)}
                                onPress={isReadOnly ? undefined : () => setCounselingStatus(value)}
                                type="checkbox"
                                checked={counselingStatus === value}
                                hideChevron
                                lastItem={index === counselingStatuses.length - 1}
                            />
                        ))}
                    </List.Section>

                    <List.Section title={fieldLabel('testDate', isDE ? 'Testdatum' : 'Test date')} rounded>
                        <List.Item
                            title={fieldLabel('testDate', isDE ? 'Testdatum' : 'Test date')}
                            subtitle={fieldInfo('testDate')}
                            onPress={isReadOnly ? undefined : () => setShowTestDatePicker(true)}
                            hideChevron
                            rightTitle={testDate ? monthYearToString(testDate, i18n.language) : fieldPlaceholder('testDate', isDE ? 'Auswählen' : 'Select')}
                            lastItem
                        />
                    </List.Section>

                    <List.Section title={fieldLabel('note', isDE ? 'Kommentar' : 'Comment')} rounded>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                value={note}
                                onChangeText={setNote}
                                editable={!isReadOnly}
                                multiline
                                placeholder={fieldPlaceholder('note', isDE ? 'Optionaler Kommentar' : 'Optional comment')}
                                placeholderTextColor={colors.textHint}
                                style={[styles.note, { color: colors.textPrimary }]}
                            />
                        </View>
                    </List.Section>
                </View>
            </ScrollView>

            <MonthYearPicker
                visible={showTestDatePicker}
                value={testDate}
                title={fieldLabel('testDate', isDE ? 'Testdatum' : 'Test date')}
                onSelect={setTestDate}
                onClose={() => setShowTestDatePicker(false)}
            />
        </>
    );
}

function ChoiceSection<T extends string>({
    title,
    info,
    values,
    value,
    onChange,
    label,
    readOnly = false,
}: {
    title: string;
    info: string;
    values: T[];
    value?: T;
    onChange: (value: T) => void;
    label: (value: T) => string;
    readOnly?: boolean;
}) {
    const { colors } = useTheme();
    return (
        <List.Section title={title} rightCmp={sectionInfoButton(title, info, colors.textHint)} rounded>
            {values.map((item, index) => (
                <List.Item
                    key={item}
                    title={label(item)}
                    onPress={readOnly ? undefined : () => onChange(item)}
                    type="checkbox"
                    checked={value === item}
                    hideChevron
                    lastItem={index === values.length - 1}
                />
            ))}
        </List.Section>
    );
}

function sectionInfoButton(title: string, info: string, color: string) {
    return (
        <Pressable
            onPress={() => Alert.alert(title, info)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`${title} Info`}
        >
            <AppIcon name="info.circle.fill" tintColor={color} size={20} />
        </Pressable>
    );
}

function getRecordedByRole(role: string | null, isDemo: boolean): 'patient' | 'caregiver' | 'doctor' | 'demo' {
    if (isDemo) return 'demo';
    if (role === 'doctor') return 'doctor';
    if (role === 'caregiver') return 'caregiver';
    return 'patient';
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90,
    },
    bodyWrapper: {
        maxWidth: 620,
        marginHorizontal: 'auto',
        width: '100%',
    },
    inputWrapper: {
        padding: 12,
    },
    input: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        fontSize: 17,
    },
    note: {
        minHeight: 86,
        fontSize: 16,
        textAlignVertical: 'top',
    },
});
