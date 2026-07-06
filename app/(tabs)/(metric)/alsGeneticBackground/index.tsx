import Slider from '@react-native-community/slider';
import { Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { List, useTheme } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    counselingStatusLabel,
    diseaseFormLabel,
    familyHistoryLabel,
    formatALSGeneticHeadline,
    geneLabel,
    sourceLabel,
    summarizeALSGeneticBackground,
    testingStatusLabel,
} from '@/src/questionnaires/structured/alsGeneticBackground/labels';
import { useALSGeneticBackground } from '@/src/questionnaires/structured/alsGeneticBackground/hooks/useALSGeneticBackground';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useMetricPreferences } from '@/src/hooks/usePatientPreferences';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';
import { monthYearToString, type MonthYearValue } from '@/src/components/ui/MonthYearPicker';
import { fmtDate } from '@/src/lib/formatDate';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { getMetricDefinition } from '@/src/metrics/definitions';
import { getQuestionnaireDefinition } from '@/src/questionnaires/definitions';
import { structuredFieldLabelFromDefinition } from '@/src/questionnaires/structured/structuredFieldLabels';

function parseYYYYMM(value: string | undefined): MonthYearValue | undefined {
    if (!value) return undefined;
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) return undefined;
    const month = Number(match[2]);
    const year = Number(match[1]);
    if (month < 1 || month > 12) return undefined;
    return { month, year };
}

