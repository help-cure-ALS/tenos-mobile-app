import Slider from '@react-native-community/slider';
import { Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { List, useTheme } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppRole } from '@/src/context/AppRoleProvider';
import { useMetricPreferences } from '@/src/hooks/usePatientPreferences';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';
import { fmtDate } from '@/src/lib/formatDate';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { getMetricDefinition } from '@/src/metrics/definitions';
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
    regionLabel,
    severityLabel,
    signPresenceLabel,
    summarizeNeurologicalExam,
} from '@/src/questionnaires/structured/neurologicalExam/labels';
import type {
    ClinicalRegionFinding,
    NeurologicalExamEntry,
    RegionMotorNeuronFindings,
    SignPresence,
} from '@/src/questionnaires/structured/neurologicalExam/types';
import { structuredFieldLabelFromDefinition } from '@/src/questionnaires/structured/structuredFieldLabels';

export default function NeurologicalExamDetailScreen() {
    const { colors } = useTheme();
    const { t, i18n } = useTranslation();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { role, isDemo } = useAppRole();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();
    const { entries, isLoading } = useNeurologicalExams();
    const { pinned, setPinned } = useMetricPreferences('als_neurological_exam');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const isDE = i18n.language === 'de';
    const definition = getMetricDefinition('als_neurological_exam', i18n.language);
    const questionnaireDefinition = getQuestionnaireDefinition('als_neurological_exam', i18n.language);
    const fieldLabel = (fieldId: string, fallback: string) => structuredFieldLabelFromDefinition(questionnaireDefinition, fieldId, fallback);
    const canEdit = role === 'doctor' || isDemo;

    const clampedIndex = Math.min(selectedIndex, Math.max(0, entries.length - 1));
    const selected = entries[clampedIndex] ?? null;

    const sliderLabels = useMemo(() => {
        if (entries.length < 2) return null;
        return {
            oldest: fmtDate(new Date(entries[entries.length - 1].assessedAt), isDE),
            newest: fmtDate(new Date(entries[0].assessedAt), isDE),
        };
    }, [entries, isDE]);

    if (!sharingLoaded || isLoading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                {Platform.OS === 'android' ? (
                    <Stack.Screen options={{
                        headerTitle: definition?.name ?? (isDE ? 'Neurologische Untersuchung' : 'Neurological exam'),
                        headerRight: () => canEdit ? (
                            <HeaderButton
                                icon="plus"
                                variant="done"
                                onPress={() => router.push('/(tabs)/(metric)/neurologicalExam/add')}
                            />
                        ) : null,
                    }} />
                ) : (
                    <>
                        <Stack.Screen.Title>{definition?.name ?? (isDE ? 'Neurologische Untersuchung' : 'Neurological exam')}</Stack.Screen.Title>
                        {canEdit && (
                            <Stack.Toolbar placement="right">
                                <Stack.Toolbar.Button icon="plus" variant="done" tintColor={colors.textPrimary} onPress={() => router.push('/(tabs)/(metric)/neurologicalExam/add')} />
                            </Stack.Toolbar>
                        )}
                    </>
                )}
                <ActivityIndicator />
            </View>
        );
    }

    if (isFiltering && !canSeeMetric('als_neurological_exam')) {
        router.back();
        return null;
    }

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: definition?.name ?? (isDE ? 'Neurologische Untersuchung' : 'Neurological exam'),
                        headerRight: () => canEdit ? (
                            <HeaderButton
                                icon="plus"
                                variant="done"
                                onPress={() => router.push('/(tabs)/(metric)/neurologicalExam/add')}
                            />
                        ) : null,
                    }}
                />
            ) : (
                <>
                    <Stack.Screen.Title>{definition?.name ?? (isDE ? 'Neurologische Untersuchung' : 'Neurological exam')}</Stack.Screen.Title>
                    {canEdit && (
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="plus" variant="done" tintColor={colors.textPrimary} onPress={() => router.push('/(tabs)/(metric)/neurologicalExam/add')} />
                        </Stack.Toolbar>
                    )}
                </>
            )}
            <ScrollView
                style={{ backgroundColor: colors.background }}
                contentContainerStyle={styles.scrollView}
                contentInsetAdjustmentBehavior="automatic"
            >
                <View style={[styles.heroSection, { backgroundColor: colors.listItemBackground }]}>
                    <View style={[styles.heroWrapper, { paddingLeft: insets.left, paddingRight: insets.right }, insets.left > 200 && { maxWidth: 940 + insets.left }]}>
                        {selected ? (
                            <>
                                <Text style={[styles.headline, { color: colors.textPrimary }]}>
                                    {selected.suggestedMotorNeuronCode ?? (isDE ? 'Motorischer Befund' : 'Motor findings')}
                                </Text>
                                <Text style={[styles.date, { color: colors.textHint }]}>
                                    {fmtDate(new Date(selected.assessedAt), isDE)}
                                </Text>
                                <View style={styles.burdenRow}>
                                    <BurdenBox label="UMN" value={burdenLabel(selected.overallUmnBurden, i18n.language)} />
                                    <BurdenBox label="LMN" value={burdenLabel(selected.overallLmnBurden, i18n.language)} />
                                    <BurdenBox label={fieldLabel('clinicalRegions', isDE ? 'Regionen' : 'Regions')} value={String(countAffectedRegions(selected))} />
                                </View>
                                <Text style={[styles.summary, { color: colors.textSecondary }]}>
                                    {summarizeNeurologicalExam(selected, i18n.language)}
                                </Text>
                                {entries.length > 1 && sliderLabels && (
                                    <View style={styles.sliderSection}>
                                        <Slider
                                            style={styles.slider}
                                            minimumValue={0}
                                            maximumValue={entries.length - 1}
                                            step={1}
                                            value={entries.length - 1 - clampedIndex}
                                            onValueChange={(v) => setSelectedIndex(entries.length - 1 - Math.round(v))}
                                            minimumTrackTintColor={colors.border}
                                            maximumTrackTintColor={colors.border}
                                            thumbTintColor={colors.textSecondary}
                                        />
                                        <View style={styles.sliderLabels}>
                                            <Text style={[styles.sliderLabel, { color: colors.textHint }]}>{sliderLabels.oldest}</Text>
                                            <Text style={[styles.sliderIndex, { color: colors.textSecondary }]}>{entries.length - clampedIndex} / {entries.length}</Text>
                                            <Text style={[styles.sliderLabel, { color: colors.textHint, textAlign: 'right' }]}>{sliderLabels.newest}</Text>
                                        </View>
                                    </View>
                                )}
                            </>
                        ) : (
                            <View style={styles.emptyHero}>
                                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                                    {isDE ? 'Noch keine Untersuchung' : 'No exam yet'}
                                </Text>
                                <Text style={[styles.summary, { color: colors.textSecondary }]}>
                                    {isDE
                                        ? 'Es wurde noch kein neurologischer Motorbefund dokumentiert.'
                                        : 'No neurological motor exam has been documented yet.'}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={[styles.bodyWrapper, { paddingLeft: insets.left, paddingRight: insets.right }, insets.left > 200 && { maxWidth: 940 + insets.left }]}>
                    {selected && <ClinicalRegionSection exam={selected} language={i18n.language} />}
                    {selected && <MrcStrengthSection exam={selected} language={i18n.language} />}
                    {selected && <SignsSection exam={selected} language={i18n.language} />}

                    <List.Section title={definition?.descriptionTitle ?? ''} rounded>
                        <List.Item title={definition?.description ?? ''} titleNumberOfLines={99} />
                    </List.Section>

                    <List.Section rounded>
                        <List.Item
                            title={t('metric.pinToOverview')}
                            hideChevron
                            lastItem
                            rightCmp={<Switch value={pinned} onValueChange={setPinned} />}
                        />
                    </List.Section>

                    {
                        (entries.length > 0 || !isFiltering) && (
                            <List.Section rounded>
                                {entries.length > 0 && (
                                    <List.Item
                                        title={isDE ? 'Verlauf anzeigen' : 'Show history'}
                                        subtitle={isDE ? `${entries.length} Untersuchungen` : `${entries.length} exams`}
                                        onPress={() => router.push('/(tabs)/(metric)/neurologicalExam/list')}
                                        lastItem={isFiltering}
                                    />
                                )}
                                {!isFiltering && (
                                    <List.Item
                                        title={t('metric.metricAccess')}
                                        onPress={() => router.push('/(tabs)/(metric)/als_neurological_exam/access')}
                                        lastItem
                                    />
                                )}
                            </List.Section>
                        )
                    }

                    <List.Wrapper>
                        <List.Text align="center">
                            {isDE
                                ? 'Die neurologische Untersuchung ist ein ärztlicher Befund und ersetzt keine vollständige klinische Beurteilung.'
                                : 'The neurological exam is a clinical finding and does not replace full medical assessment.'}
                        </List.Text>
                    </List.Wrapper>
                </View>
            </ScrollView>
        </>
    );
}

