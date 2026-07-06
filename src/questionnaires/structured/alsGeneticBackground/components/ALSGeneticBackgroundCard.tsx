import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'react-native-nice-ui';

import { CardContainer, CardFooter, CardHeader } from '@/src/components/ui/card';
import { useDisplayMode } from '@/src/context/DisplayModeProvider';
import { fmtDayMonthShort } from '@/src/lib/formatDate';
import { getQuestionnaireDefinition } from '@/src/questionnaires/definitions';
import { formatALSGeneticHeadline, summarizeALSGeneticBackground } from '../labels';
import { useALSGeneticBackground } from '../hooks/useALSGeneticBackground';

type Props = {
    onPress?: () => void;
    onLongPress?: () => void;
};

export function ALSGeneticBackgroundCard({ onPress, onLongPress }: Props) {
    const { i18n } = useTranslation();
    const { colors } = useTheme();
    const { preferences } = useDisplayMode();
    const { latestEntry, entries } = useALSGeneticBackground();
    const isDE = i18n.language === 'de';
    const definition = getQuestionnaireDefinition('als_genetic_background', i18n.language);
    const title = definition?.displayName ?? definition?.name ?? (isDE ? 'ALS-Form & Genetik' : 'ALS form & genetics');
    const showPrimaryValue = preferences.showScores;
    const showSummary = preferences.showDomainScores;
    const showFooter = !!latestEntry && preferences.showScoreChanges;

    return (
        <CardContainer onPress={onPress} onLongPress={onLongPress} padding={13}>
            <CardHeader
                title={title}
                icon={definition?.icon ?? 'atom'}
                iconColor={definition?.iconColor ?? '#AF52DE'}
                date={latestEntry ? fmtDayMonthShort(new Date(latestEntry.assessedAt), isDE) : undefined}
                showChevron={!!onPress}
            />
            {latestEntry ? (
                <View style={styles.content}>
                    {showPrimaryValue ? (
                        <Text style={[styles.headline, { color: colors.textPrimary }]}>
                            {formatALSGeneticHeadline(latestEntry, i18n.language)}
                        </Text>
                    ) : (
                        <Text style={[styles.recorded, { color: colors.textSecondary }]}>
                            {isDE ? 'Dokumentiert' : 'Documented'}
                        </Text>
                    )}
                    {showSummary && (
                        <Text style={[styles.summary, { color: colors.textSecondary }]}>
                            {summarizeALSGeneticBackground(latestEntry, i18n.language)}
                        </Text>
                    )}
                </View>
            ) : (
                <Text style={[styles.empty, { color: colors.textHint }]}>
                    {isDE ? 'Noch keine ALS-Form oder genetische Angabe dokumentiert.' : 'No ALS form or genetic background documented yet.'}
                </Text>
            )}
            {showFooter && (
                <CardFooter text={isDE ? `${entries.length} Angaben` : `${entries.length} entries`} />
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
