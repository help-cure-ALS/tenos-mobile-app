import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { List } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';

import { useTDEE, ALSFRS6_MAX_SCORE, ALSFRS6_QUESTION_IDS, getMetricDefinition } from '@/src/metrics';
import { useMetricPreferences } from '@/src/hooks/usePatientPreferences';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { alsfrsr } from '@/src/questionnaires';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharingFilter } from "@/src/hooks/useSharingFilter";

// ALSFRS-6 question translation keys
const ALSFRS6_LABEL_KEYS: Record<string, string> = {
    swallowing: 'metric.alsfrs6Swallowing',
    handwriting: 'metric.alsfrs6Handwriting',
    dressing: 'metric.alsfrs6Dressing',
    turning_in_bed: 'metric.alsfrs6TurningInBed',
    walking: 'metric.alsfrs6Walking',
    dyspnea: 'metric.alsfrs6Dyspnea'
};

function getActivityLevelKey(factor: number): string {
    if (factor >= 1.4) {
        return 'metric.activityNormal';
    }
    if (factor >= 1.3) {
        return 'metric.activitySlightlyReduced';
    }
    if (factor >= 1.2) {
        return 'metric.activityModeratelyReduced';
    }
    if (factor >= 1.15) {
        return 'metric.activitySeverelyReduced';
    }
    return 'metric.activityVerySeverelyReduced';
}

function getGenderKey(gender?: string): string {
    switch (gender) {
        case 'male':
            return 'metric.genderMale';
        case 'female':
            return 'metric.genderFemale';
        case 'other':
            return 'metric.genderOther';
        default:
            return 'metric.genderUnknown';
    }
}

