/**
 * Research Project — partner account linking. Shown for forwarding projects
 * with identity_mode 'partner_account': the patient enters the pairing code
 * from the partner app, the research proxy resolves it at the partner
 * backend and returns the stable account ref, which is stored locally and
 * attached to donations.
 *
 * Depending on the project's verification requirement the flow continues
 * with the clinic application (next=clinic) or completes the participation
 * directly (next=join).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, List, Space } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { emit } from '@/src/lib/bus';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import {
    fetchResearchProjectDetail,
    resolvePartnerLinkCode,
    type ResearchProjectDetail,
} from '@/src/services/researchDonation/proxyClient';
import {
    buildDefaultSelection,
    buildDirectParticipation,
    parseSelectionParam,
} from '@/src/lib/researchProjectApplication';

export default function ResearchProjectPartnerLinkScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { projectId, title, shareHistory, selection, next } = useLocalSearchParams<{
        projectId: string;
        title?: string;
        shareHistory?: string;
        selection?: string;
        next?: string;
    }>();
    const { patientPreferencesStore: prefsStore } = usePatientStores();

    const [project, setProject] = useState<ResearchProjectDetail | null>(null);
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isLinking, setIsLinking] = useState(false);
    const [linkError, setLinkError] = useState(false);
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

    const handleLink = useCallback(async () => {
        if (!project || !projectId || isLinking || !code.trim()) return;

        setIsLinking(true);
        setLinkError(false);
        try {
            const accountRef = await resolvePartnerLinkCode(projectId, code.trim());

            if (next === 'clinic') {
                // Continue with the clinic application; replace so back from
                // there returns to the project detail.
                router.replace({
                    pathname: '/researchProject/clinic',
                    params: {
                        projectId,
                        title: project.title,
                        shareHistory: shareHistory ?? '0',
                        selection: selection ?? '',
                        partnerAccountRef: accountRef,
                    },
                });
                return;
            }

            // Direct participation (verification_requirement 'general'):
            // consent + linking complete the participation locally.
            const participation = buildDirectParticipation({
                project,
                projectId,
                shareHistory: shareHistory === '1',
                selection: parseSelectionParam(selection) ?? buildDefaultSelection(project, null),
                locale: i18n.language,
                partnerAccountRef: accountRef,
            });
            if (prefsStore) {
                await prefsStore.setResearchProjectParticipation(participation);
            }
            emit('researchProjects:changed');
            router.back();
        } catch (e) {
            console.warn('Partner link failed:', e);
            setLinkError(true);
        } finally {
            setIsLinking(false);
        }
    }, [project, projectId, isLinking, code, next, router, shareHistory, selection, i18n.language, prefsStore]);

    function renderContent() {
        if (!project) return null;

        return (
            <>
                <ScreenHeader
                    icon="link"
                    iconTintColor={colors.brandColorMuted}
                    title={t('share.research.partnerLinkTitle')}
                    subtitle={project.partner_link_instructions ?? t('share.research.partnerLinkHint')}
                />

                <List.Wrapper>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>
                        {t('share.research.partnerLinkCodeLabel')}
                    </Text>
                    <TextInput
                        style={[
                            styles.textInput,
                            {
                                backgroundColor: colors.listItemBackground,
                                color: colors.text,
                                borderColor: linkError ? '#FF3B30' : colors.listItemBackground,
                            },
                        ]}
                        placeholder={t('share.research.partnerLinkCodePlaceholder')}
                        placeholderTextColor={colors.textHint}
                        value={code}
                        onChangeText={(value) => {
                            setCode(value);
                            setLinkError(false);
                        }}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={() => { void handleLink(); }}
                    />
                    {linkError && (
                        <Text style={[styles.errorText, { color: '#FF3B30' }]}>
                            {t('share.research.partnerLinkFailed')}
                        </Text>
                    )}
                </List.Wrapper>

                <Space />

                <List.Wrapper>
                    <Button
                        title={t('share.research.partnerLinkSubmit')}
                        onPress={() => { void handleLink(); }}
                        rounded
                        loading={isLinking}
                        disabled={isLinking || !code.trim()}
                    />
                </List.Wrapper>
            </>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            <Stack.Screen options={{ headerTitle: title || project?.title || '' }} />
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
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
                    ) : renderContent()}
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
    inputLabel: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 8,
    },
    textInput: {
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 17,
    },
    errorText: {
        fontSize: 13,
        marginTop: 8,
    },
});
