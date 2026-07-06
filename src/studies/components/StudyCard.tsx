import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useTheme } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import type { Study, StudyEnrollment } from '../types';
import { StudyStatusBadge } from './StudyStatusBadge';
import { getPhaseLabel, getStudyTypeLabel } from '../types';
import { useAppTheme } from "@/src/theme";

type Props = {
    study: Study;
    /** Enrollment info (if enrolled) */
    enrollment?: StudyEnrollment;
    /** Called when card is pressed */
    onPress?: () => void;
    /** Show as enrolled/pinned style */
    isEnrolled?: boolean;
    /** Whether this study is a favorite */
    isFavorite?: boolean;
    /** Called when favorite star is toggled */
    onFavoriteToggle?: () => void;
    /** Whether the clinic has marked this study as open for applications */
    isOpenForApplications?: boolean;
    /** Optional container style override (e.g. for width in grid layouts) */
    style?: StyleProp<ViewStyle>;
};

function formatDaysUntil(date: Date): string {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Überfällig';
    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Morgen';
    if (diffDays < 7) return `In ${diffDays} Tagen`;
    if (diffDays < 14) return 'In 1 Woche';
    return `In ${Math.floor(diffDays / 7)} Wochen`;
}

export function StudyCard({ study, enrollment, onPress, isEnrolled, isFavorite, onFavoriteToggle, isOpenForApplications, style }: Props) {
    const { colors, tokens } = useAppTheme();
    const { t } = useTranslation();

    const hasNextActivity = enrollment?.nextActivity;

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.container,
                {
                    backgroundColor: colors.listItemBackground,
                    borderRadius: tokens.listSectionRadius,
                    opacity: pressed ? 0.7 : 1,
                },
                isEnrolled && styles.enrolledContainer,
                isEnrolled && { borderColor: `${study.iconColor}40`, borderWidth: 1 },
                style,
            ]}
        >
            {/* Header with icon and title */}
            <View style={styles.header}>
                <View style={styles.titleContainer}>
                    <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
                        {study.shortTitle || study.title}
                    </Text>
                    <Text style={[styles.sponsor, { color: colors.textSecondary }]} numberOfLines={1}>
                        {study.sponsor.name}
                    </Text>
                </View>
                {onFavoriteToggle && (
                    <Pressable
                        onPress={(e) => {
                            e.stopPropagation();
                            onFavoriteToggle();
                        }}
                        hitSlop={12}
                        style={styles.favoriteButton}
                    >
                        <AppIcon
                            name={isFavorite ? 'bookmark.fill' : 'bookmark'}
                            tintColor={isFavorite ? colors.textPrimary : colors.textHint}
                            size={24}
                        />
                    </Pressable>
                )}
            </View>

            {/* Status badge */}
            <View style={styles.statusRow}>
                {isEnrolled && enrollment ? (
                    <StudyStatusBadge participantStatus={enrollment.status} size="small" />
                ) : (
                    <StudyStatusBadge status={study.status} size="small" />
                )}

                {study.phase && (
                    <Text style={[styles.phase, { color: colors.textSecondary }]}>
                        {getPhaseLabel(study.phase)}
                    </Text>
                )}

                {isOpenForApplications && (
                    <View style={[styles.openBadge, { backgroundColor: '#dcfce7' }]}>
                        <Text style={styles.openBadgeText}>
                            {t('studies.openForApplications')}
                        </Text>
                    </View>
                )}
            </View>

            {/* Summary or next activity */}
            {isEnrolled && hasNextActivity ? (
                <View style={[styles.nextActivity, { backgroundColor: `${colors.tint}10` }]}>
                    <AppIcon
                        name="calendar.badge.clock"
                        tintColor={colors.tint}
                        size={16}
                    />
                    <View style={styles.nextActivityText}>
                        <Text style={[styles.nextActivityLabel, { color: colors.textSecondary }]}>
                            Nächste Aufgabe
                        </Text>
                        <Text style={[styles.nextActivityTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                            {enrollment.nextActivity!.title}
                        </Text>
                        <Text style={[styles.nextActivityDate, { color: colors.tint }]}>
                            {formatDaysUntil(enrollment.nextActivity!.date)}
                        </Text>
                    </View>
                </View>
            ) : (
                <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={2}>
                    {study.summary || study.description}
                </Text>
            )}

            {/* Footer with location info */}
            {!isEnrolled && study.centers.length > 0 && (
                <View style={styles.footer}>
                    <AppIcon
                        name="mappin.circle.fill"
                        tintColor={colors.textHint}
                        size={14}
                    />
                    <Text style={[styles.location, { color: colors.textHint }]} numberOfLines={1}>
                        {study.centers.length === 1
                            ? study.centers[0].city
                            : `${study.centers.length} Standorte`
                        }
                    </Text>
                </View>
            )}

            {/* Enrolled footer with participant ID */}
            {isEnrolled && enrollment?.participantId && (
                <View style={styles.footer}>
                    <AppIcon
                        name="person.text.rectangle"
                        tintColor={colors.textHint}
                        size={14}
                    />
                    <Text style={[styles.location, { color: colors.textHint }]}>
                        Teilnehmer-ID: {enrollment.participantId}
                    </Text>
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 12
    },
    enrolledContainer: {
        // Additional styling for enrolled cards
    },
    header: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'flex-start',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleContainer: {
        flex: 1,
        gap: 2,
    },
    favoriteButton: {
        padding: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 20,
    },
    sponsor: {
        fontSize: 13,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    phase: {
        fontSize: 12,
    },
    openBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    openBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#166534',
    },
    summary: {
        fontSize: 14,
        lineHeight: 19,
    },
    nextActivity: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        borderRadius: 10,
    },
    nextActivityText: {
        flex: 1,
        gap: 2,
    },
    nextActivityLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    nextActivityTitle: {
        fontSize: 14,
        fontWeight: '500',
    },
    nextActivityDate: {
        fontSize: 13,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    location: {
        fontSize: 12,
    },
});