function ClinicalRegionSection({ exam, language }: { exam: NeurologicalExamEntry; language: string }) {
    const isDE = language === 'de';
    const questionnaireDefinition = getQuestionnaireDefinition('als_neurological_exam', language);
    const fieldLabel = (fieldId: string, fallback: string) => structuredFieldLabelFromDefinition(questionnaireDefinition, fieldId, fallback);
    if (exam.clinicalRegions?.length) {
        return (
            <List.Section title={fieldLabel('clinicalRegions', isDE ? 'Regionale Beteiligung' : 'Regional involvement')} rounded>
                {exam.clinicalRegions.map((region, index) => (
                    <List.Item
                        key={region.region}
                        title={clinicalRegionLabel(region.region, language)}
                        subtitle={clinicalRegionSummary(region, language, fieldLabel)}
                        subtitleNumberOfLines={2}
                        hideChevron
                        lastItem={index === exam.clinicalRegions!.length - 1}
                    />
                ))}
            </List.Section>
        );
    }

    return (
        <List.Section title={isDE ? 'Regionale Befunde' : 'Regional findings'} rounded>
            {exam.regions.map((region, index) => (
                <List.Item
                    key={`${region.region}-${index}`}
                    title={regionLabel(region.region, language)}
                    subtitle={regionSummary(region, language, fieldLabel)}
                    subtitleNumberOfLines={3}
                    hideChevron
                    lastItem={index === exam.regions.length - 1}
                />
            ))}
        </List.Section>
    );
}

