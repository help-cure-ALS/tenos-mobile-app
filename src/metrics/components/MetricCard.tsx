import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'react-native-nice-ui';

import {
    CardContainer,
    CardFooter,
    CardFooterText,
    CardHeader,
} from '../../components/ui/card';
import { useDisplayMode } from '../../context/DisplayModeProvider';
import { fmtDayMonthShort } from '@/src/lib/formatDate';
import type { MetricDefinition, MetricEntry } from '../types';
import { MetricValueDisplay } from './MetricValueDisplay';

type Props = {
    definition: MetricDefinition;
    latestEntry: MetricEntry | null;
    /** Trend direction */
    trend?: 'up' | 'down' | 'stable' | null;
    /** Change from previous value */
    changeFromPrevious?: number | null;
    /** Number of data points */
    entryCount?: number;
    /** Called when card is pressed */
    onPress?: () => void;
    /** Called when card is long-pressed */
    onLongPress?: () => void;
    style?: StyleProp<ViewStyle>;
};

export function MetricCard({
    definition,
    latestEntry,
    trend,
    changeFromPrevious,
    entryCount = 0,
    onPress,
    onLongPress,
    style
}: Props) {
    const { t, i18n } = useTranslation();
    const { colors } = useTheme();
    const { preferences } = useDisplayMode();

    // Format the last update date
    const formatDate = (date: Date): string => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return t('common.today');
        if (diffDays === 1) return t('common.yesterday');
        if (diffDays < 7) return t('common.daysAgo', { count: diffDays });

        return fmtDayMonthShort(date, i18n.language === 'de');
    };

    // Format change value
    const formatChange = (change: number): string => {
        const sign = change >= 0 ? '+' : '';
        const field = definition.fields[0];

        if (field.inputType === 'decimal' && field.decimalPlaces !== undefined) {
            const decimalSep = i18n.language === 'de' ? ',' : '.';
            return `${sign}${change.toFixed(field.decimalPlaces).replace('.', decimalSep)}`;
        }
        return `${sign}${Math.round(change)}`;
    };

    // Get trend color
    const getTrendColor = (): string => {
        if (!trend || trend === 'stable') return colors.textHint;
        // For most metrics, "up" is neutral warning, "down" might be concerning
        // This could be customized per metric in the future
        return '#FF9500';
    };

    return (
        <CardContainer onPress={onPress} onLongPress={onLongPress} style={style} padding={13}>
            <CardHeader
                icon={definition.icon as any}
                iconColor={definition.iconColor}
                title={definition.name}
                date={latestEntry ? formatDate(latestEntry.date) : undefined}
                showChevron={true}
            />

            <View style={styles.content}>
                <MetricValueDisplay
                    definition={definition}
                    entry={latestEntry}
                    showTrend={preferences.showTrends}
                    trend={trend}
                />
                {preferences.showScoreChanges &&
                    changeFromPrevious !== null &&
                    changeFromPrevious !== undefined && (
                        <View style={styles.changeContainer}>
                            <Text
                                style={[
                                    styles.changeText,
                                    { color: getTrendColor() },
                                ]}
                            >
                                {formatChange(changeFromPrevious)}
                                {definition.showUnit !== false && ` ${definition.defaultUnit}`}
                            </Text>
                            <Text
                                style={[
                                    styles.changeLabel,
                                    { color: colors.textHint },
                                ]}
                            >
                                {t('metric.sinceLastMeasurement')}
                            </Text>
                        </View>
                    )}
            </View>
            {
                preferences.showScoreChanges && (
            <CardFooter
                text={entryCount === 0
                    ? t('metric.noMeasurementsYet')
                    : t('metric.measurementsCount', { count: entryCount })}
            />
                )}
        </CardContainer>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        // paddingHorizontal: 16,
        // paddingVertical: 12,
        justifyContent: 'flex-end'
    },
    dateText: {
        fontSize: 14,
    },
    changeContainer: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },
    changeText: {
        fontSize: 14,
        fontWeight: '500',
    },
    changeLabel: {
        fontSize: 13,
    },
});
