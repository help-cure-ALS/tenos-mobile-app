import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useAppTheme } from '@/src/theme';
import { useTranslation } from 'react-i18next';
import { CardContainer, CardHeader, CardFooter, CardFooterText } from './card';
import { useDisplayMode } from '@/src/context/DisplayModeProvider';
import { green, red } from '@/src/theme/colors';

export type ALSFRSDomain = {
    /** Domain name */
    name: string;
    /** Current score (0-12) */
    score: number;
    /** Maximum score (default: 12) */
    maxScore?: number;
    /** Trend: 'up' = improving, 'down' = declining, 'stable' = no change */
    trend?: 'up' | 'down' | 'stable';
};

export type ProgressRateCategory = 'slow' | 'intermediate' | 'fast';

export type ALSFRSCardProps = {
    title: string;
    icon?: string;
    iconColor?: string;

    footer?: string;

    /** Total ALSFRS-R score */
    totalScore: number;
    /** Maximum total score (default: 48) */
    maxTotalScore?: number;
    /** Score change (e.g., -2 means declined by 2 points) */
    scoreChange?: number;
    /** Period for the change (e.g., "30 Tagen") */
    changePeriod?: string;
    /** The four ALSFRS-R domains */
    domains: ALSFRSDomain[];
    /** Last assessment date */
    lastAssessment?: string;

    /** Progression rate (Verlaufswert) - calculated as (48 - score) / months since symptom onset */
    progressRate?: number;
    /** Months since first symptoms (symptom onset) */
    monthsSinceOnset?: number;

    /** Called when the card is pressed */
    onPress?: () => void;
    /** Called when the card is long-pressed */
    onLongPress?: () => void;
    /** Called when the info icon on progress rate is pressed */
    onProgressInfoPress?: () => void;
};

function getProgressRateInfo(rate: number): { category: ProgressRateCategory; labelKey: string; color: string } {
    if (rate < 0.5) {
        return { category: 'slow', labelKey: 'progressRate.slowProgression', color: green };
    }
    if (rate <= 1.0) {
        return { category: 'intermediate', labelKey: 'progressRate.intermediateProgression', color: '#FF9500' };
    }
    return { category: 'fast', labelKey: 'progressRate.fastProgression', color: red };
}

function getProgressRatePosition(rate: number): number {
    // Map rate to position (0-100%)
    // Scale: 0 -> 0%, 0.5 -> 25%, 1.0 -> 50%, 2.0 -> 100%
    if (rate <= 0) {
        return 0;
    }
    if (rate >= 2) {
        return 100;
    }
    if (rate <= 1) {
        // 0-1 maps to 0-50%
        return rate * 50;
    }
    // 1-2 maps to 50-100%
    return 50 + (rate - 1) * 50;
}

