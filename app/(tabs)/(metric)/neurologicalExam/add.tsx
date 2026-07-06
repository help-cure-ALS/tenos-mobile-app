import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import { List, useTheme } from 'react-native-nice-ui';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/src/components/ui/AppIcon';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';
import { getQuestionnaireDefinition } from '@/src/questionnaires/definitions';
import { useNeurologicalExams } from '@/src/questionnaires/structured/neurologicalExam/hooks/useNeurologicalExams';
import {
    burdenLabel,
    bulbarSignLabel,
    clinicalRegionLabel,
    lmnSignLabel,
    mrcGradeLabel,
    mrcMuscleGroupLabel,
    pathologicalSignLabel,
    reflexGradeLabel,
    reflexNameLabel,
    severityLabel,
    signPresenceLabel,
} from '@/src/questionnaires/structured/neurologicalExam/labels';
import type {
    BilateralMrcFinding,
    BilateralReflexFinding,
    BilateralSignFinding,
    BodyRegion,
    BulbarSignFinding,
    BulbarSignName,
    ClinicalRegion,
    ClinicalRegionFinding,
    FindingSeverity,
    LmnSignName,
    MrcGrade,
    MrcMuscleGroup,
    NeurologicalExamEntry,
    PathologicalSignName,
    ReflexGrade,
    ReflexName,
    RegionMotorNeuronFindings,
    SignPresence,
} from '@/src/questionnaires/structured/neurologicalExam/types';
import {
    structuredFieldInfoFromDefinition,
    structuredFieldLabelFromDefinition,
    structuredFieldPlaceholderFromDefinition,
    structuredOptionValuesFromDefinition,
} from '@/src/questionnaires/structured/structuredFieldLabels';
import type { OpmMotorNeuronCode } from '@/src/questionnaires/structured/alsSubtype/types';

type ActiveExamTab = 'regions' | 'strength' | 'signs';

const CLINICAL_REGIONS: ClinicalRegion[] = ['bulbar', 'cervical', 'thoracic', 'lumbosacral'];
const FINDING_SEVERITIES: FindingSeverity[] = ['absent', 'mild', 'moderate', 'severe', 'not_tested'];
const SIGN_VALUES: SignPresence[] = ['absent', 'present', 'not_tested'];
const MRC_GRADES: MrcGrade[] = ['5', '4+', '4', '4-', '3', '2', '1', '0', 'not_tested'];
const REFLEX_GRADES: ReflexGrade[] = ['2+', '3+', '4+', '1+', '0', 'not_tested'];
const MRC_GROUPS: MrcMuscleGroup[] = [
    'shoulder_abduction',
    'elbow_flexion',
    'elbow_extension',
    'wrist_extension',
    'finger_abduction',
    'hip_flexion',
    'knee_extension',
    'ankle_dorsiflexion',
    'toe_extension',
];
const REFLEX_NAMES: ReflexName[] = ['biceps', 'triceps', 'brachioradialis', 'patellar', 'achilles'];
const PATHOLOGICAL_SIGNS: PathologicalSignName[] = ['babinski', 'hoffmann', 'palmomental'];
const LMN_SIGNS: LmnSignName[] = ['atrophy', 'fasciculations'];
const BULBAR_SIGNS: BulbarSignName[] = ['tongue_atrophy', 'tongue_fasciculations', 'dysarthria', 'dysphagia'];

const CLINICAL_REGION_TO_BODY: Record<ClinicalRegion, BodyRegion[]> = {
    bulbar: ['head'],
    cervical: ['left_arm', 'right_arm'],
    thoracic: ['trunk'],
    lumbosacral: ['left_leg', 'right_leg'],
};

const MRC_GROUP_TO_BODY: Record<MrcMuscleGroup, { left: BodyRegion; right: BodyRegion }> = {
    shoulder_abduction: { left: 'left_arm', right: 'right_arm' },
    elbow_flexion: { left: 'left_arm', right: 'right_arm' },
    elbow_extension: { left: 'left_arm', right: 'right_arm' },
    wrist_extension: { left: 'left_arm', right: 'right_arm' },
    finger_abduction: { left: 'left_arm', right: 'right_arm' },
    hip_flexion: { left: 'left_leg', right: 'right_leg' },
    knee_extension: { left: 'left_leg', right: 'right_leg' },
    ankle_dorsiflexion: { left: 'left_leg', right: 'right_leg' },
    toe_extension: { left: 'left_leg', right: 'right_leg' },
};

const REFLEX_TO_BODY: Record<ReflexName, { left: BodyRegion; right: BodyRegion }> = {
    biceps: { left: 'left_arm', right: 'right_arm' },
    triceps: { left: 'left_arm', right: 'right_arm' },
    brachioradialis: { left: 'left_arm', right: 'right_arm' },
    patellar: { left: 'left_leg', right: 'right_leg' },
    achilles: { left: 'left_leg', right: 'right_leg' },
};

