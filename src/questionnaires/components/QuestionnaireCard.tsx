/**
 * QuestionnaireCard Component
 *
 * Displays a questionnaire as a card with status badge, icon, and title.
 * Used in the questionnaire carousel on the main metrics screen.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { fmtDate, fmtDateShort } from '@/src/lib/formatDate';
import type { QuestionnaireDefinition, QuestionnaireAvailability } from '../types';

// =============================================================================
// Types
// =============================================================================

export type QuestionnaireCardProps = {
    /** The questionnaire definition */
    definition: QuestionnaireDefinition;
    /** Availability status */
    availability: QuestionnaireAvailability;
    /** Whether this questionnaire has been completed at least once */
    hasCompletions: boolean;
    /** Date of last completion (shown instead of duration) */
    lastCompletedAt?: Date;
    /** Days until end of availability window */
    daysUntilEnd?: number;
    /** Called when card is pressed */
    onPress: () => void;
    /** Display variant: 'carousel' or 'grid' (flex) */
    variant?: 'carousel' | 'grid';
};

// =============================================================================
// Status Badge Component
// =============================================================================

type StatusBadgeProps = {
    availability: QuestionnaireAvailability;
    hasCompletions: boolean;
};

function StatusBadge({ availability, hasCompletions }: StatusBadgeProps) {
    const { t, i18n } = useTranslation();
    const { colors, isDark } = useAppTheme();

    let label: string;
    let backgroundColor: string;
    let textColor: string;
    let showCheckmark = false;
    let checkmarkColor = isDark ? '#FFFFFF' : '#000000';

    if (availability.available) {
        const dueInDays = availability.dueInDays ?? 0;

        if (dueInDays < 0) {
            // Overdue
            const overdueDays = Math.abs(dueInDays);
            label = overdueDays === 1 ? t('questionnaire.overdue') : t('questionnaire.daysOverdue', { count: overdueDays });
            backgroundColor = '#efa80f'; // Orange
            textColor = '#FFFFFF';
        } else if (dueInDays === 0) {
            // Due today
            label = t('questionnaire.dueToday');
            backgroundColor = 'rgba(74,188,110,0.75)';
            textColor = '#FFFFFF';
        } else {
            // Due in future (but still available for non-enforced)
            label = t('questionnaire.dueInDays', { count: dueInDays });
            backgroundColor = 'rgba(74,188,110,0.2)';
            textColor = colors.textSecondary;
            showCheckmark = hasCompletions;
        }
    } else if (availability.reason === 'locked_until_due') {
        const days = availability.daysUntilAvailable ?? 0;
        label = t('questionnaire.inDaysShort', { count: days });
        backgroundColor = 'rgba(0,0,0,0.29)';
        textColor = colors.textSecondary;
        showCheckmark = hasCompletions;
    } else if (availability.reason === 'not_started') {
        const date = availability.nextAvailableDate;
        if (date) {
            const formattedDate = fmtDateShort(date, i18n.language === 'de');
            label = t('questionnaire.fromDate', { date: formattedDate });
        } else {
            label = t('questionnaire.availableSoon');
        }
        backgroundColor = colors.surface;
        textColor = colors.textSecondary;
    } else if (availability.reason === 'ended') {
        label = t('questionnaire.endedShort');
        backgroundColor = colors.surface;
        textColor = colors.textHint;
    } else {
        label = t('questionnaire.open');
        backgroundColor = colors.tint;
        textColor = '#FFFFFF';
    }

    return (
        <View style={ [styles.badge, { backgroundColor }] }>
            { showCheckmark && (
                <AppIcon
                    name="checkmark"
                    size={ 10 }
                    tintColor={checkmarkColor}
                    style={ styles.badgeCheckmark }
                />
            ) }
            <Text style={ [styles.badgeText, { color: textColor }] }>
                { label }
            </Text>
        </View>
    );
}

// =============================================================================
// QuestionnaireCard Component
// =============================================================================

export function QuestionnaireCard({
                                      definition,
                                      availability,
                                      hasCompletions,
                                      lastCompletedAt,
                                      daysUntilEnd,
                                      onPress,
                                      variant = 'carousel'
                                  }: QuestionnaireCardProps) {
    const { t, i18n } = useTranslation();
    const { colors, isDark } = useAppTheme();

    const isAvailable = availability.available;
    const cardBackgroundColor = isAvailable
        ? colors.questionnaireCardAvailable
        : colors.questionnaireCardUnavailable;

    const isGrid = variant === 'grid';

    return (
        <TouchableOpacity
            style={ [
                styles.card,
                isGrid && styles.cardGrid,
                { backgroundColor: cardBackgroundColor }
            ] }
            onPress={ onPress }
            activeOpacity={ 0.7 }
        >
            <StatusBadge
                availability={ availability }
                hasCompletions={ hasCompletions }
            />

            <View
                style={ [styles.iconContainer, isDark ? { backgroundColor: 'rgba(255,255,255,0.32)' } : { backgroundColor: 'rgba(0,0,0,0.07)' }] }>
                <AppIcon
                    name={ definition.icon }
                    size={ 40 }
                    tintColor={ colors.textPrimary }
                />
            </View>

            <View style={ styles.titleWrapper }>
                <Text
                    style={ [
                        styles.title,
                        { color: isAvailable ? colors.textPrimary : colors.textSecondary }
                    ] }
                    numberOfLines={ 2 }
                >
                    { definition.displayName ?? definition.name }
                </Text>
                { definition.shortName && (
                    <Text style={ [styles.shortName, { color: colors.textHint }] }>
                        { definition.shortName }
                    </Text>
                ) }

                { lastCompletedAt ? (
                    <Text style={ [styles.duration, { color: colors.textHint }] }>
                        { fmtDate(lastCompletedAt, i18n.language === 'de') }
                    </Text>
                ) : daysUntilEnd != null ? (
                    <Text style={ [styles.duration, { color: colors.textHint }] }>
                        { daysUntilEnd <= 1
                            ? t('questionnaire.availableToday')
                            : t('questionnaire.availableForDays', { count: daysUntilEnd })
                        }
                    </Text>
                ) : definition.estimatedMinutes ? (
                    <Text style={ [styles.duration, { color: colors.textHint }] }>
                        { t('questionnaire.estimatedMinutes', { count: definition.estimatedMinutes }) }
                    </Text>
                ) : null }
            </View>
        </TouchableOpacity>
    );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    card: {
        width: '100%',
        height: '100%',
        paddingTop: 45,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 16,
        alignItems: 'center',

        // --- iOS Schatten ---
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 }, // Verschiebung nach unten
        shadowOpacity: 0.1,                   // Sehr niedriger Wert für "leicht"
        shadowRadius: 3,                      // Weichheit des Schattens

        // --- Android Schatten ---
        elevation: 3,
        margin: 3
    },
    cardGrid: {
        flex: 1,
        paddingHorizontal: 12,
    },
    badge: {
        position: 'absolute',
        top: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        marginBottom: 12
    },
    badgeCheckmark: {
        marginRight: 4
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: -0.2
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20
    },
    titleWrapper: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        letterSpacing: -0.4
    },
    shortName: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 20,
        letterSpacing: -0.4
    },
    duration: {
        fontSize: 11
    }
});

export default QuestionnaireCard;