export function ALSFRSCard({
                               title,
                               icon,
                               iconColor,
                               footer,
                               totalScore,
                               maxTotalScore = 48,
                               scoreChange,
                               changePeriod,
                               domains,
                               lastAssessment,
                               progressRate,
                               monthsSinceOnset,
                               onPress,
                               onLongPress,
                               onProgressInfoPress
                           }: ALSFRSCardProps) {
    const { t } = useTranslation();
    const { colors, tokens } = useAppTheme();
    const { mode, preferences, getScoreColor, getTrendDisplay } = useDisplayMode();

    const totalColor = getScoreColor(totalScore, maxTotalScore, colors.tint);

    const progressInfo = progressRate !== undefined ? getProgressRateInfo(progressRate) : null;
    const progressPosition = progressRate !== undefined ? getProgressRatePosition(progressRate) : 0;

    // Determine what to show based on preferences
    const showScore = preferences.showScores;
    const showDomains = preferences.showDomainScores;
    const showChange = preferences.showScoreChanges && scoreChange !== undefined;
    const showProgress = preferences.showProgressRate && progressRate !== undefined && progressInfo;
    const showProgressBars = preferences.showProgressBars;



    return (
        <CardContainer onPress={ onPress } onLongPress={ onLongPress } padding={ 0 } gap={ 0 }>
            {/* Header */ }
            <View style={ styles.headerWrapper }>
                <CardHeader
                    title={ title }
                    icon={ icon }
                    iconColor={ iconColor }
                    date={ lastAssessment }
                    showChevron={ !!onPress }
                />
            </View>
            <View style={ styles.bodyWrapper }>
                { showScore ? (
                    totalScore !== 0 &&
                    <View style={ styles.hero }>
                        <View style={ styles.scoreRow }>
                            <Text style={ [styles.totalScore, { color: totalColor }] }>
                                { totalScore }
                            </Text>
                            <Text
                                style={ [styles.maxScore, { color: colors.textSecondary }] }> / { maxTotalScore }</Text>
                            { showChange && (
                                <View style={ [styles.changeContainer, { marginLeft: tokens.spacingMd }] }>
                                    <AppIcon
                                        name={ scoreChange > 0 ? 'arrow.up' : scoreChange < 0 ? 'arrow.down' : 'minus' }
                                        tintColor={
                                            preferences.useSignalColors
                                                ? (scoreChange > 0 ? green : scoreChange < 0 ? red : '#8E8E93')
                                                : '#8E8E93'
                                        }
                                        size={ 12 }
                                    />
                                    <Text
                                        style={ [
                                            styles.changeText,
                                            {
                                                color: preferences.useSignalColors
                                                    ? (scoreChange > 0 ? green : scoreChange < 0 ? red : '#8E8E93')
                                                    : '#8E8E93'
                                            }
                                        ] }
                                    >
                                        { Math.abs(scoreChange) } { changePeriod && `in ${ changePeriod }` }
                                    </Text>
                                </View>
                            ) }
                        </View>
                    </View>
                ) : (
                    <View style={ styles.hero }>
                        <View style={ styles.completedRow }>
                            <AppIcon
                                name="checkmark.circle.fill"
                                tintColor={ colors.tint }
                                size={ 24 }
                            />
                            <Text style={ [styles.completedText, { color: colors.text }] }>
                                { t('alsfrsCard.recorded') }
                            </Text>
                        </View>
                    </View>
                ) }


                {/* Domains - only show if enabled */ }
                { showDomains && totalScore !== 0 && (
                    <>
                        {/* Divider */ }
                        <View style={ [styles.divider, {
                            backgroundColor: colors.border,
                            marginHorizontal: tokens.spacingLg
                        }] } />

                        <View style={ [styles.domainsContainer, { padding: tokens.spacingLg, gap: tokens.spacingMd }] }>
                            { domains.map((domain, index) => {
                                const maxScore = domain.maxScore ?? 12;
                                const percentage = domain.score / maxScore;
                                const barColor = getScoreColor(domain.score, maxScore, colors.tint);
                                const trendInfo = getTrendDisplay(domain.trend ?? 'stable');

                                return (
                                    <View key={ index } style={ styles.domainRow }>
                                        <View style={ [styles.domainInfo, { gap: tokens.spacingSm }] }>
                                            <Text style={ [styles.domainName, { color: colors.text }] }>
                                                { domain.name }
                                            </Text>
                                            <Text style={ [styles.domainScore, { color: colors.textSecondary }] }>
                                                { domain.score }/{ maxScore }
                                            </Text>
                                        </View>
                                        <View style={ [styles.domainRight, { gap: tokens.spacingSm }] }>
                                            { showProgressBars && (
                                                <View style={ [styles.progressBarBackground, {
                                                    backgroundColor: colors.border,
                                                    borderRadius: tokens.radiusSm
                                                }] }>
                                                    <View
                                                        style={ [
                                                            styles.progressBarFill,
                                                            {
                                                                backgroundColor: barColor,
                                                                width: `${ percentage * 100 }%`,
                                                                borderRadius: tokens.radiusSm
                                                            }
                                                        ] }
                                                    />
                                                </View>
                                            ) }
                                            { trendInfo && (
                                                <View style={ styles.trendContainer }>
                                                    <AppIcon
                                                        name={ trendInfo.icon }
                                                        tintColor={ trendInfo.color }
                                                        size={ 10 }
                                                    />
                                                </View>
                                            ) }
                                        </View>
                                    </View>
                                );
                            }) }
                        </View>
                    </>
                ) }

                {/* Progress Rate - only show if enabled */ }
                { showProgress && (
                    <View style={ [styles.progressSection, { backgroundColor: colors.background }] }>
                        {/* Header Row */ }
                        <View style={ styles.progressHeader }>
                            <Text
                                style={ [styles.progressTitle, { color: colors.text }] }>{ t('progressRate.title') }</Text>
                            { onProgressInfoPress && (
                                <Pressable onPress={ onProgressInfoPress } hitSlop={ 12 }>
                                    <AppIcon
                                        name="questionmark.circle.fill"
                                        tintColor={ colors.textHint }
                                        size={ 20 }
                                    />
                                </Pressable>
                            ) }
                        </View>

                        {/* Value and Label */ }
                        <View style={ styles.progressValueRow }>
                            <Text style={ [
                                styles.progressValue,
                                { color: preferences.useSignalColors ? progressInfo.color : colors.text }
                            ] }>
                                { progressRate.toFixed(2) }
                            </Text>
                            { preferences.showStatusLabels && (
                                <Text style={ [
                                    styles.progressLabel,
                                    { color: preferences.useSignalColors ? progressInfo.color : colors.textSecondary }
                                ] }>
                                    { t(progressInfo.labelKey) }
                                </Text>
                            ) }
                        </View>

                        {/* Scale */ }
                        <View style={ styles.scaleContainer }>
                            {/* Track */ }
                            <View style={ styles.scaleTrack }>
                                <View style={ [
                                    styles.scaleSegment,
                                    styles.scaleSegmentSlow,
                                    { backgroundColor: preferences.useSignalColors ? green : colors.border }
                                ] } />
                                <View style={ [
                                    styles.scaleSegment,
                                    styles.scaleSegmentIntermediate,
                                    { backgroundColor: preferences.useSignalColors ? '#FF9500' : colors.border }
                                ] } />
                                <View style={ [
                                    styles.scaleSegment,
                                    styles.scaleSegmentFast,
                                    { backgroundColor: preferences.useSignalColors ? red : colors.border }
                                ] } />
                            </View>

                            {/* Marker */ }
                            <View style={ [
                                styles.scaleMarker,
                                {
                                    left: `${ progressPosition }%`,
                                    backgroundColor: preferences.useSignalColors ? progressInfo.color : colors.tint
                                }
                            ] }>
                                <View
                                    style={ [styles.scaleMarkerInner, { backgroundColor: colors.listItemBackground }] } />
                            </View>
                        </View>

                        {/* Scale Labels */ }
                        <View style={ styles.scaleLabels }>
                            <Text style={ [styles.scaleLabelText, { color: colors.textHint }] }>0</Text>
                            <Text style={ [styles.scaleLabelText, { color: colors.textHint }] }>0.5</Text>
                            <Text style={ [styles.scaleLabelText, { color: colors.textHint }] }>1.0</Text>
                            <Text style={ [styles.scaleLabelText, { color: colors.textHint }] }>2.0</Text>
                        </View>
                    </View>
                ) }
            </View>

            {/* Footer */ }
            { (footer || (monthsSinceOnset !== undefined && mode === 'clinical')) && (
                <CardFooter>
                    <View style={ styles.footerWrapper }>
                        { monthsSinceOnset !== undefined && mode === 'clinical' && (
                            <CardFooterText>
                                { t('alsfrsCard.sinceFirstSymptoms', { count: monthsSinceOnset }) }
                            </CardFooterText>
                        ) }
                        { footer && (
                            <CardFooterText>{ footer }</CardFooterText>
                        ) }
                    </View>
                </CardFooter>
            ) }
        </CardContainer>
    );
}

