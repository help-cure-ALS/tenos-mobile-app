import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'react-native-nice-ui';

import { CardContainer, CardFooter, CardHeader } from '@/src/components/ui/card';
import { useDisplayMode } from '@/src/context/DisplayModeProvider';
import { fmtDayMonthShort } from '@/src/lib/formatDate';
import { getQuestionnaireDefinition } from '@/src/questionnaires/definitions';
import { useALSSubtype } from '../hooks/useALSSubtype';
import { formatClassificationCode, summarizeALSSubtype } from '../opmCodes';

type Props = {
    onPress?: () => void;
    onLongPress?: () => void;
};

export function ALSSubtypeCard({ onPress, onLongPress }: Props) {
    const { i18n } = useTranslation();
    const { colors } = useTheme();
    const { preferences } = useDisplayMode();
    const { latestEntry, entries } = useALSSubtype();
    const isDE = i18n.language === 'de';
    const definition = getQuestionnaireDefinition('als_subtype', i18n.language);
    const title = definition?.displayName ?? definition?.name ?? (isDE ? 'ALS-Subtyp' : 'ALS subtype');
    const showPrimaryValue = preferences.showScores;
    const showSummary = preferences.showDomainScores;
    const showFooter = !!latestEntry && preferences.showScoreChanges;

    return (
        <CardContainer onPress={onPress} onLongPress={onLongPress} padding={13}>
            <CardHeader
                title={title}
                icon={definition?.icon ?? 'figure.mind.and.body'}
                iconColor={definition?.iconColor ?? '#145C9E'}
                date={latestEntry ? fmtDayMonthShort(new Date(latestEntry.assessedAt), isDE) : undefined}
                showChevron={!!onPress}
            />
            {latestEntry ? (
                <View style={styles.content}>
                    {showPrimaryValue ? (
                        <Text style={[styles.code, { color: colors.textPrimary }]}>
                            {formatClassificationCode(latestEntry.classificationCode)}
                        </Text>
                    ) : (
                        <Text style={[styles.recorded, { color: colors.textSecondary }]}>
                            {isDE ? 'Dokumentiert' : 'Documented'}
                        </Text>
                    )}
                    {showSummary && (
                        <Text style={[styles.summary, { color: colors.textSecondary }]}>
                            {summarizeALSSubtype(latestEntry, i18n.language)}
                        </Text>
                    )}
                </View>
            ) : (
                <Text style={[styles.empty, { color: colors.textHint }]}>
                    {isDE ? 'Noch keine ärztliche Klassifikation dokumentiert.' : 'No clinical classification documented yet.'}
                </Text>
            )}
            {showFooter && (
                <CardFooter text={isDE ? `${entries.length} Bewertungen` : `${entries.length} assessments`} />
            )}
        </CardContainer>
    );
}

const styles = StyleSheet.create({
    content: {
        gap: 6,
    },
    code: {
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.3,
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
