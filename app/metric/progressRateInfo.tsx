import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useTranslation } from 'react-i18next';
import { Button, Text, useTheme } from 'react-native-nice-ui';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';

type CategoryInfo = {
    labelKey: string;
    rangeKey: string;
    descriptionKey: string;
    color: string;
};

const CATEGORIES: CategoryInfo[] = [
    {
        labelKey: 'progressRate.slowProgression',
        rangeKey: 'progressRate.slowProgressionRange',
        descriptionKey: 'progressRate.slowProgressionDesc',
        color: '#34C759',
    },
    {
        labelKey: 'progressRate.intermediateProgression',
        rangeKey: 'progressRate.intermediateProgressionRange',
        descriptionKey: 'progressRate.intermediateProgressionDesc',
        color: '#FF9500',
    },
    {
        labelKey: 'progressRate.fastProgression',
        rangeKey: 'progressRate.fastProgressionRange',
        descriptionKey: 'progressRate.fastProgressionDesc',
        color: '#FF3B30',
    },
];

export default function ProgressRateInfoScreen() {
    const { colors, tokens } = useTheme();
    const router = useSafeRouter();
    const { t } = useTranslation();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { padding: tokens.spacingXl }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={[styles.header, { marginBottom: tokens.spacingXl }]}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.tint + '20' }]}>
                        <AppIcon
                            name="chart.line.uptrend.xyaxis"
                            tintColor={colors.tint}
                            size={32}
                        />
                    </View>
                    <Text variant="headlineLarge" style={styles.title}>
                        {t('progressRate.title')}
                    </Text>
                    <Text variant="bodyLarge" color="secondary" style={styles.subtitle}>
                        {t('progressRate.subtitle')}
                    </Text>
                </View>

                {/* Formula Section */}
                <View style={[styles.section, { marginBottom: tokens.spacingXl }]}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { marginBottom: tokens.spacingMd }]}>
                        {t('progressRate.calculation')}
                    </Text>
                    <View style={[styles.formulaCard, { backgroundColor: colors.listItemBackground, borderRadius: tokens.listSectionRadius, padding: tokens.spacingLg }]}>
                        <Text variant="bodyLarge" style={styles.formulaText}>
                            {t('progressRate.formula')}
                        </Text>
                    </View>
                    <Text variant="bodyMedium" color="secondary" style={{ marginTop: tokens.spacingMd, lineHeight: 22 }}>
                        {t('progressRate.formulaExplanation')}
                    </Text>
                </View>

                {/* Categories Section */}
                <View style={[styles.section, { marginBottom: tokens.spacingXl }]}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { marginBottom: tokens.spacingMd }]}>
                        {t('progressRate.categories')}
                    </Text>
                    <View style={[styles.categoriesContainer, { gap: tokens.spacingMd }]}>
                        {CATEGORIES.map((category, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.categoryCard,
                                    {
                                        backgroundColor: colors.listItemBackground,
                                        borderRadius: tokens.listSectionRadius,
                                        padding: tokens.spacingLg,
                                        borderLeftWidth: 4,
                                        borderLeftColor: category.color,
                                    }
                                ]}
                            >
                                <View style={[styles.categoryHeader, { marginBottom: tokens.spacingSm }]}>
                                    <Text variant="titleMedium" style={{ color: category.color }}>
                                        {t(category.labelKey)}
                                    </Text>
                                    <Text variant="bodyMedium" color="secondary">
                                        {t(category.rangeKey)}
                                    </Text>
                                </View>
                                <Text variant="bodyMedium" color="secondary" style={{ lineHeight: 20 }}>
                                    {t(category.descriptionKey)}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Reference Section */}
                <View style={[styles.section, { marginBottom: tokens.spacingXl }]}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { marginBottom: tokens.spacingMd }]}>
                        {t('progressRate.scientificBasis')}
                    </Text>
                    <View style={[styles.referenceCard, { backgroundColor: colors.listItemBackground, borderRadius: tokens.listSectionRadius, padding: tokens.spacingLg }]}>
                        <Text variant="bodyMedium" color="secondary" style={{ lineHeight: 22, fontStyle: 'italic' }}>
                            {t('progressRate.reference')}
                        </Text>
                    </View>
                </View>

                {/* Note */}
                <View style={[styles.noteContainer, { backgroundColor: colors.tint + '10', borderRadius: tokens.listSectionRadius, padding: tokens.spacingLg, marginBottom: tokens.spacingXl }]}>
                    <View style={[styles.noteHeader, { gap: tokens.spacingSm, marginBottom: tokens.spacingSm }]}>
                        <AppIcon
                            name="info.circle.fill"
                            tintColor={colors.tint}
                            size={18}
                        />
                        <Text variant="titleSmall" style={{ color: colors.tint }}>
                            {t('progressRate.note')}
                        </Text>
                    </View>
                    <Text variant="bodyMedium" color="secondary" style={{ lineHeight: 22 }}>
                        {t('progressRate.disclaimer')}
                    </Text>
                </View>

                {/* Close Button */}
                <Button
                    title={t('common.close')}
                    onPress={() => router.back()}
                    variant="tinted"
                    rounded
                />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    scrollContent: {},
    header: {
        alignItems: 'center',
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontWeight: '700',
        marginBottom: 4,
    },
    subtitle: {
        textAlign: 'center',
    },
    section: {},
    sectionTitle: {
        fontWeight: '600',
    },
    formulaCard: {},
    formulaText: {
        fontWeight: '500',
        textAlign: 'center',
    },
    categoriesContainer: {},
    categoryCard: {},
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    referenceCard: {},
    noteContainer: {},
    noteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