function MrcStrengthSection({ exam, language }: { exam: NeurologicalExamEntry; language: string }) {
    const isDE = language === 'de';
    const left = isDE ? 'Links' : 'Left';
    const right = isDE ? 'Rechts' : 'Right';
    if (!exam.mrcStrength?.length) return null;

    return (
        <List.Section title={isDE ? 'MRC-Kraftprüfung' : 'MRC strength exam'} rounded>
            {exam.mrcStrength.map((item, index) => (
                <List.Item
                    key={item.muscleGroup}
                    title={mrcMuscleGroupLabel(item.muscleGroup, language)}
                    subtitle={`${left}: ${mrcGradeLabel(item.left, language)} · ${right}: ${mrcGradeLabel(item.right, language)}`}
                    hideChevron
                    lastItem={index === exam.mrcStrength!.length - 1}
                />
            ))}
        </List.Section>
    );
}

function SignsSection({ exam, language }: { exam: NeurologicalExamEntry; language: string }) {
    const isDE = language === 'de';
    const rows = [
        ...(exam.reflexes ?? []).map((item) => ({
            key: `reflex-${item.name}`,
            title: reflexNameLabel(item.name, language),
            subtitle: bilateralText(reflexGradeLabel(item.left, language), reflexGradeLabel(item.right, language), isDE),
        })),
        ...(exam.pathologicalSigns ?? []).map((item) => ({
            key: `pathological-${item.name}`,
            title: pathologicalSignLabel(item.name, language),
            subtitle: bilateralText(signPresenceLabel(item.left, language), signPresenceLabel(item.right, language), isDE),
        })),
        ...(exam.lmnSideSigns ?? []).map((item) => ({
            key: `lmn-${item.name}`,
            title: lmnSignLabel(item.name, language),
            subtitle: bilateralText(signPresenceLabel(item.left, language), signPresenceLabel(item.right, language), isDE),
        })),
        ...(exam.bulbarSigns ?? []).map((item) => ({
            key: `bulbar-${item.name}`,
            title: bulbarSignLabel(item.name, language),
            subtitle: signPresenceLabel(item.value, language),
        })),
    ].filter((item) => !isNormalSignSubtitle(item.subtitle, isDE));

    if (rows.length === 0) return null;

    return (
        <List.Section title={isDE ? 'Klinische Zeichen' : 'Clinical signs'} rounded>
            {rows.map((row, index) => (
                <List.Item
                    key={row.key}
                    title={row.title}
                    subtitle={row.subtitle}
                    hideChevron
                    lastItem={index === rows.length - 1}
                />
            ))}
        </List.Section>
    );
}

function bilateralText(leftValue: string, rightValue: string, isDE: boolean): string {
    return `${isDE ? 'Links' : 'Left'}: ${leftValue} · ${isDE ? 'Rechts' : 'Right'}: ${rightValue}`;
}

function isNormalSignSubtitle(value: string, isDE: boolean): boolean {
    const normalized = value.toLowerCase();
    return normalized === (isDE ? 'nicht vorhanden' : 'absent')
        || normalized.includes(`${isDE ? 'links' : 'left'}: ${isDE ? 'nicht vorhanden' : 'absent'}`)
        && normalized.includes(`${isDE ? 'rechts' : 'right'}: ${isDE ? 'nicht vorhanden' : 'absent'}`);
}

