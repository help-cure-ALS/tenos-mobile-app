/**
 * Generic Questionnaire Screen Route
 *
 * Renders any questionnaire based on the questionnaireId parameter.
 * Route: /(tabs)/(metric)/questionnaire/[questionnaireId]
 */

import React, { useEffect, useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { QuestionnaireScreen, getQuestionnaireDefinition, useQuestionnaire } from '@/src/questionnaires';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '@/src/theme';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';

export default function QuestionnaireRoute() {
    const { questionnaireId, entryId, effectiveDate } = useLocalSearchParams<{
        questionnaireId: string;
        entryId?: string;
        effectiveDate?: string;
    }>();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const { isFiltering, isLoaded: sharingLoaded, canSeeCategory, canSeeMetric } = useSharingFilter();

    const definition = getQuestionnaireDefinition(questionnaireId);
    const customRoute = getCustomRendererRoute(definition?.customRenderer);
    const { entries } = useQuestionnaire({ questionnaireId });

    const entry = useMemo(
        () => entryId ? entries.find((e) => e.id === entryId) : undefined,
        [entryId, entries],
    );

    const parsedEffectiveDate = useMemo(() => {
        if (!effectiveDate) return undefined;
        const d = new Date(effectiveDate);
        return isNaN(d.getTime()) ? undefined : d;
    }, [effectiveDate]);

    useEffect(() => {
        if (sharingLoaded && customRoute) {
            router.replace(customRoute);
        }
    }, [customRoute, router, sharingLoaded]);

    if (!sharingLoaded) {
        return null;
    }

    if (!definition) {
        return (
            <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
                <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                    Fragebogen nicht gefunden
                </Text>
            </View>
        );
    }

    if (customRoute) {
        return null;
    }

    const canAccessByCategory = canSeeCategory('questionnaires');
    const metricAccessId = definition.metricAccessId ?? definition.id;
    const canAccessByMetric = definition.allowAsMetric === true && canSeeMetric(metricAccessId);

    if (isFiltering && !canAccessByCategory && !canAccessByMetric) {
        router.back();
        return null;
    }

    if (entryId && !entry) {
        return null;
    }

    return (
        <QuestionnaireScreen
            definition={definition}
            entry={entry}
            effectiveDate={parsedEffectiveDate}
        />
    );
}

function getCustomRendererRoute(customRenderer: string | undefined): any {
    switch (customRenderer) {
        case 'alsSubtype':
            return '/(tabs)/(metric)/alsSubtype';
        case 'neurologicalExam':
            return '/(tabs)/(metric)/neurologicalExam';
        case 'alsGeneticBackground':
            return '/(tabs)/(metric)/alsGeneticBackground';
        case 'alsKingsStage':
            return '/(tabs)/(metric)/alsKingsStage';
        default:
            return undefined;
    }
}

const styles = StyleSheet.create({
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 17,
    },
});