export default function NeurologicalExamAddScreen() {
    const { colors } = useTheme();
    const colorScheme = useColorScheme();
    const { i18n, t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { entryId } = useLocalSearchParams<{ entryId?: string }>();
    const { role, isDemo } = useAppRole();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();
    const { saveEntry, entries, isLoading } = useNeurologicalExams();
    const isDE = i18n.language === 'de';
    const definition = useMemo(() => getQuestionnaireDefinition('als_neurological_exam', i18n.language), [i18n.language]);
    const isReadOnly = !!entryId;
    const hasMetricAccess = sharingLoaded && (!isFiltering || canSeeMetric('als_neurological_exam'));
    const canCreate = hasMetricAccess && (role === 'doctor' || isDemo);
    const canAccess = canCreate || (isReadOnly && hasMetricAccess);
    const viewedEntry = useMemo(
        () => entryId ? entries.find((entry) => entry.id === entryId) : null,
        [entries, entryId]
    );

    const clinicalRegionOrder = useMemo(
        () => structuredOptionValuesFromDefinition<ClinicalRegion>(definition, 'clinicalRegion', CLINICAL_REGIONS),
        [definition]
    );
    const severityOptions = useMemo(
        () => structuredOptionValuesFromDefinition<FindingSeverity>(definition, 'findingSeverity', FINDING_SEVERITIES),
        [definition]
    );
    const signOptions = useMemo(
        () => structuredOptionValuesFromDefinition<SignPresence>(definition, 'signPresence', SIGN_VALUES),
        [definition]
    );
    const mrcOptions = useMemo(
        () => structuredOptionValuesFromDefinition<MrcGrade>(definition, 'mrcGrade', MRC_GRADES),
        [definition]
    );
    const reflexOptions = useMemo(
        () => structuredOptionValuesFromDefinition<ReflexGrade>(definition, 'reflexGrade', REFLEX_GRADES),
        [definition]
    );
    const mrcGroupOrder = useMemo(
        () => structuredOptionValuesFromDefinition<MrcMuscleGroup>(definition, 'mrcMuscleGroup', MRC_GROUPS),
        [definition]
    );
    const reflexOrder = useMemo(
        () => structuredOptionValuesFromDefinition<ReflexName>(definition, 'reflexName', REFLEX_NAMES),
        [definition]
    );
    const pathologicalSignOrder = useMemo(
        () => structuredOptionValuesFromDefinition<PathologicalSignName>(definition, 'pathologicalSignName', PATHOLOGICAL_SIGNS),
        [definition]
    );
    const lmnSignOrder = useMemo(
        () => structuredOptionValuesFromDefinition<LmnSignName>(definition, 'lmnSignName', LMN_SIGNS),
        [definition]
    );
    const bulbarSignOrder = useMemo(
        () => structuredOptionValuesFromDefinition<BulbarSignName>(definition, 'bulbarSignName', BULBAR_SIGNS),
        [definition]
    );
    const sideLabels = useMemo(() => ({
        left: definition?.structuredFields?.examSide?.options.find((item) => item.value === 'left')?.label ?? (isDE ? 'Links' : 'Left'),
        right: definition?.structuredFields?.examSide?.options.find((item) => item.value === 'right')?.label ?? (isDE ? 'Rechts' : 'Right'),
    }), [definition, isDE]);

    const fieldLabel = useCallback((fieldId: string, fallback: string) => structuredFieldLabelFromDefinition(definition, fieldId, fallback), [definition]);
    const fieldInfo = useCallback((fieldId: string) => structuredFieldInfoFromDefinition(definition, fieldId), [definition]);
    const fieldPlaceholder = useCallback((fieldId: string, fallback: string) => structuredFieldPlaceholderFromDefinition(definition, fieldId, fallback), [definition]);

    const [clinicalRegions, setClinicalRegions] = useState<ClinicalRegionFinding[]>(createDefaultClinicalRegions);
    const [mrcStrength, setMrcStrength] = useState<BilateralMrcFinding[]>(createDefaultMrcStrength);
    const [reflexes, setReflexes] = useState<BilateralReflexFinding[]>(createDefaultReflexes);
    const [pathologicalSigns, setPathologicalSigns] = useState<BilateralSignFinding<PathologicalSignName>[]>(createDefaultPathologicalSigns);
    const [lmnSideSigns, setLmnSideSigns] = useState<BilateralSignFinding<LmnSignName>[]>(createDefaultLmnSideSigns);
    const [bulbarSigns, setBulbarSigns] = useState<BulbarSignFinding[]>(createDefaultBulbarSigns);
    const [note, setNote] = useState('');
    const [activeTab, setActiveTab] = useState<ActiveExamTab>('regions');

    useEffect(() => {
        if (!sharingLoaded) return;
        if (!canAccess) {
            router.back();
        }
    }, [canAccess, router, sharingLoaded]);

    useEffect(() => {
        if (!isReadOnly || !viewedEntry) return;
        setClinicalRegions(entryClinicalRegions(viewedEntry));
        setMrcStrength(mergeMrcStrength(viewedEntry.mrcStrength));
        setReflexes(mergeReflexes(viewedEntry.reflexes));
        setPathologicalSigns(mergePathologicalSigns(viewedEntry.pathologicalSigns));
        setLmnSideSigns(mergeLmnSideSigns(viewedEntry.lmnSideSigns));
        setBulbarSigns(mergeBulbarSigns(viewedEntry.bulbarSigns));
        setNote(viewedEntry.note ?? '');
    }, [isReadOnly, viewedEntry]);

    useEffect(() => {
        if (isReadOnly && !isLoading && !viewedEntry) {
            router.back();
        }
    }, [isReadOnly, isLoading, router, viewedEntry]);

    const overallUmnBurden = useMemo(() => burdenFromSeverity(maxClinicalSeverity(clinicalRegions.map((item) => item.umnBurden))), [clinicalRegions]);
    const overallLmnBurden = useMemo(() => burdenFromSeverity(maxClinicalSeverity(clinicalRegions.map((item) => item.lmnBurden))), [clinicalRegions]);
    const suggestedMotorNeuronCode = useMemo(
        () => deriveMotorNeuronCode(overallUmnBurden, overallLmnBurden),
        [overallLmnBurden, overallUmnBurden]
    );

    const onSave = useCallback(async () => {
        if (isReadOnly) return;
        try {
            const normalizedClinicalRegions = mergeClinicalRegions(clinicalRegions);
            const normalizedMrcStrength = mergeMrcStrength(mrcStrength);
            const normalizedReflexes = mergeReflexes(reflexes);
            const normalizedPathologicalSigns = mergePathologicalSigns(pathologicalSigns);
            const normalizedLmnSideSigns = mergeLmnSideSigns(lmnSideSigns);
            const normalizedBulbarSigns = mergeBulbarSigns(bulbarSigns);
            const legacyRegions = buildLegacyRegions({
                clinicalRegions: normalizedClinicalRegions,
                mrcStrength: normalizedMrcStrength,
                reflexes: normalizedReflexes,
                pathologicalSigns: normalizedPathologicalSigns,
                lmnSideSigns: normalizedLmnSideSigns,
                bulbarSigns: normalizedBulbarSigns,
            });

            await saveEntry({
                assessedAt: new Date().toISOString(),
                recordedByRole: isDemo ? 'demo' : 'doctor',
                regions: legacyRegions,
                clinicalRegions: normalizedClinicalRegions,
                mrcStrength: normalizedMrcStrength,
                reflexes: normalizedReflexes,
                pathologicalSigns: normalizedPathologicalSigns,
                lmnSideSigns: normalizedLmnSideSigns,
                bulbarSigns: normalizedBulbarSigns,
                overallUmnBurden,
                overallLmnBurden,
                suggestedMotorNeuronCode,
                note: note.trim() || undefined,
            });
            router.back();
        } catch (e: any) {
            Alert.alert(isDE ? 'Fehler' : 'Error', e?.message ?? String(e));
        }
    }, [
        bulbarSigns,
        clinicalRegions,
        isDE,
        isDemo,
        isReadOnly,
        lmnSideSigns,
        mrcStrength,
        note,
        overallLmnBurden,
        overallUmnBurden,
        pathologicalSigns,
        reflexes,
        router,
        saveEntry,
        suggestedMotorNeuronCode,
    ]);

    const chooseSeverity = useCallback((title: string, current: FindingSeverity, onChange: (value: FindingSeverity) => void) => {
        chooseValue({
            title,
            values: severityOptions,
            current,
            label: (value) => severityLabel(value, i18n.language),
            onChange,
            cancelLabel: t('common.cancel'),
        });
    }, [i18n.language, severityOptions, t]);

    const chooseMrc = useCallback((title: string, current: MrcGrade, onChange: (value: MrcGrade) => void) => {
        chooseValue({
            title,
            values: mrcOptions,
            current,
            label: (value) => mrcGradeLabel(value, i18n.language),
            onChange,
            cancelLabel: t('common.cancel'),
        });
    }, [i18n.language, mrcOptions, t]);

    const chooseReflex = useCallback((title: string, current: ReflexGrade, onChange: (value: ReflexGrade) => void) => {
        chooseValue({
            title,
            values: reflexOptions,
            current,
            label: (value) => reflexGradeLabel(value, i18n.language),
            onChange,
            cancelLabel: t('common.cancel'),
        });
    }, [i18n.language, reflexOptions, t]);

    const chooseSign = useCallback((title: string, current: SignPresence, onChange: (value: SignPresence) => void) => {
        chooseValue({
            title,
            values: signOptions,
            current,
            label: (value) => signPresenceLabel(value, i18n.language),
            onChange,
            cancelLabel: t('common.cancel'),
        });
    }, [i18n.language, signOptions, t]);

    if (!sharingLoaded || !canAccess || (isReadOnly && (isLoading || !viewedEntry))) return null;

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: isReadOnly
                            ? (definition?.name ?? (isDE ? 'Neurologische Untersuchung' : 'Neurological exam'))
                            : (isDE ? 'Untersuchung erfassen' : 'Record exam'),
                        headerBackVisible: false,
                        headerLeft: () => (
                            <HeaderButton icon="xmark" onPress={() => router.back()} />
                        ),
                        headerRight: () => isReadOnly ? null : (
                            <HeaderButton icon="checkmark" variant="done" onPress={onSave} />
                        ),
                    }}
                />
            ) : (
                <>
                    <Stack.Screen.Title>
                        {isReadOnly
                            ? (definition?.name ?? (isDE ? 'Neurologische Untersuchung' : 'Neurological exam'))
                            : (isDE ? 'Untersuchung erfassen' : 'Record exam')}
                    </Stack.Screen.Title>
                    <Stack.Toolbar placement="left">
                        <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} />
                    </Stack.Toolbar>
                    {!isReadOnly && (
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="checkmark" variant="done" onPress={onSave} />
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
                    <View style={styles.segmentedControlWrapper}>
                        <SegmentedControl
                            values={[isDE ? 'Regionen' : 'Regions', isDE ? 'Kraft' : 'Strength', isDE ? 'Zeichen' : 'Signs']}
                            selectedIndex={activeTab === 'regions' ? 0 : activeTab === 'strength' ? 1 : 2}
                            onChange={(event) => {
                                const index = event.nativeEvent.selectedSegmentIndex;
                                setActiveTab(index === 0 ? 'regions' : index === 1 ? 'strength' : 'signs');
                            }}
                            appearance={colorScheme === 'dark' ? 'dark' : 'light'}
                            style={styles.segmentedControl}
                            fontStyle={{ color: colors.textSecondary }}
                            activeFontStyle={{ color: colorScheme === 'dark' ? '#fff' : '#000' }}
                        />
                    </View>

                    {activeTab === 'regions' && (
                        <RegionsTab
                            clinicalRegionOrder={clinicalRegionOrder}
                            clinicalRegions={clinicalRegions}
                            language={i18n.language}
                            umnLabel="UMN"
                            lmnLabel="LMN"
                            infoTitle={fieldLabel('clinicalRegions', isDE ? 'Regionale Beteiligung' : 'Regional involvement')}
                            infoText={fieldInfo('clinicalRegions')}
                            readOnly={isReadOnly}
                            onPickSeverity={chooseSeverity}
                            onChange={(region, patch) => {
                                setClinicalRegions((current) => current.map((candidate) => candidate.region === region ? { ...candidate, ...patch } : candidate));
                            }}
                        />
                    )}

                    {activeTab === 'strength' && (
                        <StrengthTab
                            groups={mrcGroupOrder}
                            mrcStrength={mrcStrength}
                            language={i18n.language}
                            sideLabels={sideLabels}
                            title={fieldLabel('mrcStrength', isDE ? 'MRC-Kraftprüfung' : 'MRC strength exam')}
                            infoText={fieldInfo('mrcStrength')}
                            readOnly={isReadOnly}
                            onPickMrc={chooseMrc}
                            onChange={(group, side, value) => {
                                setMrcStrength((current) => current.map((candidate) => candidate.muscleGroup === group ? { ...candidate, [side]: value } : candidate));
                            }}
                        />
                    )}

                    {activeTab === 'signs' && (
                        <SignsTab
                            reflexOrder={reflexOrder}
                            reflexes={reflexes}
                            pathologicalSignOrder={pathologicalSignOrder}
                            pathologicalSigns={pathologicalSigns}
                            lmnSignOrder={lmnSignOrder}
                            lmnSideSigns={lmnSideSigns}
                            bulbarSignOrder={bulbarSignOrder}
                            bulbarSigns={bulbarSigns}
                            language={i18n.language}
                            sideLabels={sideLabels}
                            readOnly={isReadOnly}
                            labels={{
                                reflexes: fieldLabel('reflexes', isDE ? 'Reflexe' : 'Reflexes'),
                                pathologicalSigns: fieldLabel('pathologicalSigns', isDE ? 'Pyramidenbahnzeichen' : 'Pyramidal tract signs'),
                                lmnSigns: fieldLabel('lmnSideSigns', isDE ? 'LMN-Zeichen' : 'LMN signs'),
                                bulbarSigns: fieldLabel('bulbarSigns', isDE ? 'Bulbäre Zeichen' : 'Bulbar signs'),
                            }}
                            infos={{
                                reflexes: fieldInfo('reflexes'),
                                pathologicalSigns: fieldInfo('pathologicalSigns'),
                                lmnSigns: fieldInfo('lmnSideSigns'),
                                bulbarSigns: fieldInfo('bulbarSigns'),
                            }}
                            onPickReflex={chooseReflex}
                            onPickSign={chooseSign}
                            onChangeReflex={(name, side, value) => {
                                setReflexes((current) => current.map((candidate) => candidate.name === name ? { ...candidate, [side]: value } : candidate));
                            }}
                            onChangePathologicalSign={(name, side, value) => {
                                setPathologicalSigns((current) => current.map((candidate) => candidate.name === name ? { ...candidate, [side]: value } : candidate));
                            }}
                            onChangeLmnSign={(name, side, value) => {
                                setLmnSideSigns((current) => current.map((candidate) => candidate.name === name ? { ...candidate, [side]: value } : candidate));
                            }}
                            onChangeBulbarSign={(name, value) => {
                                setBulbarSigns((current) => current.map((candidate) => candidate.name === name ? { ...candidate, value } : candidate));
                            }}
                        />
                    )}

                    <DerivedPhenotypeCard
                        title={fieldLabel('motorNeuronCode', isDE ? 'Abgeleiteter M-Phänotyp' : 'Derived M phenotype')}
                        code={suggestedMotorNeuronCode}
                        subtitle={`UMN ${burdenLabel(overallUmnBurden, i18n.language)} · LMN ${burdenLabel(overallLmnBurden, i18n.language)}`}
                    />

                    <TextAreaSection
                        title={fieldLabel('note', isDE ? 'Interner Kommentar' : 'Internal note')}
                        info={fieldInfo('note')}
                        value={note}
                        onChangeText={setNote}
                        placeholder={fieldPlaceholder('note', isDE ? 'Optional' : 'Optional')}
                        readOnly={isReadOnly}
                    />
                </View>
            </ScrollView>
        </>
    );
}

