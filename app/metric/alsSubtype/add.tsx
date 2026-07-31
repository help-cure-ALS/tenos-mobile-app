import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { List, useTheme } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/src/components/ui/AppIcon';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { getQuestionnaireDefinition } from '@/src/questionnaires/definitions';
import { MotorNeuronFigure, OnsetFigure, PropagationFigure } from '@/src/questionnaires/structured/alsSubtype/components/OPMFigure';
import { useALSSubtype } from '@/src/questionnaires/structured/alsSubtype/hooks/useALSSubtype';
import {
    certaintyLabel,
    motorNeuronLabel,
    onsetLabel,
} from '@/src/questionnaires/structured/alsSubtype/opmCodes';
import type { ALSSubtypeCertainty, OpmMotorNeuronCode, OpmOnsetCode } from '@/src/questionnaires/structured/alsSubtype/types';
import {
    structuredFieldInfoFromDefinition,
    structuredFieldLabelFromDefinition,
    structuredFieldPlaceholderFromDefinition,
    structuredOptionValuesFromDefinition,
    structuredOptionsFromDefinition,
} from '@/src/questionnaires/structured/structuredFieldLabels';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';

const ONSET_CODES: OpmOnsetCode[] = ['O1', 'O2d', 'O2p', 'O2x', 'O3r', 'O3a', 'O4d', 'O4p', 'O4x'];
const MOTOR_CODES: OpmMotorNeuronCode[] = ['M0', 'M1d', 'M1p', 'M2d', 'M2p', 'M3'];
const CERTAINTIES: ALSSubtypeCertainty[] = ['preliminary', 'confirmed', 'uncertain'];
type PropagationPattern = 'P0n' | 'P1n' | 'P1x';
const PROPAGATION_PATTERNS: PropagationPattern[] = ['P0n', 'P1n', 'P1x'];

