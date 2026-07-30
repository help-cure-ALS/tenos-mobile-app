/**
 * Research Projects List — modal listing all active research data collection
 * projects. Tapping a project opens the detail/application view.
 *
 * The open default project ("Anonyme Datenspende") is not listed here —
 * it has its own card in the share tab.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, List } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { useResearchProjectParticipations } from '@/src/hooks/usePatientPreferences';
import {
    fetchResearchProjects,
    type ResearchProjectSummary,
} from '@/src/services/researchDonation/proxyClient';
import type { BadgeVariant } from 'react-native-nice-ui';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
    pending: 'warning',
    active: 'success',
    rejected: 'error',
    revoked: 'error',
    completed: 'default',
};

export default function ResearchProjectsScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { participations } = useResearchProjectParticipations();

    const [projects, setProjects] = useState<ResearchProjectSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);

    const loadProjects = useCallback(async () => {
        setIsLoading(true);
        setLoadFailed(false);
        try {
            const all = await fetchResearchProjects(undefined, i18n.language);
            // The open default project has its own card in the share tab
            setProjects(all.filter((project) => project.participation_mode === 'closed'));
        } catch (e) {
            console.warn('Failed to load research projects:', e);
            setLoadFailed(true);
        } finally {
            setIsLoading(false);
        }
    }, [i18n.language]);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    function participationBadge(projectId: string) {
        const participation = participations[projectId];
        if (!participation) return undefined;
        return (
            <Badge
                label={t(`share.research.status.${participation.status}`)}
                variant={STATUS_VARIANT[participation.status] ?? 'default'}
            />
        );
    }

    // short_description is internal-only (portal), not shown to patients
    function projectSubtitle(project: ResearchProjectSummary): string {
        return project.sponsor_name ?? '';
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerRight: () => (
                            <HeaderButton title={t('verification.done')} variant="plain" onPress={() => router.back()} />
                        ),
                    }}
                />
            ) : (
                <Stack.Toolbar placement="right">
                    <Stack.Toolbar.Button variant="plain" onPress={() => router.back()}>
                        {t('verification.done')}
                    </Stack.Toolbar.Button>
                </Stack.Toolbar>
            )}

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScrollViewContent>
                    <ScreenHeader
                        icon="atom"
                        iconTintColor={colors.brandColorMuted}
                        subtitle={t('share.research.projectsSubtitle')}
                    />

                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={colors.textSecondary} />
                        </View>
                    ) : loadFailed ? (
                        <List.Wrapper>
                            <List.Text align="center">{t('share.research.loadFailed')}</List.Text>
                        </List.Wrapper>
                    ) : projects.length === 0 ? (
                        <List.Wrapper>
                            <List.Text align="center">{t('share.research.noProjects')}</List.Text>
                        </List.Wrapper>
                    ) : (
                        <List.Section rounded>
                            {projects.map((project) => (
                                <List.Item
                                    key={project.id}
                                    title={project.title}
                                    subtitle={projectSubtitle(project)}
                                    subtitleNumberOfLines={2}
                                    leftCmpSize={40}
                                    leftCmp={
                                        <ListItemIcon
                                            name="atom"
                                            color={colors.textPrimary}
                                            backgroundColor={colors.listItemBackgroundMuted}
                                            size="md"
                                        />
                                    }
                                    rightCmp={participationBadge(project.id)}
                                    onPress={() => router.push({
                                        pathname: '/researchProject',
                                        params: { projectId: project.id },
                                    })}
                                />
                            ))}
                        </List.Section>
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
});
