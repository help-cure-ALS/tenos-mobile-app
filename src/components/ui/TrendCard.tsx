import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { Text } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { CardContainer, CardHeader } from './card';
import { useDisplayMode } from '@/src/context/DisplayModeProvider';

export type TrendDirection = 'up' | 'down' | 'stable';

export type TrendCardProps = {
    /** Card title (e.g., "Gewicht") */
    title: string;
    /** Current value */
    value: string;
    /** Unit (e.g., "kg") - displayed after value */
    unit?: string;
    /** Secondary value info (e.g., "/ 48 Punkte") */
    secondaryValue?: string;
    /** Trend direction */
    trend?: TrendDirection;
    /** Trend value (e.g., "-2" or "+0.5") */
    trendValue?: string;
    /** Period for the trend (e.g., "seit letzter Messung") */
    trendPeriod?: string;
    /** SF Symbol icon name */
    icon?: string;
    /** Icon tint color */
    iconColor?: string;
    /** Data points for sparkline (values between 0 and 1) */
    sparklineData?: number[];
    /** Last measurement date */
    lastMeasurement?: string;
    /** Called when the card is pressed */
    onPress?: () => void;
};

export function TrendCard({
    title,
    value,
    unit,
    secondaryValue,
    trend,
    trendValue,
    trendPeriod,
    icon,
    iconColor,
    sparklineData,
    lastMeasurement,
    onPress,
}: TrendCardProps) {
    const { colors, tokens } = useAppTheme();
    const { t } = useTranslation();
    const { preferences, getTrendDisplay } = useDisplayMode();

    const tintColor = iconColor ?? colors.tint;
    const trendInfo = getTrendDisplay(trend ?? 'stable');

    const showValue = preferences.showScores;
    const showTrend = preferences.showTrends && (trend || trendValue);
    const showSparkline = preferences.showProgressBars && sparklineData && sparklineData.length > 1;

    return (
        <CardContainer onPress={onPress}>
            {/* Header */}
            <CardHeader
                title={title}
                icon={icon}
                iconColor={tintColor}
                showChevron={!!onPress}
            />

            {/* Value Row */}
            {showValue ? (
                <View style={styles.valueRow}>
                    <View style={styles.valueContainer}>
                        <Text variant="headlineLarge" style={styles.value}>
                            {value}
                        </Text>
                        {unit && (
                            <Text variant="titleMedium" color="secondary"> {unit}</Text>
                        )}
                        {secondaryValue && (
                            <Text variant="titleMedium" color="secondary"> {secondaryValue}</Text>
                        )}
                    </View>
                </View>
            ) : (
                <Text variant="titleMedium" color="secondary">{t('common.recorded')}</Text>
            )}

            {/* Trend */}
            {showTrend && trendInfo && (
                <View style={[styles.trendRow, { gap: tokens.spacingXs }]}>
                    <AppIcon
                        name={trendInfo.icon}
                        tintColor={trendInfo.color}
                        size={14}
                    />
                    <Text variant="bodyMedium" style={{ color: trendInfo.color }}>
                        {trendValue} {trendPeriod}
                    </Text>
                </View>
            )}

            {/* Sparkline */}
            {showSparkline && (
                <View style={[styles.sparklineContainer, { backgroundColor: colors.border + '40', borderRadius: tokens.radiusMd }]}>
                    <View style={[styles.sparklinePlaceholder, { padding: tokens.spacingXs }]}>
                        {sparklineData.map((point, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.sparklineBar,
                                    {
                                        height: `${point * 100}%`,
                                        backgroundColor: tintColor,
                                        borderRadius: tokens.radiusSm,
                                    },
                                ]}
                            />
                        ))}
                    </View>
                </View>
            )}

            {/* Footer */}
            {lastMeasurement && (
                <Text variant="bodySmall" color="hint">
                    {t('common.lastRecorded')}: {lastMeasurement}
                </Text>
            )}
        </CardContainer>
    );
}

const styles = StyleSheet.create({
    valueRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    value: {
        fontWeight: '700',
    },
    trendRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sparklineContainer: {
        height: 40,
        overflow: 'hidden',
    },
    sparklinePlaceholder: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
    },
    sparklineBar: {
        width: 4,
        minHeight: 2,
    },
});