export default function ALSGeneticBackgroundDetailScreen() {
    const { colors } = useTheme();
    const { t, i18n } = useTranslation();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { canWriteForActive, isDemo } = useAppRole();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();
    const { entries, isLoading } = useALSGeneticBackground();
    const { pinned, setPinned } = useMetricPreferences('als_genetic_background');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const isDE = i18n.language === 'de';
    const definition = getMetricDefinition('als_genetic_background', i18n.language);
    const questionnaireDefinition = getQuestionnaireDefinition('als_genetic_background', i18n.language);
    const fieldLabel = (fieldId: string, fallback: string) => structuredFieldLabelFromDefinition(questionnaireDefinition, fieldId, fallback);
    const canEdit = canWriteForActive || isDemo;

    const clampedIndex = Math.min(selectedIndex, Math.max(0, entries.length - 1));
    const selected = entries[clampedIndex] ?? null;
    const selectedGeneLabel = selected ? geneLabel(selected, i18n.language) : '';
    const showSelectedGene = selectedGeneLabel.length > 0;

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
                        headerTitle: definition?.name ?? (isDE ? 'ALS-Form & Genetik' : 'ALS form & genetics'),
                        headerRight: () => canEdit ? (
                            <HeaderButton
                                icon="plus"
                                variant="done"
                                onPress={() => router.push('/(tabs)/(metric)/alsGeneticBackground/add')}
                            />
                        ) : null,
                    }} />
                ) : (
                    <>
                        <Stack.Screen.Title>{definition?.name ?? (isDE ? 'ALS-Form & Genetik' : 'ALS form & genetics')}</Stack.Screen.Title>
                        {canEdit && (
                            <Stack.Toolbar placement="right">
                                <Stack.Toolbar.Button icon="plus" variant="done" tintColor={colors.textPrimary} onPress={() => router.push('/(tabs)/(metric)/alsGeneticBackground/add')} />
                            </Stack.Toolbar>
                        )}
                    </>
                )}
                <ActivityIndicator />
            </View>
        );
    }

    if (isFiltering && !canSeeMetric('als_genetic_background')) {
        router.back();
        return null;
    }

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: definition?.name ?? (isDE ? 'ALS-Form & Genetik' : 'ALS form & genetics'),
                        headerRight: () => canEdit ? (
                            <HeaderButton
                                icon="plus"
                                variant="done"
                                onPress={() => router.push('/(tabs)/(metric)/alsGeneticBackground/add')}
                            />
                        ) : null,
                    }}
                />
            ) : (
                <>
                    <Stack.Screen.Title>{definition?.name ?? (isDE ? 'ALS-Form & Genetik' : 'ALS form & genetics')}</Stack.Screen.Title>
                    {canEdit && (
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="plus" variant="done" tintColor={colors.textPrimary} onPress={() => router.push('/(tabs)/(metric)/alsGeneticBackground/add')} />
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
                                {/*<Text style={[styles.headline, { color: colors.textPrimary }]}>*/}
                                {/*    {formatALSGeneticHeadline(selected, i18n.language)}*/}
                                {/*</Text>*/}
                                <Text style={[styles.date, { color: colors.textHint }]}>
                                    {fmtDate(new Date(selected.assessedAt), isDE)}
                                </Text>
                                <View style={styles.summaryRow}>
                                    <SummaryBox label={fieldLabel('diseaseForm', isDE ? 'ALS-Form' : 'ALS form')} value={diseaseFormLabel(selected.diseaseForm, i18n.language)} />
                                    <SummaryBox label={fieldLabel('testingStatus', isDE ? 'Genetik' : 'Genetics')} value={testingStatusLabel(selected.testingStatus, i18n.language)} />
                                    {showSelectedGene && (
                                        <SummaryBox label={fieldLabel('gene', isDE ? 'Gen' : 'Gene')} value={selectedGeneLabel} />
                                    )}
                                    <SummaryBox label={fieldLabel('source', isDE ? 'Quelle' : 'Source')} value={sourceLabel(selected.source, i18n.language)} />
                                </View>
                                {/*<Text style={[styles.summary, { color: colors.textSecondary }]}>*/}
                                {/*    {summarizeALSGeneticBackground(selected, i18n.language)}*/}
                                {/*</Text>*/}
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
                                    {isDE ? 'Noch keine Angabe' : 'No entry yet'}
                                </Text>
                                <Text style={[styles.summary, { color: colors.textSecondary }]}>
                                    {isDE
                                        ? 'Es wurde noch keine ALS-Form oder genetische Angabe dokumentiert.'
                                        : 'No ALS form or genetic background has been documented yet.'}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={[styles.bodyWrapper, { paddingLeft: insets.left, paddingRight: insets.right }, insets.left > 200 && { maxWidth: 940 + insets.left }]}>
                    {selected && (
                        <List.Section title={isDE ? 'Ausgewählte Bewertung' : 'Selected assessment'} rounded>
                            <List.Item
                                title={fieldLabel('diseaseForm', isDE ? 'ALS-Form' : 'ALS form')}
                                subtitle={diseaseFormLabel(selected.diseaseForm, i18n.language)}
                                hideChevron
                            />
                            <List.Item
                                title={fieldLabel('familyHistory', isDE ? 'Familienanamnese' : 'Family history')}
                                subtitle={familyHistoryLabel(selected.familyHistory, i18n.language)}
                                hideChevron
                            />
                            <List.Item
                                title={fieldLabel('testingStatus', isDE ? 'Genetische Testung' : 'Genetic testing')}
                                subtitle={testingStatusLabel(selected.testingStatus, i18n.language)}
                                hideChevron
                            />
                            {showSelectedGene && (
                                <List.Item
                                    title={fieldLabel('gene', isDE ? 'Gen' : 'Gene')}
                                    subtitle={selectedGeneLabel}
                                    hideChevron
                                />
                            )}
                            {selected.variantText && (
                                <List.Item
                                    title={fieldLabel('variantText', isDE ? 'Variante' : 'Variant')}
                                    subtitle={selected.variantText}
                                    subtitleNumberOfLines={3}
                                    hideChevron
                                />
                            )}
                            {selected.testDate && (
                                <List.Item
                                    title={fieldLabel('testDate', isDE ? 'Testdatum' : 'Test date')}
                                    subtitle={monthYearToString(parseYYYYMM(selected.testDate), i18n.language) || selected.testDate}
                                    hideChevron
                                />
                            )}
                            <List.Item
                                title={fieldLabel('counselingStatus', isDE ? 'Humangenetische Beratung' : 'Genetic counseling')}
                                subtitle={counselingStatusLabel(selected.counselingStatus, i18n.language)}
                                hideChevron
                            />
                            <List.Item
                                title={fieldLabel('source', isDE ? 'Quelle' : 'Source')}
                                subtitle={sourceLabel(selected.source, i18n.language)}
                                hideChevron
                                lastItem={!selected.note}
                            />
                            {selected.note && (
                                <List.Item
                                    title={fieldLabel('note', isDE ? 'Kommentar' : 'Comment')}
                                    subtitle={selected.note}
                                    subtitleNumberOfLines={3}
                                    hideChevron
                                    lastItem
                                />
                            )}
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

                    {
                        (entries.length > 0 || !isFiltering) && (
                            <List.Section rounded>
                                {entries.length > 0 && (
                                    <List.Item
                                        title={isDE ? 'Verlauf anzeigen' : 'Show history'}
                                        subtitle={isDE ? `${entries.length} Angaben` : `${entries.length} entries`}
                                        onPress={() => router.push('/(tabs)/(metric)/alsGeneticBackground/list')}
                                        lastItem={isFiltering}
                                    />
                                )}
                                {!isFiltering && (
                                    <List.Item
                                        title={t('metric.metricAccess')}
                                        onPress={() => router.push('/(tabs)/(metric)/als_genetic_background/access')}
                                        lastItem
                                    />
                                )}
                            </List.Section>
                        )
                    }

                    <List.Wrapper>
                        <List.Text align="center">
                            {isDE
                                ? 'Genetische Angaben sind besonders sensibel und sollten nur gezielt geteilt werden.'
                                : 'Genetic information is especially sensitive and should only be shared deliberately.'}
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
        minHeight: 140
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
        fontSize: 30,
        fontWeight: '800',
        letterSpacing: -0.35,
    },
    date: {
        fontSize: 13,
        fontWeight: '600',
    },
    summaryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 4,
    },
    summaryBox: {
        flexGrow: 1,
        minWidth: '47%',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        padding: 10,
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 16,
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