export default function TDEEDetailScreen() {
    const { t, i18n } = useTranslation();
    const { colors, tokens } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();
    const definition = getMetricDefinition('tdee', i18n.language);
    const { pinned, setPinned } = useMetricPreferences('tdee');
    const {
        calories,
        waterLiters,
        breakdown,
        patientData,
        alsfrs6,
        missingPatientData,
        missingFields,
        missingALSFRS,
        isLoading
    } = useTDEE();

    if (!sharingLoaded) {
        return <View style={ [styles.container, styles.centered, { backgroundColor: colors.background }] }><ActivityIndicator /></View>;
    }
    if (isFiltering && !canSeeMetric('tdee')) {
        router.back();
        return null;
    }

    if (!definition) {
        return (
            <View
                style={ [
                    styles.container,
                    styles.centered,
                    { backgroundColor: colors.background }
                ] }
            >
                <Text style={ { color: colors.textPrimary } }>
                    { t('metric.metricNotFound') }
                </Text>
            </View>
        );
    }

    // Show loading screen until data is ready
    if (isLoading) {
        return (
            <View style={ [styles.container, styles.loadingContainer, { backgroundColor: colors.background }] }>
                <Stack.Screen
                    options={ {
                        headerTitle: t('metric.energyRequirement')
                    } }
                />
                <ActivityIndicator color={ colors.textSecondary } style={ styles.loadingIndicator } />
                <Text style={ [styles.loadingText, { color: colors.textHint }] }>
                    { t('metric.calculating') }
                </Text>
            </View>
        );
    }

    return (
        <>
            <Stack.Screen
                options={ {
                    headerTitle: definition.name
                } }
            />
            <ScrollView
                style={ { backgroundColor: colors.background } }
                contentContainerStyle={ styles.scrollView }
                contentInsetAdjustmentBehavior="automatic"
            >
                {/* Hero Section */ }
                <View style={ [styles.heroSection, { backgroundColor: colors.listItemBackground }] }>
                    <View style={ [styles.heroWrapper,
                        {
                            // We add the insets to the padding so that the content
                            // doesn't disappear under the sidebar.
                            paddingLeft: insets.left,
                            paddingRight: insets.right
                        },
                        insets.left > 200 && { maxWidth: 940 + insets.left }
                    ] }>
                    <View style={ [styles.iconContainer, { backgroundColor: definition.iconColor + '20' }] }>
                        <AppIcon
                            name={ definition.icon }
                            tintColor={ definition.iconColor }
                            size={ 32 }
                        />
                    </View>

                    { calories !== undefined ? (
                        <>
                            <Text style={ [styles.heroValue, { color: colors.text }] }>
                                { t('metric.kcalPerDay', { value: calories.toLocaleString('de-DE') }) }
                            </Text>
                            { waterLiters !== undefined && (
                                <Text style={ [styles.heroSubvalue, { color: colors.textSecondary }] }>
                                    { t('metric.litersPerDay', { value: waterLiters.toLocaleString('de-DE') }) }
                                </Text>
                            ) }
                        </>
                    ) : (
                        <Text style={ [styles.heroValue, { color: colors.textHint }] }>
                            { t('metric.notAvailable') }
                        </Text>
                    ) }
                        </View>
                </View>

                <View style={ [styles.bodyWrapper,
                    {
                        // We add the insets to the padding so that the content
                        // doesn't disappear under the sidebar.
                        paddingLeft: insets.left,
                        paddingRight: insets.right
                    },
                    insets.left > 200 && { maxWidth: 940 + insets.left }
                ] }>
                    <List.Section title={ definition.descriptionTitle }
                                  titleStyle={ [styles.sectionTitle, { color: colors.textPrimary }] } rounded>
                        <List.Item
                            title={ definition.description }
                            titleNumberOfLines={ 99 }
                        />
                    </List.Section>

                    {/* Pin to Overview */ }
                    <List.Section rounded>
                        <List.Item
                            title={ t('metric.pinToOverview') }
                            hideChevron
                            lastItem
                            rightCmp={
                                <Switch
                                    value={ pinned }
                                    onValueChange={ setPinned }
                                />
                            }
                        />
                    </List.Section>

                    {/* Access Settings (patient/demo only) */}
                    {!isFiltering && (
                        <List.Section rounded>
                            <List.Item
                                title={ t('metric.metricAccess') }
                                onPress={ () => router.push('/(tabs)/(metric)/tdee/access') }
                                lastItem
                            />
                        </List.Section>
                    )}

                    {/* Missing Data Warning */ }
                    { missingPatientData && (
                        <List.Section rounded>
                            <List.Item
                                title={ t('metric.missingHealthData') }
                                subtitle={ t('metric.missingHealthDataHint', { fields: missingFields.join(', ') }) }
                                subtitleNumberOfLines={ 3 }
                                leftCmp={
                                    <AppIcon
                                        name="exclamationmark.triangle.fill"
                                        tintColor="#FF9500"
                                        size={ 24 }
                                    />
                                }
                                onPress={ () => router.push('/settings/profile') }
                                lastItem
                            />
                        </List.Section>
                    ) }

                    {/* Missing ALSFRS Warning */ }
                    { missingALSFRS && !missingPatientData && (
                        <List.Section rounded>
                            <List.Item
                                title={ t('metric.alsfrsNotFilled') }
                                subtitle={ t('metric.alsfrsNotFilledHint') }
                                subtitleNumberOfLines={ 4 }
                                leftCmp={
                                    <AppIcon
                                        name="info.circle.fill"
                                        tintColor={ colors.tint }
                                        size={ 24 }
                                    />
                                }
                                onPress={ () => router.push('/condition/questions/alsfrs-r') }
                                lastItem
                            />
                        </List.Section>
                    ) }

                    {/* Patient Data */ }
                    { !missingPatientData && (
                        <List.Section title={ t('metric.yourData') }
                                      titleStyle={ [styles.sectionTitle, { color: colors.textPrimary }] } rounded>
                            <List.Item
                                title={ t('metric.weight') }
                                subtitle={ patientData.weightSource === 'metric' ? t('metric.weightFromMetric') : t('metric.weightFromProfile') }
                                rightTitle={ patientData.weightKg ? `${ patientData.weightKg } kg` : '–' }
                                hideChevron
                            />
                            <List.Item
                                title={ t('metric.height') }
                                rightTitle={ patientData.heightCm ? `${ patientData.heightCm } cm` : '–' }
                                hideChevron
                            />
                            <List.Item
                                title={ t('metric.age') }
                                rightTitle={ patientData.ageYears ? t('metric.ageYears', { count: patientData.ageYears }) : '–' }
                                hideChevron
                            />
                            <List.Item
                                title={ t('metric.gender') }
                                rightTitle={ t(getGenderKey(patientData.gender)) }
                                hideChevron
                                lastItem
                            />
                        </List.Section>
                    ) }


                    {/* Calculation Breakdown */ }
                    { breakdown && (
                        <List.Section title={ t('metric.calculation') }
                                      titleStyle={ [styles.sectionTitle, { color: colors.textPrimary }] } rounded>
                            <List.Item
                                title={ t('metric.basalMetabolicRate') }
                                rightTitle={ `${ breakdown.bmr.toLocaleString('de-DE') } kcal` }
                                hideChevron
                            />
                            <List.Item
                                title={ t('metric.activityFactor') }
                                subtitle={ t(getActivityLevelKey(breakdown.activityFactor)) }
                                rightTitle={ `×${ breakdown.activityFactor.toFixed(2) }` }
                                hideChevron
                            />
                            <List.Item
                                title={ t('metric.alsAdjustment') }
                                subtitle={ t('metric.alsAdjustmentHint') }
                                rightTitle={ `×${ breakdown.alsAdjustment.toFixed(2) }` }
                                hideChevron
                            />
                            <View style={ [styles.divider, { backgroundColor: colors.border }] } />
                            <List.Item
                                title={ t('metric.estimatedRequirement') }
                                rightTitle={ `${ breakdown.tdee.toLocaleString('de-DE') } kcal` }
                                hideChevron
                                lastItem
                            />
                        </List.Section>
                    ) }

                    {/* ALSFRS-6 Breakdown */ }
                    { alsfrs6 && (
                        <List.Section title={ t('metric.alsfrs6FunctionalAreas') }
                                      titleStyle={ [styles.sectionTitle, { color: colors.textPrimary }] } rounded>
                            { ALSFRS6_QUESTION_IDS.map((questionId, index) => {
                                const score = alsfrs6.questionScores[questionId] ?? 0;
                                const isLast = index === ALSFRS6_QUESTION_IDS.length - 1;

                                return (
                                    <List.Item
                                        key={ questionId }
                                        title={ t(ALSFRS6_LABEL_KEYS[questionId]) }
                                        rightTitle={ `${ score }/4` }
                                        hideChevron
                                        lastItem={ isLast }
                                    />
                                );
                            }) }
                            <View style={ [styles.divider, { backgroundColor: colors.border }] } />
                            <List.Item
                                title={ t('metric.total') }
                                rightTitle={ `${ alsfrs6.score }/${ ALSFRS6_MAX_SCORE }` }
                                hideChevron
                                lastItem
                            />
                        </List.Section>
                    ) }

                    {/* Disclaimer */ }
                    <List.Wrapper>
                        <List.Text align="center">
                            { t('metric.disclaimer') }
                        </List.Text>
                    </List.Wrapper>
                </View>

            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        flex: 1,
        paddingTop: 20,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    container: {
        flex: 1
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100
    },
    loadingIndicator: {
        marginBottom: 16
    },
    heroSection: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 16
    },
    heroWrapper: {
        flex: 1,
        maxWidth: 940,
        alignItems: 'center',
        marginHorizontal: 'auto',
        width: '100%'
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600'
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    heroValue: {
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center'
    },
    heroSubvalue: {
        fontSize: 18,
        fontWeight: '500',
        marginTop: 4,
        textAlign: 'center'
    },
    loadingText: {
        fontSize: 16
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: 16,
    },
});
