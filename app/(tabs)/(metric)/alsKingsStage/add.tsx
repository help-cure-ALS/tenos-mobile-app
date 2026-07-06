import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { List, useTheme } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/src/components/ui/AppIcon';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { getQuestionnaireDefinition } from '@/src/questionnaires/definitions';
import { useALSKingsStage } from '@/src/questionnaires/structured/alsKingsStage/hooks/useALSKingsStage';
import { regionLabel, sourceLabel, stage4ReasonLabel, stageDescription, stageLabel } from '@/src/questionnaires/structured/alsKingsStage/labels';
import type { ALSKingsStage4Reason, ALSKingsStageRegion, ALSKingsStageSource, ALSKingsStageValue } from '@/src/questionnaires/structured/alsKingsStage/types';
import {
    structuredFieldInfoFromDefinition,
    structuredFieldLabelFromDefinition,
    structuredFieldPlaceholderFromDefinition,
    structuredOptionValuesFromDefinition,
} from '@/src/questionnaires/structured/structuredFieldLabels';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';

const STAGES: ALSKingsStageValue[] = ['1', '2', '3', '4A', '4B', '4'];
const SOURCES: ALSKingsStageSource[] = ['manual', 'suggested_from_exam', 'suggested_from_alsfrs', 'suggested_from_care'];
const REGIONS: ALSKingsStageRegion[] = ['bulbar', 'upper_limb', 'lower_limb', 'thoracic'];
const STAGE4_REASONS: ALSKingsStage4Reason[] = ['nutrition', 'respiratory', 'both', 'unspecified'];

