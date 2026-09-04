/**
 * Research Project Application — clinic selection. Second step of the
 * application flow: pick one of the project's clinics and submit the
 * application. On success this screen is replaced by the code screen, so
 * back navigation from there returns to the project detail.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, List, Space } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { emit } from '@/src/lib/bus';
import { usePatientStores, useAppSync } from '@/src/context/AppSyncProvider';
import {
    fetchResearchProjectDetail,
    type ResearchProjectClinic,
    type ResearchProjectDetail,
} from '@/src/services/researchDonation/proxyClient';
import {
    buildDefaultSelection,
    parseSelectionParam,
    resolveAnonymousResearchId,
    submitProjectApplication,
} from '@/src/lib/researchProjectApplication';

export default function ResearchProjectClinicScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { projectId, title, shareHistory, selection, partnerAccountRef } = useLocalSearchParams<{
        projectId: string;
        title?: string;
        shareHistory?: string;
        selection?: string;
        /** Set when the partner linking step preceded this screen */
        partnerAccountRef?: string;
    }>();
    const { patientPreferencesStore: prefsStore, donationTrackingStore } = usePatientStores();
    const { getOrCreateSubjectId } = useAppSync();

    const [project, setProject] = useState<ResearchProjectDetail | null>(null);
    const [verificationTokenId, setVerificationTokenId] = useState<string | null>(null);
    const [selectedClinic, setSelectedClinic] = useState<ResearchProjectClinic | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isApplying, setIsApplying] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    const acceptedClinics = useMemo(
        () => (project?.clinic_bindings ?? []).filter((binding) => binding.status === 'accepted'),
        [project],
    );

    useEffect(() => {
        let cancelled = false;

        async function init() {
            if (!projectId) return;
            setIsLoading(true);
            setLoadFailed(false);
            try {
                const [detail, prefs] = await Promise.all([
                    fetchResearchProjectDetail(projectId, i18n.language),
                    prefsStore ? prefsStore.getAll() : Promise.resolve(null),
                ]);
                if (cancelled) return;
                setProject(detail);
                setVerificationTokenId(prefs?.verification?.tokenId ?? null);
            } catch (e) {
                console.warn('Failed to load research project:', e);
                if (!cancelled) setLoadFailed(true);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        init();
        return () => { cancelled = true; };
    }, [projectId, prefsStore, i18n.language]);

    const handleApply = useCallback(async (clinic: ResearchProjectClinic) => {
        if (!project || !projectId || isApplying || !verificationTokenId) return;

        setIsApplying(true);
        try {
            const anonymousResearchId = await resolveAnonymousResearchId(
                donationTrackingStore, getOrCreateSubjectId,
            );

            const participation = await submitProjectApplication({
                project,
                projectId,
                clinicId: clinic.clinic_id,
                clinicName: clinic.clinic_name_snapshot,
                verificationTokenId,
                anonymousResearchId,
                shareHistory: shareHistory === '1',
                selection: parseSelectionParam(selection) ?? buildDefaultSelection(project, null),
                locale: i18n.language,
                ...(partnerAccountRef ? { partnerAccountRef } : {}),
            });

            if (prefsStore) {
                await prefsStore.setResearchProjectParticipation(participation);
            }
            emit('researchProjects:changed');

            // Replace, so back from the code screen returns to the detail
            router.replace({
                pathname: '/researchProject/code',
                params: { projectId, title: project.title },
            });
        } catch (e) {
            console.warn('Failed to apply for research project:', e);
        } finally {
            setIsApplying(false);
        }
    }, [project, projectId, isApplying, verificationTokenId, donationTrackingStore,
        getOrCreateSubjectId, shareHistory, selection, prefsStore, router, i18n.language]);

    function clinicSubtitle(clinic: ResearchProjectClinic): string {
        return clinic.clinic_name_snapshot ? '' : clinic.clinic_id;
    }

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
                    ) : loadFailed ? (
                        <List.Wrapper>
                            <List.Text align="center">{t('share.research.loadFailed')}</List.Text>
                        </List.Wrapper>
                    ) : (
                        <>
                            <ScreenHeader
                                icon="building.2"
                                iconTintColor={colors.brandColorMuted}
                                subtitle={t('share.research.selectClinicSubtitle')}
                            />

                            <List.Section rounded>
                                {acceptedClinics.map((clinic) => (
                                    <List.Item
                                        key={clinic.clinic_id}
                                        title={clinic.clinic_name_snapshot ?? clinic.clinic_id}
                                        subtitle={clinicSubtitle(clinic)}
                                        onPress={() => setSelectedClinic(clinic)}
                                        leftCmpSize={56}
                                        leftCmp={
                                            <ListItemIcon name="building.2" color={colors.text} size="lg" backgroundColor={colors.listItemBackgroundMuted} />
                                        }
                                        type="checkbox"
                                        checked={selectedClinic?.clinic_id === clinic.clinic_id}
                                        hideChevron
                                    />
                                ))}
                            </List.Section>

                            <Space />

                            {selectedClinic && (
                                <List.Wrapper>
                                    <Button
                                        title={t('verification.startNow')}
                                        onPress={() => void handleApply(selectedClinic)}
                                        rounded
                                        loading={isApplying}
                                        disabled={isApplying}
                                    />
                                </List.Wrapper>
                            )}
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
});
