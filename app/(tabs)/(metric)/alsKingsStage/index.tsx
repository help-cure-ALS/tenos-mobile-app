import Slider from '@react-native-community/slider';
import { Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { List, useTheme } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isDerivedALSKingsStageEntry } from '@/src/questionnaires/structured/alsKingsStage/deriveKingsStage';
import { useALSKingsStage } from '@/src/questionnaires/structured/alsKingsStage/hooks/useALSKingsStage';
import { regionLabel, sourceLabel, stage4ReasonLabel, stageDescription, stageLabel, summarizeALSKingsStage } from '@/src/questionnaires/structured/alsKingsStage/labels';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useMetricPreferences } from '@/src/hooks/usePatientPreferences';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';
import { fmtDate } from '@/src/lib/formatDate';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { getMetricDefinition } from '@/src/metrics/definitions';
import { getQuestionnaireDefinition } from '@/src/questionnaires/definitions';
import { structuredFieldLabelFromDefinition } from '@/src/questionnaires/structured/structuredFieldLabels';

export default function ALSKingsStageDetailScreen() {
    const { colors } = useTheme();
    const { t, i18n } = useTranslation();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { role, isDemo } = useAppRole();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();
    const { entries, latestEntry, calculatedEntry, isLoading } = useALSKingsStage();
    const { pinned, setPinned } = useMetricPreferences('als_kings_stage');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const isDE = i18n.language === 'de';
    const definition = getMetricDefinition('als_kings_stage', i18n.language);
    const questionnaireDefinition = getQuestionnaireDefinition('als_kings_stage', i18n.language);
    const fieldLabel = (fieldId: string, fallback: string) => structuredFieldLabelFromDefinition(questionnaireDefinition, fieldId, fallback);
    const canEdit = role === 'doctor' || isDemo;

    const displayEntries = entries.length > 0 ? entries : (latestEntry ? [latestEntry] : []);
    const clampedIndex = Math.min(selectedIndex, Math.max(0, displayEntries.length - 1));
    const selected = displayEntries[clampedIndex] ?? null;
    const selectedIsCalculated = isDerivedALSKingsStageEntry(selected);

    const sliderLabels = useMemo(() => {
        if (displayEntries.length < 2) return null;
        return {
            oldest: fmtDate(new Date(displayEntries[displayEntries.length - 1].assessedAt), isDE),
            newest: fmtDate(new Date(displayEntries[0].assessedAt), isDE),
        };
    }, [displayEntries, isDE]);

    if (!sharingLoaded || isLoading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                {Platform.OS === 'android' ? (
                    <Stack.Screen options={{
                        headerTitle: definition?.name ?? "King's Stage",
                        headerRight: () => canEdit ? (
                            <HeaderButton
                                icon="plus"
                                variant="done"
                                onPress={() => router.push('/(tabs)/(metric)/alsKingsStage/add')}
                            />
                        ) : null,
                    }} />
                ) : (
                    <>
                        <Stack.Screen.Title>{definition?.name ?? "King's Stage"}</Stack.Screen.Title>
                        {canEdit && (
                            <Stack.Toolbar placement="right">
                                <Stack.Toolbar.Button icon="plus" variant="done" tintColor={colors.textPrimary} onPress={() => router.push('/(tabs)/(metric)/alsKingsStage/add')} />
                            </Stack.Toolbar>
                        )}
                    </>
                )}
                <ActivityIndicator />
            </View>
        );
    }

    if (isFiltering && !canSeeMetric('als_kings_stage')) {
        router.back();
        return null;
    }

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: definition?.name ?? "King's Stage",
                        headerRight: () => canEdit ? (
                            <HeaderButton
                                icon="plus"
                                variant="done"
                                onPress={() => router.push('/(tabs)/(metric)/alsKingsStage/add')}
                            />
                        ) : null,
                    }}
                />
            ) : (
                <>
                    <Stack.Screen.Title>{definition?.name ?? "King's Stage"}</Stack.Screen.Title>
                    {canEdit && (
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="plus" variant="done" tintColor={colors.textPrimary} onPress={() => router.push('/(tabs)/(metric)/alsKingsStage/add')} />
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
                                    {stageLabel(selected.stage, i18n.language)}
                                </Text>
                                <Text style={[styles.date, { color: colors.textHint }]}>
                                    {fmtDate(new Date(selected.assessedAt), isDE)}
                                </Text>
                                <View style={styles.summaryRow}>
                                    <SummaryBox label={fieldLabel('stage', isDE ? 'Stadium' : 'Stage')} value={selected.stage} />
                                    <SummaryBox label={fieldLabel('source', isDE ? 'Quelle' : 'Source')} value={sourceLabel(selected.source, i18n.language)} />
                                    <SummaryBox label={fieldLabel('affectedRegions', isDE ? 'Regionen' : 'Regions')} value={String(selected.affectedRegions?.length ?? 0)} />
                                </View>
                                <Text style={[styles.summary, { color: colors.textSecondary }]}>
                                    {summarizeALSKingsStage(selected, i18n.language)}
                                </Text>
                                {displayEntries.length > 1 && sliderLabels && (
                                    <View style={styles.sliderSection}>
                                        <Slider
                                            style={styles.slider}
                                            minimumValue={0}
                                            maximumValue={displayEntries.length - 1}
                                            step={1}
                                            value={displayEntries.length - 1 - clampedIndex}
                                            onValueChange={(v) => setSelectedIndex(displayEntries.length - 1 - Math.round(v))}
                                            minimumTrackTintColor={colors.border}
                                            maximumTrackTintColor={colors.border}
                                            thumbTintColor={colors.textSecondary}
                                        />
                                        <View style={styles.sliderLabels}>
                                            <Text style={[styles.sliderLabel, { color: colors.textHint }]}>{sliderLabels.oldest}</Text>
                                            <Text style={[styles.sliderIndex, { color: colors.textSecondary }]}>{displayEntries.length - clampedIndex} / {displayEntries.length}</Text>
                                            <Text style={[styles.sliderLabel, { color: colors.textHint, textAlign: 'right' }]}>{sliderLabels.newest}</Text>
                                        </View>
                                    </View>
                                )}
                            </>
                        ) : (
                            <View style={styles.emptyHero}>
                                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                                    {isDE ? "King's Stage nicht berechenbar" : "King's Stage not calculable"}
                                </Text>
                                <Text style={[styles.summary, { color: colors.textSecondary }]}>
                                    {isDE
                                        ? "Es liegen noch keine ausreichenden neurologischen Befunde oder Versorgungskriterien vor."
                                        : "There is not enough neurological exam or care milestone data yet."}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={[styles.bodyWrapper, { paddingLeft: insets.left, paddingRight: insets.right }, insets.left > 200 && { maxWidth: 940 + insets.left }]}>
                    {selected && (
                        <List.Section title={selectedIsCalculated ? (isDE ? 'Berechneter Vorschlag' : 'Calculated suggestion') : (isDE ? 'Ausgewählte Bewertung' : 'Selected assessment')} rounded>
                            <List.Item title={fieldLabel('stage', isDE ? 'Stadium' : 'Stage')} subtitle={stageLabel(selected.stage, i18n.language)} hideChevron />
                            <List.Item title={isDE ? 'Bedeutung' : 'Meaning'} subtitle={stageDescription(selected.stage, i18n.language)} hideChevron />
                            <List.Item
                                title={fieldLabel('affectedRegions', isDE ? 'Betroffene Regionen' : 'Affected regions')}
                                subtitle={selected.affectedRegions?.map((region) => regionLabel(region, i18n.language)).join(', ') || (isDE ? 'nicht dokumentiert' : 'not documented')}
                                subtitleNumberOfLines={3}
                                hideChevron
                            />
                            {selected.stage4Reason && (
                                <List.Item
                                    title={fieldLabel('stage4Reason', isDE ? 'Stadium-4-Grund' : 'Stage 4 reason')}
                                    subtitle={stage4ReasonLabel(selected.stage4Reason, i18n.language)}
                                    hideChevron
                                />
                            )}
                            <List.Item title={fieldLabel('source', isDE ? 'Quelle' : 'Source')} subtitle={sourceLabel(selected.source, i18n.language)} hideChevron lastItem />
                        </List.Section>
                    )}

                    {entries.length > 0 && calculatedEntry && (
                        <List.Section title={isDE ? 'Aktueller berechneter Vorschlag' : 'Current calculated suggestion'} rounded>
                            <List.Item title={fieldLabel('stage', isDE ? 'Stadium' : 'Stage')} subtitle={stageLabel(calculatedEntry.stage, i18n.language)} hideChevron />
                            <List.Item
                                title={fieldLabel('affectedRegions', isDE ? 'Betroffene Regionen' : 'Affected regions')}
                                subtitle={calculatedEntry.affectedRegions?.map((region) => regionLabel(region, i18n.language)).join(', ') || (isDE ? 'nicht dokumentiert' : 'not documented')}
                                subtitleNumberOfLines={3}
                                hideChevron
                            />
                            <List.Item title={fieldLabel('source', isDE ? 'Quelle' : 'Source')} subtitle={sourceLabel(calculatedEntry.source, i18n.language)} hideChevron lastItem />
                        </List.Section>
                    )}

                    <List.Section title={definition?.descriptionTitle ?? ''} rounded>
                        <List.Item title={definition?.description ?? ''} titleNumberOfLines={99} />
                    </List.Section>

                    <List.Section rounded>
                        <List.Item
                            title={t('metric.pinToOverview')}
                            hideChevron
                            rightCmp={<Switch value={pinned} onValueChange={setPinned} />}
                            lastItem
                        />
                    </List.Section>

                    {(entries.length > 0 || !isFiltering) && (
                        <List.Section rounded>
                            {entries.length > 0 && (
                                <List.Item
                                    title={isDE ? 'Verlauf anzeigen' : 'Show history'}
                                    subtitle={isDE ? `${entries.length} Bewertungen` : `${entries.length} assessments`}
                                    onPress={() => router.push('/(tabs)/(metric)/alsKingsStage/list')}
                                    lastItem={isFiltering}
                                />
                            )}
                            {!isFiltering && (
                                <List.Item
                                    title={t('metric.metricAccess')}
                                    onPress={() => router.push('/(tabs)/(metric)/als_kings_stage/access')}
                                    lastItem
                                />
                            )}
                        </List.Section>
                    )}

                    <List.Wrapper>
                        <List.Text align="center">
                            {isDE
                                ? "King's Stage ist eine ärztliche Stadieneinteilung und ersetzt keine klinische Beurteilung."
                                : "King's Stage is a clinical staging assessment and does not replace medical judgment."}
                        </List.Text>
                    </List.Wrapper>
                </View>
            </ScrollView>
        </>
    );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
    const { colors } = useTheme();
    return (
        <View style={[styles.summaryBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]} numberOfLines={1}>{value}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textHint }]}>{label}</Text>
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
        minHeight: 140,
    },
    heroWrapper: {
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%',
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
    summaryRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    summaryBox: {
        flex: 1,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        padding: 10,
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 17,
        fontWeight: '800',
    },
    summaryLabel: {
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
    },
    emptyTitle: {
        fontSize: 26,
        fontWeight: '800',
    },
});