function RegionsTab({
    clinicalRegionOrder,
    clinicalRegions,
    language,
    umnLabel,
    lmnLabel,
    infoTitle,
    infoText,
    readOnly,
    onPickSeverity,
    onChange,
}: {
    clinicalRegionOrder: ClinicalRegion[];
    clinicalRegions: ClinicalRegionFinding[];
    language: string;
    umnLabel: string;
    lmnLabel: string;
    infoTitle: string;
    infoText: string;
    readOnly: boolean;
    onPickSeverity: (title: string, current: FindingSeverity, onChange: (value: FindingSeverity) => void) => void;
    onChange: (region: ClinicalRegion, patch: Partial<ClinicalRegionFinding>) => void;
}) {
    return (
        <View style={styles.tabContent}>
            <MockSectionHeader title={infoTitle} info={infoText} />
            {clinicalRegionOrder.map((region) => {
                const item = clinicalRegions.find((candidate) => candidate.region === region) ?? { region, umnBurden: 'absent' as const, lmnBurden: 'absent' as const };
                const title = clinicalRegionLabel(region, language);
                return (
                    <RegionCard
                        key={region}
                        title={title}
                        subtitle={clinicalRegionSubtitle(region, language)}
                        affected={isAffectedSeverity(item.umnBurden) || isAffectedSeverity(item.lmnBurden)}
                        umnLabel={umnLabel}
                        lmnLabel={lmnLabel}
                        umnValue={severityLabel(item.umnBurden, language)}
                        lmnValue={severityLabel(item.lmnBurden, language)}
                        umnTone={severityTone(item.umnBurden)}
                        lmnTone={severityTone(item.lmnBurden)}
                        onUmnPress={() => onPickSeverity(`${title} · ${umnLabel}`, item.umnBurden, (value) => onChange(region, { umnBurden: value }))}
                        onLmnPress={() => onPickSeverity(`${title} · ${lmnLabel}`, item.lmnBurden, (value) => onChange(region, { lmnBurden: value }))}
                        readOnly={readOnly}
                        language={language}
                    />
                );
            })}
        </View>
    );
}

