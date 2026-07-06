import React, { useCallback, useMemo } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-nice-ui';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { fmtDate } from '@/src/lib/formatDate';
import { QuestionnaireCard } from './QuestionnaireCard';
import { getAllQuestionnaireDefinitions } from '../definitions';
import { getQuestionnaireAvailability } from '../types';
import type { QuestionnaireDefinition } from '../types';
import { useQuestionnaire } from '../hooks/useQuestionnaire';
import { tokens } from "@/src/theme/tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SectionTitle } from "@/src/components/ui/SectionTitle";

export type QuestionnaireCarouselProps = {
    /** Optional title (default: "Fragebögen") */
    title?: string;
    /** Filter to show only specific questionnaire IDs */
    questionnaireIds?: string[];
    /** Only show questionnaires with highlighted: true (default: true) */
    highlightedOnly?: boolean;
};

const MAX_CARD_WIDTH = 250;
const SCREEN_WIDTH = Dimensions.get('window').width;
const PHI = 1.618;
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.40, MAX_CARD_WIDTH);
const CARD_HEIGHT = CARD_WIDTH / (1.22 / PHI);


type CardWrapperProps = {
    definition: QuestionnaireDefinition;
    width: number;
    height: number;
    onPress: (available: boolean) => void;
};

function CardWrapper({ definition, width, height, onPress }: CardWrapperProps) {
    const { latestEntry } = useQuestionnaire({ questionnaireId: definition.id });

    const availability = useMemo(() => {
        return getQuestionnaireAvailability(
            definition,
            latestEntry?.completedAt ?? null
        );
    }, [definition, latestEntry]);

    const hasCompletions = latestEntry !== null;

    // Hide if outside date window and no completions
    if ((availability.reason === 'not_started' || availability.reason === 'ended') && !hasCompletions) {
        return null;
    }

    const handlePress = useCallback(() => {
        onPress(availability.available);
    }, [onPress, availability.available]);

    return (
        <View style={ { width: width + 6, height: height + 6 } }>
            <QuestionnaireCard
                definition={ definition }
                availability={ availability }
                hasCompletions={ hasCompletions }
                daysUntilEnd={ availability.daysUntilEnd }
                onPress={ handlePress }
                variant="grid"
            />
        </View>
    );
}

export function QuestionnaireCarousel({
                                          title,
                                          questionnaireIds,
                                          highlightedOnly = true
                                      }: QuestionnaireCarouselProps) {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();

    const displayTitle = title ?? t('questionnaire.questionnaires');

    // Get questionnaire definitions (re-fetch when language changes)
    const definitions = useMemo(() => {
        let defs = getAllQuestionnaireDefinitions(i18n.language)
            .filter(d => !d.customRenderer);

        // Filter by IDs if provided
        if (questionnaireIds) {
            defs = defs.filter(d => questionnaireIds.includes(d.id));
        }

        // Filter to highlighted only
        if (highlightedOnly) {
            defs = defs.filter(d => d.highlighted === true);
        }

        return defs.sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity));
    }, [questionnaireIds, highlightedOnly, i18n.language]);

    const handleCardPress = useCallback((definition: QuestionnaireDefinition, available: boolean) => {
        if (available) {
            // Navigate to questionnaire
            router.push(`/questionnaire/${ definition.id }`);
        } else {
            // Show info alert
            const availability = getQuestionnaireAvailability(definition, null);
            let message = t('questionnaire.notAvailable');

            if (availability.reason === 'locked_until_due' && availability.daysUntilAvailable) {
                message = t('questionnaire.availableInDays', { days: availability.daysUntilAvailable });
            } else if (availability.reason === 'not_started' && availability.nextAvailableDate) {
                message = t('questionnaire.availableFrom', {
                    date: fmtDate(availability.nextAvailableDate, i18n.language === 'de')
                });
            } else if (availability.reason === 'ended') {
                message = t('questionnaire.ended');
            }

            Alert.alert(definition.name, message);
        }
    }, [router, t, i18n.language]);

    if (definitions.length === 0) {
        return null;
    }

    const contentWidth = Math.min(width, 900);
    // const paddingHorizontal = width > contentWidth ? (width - contentWidth) / 2 : tokens.listSectionPaddingHorizontal;
    const paddingLeft = width > contentWidth ? ((width - insets.left - contentWidth) / 2) + insets.left : insets.left + tokens.listSectionPaddingHorizontal;
    const paddingRight = width > contentWidth ? ((width - insets.right - contentWidth) / 2) + insets.right : insets.right + tokens.listSectionPaddingHorizontal;


    return (
        <>
            <View style={ [styles.bodyWrapper,
                {
                    // We add the insets to the padding so that the content
                    // doesn't disappear under the sidebar.
                    paddingLeft: insets.left + tokens.listSectionPaddingHorizontal + 5,
                    paddingRight: insets.right + tokens.listSectionPaddingHorizontal
                },
                insets.left > 200 && { maxWidth: 940 + insets.left }
            ] }>
                <SectionTitle title={ displayTitle } />
            </View>

            <ScrollView
                horizontal
                scrollsToTop={ false }
                showsHorizontalScrollIndicator={ false }
                contentContainerStyle={ [styles.scrollContent, {
                    paddingLeft: paddingLeft,
                    paddingRight: paddingRight
                }] }
            >
                { definitions.map((definition) => (
                    <CardWrapper
                        key={ definition.id }
                        definition={ definition }
                        width={ CARD_WIDTH }
                        height={ CARD_HEIGHT }
                        onPress={ (available) => handleCardPress(definition, available) }
                    />
                )) }
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    bodyWrapper: {
        paddingTop: 20,
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    scrollContent: {
        gap: 12
    }
});

export default QuestionnaireCarousel;