export default function ALSSubtypeAddScreen() {
    const { colors } = useTheme();
    const { i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { entryId } = useLocalSearchParams<{ entryId?: string }>();
    const { role, isDemo } = useAppRole();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();
    const { saveEntry, entries, isLoading } = useALSSubtype();
    const isDE = i18n.language === 'de';
    const definition = useMemo(() => getQuestionnaireDefinition('als_subtype', i18n.language), [i18n.language]);
    const isReadOnly = !!entryId;
    const hasMetricAccess = sharingLoaded && (!isFiltering || canSeeMetric('als_subtype'));
    const canCreate = hasMetricAccess && (role === 'doctor' || isDemo);
    const canAccess = canCreate || (isReadOnly && hasMetricAccess);
    const viewedEntry = useMemo(
        () => entryId ? entries.find((entry) => entry.id === entryId) : null,
        [entries, entryId]
    );
    const onsetCodes = useMemo(() => structuredOptionValuesFromDefinition<OpmOnsetCode>(definition, 'onsetCode', ONSET_CODES), [definition]);
    const motorCodes = useMemo(() => structuredOptionValuesFromDefinition<OpmMotorNeuronCode>(definition, 'motorNeuronCode', MOTOR_CODES), [definition]);
    const certainties = useMemo(() => structuredOptionValuesFromDefinition<ALSSubtypeCertainty>(definition, 'certainty', CERTAINTIES), [definition]);
    const propagationChoices = useMemo<Array<{ value: PropagationPattern; label: string; description?: string }>>(() => {
        const options = structuredOptionsFromDefinition(definition, 'propagationPattern');
        if (options.length > 0) return options as Array<{ value: PropagationPattern; label: string; description?: string }>;
        return PROPAGATION_PATTERNS.map((value) => ({ value, label: value.replace('n', '(n)').replace('x', '(x)') }));
    }, [definition]);
    const fieldLabel = useCallback((fieldId: string, fallback: string) => structuredFieldLabelFromDefinition(definition, fieldId, fallback), [definition]);
    const fieldInfo = useCallback((fieldId: string) => structuredFieldInfoFromDefinition(definition, fieldId), [definition]);
    const fieldPlaceholder = useCallback((fieldId: string, fallback: string) => structuredFieldPlaceholderFromDefinition(definition, fieldId, fallback), [definition]);

    const [onsetCode, setOnsetCode] = useState<OpmOnsetCode>('O2d');
    const [propagationStatus, setPropagationStatus] = useState<'P0' | 'P1'>('P1');
    const [propagationTimingUnknown, setPropagationTimingUnknown] = useState(false);
    const [propagationMonths, setPropagationMonths] = useState('8');
    const [motorNeuronCode, setMotorNeuronCode] = useState<OpmMotorNeuronCode>('M2d');
    const [certainty, setCertainty] = useState<ALSSubtypeCertainty>('preliminary');
    const [note, setNote] = useState('');
    const propagationMonthsLabel = propagationStatus === 'P0'
        ? (isDE ? 'Monate vom Symptombeginn bis zur Bewertung' : 'Months from symptom onset to assessment')
        : (isDE ? 'Monate vom Symptombeginn bis zur Ausbreitung' : 'Months from symptom onset to propagation');
    const selectedPropagationPattern: PropagationPattern = propagationTimingUnknown
        ? 'P1x'
        : propagationStatus === 'P0' ? 'P0n' : 'P1n';

    useEffect(() => {
        if (!sharingLoaded) return;
        if (!canAccess) {
            router.back();
        }
    }, [canAccess, router, sharingLoaded]);

    useEffect(() => {
        if (!isReadOnly || !viewedEntry) return;
        setOnsetCode(viewedEntry.onsetCode);
        setPropagationStatus(viewedEntry.propagationStatus);
        setPropagationTimingUnknown(!!viewedEntry.propagationTimingUnknown);
        setPropagationMonths(String(viewedEntry.propagationMonths ?? ''));
        setMotorNeuronCode(viewedEntry.motorNeuronCode);
        setCertainty(viewedEntry.certainty);
        setNote(viewedEntry.note ?? '');
    }, [isReadOnly, viewedEntry]);

    useEffect(() => {
        if (isReadOnly && !isLoading && !viewedEntry) {
            router.back();
        }
    }, [isReadOnly, isLoading, router, viewedEntry]);

    const onSave = useCallback(async () => {
        if (isReadOnly) return;
        const months = propagationTimingUnknown ? undefined : Math.max(0, Math.round(Number(propagationMonths) || 0));
        try {
            await saveEntry({
                onsetCode,
                propagationStatus,
                propagationMonths: months,
                propagationTimingUnknown,
                motorNeuronCode,
                certainty,
                recordedByRole: isDemo ? 'demo' : 'doctor',
                note: note.trim() || undefined,
                assessedAt: new Date().toISOString(),
            });
            router.back();
        } catch (e: any) {
            Alert.alert(isDE ? 'Fehler' : 'Error', e?.message ?? String(e));
        }
    }, [certainty, isDE, isDemo, isReadOnly, motorNeuronCode, note, onsetCode, propagationMonths, propagationStatus, propagationTimingUnknown, router, saveEntry]);

    if (!sharingLoaded || !canAccess || (isReadOnly && (isLoading || !viewedEntry))) return null;

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: isReadOnly
                            ? (definition?.name ?? (isDE ? 'ALS-Subtyp' : 'ALS subtype'))
                            : (isDE ? `${definition?.name ?? 'ALS-Subtyp'} erfassen` : `Record ${definition?.name ?? 'ALS subtype'}`),
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
                            ? (definition?.name ?? (isDE ? 'ALS-Subtyp' : 'ALS subtype'))
                            : (isDE ? `${definition?.name ?? 'ALS-Subtyp'} erfassen` : `Record ${definition?.name ?? 'ALS subtype'}`)}
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
                    <List.Section
                        title={fieldLabel('onsetCode', isDE ? 'Ort des Symptombeginns' : 'Site of symptom onset')}
                        rightCmp={sectionInfoButton(
                            fieldLabel('onsetCode', isDE ? 'Ort des Symptombeginns' : 'Site of symptom onset'),
                            fieldInfo('onsetCode'),
                            colors.textHint
                        )}
                        rounded
                        borders={false}
                    >
                        <View style={styles.grid}>
                            {onsetCodes.map((code) => (
                                <SelectableTile
                                    key={code}
                                    selected={onsetCode === code}
                                    label={code}
                                    subtitle={onsetLabel(code, i18n.language)}
                                    onPress={() => setOnsetCode(code)}
                                    disabled={isReadOnly}
                                >
                                    <OnsetFigure code={code} selected={onsetCode === code} />
                                </SelectableTile>
                            ))}
                        </View>
                    </List.Section>

                    <List.Section
                        title={fieldLabel('propagationPattern', isDE ? 'Ausbreitung' : 'Propagation')}
                        rightCmp={sectionInfoButton(
                            fieldLabel('propagationPattern', isDE ? 'Ausbreitung' : 'Propagation'),
                            fieldInfo('propagationPattern'),
                            colors.textHint
                        )}
                        rounded
                    >
                        {propagationChoices.map((choice, index) => (
                            <List.Item
                                key={choice.value}
                                title={choice.label}
                                subtitle={choice.description}
                                leftCmp={<PropagationFigure variant={propagationFigureVariant(choice.value)} selected={selectedPropagationPattern === choice.value} />}
                                leftCmpSize={64}
                                type="checkbox"
                                checked={selectedPropagationPattern === choice.value}
                                hideChevron
                                onPress={isReadOnly ? undefined : () => applyPropagationPattern(choice.value, setPropagationStatus, setPropagationTimingUnknown)}
                                lastItem={index === propagationChoices.length - 1 && propagationTimingUnknown}
                            />
                        ))}
                        {!propagationTimingUnknown && (
                            <List.InputItem
                                label={propagationMonthsLabel}
                                value={propagationMonths}
                                onChangeText={setPropagationMonths}
                                editable={!isReadOnly}
                                keyboardType="number-pad"
                                placeholder="8"
                                placeholderTextColor={colors.textHint}
                                selectTextOnFocus
                                lastItem
                            />
                        )}
                    </List.Section>

                    <List.Section
                        title={fieldLabel('motorNeuronCode', isDE ? 'Motoneuron-Phänotyp' : 'Motor neuron phenotype')}
                        rightCmp={sectionInfoButton(
                            fieldLabel('motorNeuronCode', isDE ? 'Motoneuron-Phänotyp' : 'Motor neuron phenotype'),
                            fieldInfo('motorNeuronCode'),
                            colors.textHint
                        )}
                        rounded
                        borders={false}
                    >
                        <View style={styles.grid}>
                            {motorCodes.map((code) => (
                                <SelectableTile
                                    key={code}
                                    selected={motorNeuronCode === code}
                                    label={code}
                                    subtitle={motorNeuronLabel(code, i18n.language)}
                                    onPress={() => setMotorNeuronCode(code)}
                                    disabled={isReadOnly}
                                >
                                    <MotorNeuronFigure code={code} />
                                </SelectableTile>
                            ))}
                        </View>
                    </List.Section>

                    <List.Section
                        title={fieldLabel('certainty', isDE ? 'Status' : 'Status')}
                        rightCmp={sectionInfoButton(
                            fieldLabel('certainty', isDE ? 'Status' : 'Status'),
                            fieldInfo('certainty'),
                            colors.textHint
                        )}
                        rounded
                    >
                        {certainties.map((value, index) => (
                            <List.Item
                                key={value}
                                title={certaintyLabel(value, i18n.language)}
                                onPress={isReadOnly ? undefined : () => setCertainty(value)}
                                type="checkbox"
                                checked={certainty === value}
                                hideChevron
                                lastItem={index === certainties.length - 1}
                            />
                        ))}
                    </List.Section>

                    <List.Section title={fieldLabel('note', isDE ? 'Kommentar' : 'Comment')} rounded>
                        <View style={styles.noteWrapper}>
                            <TextInput
                                value={note}
                                onChangeText={setNote}
                                editable={!isReadOnly}
                                multiline
                                placeholder={fieldPlaceholder('note', isDE ? 'Optionaler ärztlicher Kommentar' : 'Optional clinical comment')}
                                placeholderTextColor={colors.textHint}
                                style={[styles.note, { color: colors.textPrimary }]}
                            />
                        </View>
                    </List.Section>
                </View>
            </ScrollView>
        </>
    );
}