export default function ALSKingsStageAddScreen() {
    const { colors } = useTheme();
    const { i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { entryId } = useLocalSearchParams<{ entryId?: string }>();
    const { role, isDemo } = useAppRole();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();
    const { saveEntry, entries, calculatedEntry, isLoading } = useALSKingsStage();
    const isDE = i18n.language === 'de';
    const definition = useMemo(() => getQuestionnaireDefinition('als_kings_stage', i18n.language), [i18n.language]);
    const isReadOnly = !!entryId;
    const hasMetricAccess = sharingLoaded && (!isFiltering || canSeeMetric('als_kings_stage'));
    const canCreate = hasMetricAccess && (role === 'doctor' || isDemo);
    const canAccess = canCreate || (isReadOnly && hasMetricAccess);
    const viewedEntry = useMemo(
        () => entryId ? entries.find((entry) => entry.id === entryId) : null,
        [entries, entryId]
    );
    const stages = useMemo(() => structuredOptionValuesFromDefinition<ALSKingsStageValue>(definition, 'stage', STAGES), [definition]);
    const sources = useMemo(() => structuredOptionValuesFromDefinition<ALSKingsStageSource>(definition, 'source', SOURCES), [definition]);
    const regions = useMemo(() => structuredOptionValuesFromDefinition<ALSKingsStageRegion>(definition, 'affectedRegions', REGIONS), [definition]);
    const stage4Reasons = useMemo(() => structuredOptionValuesFromDefinition<ALSKingsStage4Reason>(definition, 'stage4Reason', STAGE4_REASONS), [definition]);
    const fieldLabel = useCallback((fieldId: string, fallback: string) => structuredFieldLabelFromDefinition(definition, fieldId, fallback), [definition]);
    const fieldInfo = useCallback((fieldId: string) => structuredFieldInfoFromDefinition(definition, fieldId), [definition]);
    const fieldPlaceholder = useCallback((fieldId: string, fallback: string) => structuredFieldPlaceholderFromDefinition(definition, fieldId, fallback), [definition]);

    const [stage, setStage] = useState<ALSKingsStageValue | undefined>();
    const [source, setSource] = useState<ALSKingsStageSource | undefined>();
    const [affectedRegions, setAffectedRegions] = useState<ALSKingsStageRegion[]>([]);
    const [stage4Reason, setStage4Reason] = useState<ALSKingsStage4Reason | undefined>();
    const [note, setNote] = useState('');
    const [didApplyCalculatedEntry, setDidApplyCalculatedEntry] = useState(false);
    const isStage4 = !!stage && stage.startsWith('4');
    const canSave = !!(
        !isReadOnly &&
        stage &&
        source &&
        (isStage4 ? stage4Reason : affectedRegions.length > 0)
    );

    useEffect(() => {
        if (!sharingLoaded) return;
        if (!canAccess) {
            router.back();
        }
    }, [canAccess, router, sharingLoaded]);

    useEffect(() => {
        if (!isReadOnly || !viewedEntry) return;
        setStage(viewedEntry.stage);
        setSource(viewedEntry.source);
        setAffectedRegions(viewedEntry.affectedRegions ?? []);
        setStage4Reason(viewedEntry.stage4Reason);
        setNote(viewedEntry.note ?? '');
    }, [isReadOnly, viewedEntry]);

    useEffect(() => {
        if (isReadOnly || didApplyCalculatedEntry || !calculatedEntry) return;
        setStage(calculatedEntry.stage);
        setSource(calculatedEntry.source);
        setAffectedRegions(calculatedEntry.affectedRegions ?? []);
        setStage4Reason(calculatedEntry.stage4Reason);
        setDidApplyCalculatedEntry(true);
    }, [calculatedEntry, didApplyCalculatedEntry, isReadOnly]);

    useEffect(() => {
        if (isReadOnly && !isLoading && !viewedEntry) {
            router.back();
        }
    }, [isReadOnly, isLoading, router, viewedEntry]);

    const toggleRegion = useCallback((region: ALSKingsStageRegion) => {
        setAffectedRegions((current) => current.includes(region)
            ? current.filter((value) => value !== region)
            : [...current, region]
        );
    }, []);

    const onSave = useCallback(async () => {
        if (isReadOnly) return;
        if (!canSave || !stage || !source) {
            Alert.alert(
                isDE ? 'Angaben vervollständigen' : 'Complete entry',
                isDE ? 'Bitte Stadium, Quelle und die relevanten Details auswählen.' : 'Please select stage, source, and the relevant details.'
            );
            return;
        }

        try {
            await saveEntry({
                assessedAt: new Date().toISOString(),
                recordedByRole: isDemo ? 'demo' : 'doctor',
                stage,
                source,
                affectedRegions,
                stage4Reason,
                note,
            });
            router.back();
        } catch (e: any) {
            Alert.alert(isDE ? 'Fehler' : 'Error', e?.message ?? String(e));
        }
    }, [affectedRegions, canSave, isDE, isDemo, isReadOnly, note, router, saveEntry, source, stage, stage4Reason]);

    if (!sharingLoaded || !canAccess || (isReadOnly && (isLoading || !viewedEntry))) return null;

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: isReadOnly
                            ? (definition?.name ?? "King's Stage")
                            : (isDE ? `${definition?.name ?? "King's Stage"} erfassen` : `Record ${definition?.name ?? "King's Stage"}`),
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
                            ? (definition?.name ?? "King's Stage")
                            : (isDE ? `${definition?.name ?? "King's Stage"} erfassen` : `Record ${definition?.name ?? "King's Stage"}`)}
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
                    <List.Section
                        title={fieldLabel('stage', isDE ? 'Stadium' : 'Stage')}
                        rightCmp={sectionInfoButton(
                            fieldLabel('stage', isDE ? 'Stadium' : 'Stage'),
                            fieldInfo('stage'),
                            colors.textHint
                        )}
                        rounded
                    >
                        {stages.map((value, index) => (
                            <List.Item
                                key={value}
                                title={stageLabel(value, i18n.language)}
                                subtitle={stageDescription(value, i18n.language)}
                                onPress={isReadOnly ? undefined : () => setStage(value)}
                                type="checkbox"
                                checked={stage === value}
                                hideChevron
                                lastItem={index === stages.length - 1}
                            />
                        ))}
                    </List.Section>

                    {!isStage4 && (
                        <List.Section
                            title={fieldLabel('affectedRegions', isDE ? 'Betroffene Regionen' : 'Affected regions')}
                            rightCmp={sectionInfoButton(
                                fieldLabel('affectedRegions', isDE ? 'Betroffene Regionen' : 'Affected regions'),
                                fieldInfo('affectedRegions'),
                                colors.textHint
                            )}
                            rounded
                        >
                            {regions.map((value, index) => (
                                <List.Item
                                    key={value}
                                    title={regionLabel(value, i18n.language)}
                                    onPress={isReadOnly ? undefined : () => toggleRegion(value)}
                                    type="checkbox"
                                    checked={affectedRegions.includes(value)}
                                    hideChevron
                                    lastItem={index === regions.length - 1}
                                />
                            ))}
                        </List.Section>
                    )}

                    {isStage4 && (
                        <List.Section
                            title={fieldLabel('stage4Reason', isDE ? 'Stadium-4-Grund' : 'Stage 4 reason')}
                            rightCmp={sectionInfoButton(
                                fieldLabel('stage4Reason', isDE ? 'Stadium-4-Grund' : 'Stage 4 reason'),
                                fieldInfo('stage4Reason'),
                                colors.textHint
                            )}
                            rounded
                        >
                            {stage4Reasons.map((value, index) => (
                                <List.Item
                                    key={value}
                                    title={stage4ReasonLabel(value, i18n.language)}
                                    onPress={isReadOnly ? undefined : () => setStage4Reason(value)}
                                    type="checkbox"
                                    checked={stage4Reason === value}
                                    hideChevron
                                    lastItem={index === stage4Reasons.length - 1}
                                />
                            ))}
                        </List.Section>
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

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90,
    },
    bodyWrapper: {
        maxWidth: 620,
        marginHorizontal: 'auto',
        width: '100%',
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