function StrengthTab({
    groups,
    mrcStrength,
    language,
    sideLabels,
    title,
    infoText,
    readOnly,
    onPickMrc,
    onChange,
}: {
    groups: MrcMuscleGroup[];
    mrcStrength: BilateralMrcFinding[];
    language: string;
    sideLabels: { left: string; right: string };
    title: string;
    infoText: string;
    readOnly: boolean;
    onPickMrc: (title: string, current: MrcGrade, onChange: (value: MrcGrade) => void) => void;
    onChange: (group: MrcMuscleGroup, side: 'left' | 'right', value: MrcGrade) => void;
}) {
    const { colors } = useTheme();
    const isDE = language === 'de';
    const upperGroups = groups.filter((group) => MRC_GROUP_TO_BODY[group].left === 'left_arm');
    const lowerGroups = groups.filter((group) => MRC_GROUP_TO_BODY[group].left === 'left_leg');
    return (
        <View style={styles.tabContent}>
            <MockSectionHeader title={title} info={infoText} />
            <Text style={[styles.miniNote, { color: colors.textHint }]}>
                {isDE ? 'MRC 0-5, plus/minus zur klinischen Verlaufsdokumentation.' : 'MRC 0-5, with plus/minus for clinical follow-up.'}
            </Text>
            <MrcScale />
            <StrengthTable
                title={isDE ? 'Arme / OEX' : 'Arms / upper limbs'}
                groups={upperGroups}
                values={mrcStrength}
                language={language}
                sideLabels={sideLabels}
                readOnly={readOnly}
                onPickMrc={onPickMrc}
                onChange={onChange}
            />
            <StrengthTable
                title={isDE ? 'Beine / UEX' : 'Legs / lower limbs'}
                groups={lowerGroups}
                values={mrcStrength}
                language={language}
                sideLabels={sideLabels}
                readOnly={readOnly}
                onPickMrc={onPickMrc}
                onChange={onChange}
            />
        </View>
    );
}

function SignsTab({
    reflexOrder,
    reflexes,
    pathologicalSignOrder,
    pathologicalSigns,
    lmnSignOrder,
    lmnSideSigns,
    bulbarSignOrder,
    bulbarSigns,
    language,
    sideLabels,
    readOnly,
    labels,
    infos,
    onPickReflex,
    onPickSign,
    onChangeReflex,
    onChangePathologicalSign,
    onChangeLmnSign,
    onChangeBulbarSign,
}: {
    reflexOrder: ReflexName[];
    reflexes: BilateralReflexFinding[];
    pathologicalSignOrder: PathologicalSignName[];
    pathologicalSigns: BilateralSignFinding<PathologicalSignName>[];
    lmnSignOrder: LmnSignName[];
    lmnSideSigns: BilateralSignFinding<LmnSignName>[];
    bulbarSignOrder: BulbarSignName[];
    bulbarSigns: BulbarSignFinding[];
    language: string;
    sideLabels: { left: string; right: string };
    readOnly: boolean;
    labels: { reflexes: string; pathologicalSigns: string; lmnSigns: string; bulbarSigns: string };
    infos: { reflexes: string; pathologicalSigns: string; lmnSigns: string; bulbarSigns: string };
    onPickReflex: (title: string, current: ReflexGrade, onChange: (value: ReflexGrade) => void) => void;
    onPickSign: (title: string, current: SignPresence, onChange: (value: SignPresence) => void) => void;
    onChangeReflex: (name: ReflexName, side: 'left' | 'right', value: ReflexGrade) => void;
    onChangePathologicalSign: (name: PathologicalSignName, side: 'left' | 'right', value: SignPresence) => void;
    onChangeLmnSign: (name: LmnSignName, side: 'left' | 'right', value: SignPresence) => void;
    onChangeBulbarSign: (name: BulbarSignName, value: SignPresence) => void;
}) {
    const isDE = language === 'de';
    return (
        <View style={styles.tabContent}>
            <SignCard title={labels.reflexes} subtitle={isDE ? 'Muskeleigenreflexe links / rechts' : 'Deep tendon reflexes left / right'} badge="UMN" badgeTone="blue" info={infos.reflexes}>
                <BilateralSignGrid
                    names={reflexOrder}
                    values={reflexes}
                    language={language}
                    sideLabels={sideLabels}
                    readOnly={readOnly}
                    labelForName={reflexNameLabel}
                    labelForValue={reflexGradeLabel}
                    onPick={(name, side, current) => {
                        const title = `${reflexNameLabel(name, language)} · ${sideLabels[side]}`;
                        onPickReflex(title, current, (value) => onChangeReflex(name, side, value));
                    }}
                />
            </SignCard>

            <SignCard title={labels.pathologicalSigns} subtitle={isDE ? 'Pyramidenbahnzeichen' : 'Pyramidal tract signs'} badge={isDE ? 'UMN' : 'UMN'} badgeTone="blue" info={infos.pathologicalSigns}>
                <BilateralSignGrid
                    names={pathologicalSignOrder}
                    values={pathologicalSigns}
                    language={language}
                    sideLabels={sideLabels}
                    readOnly={readOnly}
                    labelForName={pathologicalSignLabel}
                    labelForValue={signPresenceLabel}
                    onPick={(name, side, current) => {
                        const title = `${pathologicalSignLabel(name, language)} · ${sideLabels[side]}`;
                        onPickSign(title, current, (value) => onChangePathologicalSign(name, side, value));
                    }}
                />
            </SignCard>

            <SignCard title={labels.lmnSigns} subtitle={isDE ? 'Atrophien und Faszikulationen' : 'Atrophy and fasciculations'} badge="LMN" badgeTone="green" info={infos.lmnSigns}>
                <BilateralSignGrid
                    names={lmnSignOrder}
                    values={lmnSideSigns}
                    language={language}
                    sideLabels={sideLabels}
                    readOnly={readOnly}
                    labelForName={lmnSignLabel}
                    labelForValue={signPresenceLabel}
                    onPick={(name, side, current) => {
                        const title = `${lmnSignLabel(name, language)} · ${sideLabels[side]}`;
                        onPickSign(title, current, (value) => onChangeLmnSign(name, side, value));
                    }}
                />
            </SignCard>

            <SignCard title={labels.bulbarSigns} subtitle={isDE ? 'Hirnnerven / Zunge / Sprache' : 'Cranial nerves / tongue / speech'} badge="LMN" badgeTone="green" info={infos.bulbarSigns}>
                <View style={styles.signGrid}>
                    {bulbarSignOrder.map((name) => {
                        const item = bulbarSigns.find((candidate) => candidate.name === name) ?? { name, value: 'absent' as const };
                        return (
                            <SignCell
                                key={name}
                                title={bulbarSignLabel(name, language)}
                                value={signPresenceLabel(item.value, language)}
                                tone={presenceTone(item.value)}
                                onPress={() => onPickSign(bulbarSignLabel(name, language), item.value, (value) => onChangeBulbarSign(name, value))}
                                disabled={readOnly}
                            />
                        );
                    })}
                </View>
            </SignCard>
        </View>
    );
}

