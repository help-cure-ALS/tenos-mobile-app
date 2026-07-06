import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, useTheme } from 'react-native-nice-ui';
import {
    type StudyStatus,
    type ParticipantStatus,
    getStudyStatusInfo,
    getParticipantStatusInfo,
} from '../types';

type Props = {
    /** Study status */
    status?: StudyStatus;
    /** Participant status (takes precedence if provided) */
    participantStatus?: ParticipantStatus;
    /** Size variant */
    size?: 'small' | 'medium';
};

export function StudyStatusBadge({
    status,
    participantStatus,
    size = 'medium',
}: Props) {
    const { colors } = useTheme();

    const info = participantStatus
        ? getParticipantStatusInfo(participantStatus)
        : status
            ? getStudyStatusInfo(status)
            : null;

    if (!info) return null;

    const isSmall = size === 'small';

    return (
        <Badge label={info.label} color={info.color} size={size} />
    );
}
