import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'react-native-nice-ui';

import { CardContainer, CardFooter, CardHeader } from '@/src/components/ui/card';
import { useDisplayMode } from '@/src/context/DisplayModeProvider';
import { fmtDayMonthShort } from '@/src/lib/formatDate';
import { getQuestionnaireDefinition } from '@/src/questionnaires/definitions';
import { useNeurologicalExams } from '../hooks/useNeurologicalExams';
import { summarizeNeurologicalExam } from '../labels';

type Props = {
    onPress?: () => void;
    onLongPress?: () => void;
};

export function NeurologicalExamSummaryCard({ onPress, onLongPress }: Props) {
    const { i18n } = useTranslation();
    const { colors } = useTheme();
    const { preferences } = useDisplayMode();
    const { latestEntry, entries } = useNeurologicalExams();
    const isDE = i18n.language === 'de';
    const definition = getQuestionnaireDefinition('als_neurological_exam', i18n.language);
    const title = definition?.displayName ?? definition?.name ?? (isDE ? 'Neurologische Untersuchung' : 'Neurological exam');
    const showPrimaryValue = preferences.showScores;
    const showSummary = preferences.showDomainScores;
    const showFooter = !!latestEntry && preferences.showScoreChanges;

    return (
        <CardContainer onPress={onPress} onLongPress={onLongPress} padding={13}>
            <CardHeader
                title={title}
                icon={definition?.icon ?? 'stethoscope'}
                iconColor={definition?.iconColor ?? '#145C9E'}
                date={latestEntry ? fmtDayMonthShort(new Date(latestEntry.assessedAt), isDE) : undefined}
                showChevron={!!onPress}
            />
            {latestEntry ? (
                <View style={styles.content}>
                    {showPrimaryValue ? (
                        <Text style={[styles.headline, { color: colors.textPrimary }]}>
                            {latestEntry.suggestedMotorNeuronCode ?? (isDE ? 'Motorischer Status' : 'Motor status')}
                        </Text>
                    ) : (
                        <Text style={[styles.recorded, { color: colors.textSecondary }]}>
                            {isDE ? 'Dokumentiert' : 'Documented'}
                        </Text>
                    )}
                    {showSummary && (
                        <Text style={[styles.summary, { color: colors.textSecondary }]}>
                            {summarizeNeurologicalExam(latestEntry, i18n.language)}
                        </Text>
                    )}
                </View>
            ) : (
                <Text style={[styles.empty, { color: colors.textHint }]}>
                    {isDE ? 'Noch keine neurologische Untersuchung dokumentiert.' : 'No neurological exam documented yet.'}
                </Text>
            )}
            {showFooter && (
                <CardFooter text={isDE ? `${entries.length} Untersuchungen` : `${entries.length} exams`} />
            )}
        </CardContainer>
    );
}

const styles = StyleSheet.create({
    content: {
        gap: 6,
    },
    headline: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.25,
    },
    summary: {
        fontSize: 13,
        lineHeight: 18,
    },
    recorded: {
        fontSize: 15,
        fontWeight: '600',
    },
    empty: {
        fontSize: 14,
        lineHeight: 19,
    },
});