function MockSectionHeader({ title, info }: { title: string; info: string }) {
    const { colors } = useTheme();
    return (
        <View style={styles.mockSectionHeader}>
            <Text style={[styles.mockSectionTitle, { color: colors.textPrimary }]}>{title}</Text>
            {sectionInfoButton(title, info, colors.textHint)}
        </View>
    );
}

function RegionCard({
    title,
    subtitle,
    affected,
    umnLabel,
    lmnLabel,
    umnValue,
    lmnValue,
    umnTone,
    lmnTone,
    onUmnPress,
    onLmnPress,
    readOnly,
    language,
}: {
    title: string;
    subtitle: string;
    affected: boolean;
    umnLabel: string;
    lmnLabel: string;
    umnValue: string;
    lmnValue: string;
    umnTone: PillTone;
    lmnTone: PillTone;
    onUmnPress: () => void;
    onLmnPress: () => void;
    readOnly: boolean;
    language: string;
}) {
    const { colors } = useTheme();
    const isDE = language === 'de';
    return (
        <View style={[styles.regionCard, { backgroundColor: colors.listItemBackground, borderColor: colors.border }]}>
            <View style={styles.regionHead}>
                <View style={styles.regionTitleBlock}>
                    <Text style={[styles.regionTitle, { color: colors.textPrimary }]}>{title}</Text>
                    <Text style={[styles.regionMeta, { color: colors.textHint }]}>{subtitle}</Text>
                </View>
                <StatusPill tone={affected ? 'green' : 'neutral'} text={affected ? (isDE ? 'betroffen' : 'involved') : (isDE ? 'unauffällig' : 'normal')} />
            </View>
            <View style={styles.checks}>
                <MockValueTile label={lmnLabel} value={lmnValue} tone={lmnTone} onPress={onLmnPress} disabled={readOnly} />
                <MockValueTile label={umnLabel} value={umnValue} tone={umnTone} onPress={onUmnPress} disabled={readOnly} />
            </View>
        </View>
    );
}

