/**
 * Research Project — collected data. Shows the project's metrics and
 * questionnaires with on/off toggles (Datenfreigabe style). For an active
 * participation toggles persist immediately; before an application exists
 * they are broadcast as a draft selection so the detail screen picks them
 * up and passes them along when applying.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { List } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { emit } from '@/src/lib/bus';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import type { ResearchProjectParticipation } from '@/src/stores/patientPreferencesStore';
import {
    fetchResearchProjectDetail,
    type ResearchProjectDetail,
} from '@/src/services/researchDonation/proxyClient';
import {
    DRAFT_SELECTION_EVENT,
    type DraftSelectionPayload,
    buildDefaultSelection,
    buildInstrumentsRecord,
    instrumentKey,
    parseSelectionParam,
} from '@/src/lib/researchProjectApplication';

export default function ResearchProjectDataScreen() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { projectId, title, selection: selectionParam } = useLocalSearchParams<{
        projectId: string;
        title?: string;
        selection?: string;
    }>();
    const { patientPreferencesStore: prefsStore } = usePatientStores();

    const [project, setProject] = useState<ResearchProjectDetail | null>(null);
    const [participation, setParticipation] = useState<ResearchProjectParticipation | null>(null);
    const [instrumentSelection, setInstrumentSelection] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);

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

                const existing = prefs?.researchProjects?.[projectId] ?? null;
                setProject(detail);
                setParticipation(existing);
                // Draft selection from the detail screen wins over saved state
                setInstrumentSelection(
                    parseSelectionParam(selectionParam) ?? buildDefaultSelection(detail, existing),
                );
            } catch (e) {
                console.warn('Failed to load research project:', e);
                if (!cancelled) setLoadFailed(true);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        init();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, prefsStore, i18n.language]);

    const handleToggleInstrument = useCallback(async (key: string, enabled: boolean) => {
        if (!project || !projectId) return;
        const nextSelection = { ...instrumentSelection, [key]: enabled };
        setInstrumentSelection(nextSelection);

        if (participation?.status === 'active') {
            // Active participation: persist immediately (optional instruments only)
            const updated: ResearchProjectParticipation = {
                ...participation,
                instruments: buildInstrumentsRecord(project, nextSelection),
                updatedAt: new Date().toISOString(),
            };
            setParticipation(updated);
            if (prefsStore) {
                await prefsStore.setResearchProjectParticipation(updated);
            }
            emit('researchProjects:changed');
        } else {
            // No application yet: broadcast as draft for the detail screen
            emit<DraftSelectionPayload>(DRAFT_SELECTION_EVENT, {
                projectId,
                selection: nextSelection,
            });
        }
    }, [project, projectId, instrumentSelection, participation, prefsStore]);

    function renderContent() {
        if (!project) return null;

        const metricInstruments = project.instruments.filter((i) => i.instrument_type === 'metric');
        const questionnaireInstruments = project.instruments.filter((i) => i.instrument_type === 'questionnaire');

        const renderInstrumentItem = (instrument: typeof project.instruments[number], lastItem: boolean) => {
            const key = instrumentKey(instrument.instrument_type, instrument.instrument_id);
            return (
                <List.Item
                    key={key}
                    title={instrument.display_name_snapshot}
                    subtitle={instrument.required ? t('share.research.required') : undefined}
                    hideChevron
                    lastItem={lastItem}
                    rightCmp={
                        <Switch
                            value={instrument.required ? true : (instrumentSelection[key] ?? instrument.default_enabled)}
                            disabled={instrument.required}
                            onValueChange={(value) => void handleToggleInstrument(key, value)}
                        />
                    }
                />
            );
        };

        return (
            <>
                <ScreenHeader
                    icon="waveform.path.ecg.rectangle"
                    iconTintColor={colors.brandColorMuted}
                    title={t('share.research.instrumentsLabel')}
                    subtitle={t('share.research.dataSubtitle')}
                />

                {metricInstruments.length > 0 && (
                    <List.Section title={t('share.research.metricsSection')} rounded>
                        {metricInstruments.map((instrument, index) =>
                            renderInstrumentItem(instrument, index === metricInstruments.length - 1))}
                    </List.Section>
                )}

                {questionnaireInstruments.length > 0 && (
                    <List.Section title={t('share.research.questionnairesSection')} rounded>
                        {questionnaireInstruments.map((instrument, index) =>
                            renderInstrumentItem(instrument, index === questionnaireInstruments.length - 1))}
                    </List.Section>
                )}
            </>
        );
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
});
