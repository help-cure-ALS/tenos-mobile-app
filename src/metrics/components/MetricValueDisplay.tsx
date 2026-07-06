import { AppIcon } from '@/src/components/ui/AppIcon';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'react-native-nice-ui';

import { useDisplayMode } from '../../context/DisplayModeProvider';
import type { MetricDefinition, MetricEntry } from '../types';
import { getValueLabel } from '../types';

type Props = {
    definition: MetricDefinition;
    entry: MetricEntry | null;
    /** Show trend indicator */
    showTrend?: boolean;
    /** Trend direction */
    trend?: 'up' | 'down' | 'stable' | null;
    /** Compact display mode */
    compact?: boolean;
};

export function MetricValueDisplay({
    definition,
    entry,
    showTrend = false,
    trend,
    compact = false,
}: Props) {
    const { t, i18n } = useTranslation();
    const { colors } = useTheme();
    const { preferences } = useDisplayMode();

    if (!entry) {
        return (
            <View style={styles.container}>
                <Text style={[styles.noData, { color: colors.textHint }]}>
                    {t('common.noData')}
                </Text>
            </View>
        );
    }

    // Format value based on field definition
    const formatValue = (value: number, fieldKey: string): string => {
        const field = definition.fields.find((f) => f.key === fieldKey);
        if (!field) return String(value);

        // If field has value labels, use the label instead of the number
        const label = getValueLabel(field, value);
        if (label) return label;

        if (field.inputType === 'decimal' && field.decimalPlaces !== undefined) {
            const decimalSep = i18n.language === 'de' ? ',' : '.';
            return value.toFixed(field.decimalPlaces).replace('.', decimalSep);
        }
        return String(Math.round(value));
    };

    // Get trend icon and color
    const getTrendDisplay = () => {
        if (!showTrend || !trend || !preferences.showTrends) return null;

        const trendConfig = {
            up: { icon: 'arrow.up', color: '#FF9500' },
            down: { icon: 'arrow.down', color: '#FF9500' },
            stable: { icon: 'arrow.right', color: '#34C759' },
        };

        const config = trendConfig[trend];
        return (
            <AppIcon
                name={config.icon}
                size={compact ? 12 : 16}
                tintColor={config.color}
                style={styles.trendIcon}
            />
        );
    };

    // Whether to show unit (default: true)
    const shouldShowUnit = definition.showUnit !== false;
    const useSlashMultiValue = definition.id === 'blood_pressure';

    // Single value metric
    if (definition.fields.length === 1) {
        const field = definition.fields[0];
        const value = entry.values[field.key];

        return (
            <View style={styles.container}>
                <View style={styles.valueRow}>
                    <Text
                        numberOfLines={1}
                        style={[
                            compact ? styles.valueCompact : styles.value,
                            { color: colors.textPrimary },
                        ]}
                    >
                        {formatValue(value, field.key)}
                    </Text>
                    {shouldShowUnit && (
                        <Text
                            style={[
                                compact ? styles.unitCompact : styles.unit,
                                { color: colors.textHint },
                            ]}
                        >
                            {entry.unit}
                        </Text>
                    )}
                    {getTrendDisplay()}
                </View>
            </View>
        );
    }

    // Multi-value metric (e.g., blood pressure)
    return (
        <View style={styles.container}>
            <View style={styles.multiValueContainer}>
                {definition.fields.map((field, index) => {
                    const value = entry.values[field.key];
                    const isLast = index === definition.fields.length - 1;

                    return (
                        <View key={field.key} style={styles.multiValueRow}>
                            {!compact && !useSlashMultiValue && (
                                <Text
                                    style={[
                                        styles.fieldLabel,
                                        { color: colors.textHint },
                                    ]}
                                >
                                    {field.label}
                                </Text>
                            )}
                            <View style={styles.valueRow}>
                                <Text
                                    style={[
                                        compact
                                            ? styles.valueCompact
                                            : styles.value,
                                        { color: colors.textPrimary },
                                    ]}
                                >
                                    {formatValue(value, field.key)}
                                </Text>
                                {(compact || useSlashMultiValue) && !isLast && (
                                    <Text
                                        style={[
                                            compact ? styles.separatorCompact : styles.separator,
                                            { color: colors.textHint },
                                        ]}
                                    >
                                        /
                                    </Text>
                                )}
                                {!compact && !useSlashMultiValue && shouldShowUnit && (
                                    <Text
                                        style={[
                                            styles.unit,
                                            { color: colors.textHint },
                                        ]}
                                    >
                                        {field.unit ?? entry.unit}
                                    </Text>
                                )}
                            </View>
                        </View>
                    );
                })}
                {(compact || useSlashMultiValue) && shouldShowUnit && (
                    <Text
                        style={[
                            compact ? styles.unitCompact : styles.unit,
                            { color: colors.textHint },
                        ]}
                    >
                        {entry.unit}
                    </Text>
                )}
                {getTrendDisplay()}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    value: {
        fontSize: 27,
        fontWeight: '700',
        letterSpacing: -0.8,
        // fontVariant: ['tabular-nums'],
    },
    valueCompact: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.4,
        // fontVariant: ['tabular-nums'],
    },
    unit: {
        fontSize: 16,
        fontWeight: 600,
        marginLeft: 4,
    },
    unitCompact: {
        fontSize: 14,
        marginLeft: 4,
    },
    noData: {
        fontSize: 13
    },
    multiValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    multiValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    fieldLabel: {
        fontSize: 12,
        marginRight: 4,
    },
    separator: {
        fontSize: 27,
        fontWeight: '600',
        marginHorizontal: 4,
    },
    separatorCompact: {
        fontSize: 20,
        fontWeight: '600',
        marginHorizontal: 2,
    },
    trendIcon: {
        marginLeft: 8,
    },
});
