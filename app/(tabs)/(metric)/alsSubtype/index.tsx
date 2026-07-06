import Slider from '@react-native-community/slider';
import { Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { List, useTheme } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useALSSubtype } from '@/src/questionnaires/structured/alsSubtype/hooks/useALSSubtype';
import { formatClassificationCode, summarizeALSSubtype } from '@/src/questionnaires/structured/alsSubtype/opmCodes';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useMetricPreferences } from '@/src/hooks/usePatientPreferences';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';
import { fmtDate } from '@/src/lib/formatDate';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { getMetricDefinition } from '@/src/metrics/definitions';

export default function ALSSubtypeDetailScreen() {
    const { colors } = useTheme();
    const { t, i18n } = useTranslation();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { role, isDemo } = useAppRole();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();
    const { entries, isLoading } = useALSSubtype();
    const { pinned, setPinned } = useMetricPreferences('als_subtype');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const isDE = i18n.language === 'de';
    const definition = getMetricDefinition('als_subtype', i18n.language);
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
                        headerTitle: definition?.name ?? 'ALS-Subtyp',
                        headerRight: () => canEdit ? (
                            <HeaderButton
                                icon="plus"
                                variant="done"
                                onPress={() => router.push('/(tabs)/(metric)/alsSubtype/add')}
                            />
                        ) : null,
                    }} />
                ) : (
                    <>
                        <Stack.Screen.Title>{definition?.name ?? 'ALS-Subtyp'}</Stack.Screen.Title>
                        {canEdit && (
                            <Stack.Toolbar placement="right">
                                <Stack.Toolbar.Button icon="plus" variant="done" tintColor={colors.textPrimary} onPress={() => router.push('/(tabs)/(metric)/alsSubtype/add')} />
                            </Stack.Toolbar>
                        )}
                    </>
                )}
                <ActivityIndicator />
            </View>
        );
    }

    if (isFiltering && !canSeeMetric('als_subtype')) {
        router.back();
        return null;
    }

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: definition?.name ?? 'ALS-Subtyp',
                        headerRight: () => canEdit ? (
                            <HeaderButton
                                icon="plus"
                                variant="done"
                                onPress={() => router.push('/(tabs)/(metric)/alsSubtype/add')}
                            />
                        ) : null,
                    }}
                />
            ) : (
                <>
                    <Stack.Screen.Title>{definition?.name ?? 'ALS-Subtyp'}</Stack.Screen.Title>
                    {canEdit && (
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="plus" variant="done" tintColor={colors.textPrimary} onPress={() => router.push('/(tabs)/(metric)/alsSubtype/add')} />
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
                                <Text style={[styles.code, { color: colors.textPrimary }]}>
                                    {formatClassificationCode(selected.classificationCode)}
                                </Text>
                                <Text style={[styles.date, { color: colors.textHint }]}>
                                    {fmtDate(new Date(selected.assessedAt), isDE)}
                                </Text>
                                <View style={styles.axisRow}>
                                    <AxisBox label="O" value={selected.onsetCode} />
                                    <AxisBox label="P" value={selected.propagationTimingUnknown ? 'P1(x)' : `${selected.propagationStatus}(${selected.propagationMonths ?? 0})`} />
                                    <AxisBox label="M" value={selected.motorNeuronCode} />
                                </View>
                                <Text style={[styles.summary, { color: colors.textSecondary }]}>
                                    {summarizeALSSubtype(selected, i18n.language)}
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
                                    {isDE ? 'Noch kein ALS-Subtyp' : 'No ALS subtype yet'}
                                </Text>
                                <Text style={[styles.summary, { color: colors.textSecondary }]}>
                                    {isDE ? 'Es wurde noch keine ärztliche ALS-OPM-Klassifikation dokumentiert.' : 'No clinical ALS-OPM classification has been documented yet.'}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={[styles.bodyWrapper, { paddingLeft: insets.left, paddingRight: insets.right }, insets.left > 200 && { maxWidth: 940 + insets.left }]}>
                    <List.Section title={definition?.descriptionTitle} rounded>
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
                                        subtitle={isDE ? `${entries.length} Bewertungen` : `${entries.length} assessments`}
                                        onPress={() => router.push('/(tabs)/(metric)/alsSubtype/list')}
                                        lastItem={isFiltering}
                                    />
                                )}
                                {!isFiltering && (
                                    <List.Item
                                        title={t('metric.metricAccess')}
                                        onPress={() => router.push('/(tabs)/(metric)/als_subtype/access')}
                                        lastItem
                                    />
                                )}
                            </List.Section>
                        )
                    }

                    <List.Wrapper>
                        <List.Text align="center">
                            {isDE
                                ? 'Der ALS-Subtyp ist eine ärztliche Klassifikation und ersetzt keine klinische Beurteilung.'
                                : 'The ALS subtype is a clinical classification and does not replace medical assessment.'}
                        </List.Text>
                    </List.Wrapper>
                </View>
            </ScrollView>
        </>
    );
}

function AxisBox({ label, value }: { label: string; value: string }) {
    const { colors } = useTheme();
    return (
        <View style={[styles.axisBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.axisValue, { color: colors.textPrimary }]}>{value}</Text>
            <Text style={[styles.axisLabel, { color: colors.textHint }]}>{label}</Text>
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
    code: {
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    date: {
        fontSize: 13,
        fontWeight: '600',
    },
    axisRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    axisBox: {
        flex: 1,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        padding: 10,
        alignItems: 'center',
    },
    axisValue: {
        fontSize: 19,
        fontWeight: '800',
    },
    axisLabel: {
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