function applyPropagationPattern(
    value: PropagationPattern,
    setPropagationStatus: (status: 'P0' | 'P1') => void,
    setPropagationTimingUnknown: (unknown: boolean) => void
) {
    if (value === 'P0n') {
        setPropagationStatus('P0');
        setPropagationTimingUnknown(false);
        return;
    }
    setPropagationStatus('P1');
    setPropagationTimingUnknown(value === 'P1x');
}

function propagationFigureVariant(value: PropagationPattern): 'same' | 'vertical' | 'unknown' {
    if (value === 'P0n') return 'same';
    if (value === 'P1x') return 'unknown';
    return 'vertical';
}

function SelectableTile({
    selected,
    label,
    subtitle,
    children,
    onPress,
    disabled = false,
}: {
    selected: boolean;
    label: string;
    subtitle: string;
    children: React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
}) {
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={[
                styles.tile,
                { borderColor: selected ? colors.tint : colors.border, backgroundColor: colors.listItemBackground },
                selected && { borderWidth: 2 },
            ]}
        >
            {children}
            <Text style={[styles.tileLabel, { color: colors.textPrimary }]}>{label}</Text>
            <Text style={[styles.tileSubtitle, { color: colors.textHint }]} numberOfLines={2}>{subtitle}</Text>
        </Pressable>
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

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90,
    },
    bodyWrapper: {
        maxWidth: 620,
        marginHorizontal: 'auto',
        width: '100%',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        // padding: 12,
    },
    tile: {
        flexGrow: 1,
        flexBasis: '30%',
        minHeight: 116,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        gap: 4,
    },
    tileLabel: {
        fontSize: 15,
        fontWeight: '800',
    },
    tileSubtitle: {
        fontSize: 11,
        lineHeight: 14,
        textAlign: 'center',
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
