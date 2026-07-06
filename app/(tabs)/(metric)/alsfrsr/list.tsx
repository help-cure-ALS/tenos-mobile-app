import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { List } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';

import { useQuestionnaire } from '@/src/questionnaires';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmtDateTime } from '@/src/lib/formatDate';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';

function formatDateTime(date: Date): string {
    return fmtDateTime(date, true);
}

export default function ALSFRSRList() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();

    const { entries, isLoading } = useQuestionnaire({ questionnaireId: 'alsfrs-r' });

    if (!sharingLoaded || (isFiltering && !canSeeMetric('alsfrs-r'))) {
        if (isFiltering && sharingLoaded) router.back();
        return null;
    }

    return (
        <>
            <Stack.Screen
                options={{
                    headerTitle: t('metric.allData'),
                    headerBackButtonDisplayMode: 'minimal',
                }}
            />

            <ScrollView
                style={ { backgroundColor: colors.background } }
                contentContainerStyle={ styles.scrollView }
                contentInsetAdjustmentBehavior="automatic"
            >
                <View style={ [styles.bodyWrapper,
                    {
                        // We add the insets to the padding so that the content
                        // doesn't disappear under the sidebar.
                        paddingLeft: insets.left,
                        paddingRight: insets.right
                    },
                    insets.left > 200 && { maxWidth: 940 + insets.left }
                ] }>
                {entries.length === 0 ? (
                    isLoading ? (
                        <View style={styles.emptyState}>
                            <ActivityIndicator size="small" color={colors.textHint} />
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={[styles.emptyText, { color: colors.textHint }]}>
                                {t('metric.noEntriesYet')}
                            </Text>
                        </View>
                    )
                ) : (
                    <List.Section rounded>
                        {entries.map((entry, index) => (
                            <List.Item
                                key={entry.id}
                                title={`${entry.totalScore}/48`}
                                subtitle={formatDateTime(entry.completedAt)}
                                onPress={() => router.push(`/(tabs)/(metric)/questionnaire/alsfrs-r?entryId=${entry.id}`)}
                                lastItem={index === entries.length - 1}
                            />
                        ))}
                    </List.Section>
                )}
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
    },
});