function clinicalRegionSummary(
    region: ClinicalRegionFinding,
    language: string,
    fieldLabel: (fieldId: string, fallback: string) => string
): string {
    return [
        `${fieldLabel('overallUmnBurden', 'UMN')}: ${severityLabel(region.umnBurden, language)}`,
        `${fieldLabel('overallLmnBurden', 'LMN')}: ${severityLabel(region.lmnBurden, language)}`,
    ].join(' · ');
}

function regionSummary(
    region: RegionMotorNeuronFindings,
    language: string,
    fieldLabel: (fieldId: string, fallback: string) => string
): string {
    const isDE = language === 'de';
    const parts = [
        region.lmnSigns?.weakness && region.lmnSigns.weakness !== 'absent'
            ? `${fieldLabel('lmnWeakness', isDE ? 'Schwäche' : 'Weakness')}: ${severityLabel(region.lmnSigns.weakness, language)}`
            : null,
        region.lmnSigns?.atrophy && region.lmnSigns.atrophy !== 'absent'
            ? `${fieldLabel('lmnAtrophy', isDE ? 'Atrophie' : 'Atrophy')}: ${severityLabel(region.lmnSigns.atrophy, language)}`
            : null,
        region.lmnSigns?.fasciculations && region.lmnSigns.fasciculations !== 'absent'
            ? `${fieldLabel('lmnFasciculations', isDE ? 'Faszikulationen' : 'Fasciculations')}: ${severityLabel(region.lmnSigns.fasciculations, language)}`
            : null,
        region.umnSigns?.hyperreflexia && region.umnSigns.hyperreflexia !== 'absent'
            ? `${fieldLabel('umnHyperreflexia', isDE ? 'Hyperreflexie' : 'Hyperreflexia')}: ${severityLabel(region.umnSigns.hyperreflexia, language)}`
            : null,
        region.umnSigns?.spasticity && region.umnSigns.spasticity !== 'absent'
            ? `${fieldLabel('umnSpasticity', isDE ? 'Spastik' : 'Spasticity')}: ${severityLabel(region.umnSigns.spasticity, language)}`
            : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : (isDE ? 'kein pathologischer Befund dokumentiert' : 'no pathological finding documented');
}

function countAffectedRegions(exam: NeurologicalExamEntry): number {
    if (exam.clinicalRegions?.length) {
        return exam.clinicalRegions.filter((region) => isAffected(region.umnBurden) || isAffected(region.lmnBurden)).length;
    }
    return exam.regions.filter((region) => isLegacyRegionAffected(region)).length;
}

function isAffected(value: SignPresence | string | undefined): boolean {
    return value !== undefined && value !== 'absent' && value !== 'not_tested' && value !== 'none';
}

function isLegacyRegionAffected(region: RegionMotorNeuronFindings): boolean {
    return Object.values(region.umnSigns).some(isAffected) || Object.values(region.lmnSigns).some(isAffected);
}

function BurdenBox({ label, value }: { label: string; value: string }) {
    const { colors } = useTheme();
    return (
        <View style={[styles.burdenBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.burdenValue, { color: colors.textPrimary }]}>{value}</Text>
            <Text style={[styles.burdenLabel, { color: colors.textHint }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90,
    },
    heroSection: {
        paddingTop: 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
        minHeight: 140
    },
    heroWrapper: {
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%',
        paddingHorizontal: 20,
        gap: 10,
    },
    bodyWrapper: {
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%',
        paddingTop: 20,
    },
    headline: {
        fontSize: 32,
        fontWeight: '800',
    },
    date: {
        fontSize: 13,
        fontWeight: '600',
    },
    burdenRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    burdenBox: {
        flex: 1,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        padding: 10,
        alignItems: 'center',
    },
    burdenValue: {
        fontSize: 17,
        fontWeight: '800',
    },
    burdenLabel: {
        fontSize: 11,
        marginTop: 2,
    },
    summary: {
        fontSize: 15,
        lineHeight: 21,
    },
    sliderSection: {
        marginTop: 6,
    },
    slider: {
        width: '100%',
        height: 32,
    },
    sliderLabels: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sliderLabel: {
        flex: 1,
        fontSize: 11,
    },
    sliderIndex: {
        fontSize: 12,
        fontWeight: '700',
    },
    emptyHero: {
        gap: 8,
        paddingVertical: 18,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '800',
    },
});
