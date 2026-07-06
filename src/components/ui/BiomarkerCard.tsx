import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { CardContainer, CardHeader, CardFooter } from './card';
import { useDisplayMode } from '@/src/context/DisplayModeProvider';

export type BiomarkerStatus = 'normal' | 'elevated' | 'low' | 'critical';

export type BiomarkerCardProps = {
    /** Biomarker name (e.g., "NFL im Serum") */
    title: string;
    /** Current value */
    value: number;
    /** Unit (e.g., "pg/ml") */
    unit: string;
    /** Reference range text (e.g., "< 20 pg/ml") */
    referenceRange?: string;
    /** Status of the value */
    status?: BiomarkerStatus;
    /** Custom status label (e.g., "Erhöht", "Normal") */
    statusLabel?: string;
    /** SF Symbol icon name */
    icon?: string;
    /** Date of the lab result */
    labDate?: string;
    /** Called when the card is pressed */
    onPress?: () => void;
};

function getStatusLabel(status: BiomarkerStatus | undefined, t: (key: string) => string): string {
    switch (status) {
        case 'normal':
            return t('biomarkerCard.normal');
        case 'elevated':
            return t('biomarkerCard.elevated');
        case 'low':
            return t('biomarkerCard.low');
        case 'critical':
            return t('biomarkerCard.critical');
        default:
            return '';
    }
}

export function BiomarkerCard({
    title,
    value,
    unit,
    referenceRange,
    status,
    statusLabel,
    icon = 'drop.fill',
    labDate,
    onPress,
}: BiomarkerCardProps) {
    const { colors, tokens } = useTheme();
    const { t, i18n } = useTranslation();
    const { preferences, getStatusColor } = useDisplayMode();

    const statusColor = getStatusColor(status ?? 'normal', colors.tint);
    const displayStatusLabel = statusLabel ?? getStatusLabel(status, t);
    const numberLocale = i18n.language === 'de' ? 'de-DE' : 'en-US';

    const showValue = preferences.showScores;
    const showStatusBadge = preferences.showStatusLabels && status;

    return (
        <CardContainer onPress={onPress}>
            {/* Header */}
            <CardHeader
                title={title}
                icon={icon}
                iconColor={statusColor}
                showChevron={!!onPress}
            />

            {/* Value */}
            {showValue ? (
                <View style={styles.valueContainer}>
                    <Text variant="headlineLarge" style={styles.value}>
                        {value.toLocaleString(numberLocale, { maximumFractionDigits: 2 })}
                    </Text>
                    <Text variant="titleMedium" color="secondary"> {unit}</Text>
                </View>
            ) : (
                <Text variant="titleMedium" color="secondary">{t('common.recorded')}</Text>
            )}

            {/* Reference & Status */}
            {(referenceRange || showStatusBadge) && (
                <View style={styles.referenceRow}>
                    {referenceRange && (
                        <Text variant="bodySmall" color="secondary">
                            {t('common.reference')}: {referenceRange}
                        </Text>
                    )}
                    {showStatusBadge && (
                        <View style={[styles.statusBadge, { gap: tokens.spacingXs }]}>
                            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                            <Text variant="bodySmall" style={{ color: statusColor }}>
                                {displayStatusLabel}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* Footer */}
            {labDate && (
                <CardFooter text={t('biomarkerCard.labDate', { date: labDate })} />
            )}
        </CardContainer>
    );
}

const styles = StyleSheet.create({
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    value: {
        fontWeight: '700',
    },
    referenceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});
