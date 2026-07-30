/**
 * Research Project — privacy policy. Renders the project's privacy policy
 * text in the current content locale.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { List } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import {
    fetchResearchProjectDetail,
    type ResearchProjectDetail,
} from '@/src/services/researchDonation/proxyClient';

export default function ResearchProjectPrivacyScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { projectId, title } = useLocalSearchParams<{ projectId: string; title?: string }>();

    const [project, setProject] = useState<ResearchProjectDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function init() {
            if (!projectId) return;
            setIsLoading(true);
            setLoadFailed(false);
            try {
                const detail = await fetchResearchProjectDetail(projectId, i18n.language);
                if (!cancelled) setProject(detail);
            } catch (e) {
                console.warn('Failed to load research project:', e);
                if (!cancelled) setLoadFailed(true);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        init();
        return () => { cancelled = true; };
    }, [projectId, i18n.language]);

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            <Stack.Screen options={{ headerTitle: title || project?.title || '' }} />
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScrollViewContent>
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={colors.textSecondary} />
                        </View>
                    ) : loadFailed || !project?.privacy_policy ? (
                        <List.Wrapper>
                            <List.Text align="center">{t('share.research.loadFailed')}</List.Text>
                        </List.Wrapper>
                    ) : (
                        <>
                            <ScreenHeader
                                icon="lock.shield"
                                iconTintColor={colors.brandColorMuted}
                                title={t('share.research.privacyLabel')}
                                subtitle={project.title}
                            />

                            <View style={styles.privacyContainer}>
                                <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                                    {project.privacy_policy}
                                </Text>
                            </View>
                        </>
                    )}
                </ScrollViewContent>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 20,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    privacyContainer: {
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    privacyText: {
        fontSize: 15,
        lineHeight: 24,
    },
});