const styles = StyleSheet.create({
    headerWrapper: {
        paddingHorizontal: 14,
        paddingTop: 12
    },
    bodyWrapper: {
        flex: 1
    },
    hero: {
        paddingHorizontal: 14,
        paddingVertical: 12
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'baseline'
    },
    totalScore: {
        fontSize: 32,
        fontWeight: '700'
    },
    maxScore: {
        fontSize: 16,
        fontWeight: '600'
    },
    changeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    changeText: {
        fontSize: 12
    },
    completedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    completedText: {
        fontSize: 18,
        fontWeight: '600'
    },
    divider: {
        height: StyleSheet.hairlineWidth
    },
    domainsContainer: {},
    domainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    domainInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    domainName: {
        fontSize: 13.5,
        fontWeight: '500',
        minWidth: 120
    },
    domainScore: {
        fontSize: 12,
        textAlign: 'right',
        marginRight: 20,
        flex: 1
    },
    domainRight: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: '40%'
    },
    progressBarBackground: {
        flex: 1,
        height: 6,
        overflow: 'hidden'
    },
    progressBarFill: {
        height: '100%'
    },
    trendContainer: {
        width: 16,
        alignItems: 'center'
    },

    // Progress Rate Section
    progressSection: {
        marginHorizontal: 14,
        marginBottom: 14,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 8,
        gap: 8
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    progressTitle: {
        fontSize: 13,
        fontWeight: '600'
    },
    progressValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8
    },
    progressValue: {
        fontSize: 24,
        fontWeight: '700'
    },
    progressLabel: {
        fontSize: 12,
        fontWeight: '500'
    },
    scaleContainer: {
        height: 10,
        position: 'relative',
        justifyContent: 'center'
    },
    scaleTrack: {
        flexDirection: 'row',
        height: 3,
        borderRadius: 3,
        overflow: 'hidden'
    },
    scaleSegment: {
        height: '100%'
    },
    scaleSegmentSlow: {
        flex: 25 // 0 - 0.5 (25%)
    },
    scaleSegmentIntermediate: {
        flex: 25 // 0.5 - 1.0 (25%)
    },
    scaleSegmentFast: {
        flex: 50 // 1.0 - 2.0 (50%)
    },
    scaleMarker: {
        position: 'absolute',
        width: 16,
        height: 16,
        borderRadius: 8,
        marginLeft: -8,
        alignItems: 'center',
        justifyContent: 'center'
    },
    scaleMarkerInner: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    scaleLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    scaleLabelText: {
        fontSize: 10
    },

    footerWrapper: {
        paddingHorizontal: 14,
        paddingBottom: 12,
        gap: 2
    }
});
