import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'react-native-nice-ui';

import { CardContainer, CardFooter, CardHeader } from '@/src/components/ui/card';
import { useDisplayMode } from '@/src/context/DisplayModeProvider';
import { fmtDayMonthShort } from '@/src/lib/formatDate';
import { getQuestionnaireDefinition } from '@/src/questionnaires/definitions';
import { isDerivedALSKingsStageEntry } from '../deriveKingsStage';
import { useALSKingsStage } from '../hooks/useALSKingsStage';
import { stageLabel, summarizeALSKingsStage } from '../labels';

type Props = {
    onPress?: () => void;
    onLongPress?: () => void;
};

export function ALSKingsStageCard({ onPress, onLongPress }: Props) {
    const { i18n } = useTranslation();
    const { colors } = useTheme();
    const { preferences } = useDisplayMode();
    const { latestEntry, entries } = useALSKingsStage();
    const isDE = i18n.language === 'de';
    const definition = getQuestionnaireDefinition('als_kings_stage', i18n.language);
    const title = definition?.displayName ?? definition?.name ?? "King's Stage";
    const showPrimaryValue = preferences.showScores;
    const showSummary = preferences.showDomainScores;
    const showFooter = !!latestEntry && preferences.showScoreChanges;
    const isCalculated = isDerivedALSKingsStageEntry(latestEntry);

    return (
        <CardContainer onPress={onPress} onLongPress={onLongPress} padding={13}>
            <CardHeader
                title={title}
                icon={definition?.icon ?? 'chart.bar.fill'}
                iconColor={definition?.iconColor ?? '#FF9500'}
                date={latestEntry ? fmtDayMonthShort(new Date(latestEntry.assessedAt), isDE) : undefined}
                showChevron={!!onPress}
            />
            {latestEntry ? (
                <View style={styles.content}>
                    {showPrimaryValue ? (
                        <Text style={[styles.headline, { color: colors.textPrimary }]}>
                            {stageLabel(latestEntry.stage, i18n.language)}
                        </Text>
                    ) : (
                        <Text style={[styles.recorded, { color: colors.textSecondary }]}>
                            {isCalculated
                                ? (isDE ? 'Berechnet' : 'Calculated')
                                : (isDE ? 'Dokumentiert' : 'Documented')}
                        </Text>
                    )}
                    {showSummary && (
                        <Text style={[styles.summary, { color: colors.textSecondary }]}>
                            {summarizeALSKingsStage(latestEntry, i18n.language)}
                        </Text>
                    )}
                </View>
            ) : (
                <Text style={[styles.empty, { color: colors.textHint }]}>
                    {isDE ? "Noch kein King's Stage dokumentiert." : "No King's Stage documented yet."}
                </Text>
            )}
            {showFooter && (
                <CardFooter
                    text={isCalculated
                        ? (isDE ? 'Aus vorhandenen Daten berechnet' : 'Calculated from existing data')
                        : (isDE ? `${entries.length} Bewertungen` : `${entries.length} assessments`)}
                />
            )}
        </CardContainer>
    );
}

const styles = StyleSheet.create({
    content: {
        gap: 6,
    },
    headline: {
        fontSize: 24,
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