function StrengthTable({
    title,
    groups,
    values,
    language,
    sideLabels,
    readOnly,
    onPickMrc,
    onChange,
}: {
    title: string;
    groups: MrcMuscleGroup[];
    values: BilateralMrcFinding[];
    language: string;
    sideLabels: { left: string; right: string };
    readOnly: boolean;
    onPickMrc: (title: string, current: MrcGrade, onChange: (value: MrcGrade) => void) => void;
    onChange: (group: MrcMuscleGroup, side: 'left' | 'right', value: MrcGrade) => void;
}) {
    const { colors } = useTheme();
    return (
        <View style={styles.strengthBlock}>
            <Text style={[styles.tableSectionTitle, { color: colors.textSecondary }]}>{title}</Text>
            <View style={[styles.mrcTable, { backgroundColor: colors.listItemBackground, borderColor: colors.border }]}>
                <View style={[styles.mrcHeaderRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.mrcHeaderTitle, { color: colors.textHint }]}>
                        {language === 'de' ? 'Muskelgruppe' : 'Muscle group'}
                    </Text>
                    <Text style={[styles.mrcHeaderSide, { color: colors.textHint }]}>{sideLabels.left}</Text>
                    <Text style={[styles.mrcHeaderSide, { color: colors.textHint }]}>{sideLabels.right}</Text>
                </View>
                {groups.map((group, index) => {
                    const item = values.find((candidate) => candidate.muscleGroup === group) ?? { muscleGroup: group, left: '5' as const, right: '5' as const };
                    const label = mrcMuscleGroupLabel(group, language);
                    return (
                        <View key={group} style={[styles.mrcRow, index < groups.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                            <Text style={[styles.mrcName, { color: colors.textPrimary }]} numberOfLines={2}>{label}</Text>
                            <MrcCell
                                value={mrcGradeLabel(item.left, language)}
                                tone={mrcTone(item.left)}
                                onPress={() => onPickMrc(`${label} · ${sideLabels.left}`, item.left, (value) => onChange(group, 'left', value))}
                                disabled={readOnly}
                            />
                            <MrcCell
                                value={mrcGradeLabel(item.right, language)}
                                tone={mrcTone(item.right)}
                                onPress={() => onPickMrc(`${label} · ${sideLabels.right}`, item.right, (value) => onChange(group, 'right', value))}
                                disabled={readOnly}
                            />
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

function MrcScale() {
    const { colors } = useTheme();
    const values = ['0', '1', '2', '3', '4', '5', 'n.p.'];
    return (
        <View style={[styles.mrcScale, { backgroundColor: colors.listItemBackground, borderColor: colors.border }]}>
            {values.map((value) => (
                <View key={value} style={[styles.scaleDot, value === '4' && styles.scaleDotActive]}>
                    <Text style={[styles.scaleText, { color: value === '4' ? '#fff' : colors.textSecondary }]}>{value}</Text>
                </View>
            ))}
        </View>
    );
}

function SignCard({
    title,
    subtitle,
    badge,
    badgeTone,
    info,
    children,
}: {
    title: string;
    subtitle: string;
    badge: string;
    badgeTone: PillTone;
    info: string;
    children: React.ReactNode;
}) {
    const { colors } = useTheme();
    return (
        <View style={[styles.signCard, { backgroundColor: colors.listItemBackground, borderColor: colors.border }]}>
            <View style={styles.signHeader}>
                <View style={styles.regionTitleBlock}>
                    <View style={styles.signTitleRow}>
                        <Text style={[styles.signTitle, { color: colors.textPrimary }]}>{title}</Text>
                        {sectionInfoButton(title, info, colors.textHint)}
                    </View>
                    <Text style={[styles.signSubtitle, { color: colors.textHint }]}>{subtitle}</Text>
                </View>
                <StatusPill tone={badgeTone} text={badge} />
            </View>
            {children}
        </View>
    );
}

function BilateralSignGrid<TName extends string, TValue extends string>({
    names,
    values,
    language,
    sideLabels,
    readOnly,
    labelForName,
    labelForValue,
    onPick,
}: {
    names: TName[];
    values: Array<{ name: TName; left: TValue; right: TValue }>;
    language: string;
    sideLabels: { left: string; right: string };
    readOnly: boolean;
    labelForName: (name: TName, language?: string) => string;
    labelForValue: (value?: TValue, language?: string) => string;
    onPick: (name: TName, side: 'left' | 'right', current: TValue) => void;
}) {
    return (
        <View style={styles.signGrid}>
            {names.map((name) => {
                const item = values.find((candidate) => candidate.name === name);
                if (!item) return null;
                const title = labelForName(name, language);
                return (
                    <React.Fragment key={name}>
                        <SignCell
                            title={`${title} ${sideLabels.left}`}
                            value={labelForValue(item.left, language)}
                            tone={valueTone(item.left)}
                            onPress={() => onPick(name, 'left', item.left)}
                            disabled={readOnly}
                        />
                        <SignCell
                            title={`${title} ${sideLabels.right}`}
                            value={labelForValue(item.right, language)}
                            tone={valueTone(item.right)}
                            onPress={() => onPick(name, 'right', item.right)}
                            disabled={readOnly}
                        />
                    </React.Fragment>
                );
            })}
        </View>
    );
}

function SignCell({
    title,
    value,
    tone,
    onPress,
    disabled,
}: {
    title: string;
    value: string;
    tone: PillTone;
    onPress: () => void;
    disabled: boolean;
}) {
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={disabled ? undefined : onPress}
            disabled={disabled}
            style={[styles.signCell, { backgroundColor: colors.background, borderColor: colors.border }]}
        >
            <Text style={[styles.signName, { color: colors.textSecondary }]} numberOfLines={2}>{title}</Text>
            <StatusPill tone={tone} text={value} />
        </Pressable>
    );
}

function MrcCell({ value, tone, onPress, disabled }: { value: string; tone: PillTone; onPress: () => void; disabled: boolean }) {
    return (
        <Pressable onPress={disabled ? undefined : onPress} disabled={disabled} style={styles.mrcCell}>
            <StatusPill tone={tone} text={value} large />
        </Pressable>
    );
}

function MockValueTile({
    label,
    value,
    tone,
    onPress,
    disabled,
}: {
    label: string;
    value: string;
    tone: PillTone;
    onPress: () => void;
    disabled: boolean;
}) {
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={disabled ? undefined : onPress}
            disabled={disabled}
            style={[styles.checkTile, { backgroundColor: colors.background, borderColor: colors.border }]}
        >
            <StatusPill tone={tone} text={value} />
            <Text style={[styles.checkLabel, { color: colors.textHint }]}>{label}</Text>
        </Pressable>
    );
}

function DerivedPhenotypeCard({ title, code, subtitle }: { title: string; code: string; subtitle: string }) {
    const { colors } = useTheme();
    return (
        <View style={[styles.derivedCard, { backgroundColor: colors.listItemBackground, borderColor: colors.border }]}>
            <View>
                <Text style={[styles.derivedTitle, { color: colors.textHint }]}>{title}</Text>
                <Text style={[styles.derivedSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            </View>
            <Text style={[styles.derivedCode, { color: colors.textPrimary }]}>{code}</Text>
        </View>
    );
}

type PillTone = 'neutral' | 'green' | 'blue' | 'orange' | 'red';

function StatusPill({ text, tone, large = false }: { text: string; tone: PillTone; large?: boolean }) {
    const colors = pillColors(tone);
    return (
        <View style={[styles.pill, large && styles.pillLarge, { backgroundColor: colors.background }]}>
            <Text style={[styles.pillText, large && styles.pillLargeText, { color: colors.text }]} numberOfLines={1}>{text}</Text>
        </View>
    );
}

function TextAreaSection({
    title,
    info,
    value,
    onChangeText,
    placeholder,
    readOnly,
}: {
    title: string;
    info: string;
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
    readOnly: boolean;
}) {
    const { colors } = useTheme();
    return (
        <List.Section title={title} rightCmp={sectionInfoButton(title, info, colors.textHint)} rounded>
            <View style={styles.noteWrapper}>
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    editable={!readOnly}
                    multiline
                    placeholder={placeholder}
                    placeholderTextColor={colors.textHint}
                    style={[styles.note, { color: colors.textPrimary }]}
                />
            </View>
        </List.Section>
    );
}

function sectionInfoButton(title: string, info: string, color: string) {
    if (!info) return undefined;
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

function chooseValue<T extends string>({
    title,
    values,
    current,
    label,
    onChange,
    cancelLabel,
}: {
    title: string;
    values: T[];
    current: T;
    label: (value: T) => string;
    onChange: (value: T) => void;
    cancelLabel: string;
}) {
    Alert.alert(
        title,
        undefined,
        [
            ...values.map((value) => ({
                text: value === current ? `✓ ${label(value)}` : label(value),
                onPress: () => onChange(value),
            })),
            { text: cancelLabel, style: 'cancel' as const },
        ]
    );
}

function clinicalRegionSubtitle(region: ClinicalRegion, language: string): string {
    const isDE = language === 'de';
    switch (region) {
        case 'bulbar':
            return isDE ? 'Hirnnerven / Zunge / Sprache' : 'Cranial nerves / tongue / speech';
        case 'cervical':
            return isDE ? 'OEX, Hand- und Fingerfunktion' : 'Upper limbs, hand and finger function';
        case 'thoracic':
            return isDE ? 'Rumpf, Atmung und axiale Stabilität' : 'Trunk, breathing and axial stability';
        case 'lumbosacral':
            return isDE ? 'UEX, Stand und Gang' : 'Lower limbs, stance and gait';
    }
}

function severityTone(value: FindingSeverity): PillTone {
    if (value === 'severe') return 'red';
    if (value === 'moderate') return 'orange';
    if (value === 'mild') return 'green';
    return 'neutral';
}

function presenceTone(value: SignPresence): PillTone {
    if (value === 'present') return 'green';
    return 'neutral';
}

function valueTone(value: string): PillTone {
    if (value === 'present' || value === '3+' || value === '4+') return 'green';
    if (value === '0' || value === '1+') return 'orange';
    return 'neutral';
}

function mrcTone(value: MrcGrade): PillTone {
    if (value === '0' || value === '1' || value === '2') return 'red';
    if (value === '3') return 'orange';
    if (value === '4-' || value === '4' || value === '4+') return 'green';
    return 'neutral';
}

function pillColors(tone: PillTone): { background: string; text: string } {
    switch (tone) {
        case 'green':
            return { background: 'rgba(47, 200, 111, 0.14)', text: '#1f9d58' };
        case 'blue':
            return { background: 'rgba(47, 120, 198, 0.14)', text: '#2f78c6' };
        case 'orange':
            return { background: 'rgba(240, 161, 43, 0.16)', text: '#b86f00' };
        case 'red':
            return { background: 'rgba(232, 91, 91, 0.16)', text: '#cf3d3d' };
        default:
            return { background: 'rgba(142, 142, 150, 0.14)', text: '#777780' };
    }
}

function createDefaultClinicalRegions(): ClinicalRegionFinding[] {
    return CLINICAL_REGIONS.map((region) => ({
        region,
        umnBurden: 'absent',
        lmnBurden: 'absent',
    }));
}

function createDefaultMrcStrength(): BilateralMrcFinding[] {
    return MRC_GROUPS.map((muscleGroup) => ({
        muscleGroup,
        left: '5',
        right: '5',
    }));
}

function createDefaultReflexes(): BilateralReflexFinding[] {
    return REFLEX_NAMES.map((name) => ({
        name,
        left: '2+',
        right: '2+',
    }));
}

function createDefaultPathologicalSigns(): BilateralSignFinding<PathologicalSignName>[] {
    return PATHOLOGICAL_SIGNS.map((name) => ({
        name,
        left: 'absent',
        right: 'absent',
    }));
}

function createDefaultLmnSideSigns(): BilateralSignFinding<LmnSignName>[] {
    return LMN_SIGNS.map((name) => ({
        name,
        left: 'absent',
        right: 'absent',
    }));
}

function createDefaultBulbarSigns(): BulbarSignFinding[] {
    return BULBAR_SIGNS.map((name) => ({
        name,
        value: 'absent',
    }));
}

function mergeClinicalRegions(values: ClinicalRegionFinding[] | undefined): ClinicalRegionFinding[] {
    return CLINICAL_REGIONS.map((region) => {
        const existing = values?.find((item) => item.region === region);
        return existing ?? { region, umnBurden: 'absent', lmnBurden: 'absent' };
    });
}

function mergeMrcStrength(values: BilateralMrcFinding[] | undefined): BilateralMrcFinding[] {
    return MRC_GROUPS.map((muscleGroup) => {
        const existing = values?.find((item) => item.muscleGroup === muscleGroup);
        return existing ?? { muscleGroup, left: '5', right: '5' };
    });
}

function mergeReflexes(values: BilateralReflexFinding[] | undefined): BilateralReflexFinding[] {
    return REFLEX_NAMES.map((name) => {
        const existing = values?.find((item) => item.name === name);
        return existing ?? { name, left: '2+', right: '2+' };
    });
}

function mergePathologicalSigns(values: BilateralSignFinding<PathologicalSignName>[] | undefined): BilateralSignFinding<PathologicalSignName>[] {
    return PATHOLOGICAL_SIGNS.map((name) => {
        const existing = values?.find((item) => item.name === name);
        return existing ?? { name, left: 'absent', right: 'absent' };
    });
}

function mergeLmnSideSigns(values: BilateralSignFinding<LmnSignName>[] | undefined): BilateralSignFinding<LmnSignName>[] {
    return LMN_SIGNS.map((name) => {
        const existing = values?.find((item) => item.name === name);
        return existing ?? { name, left: 'absent', right: 'absent' };
    });
}

function mergeBulbarSigns(values: BulbarSignFinding[] | undefined): BulbarSignFinding[] {
    return BULBAR_SIGNS.map((name) => {
        const existing = values?.find((item) => item.name === name);
        return existing ?? { name, value: 'absent' };
    });
}

function entryClinicalRegions(entry: NeurologicalExamEntry): ClinicalRegionFinding[] {
    if (entry.clinicalRegions?.length) return mergeClinicalRegions(entry.clinicalRegions);

    const values = createDefaultClinicalRegions();
    for (const region of entry.regions) {
        const clinicalRegion = bodyRegionToClinicalRegion(region.region);
        const target = values.find((item) => item.region === clinicalRegion);
        if (!target) continue;
        target.umnBurden = maxClinicalSeverity([
            target.umnBurden,
            ...Object.values(region.umnSigns ?? {}),
        ]);
        target.lmnBurden = maxClinicalSeverity([
            target.lmnBurden,
            ...Object.values(region.lmnSigns ?? {}),
        ]);
    }
    return values;
}

function bodyRegionToClinicalRegion(region: BodyRegion): ClinicalRegion {
    switch (region) {
        case 'head':
            return 'bulbar';
        case 'left_arm':
        case 'right_arm':
            return 'cervical';
        case 'trunk':
            return 'thoracic';
        case 'left_leg':
        case 'right_leg':
            return 'lumbosacral';
    }
}

function maxClinicalSeverity(values: Array<FindingSeverity | undefined>): FindingSeverity {
    return values.reduce<FindingSeverity>((max, value) => severityRank(value) > severityRank(max) ? (value ?? max) : max, 'absent');
}

function severityRank(value: FindingSeverity | undefined): number {
    switch (value) {
        case 'severe':
            return 3;
        case 'moderate':
            return 2;
        case 'mild':
            return 1;
        default:
            return 0;
    }
}

function burdenFromSeverity(severity: FindingSeverity): NonNullable<NeurologicalExamEntry['overallUmnBurden']> {
    if (severity === 'severe') return 'severe';
    if (severity === 'moderate') return 'moderate';
    if (severity === 'mild') return 'mild';
    return 'none';
}

function deriveMotorNeuronCode(
    umn: NonNullable<NeurologicalExamEntry['overallUmnBurden']>,
    lmn: NonNullable<NeurologicalExamEntry['overallLmnBurden']>
): OpmMotorNeuronCode {
    const umnRank = burdenRank(umn);
    const lmnRank = burdenRank(lmn);
    if (umnRank === 0 && lmnRank === 0) return 'M0';
    if (umnRank > 0 && lmnRank === 0) return 'M1p';
    if (lmnRank > 0 && umnRank === 0) return 'M2p';
    if (umnRank > lmnRank) return 'M1d';
    if (lmnRank > umnRank) return 'M2d';
    return 'M0';
}

function burdenRank(value: NonNullable<NeurologicalExamEntry['overallUmnBurden']>): number {
    switch (value) {
        case 'severe':
            return 3;
        case 'moderate':
            return 2;
        case 'mild':
            return 1;
        default:
            return 0;
    }
}

function buildLegacyRegions({
    clinicalRegions,
    mrcStrength,
    reflexes,
    pathologicalSigns,
    lmnSideSigns,
    bulbarSigns,
}: {
    clinicalRegions: ClinicalRegionFinding[];
    mrcStrength: BilateralMrcFinding[];
    reflexes: BilateralReflexFinding[];
    pathologicalSigns: BilateralSignFinding<PathologicalSignName>[];
    lmnSideSigns: BilateralSignFinding<LmnSignName>[];
    bulbarSigns: BulbarSignFinding[];
}): RegionMotorNeuronFindings[] {
    const byRegion = new Map<BodyRegion, RegionMotorNeuronFindings>();
    const getRegion = (region: BodyRegion): RegionMotorNeuronFindings => {
        const existing = byRegion.get(region);
        if (existing) return existing;
        const created: RegionMotorNeuronFindings = {
            region,
            umnSigns: {},
            lmnSigns: {},
        };
        byRegion.set(region, created);
        return created;
    };

    for (const item of clinicalRegions) {
        for (const region of CLINICAL_REGION_TO_BODY[item.region]) {
            const target = getRegion(region);
            if (isAffectedSeverity(item.umnBurden)) {
                target.umnSigns.hyperreflexia = maxClinicalSeverity([target.umnSigns.hyperreflexia, item.umnBurden]);
                target.umnSigns.spasticity = maxClinicalSeverity([target.umnSigns.spasticity, item.umnBurden]);
            }
            if (isAffectedSeverity(item.lmnBurden)) {
                target.lmnSigns.weakness = maxClinicalSeverity([target.lmnSigns.weakness, item.lmnBurden]);
            }
        }
    }

    for (const item of mrcStrength) {
        const body = MRC_GROUP_TO_BODY[item.muscleGroup];
        applyMrcWeakness(getRegion(body.left), item.left);
        applyMrcWeakness(getRegion(body.right), item.right);
    }

    for (const item of reflexes) {
        const body = REFLEX_TO_BODY[item.name];
        applyReflex(getRegion(body.left), item.left);
        applyReflex(getRegion(body.right), item.right);
    }

    for (const item of pathologicalSigns) {
        if (item.left === 'present') {
            getRegion(signToBodyRegion(item.name, 'left')).umnSigns.pathologicalReflexes = 'mild';
        }
        if (item.right === 'present') {
            getRegion(signToBodyRegion(item.name, 'right')).umnSigns.pathologicalReflexes = 'mild';
        }
    }

    for (const item of bulbarSigns) {
        if (item.value !== 'present') continue;
        const target = getRegion('head');
        if (item.name === 'tongue_atrophy') target.lmnSigns.atrophy = 'mild';
        if (item.name === 'tongue_fasciculations') target.lmnSigns.fasciculations = 'mild';
        if (item.name === 'dysarthria' || item.name === 'dysphagia') target.lmnSigns.weakness = 'mild';
    }

    return Array.from(byRegion.values()).filter(isLegacyRegionAffected);
}

function applyMrcWeakness(region: RegionMotorNeuronFindings, grade: MrcGrade) {
    if (grade === '5' || grade === 'not_tested') return;
    region.lmnSigns.weakness = maxClinicalSeverity([region.lmnSigns.weakness, mrcToSeverity(grade)]);
}

function mrcToSeverity(grade: MrcGrade): FindingSeverity {
    if (grade === '4+' || grade === '4' || grade === '4-') return 'mild';
    if (grade === '3') return 'moderate';
    return 'severe';
}

function applyReflex(region: RegionMotorNeuronFindings, grade: ReflexGrade) {
    if (grade === '3+' || grade === '4+') {
        region.umnSigns.hyperreflexia = maxClinicalSeverity([region.umnSigns.hyperreflexia, 'mild']);
    }
    if (grade === '0' || grade === '1+') {
        region.lmnSigns.reducedOrAbsentReflexes = maxClinicalSeverity([region.lmnSigns.reducedOrAbsentReflexes, 'mild']);
    }
}

function signToBodyRegion(sign: PathologicalSignName, side: 'left' | 'right'): BodyRegion {
    if (sign === 'babinski') return side === 'left' ? 'left_leg' : 'right_leg';
    return side === 'left' ? 'left_arm' : 'right_arm';
}

function isLegacyRegionAffected(region: RegionMotorNeuronFindings): boolean {
    return Object.values(region.umnSigns).some(isAffectedSeverity) || Object.values(region.lmnSigns).some(isAffectedSeverity);
}

function isAffectedSeverity(value: FindingSeverity | undefined): boolean {
    return value !== undefined && value !== 'absent' && value !== 'not_tested';
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
    segmentedControlWrapper: {
        marginHorizontal: 16,
        marginBottom: 16,
    },
    segmentedControl: {
        height: 32,
    },
    tabContent: {
        gap: 12,
        marginHorizontal: 16,
        marginBottom: 14,
    },
    mockSectionHeader: {
        minHeight: 34,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
    },
    mockSectionTitle: {
        fontSize: 17,
        fontWeight: '800',
    },
    regionCard: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        padding: 14,
        gap: 12,
    },
    regionHead: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    regionTitleBlock: {
        flex: 1,
        gap: 3,
    },
    regionTitle: {
        fontSize: 16,
        fontWeight: '800',
    },
    regionMeta: {
        fontSize: 12,
        fontWeight: '700',
    },
    checks: {
        flexDirection: 'row',
        gap: 10,
    },
    checkTile: {
        flex: 1,
        minHeight: 72,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingHorizontal: 8,
    },
    checkLabel: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    pill: {
        minHeight: 24,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
    },
    pillLarge: {
        minWidth: 44,
        minHeight: 32,
        paddingHorizontal: 12,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '800',
    },
    pillLargeText: {
        fontSize: 16,
    },
    miniNote: {
        marginTop: -6,
        marginHorizontal: 4,
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
    mrcScale: {
        minHeight: 46,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    scaleDot: {
        minWidth: 34,
        minHeight: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scaleDotActive: {
        backgroundColor: '#8f3f98',
    },
    scaleText: {
        fontSize: 13,
        fontWeight: '800',
    },
    strengthBlock: {
        gap: 8,
    },
    tableSectionTitle: {
        marginLeft: 4,
        fontSize: 16,
        fontWeight: '800',
    },
    mrcTable: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        overflow: 'hidden',
    },
    mrcHeaderRow: {
        minHeight: 38,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        gap: 8,
    },
    mrcHeaderTitle: {
        flex: 1,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    mrcHeaderSide: {
        width: 62,
        fontSize: 11,
        fontWeight: '800',
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    mrcRow: {
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        gap: 8,
    },
    mrcName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
    mrcCell: {
        width: 62,
        alignItems: 'center',
        justifyContent: 'center',
    },
    signCard: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        padding: 16,
        gap: 14,
    },
    signHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    signTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    signTitle: {
        fontSize: 17,
        fontWeight: '800',
    },
    signSubtitle: {
        fontSize: 12,
        fontWeight: '700',
    },
    signGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    signCell: {
        width: '48%',
        minHeight: 74,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 8,
    },
    signName: {
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 15,
    },
    derivedCard: {
        minHeight: 76,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        marginHorizontal: 16,
        marginBottom: 14,
    },
    derivedTitle: {
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    derivedSubtitle: {
        marginTop: 4,
        fontSize: 13,
        fontWeight: '700',
    },
    derivedCode: {
        fontSize: 22,
        fontWeight: '800',
    },
    noteWrapper: {
        padding: 12,
    },
    note: {
        minHeight: 86,
        fontSize: 16,
        textAlignVertical: 'top',
    },
});
