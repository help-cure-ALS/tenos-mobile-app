import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, List } from 'react-native-nice-ui';

import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { useMedications } from '@/src/medications';
import { useExternalHealthImport } from '@/src/services/externalHealth/hooks/useExternalHealthImport';
import {
    buildAppleHealthMedicationImportPreview,
    getAppleHealthMedicationImportSelectionDefaults,
    type AppleHealthMedicationImportCandidate,
    type AppleHealthMedicationImportPreview,
} from '@/src/services/externalHealth/medicationImport';
import { useAppTheme } from '@/src/theme';
import { fmtDateTime } from '@/src/lib/formatDate';

export default function HealthImportSettingsScreen() {
    const { colors } = useAppTheme();
    const { t, i18n } = useTranslation();
    const healthImport = useExternalHealthImport();
    const { medications, addMedication, reload: reloadMedications } = useMedications();
    const [medicationPreview, setMedicationPreview] = useState<AppleHealthMedicationImportPreview | null>(null);
    const [selectedMedicationSourceIds, setSelectedMedicationSourceIds] = useState<string[]>([]);
    const [isCheckingMedications, setIsCheckingMedications] = useState(false);
    const [isImportingMedications, setIsImportingMedications] = useState(false);

    const showError = useCallback((error: unknown) => {
        Alert.alert(
            t('common.error'),
            error instanceof Error ? t(`healthImport.errors.${error.message}`, { defaultValue: error.message }) : String(error)
        );
    }, [t]);

    const handleConnect = useCallback(async () => {
        try {
            await healthImport.connect();
            Alert.alert(t('healthImport.connectedTitle'), t('healthImport.connectedMessage'));
        } catch (error) {
            showError(error);
        }
    }, [healthImport, showError, t]);

    const handleSync = useCallback(async () => {
        try {
            const result = await healthImport.syncNow();
            const diagnostics = result.diagnostics;
            const changedCount = result.imported + result.updated;
            const diagnosticText = diagnostics && changedCount === 0
                ? `\n\n${t('healthImport.syncDiagnostic', {
                    raw: diagnostics.rawSampleCount,
                    processed: diagnostics.processedSampleCount,
                    days: diagnostics.lookbackDays,
                })}`
                : '';
            const missingNames = (result.metricsWithoutPermission ?? [])
                .map((metricId) => healthImport.registryEntries.find((entry) => entry.metricId === metricId)?.definition.name ?? metricId);
            const missingPermissionText = missingNames.length > 0
                ? `\n\n${t('healthImport.syncMissingPermission', { metrics: missingNames.join(', ') })}`
                : '';
            const completionBody = t('healthImport.syncCompleteMessage', {
                imported: result.imported,
                updated: result.updated,
                unchanged: result.unchanged,
                thinned: result.thinned,
                skipped: result.skipped,
            }) + diagnosticText + missingPermissionText;
            Alert.alert(
                result.cancelled ? t('healthImport.syncCancelledTitle') : t('healthImport.syncCompleteTitle'),
                result.cancelled
                    ? `${t('healthImport.syncCancelledMessage')}\n\n${completionBody}`
                    : completionBody
            );
        } catch (error) {
            showError(error);
        }
    }, [healthImport, showError, t]);

    const handleDisconnect = useCallback(async () => {
        await healthImport.disconnect();
    }, [healthImport]);

    const handleCheckMedications = useCallback(async () => {
        setIsCheckingMedications(true);
        try {
            const preview = await buildAppleHealthMedicationImportPreview(medications);
            setMedicationPreview(preview);
            setSelectedMedicationSourceIds(getAppleHealthMedicationImportSelectionDefaults(preview));

            if (preview.newItems.length === 0) {
                Alert.alert(
                    t('healthImport.medicationNoNewTitle'),
                    t('healthImport.medicationNoNewMessage', {
                        existing: preview.existingItems.length,
                        archived: preview.archivedCount,
                        unclear: preview.ambiguousItems.length,
                    })
                );
            }
        } catch (error) {
            showError(error);
        } finally {
            setIsCheckingMedications(false);
        }
    }, [medications, showError, t]);

    const handleToggleMedicationSelection = useCallback((sourceId: string) => {
        setSelectedMedicationSourceIds((current) => (
            current.includes(sourceId)
                ? current.filter((id) => id !== sourceId)
                : [...current, sourceId]
        ));
    }, []);

    const handleImportSelectedMedications = useCallback(async () => {
        if (!medicationPreview) return;
        const selectedSourceIds = new Set(selectedMedicationSourceIds);
        const selected = medicationPreview.newItems.filter((item) => selectedSourceIds.has(item.sourceId));

        if (selected.length === 0) {
            Alert.alert(t('healthImport.medicationImportNothingSelectedTitle'), t('healthImport.medicationImportNothingSelected'));
            return;
        }

        setIsImportingMedications(true);
        try {
            for (const item of selected) {
                await addMedication(item.draft);
            }
            await reloadMedications();
            setMedicationPreview(null);
            setSelectedMedicationSourceIds([]);
            Alert.alert(
                t('healthImport.medicationImportCompleteTitle'),
                t('healthImport.medicationImportCompleteMessage', { imported: selected.length })
            );
        } catch (error) {
            showError(error);
        } finally {
            setIsImportingMedications(false);
        }
    }, [addMedication, medicationPreview, reloadMedications, selectedMedicationSourceIds, showError, t]);

    const handleDiscardMedicationPreview = useCallback(() => {
        setMedicationPreview(null);
        setSelectedMedicationSourceIds([]);
    }, []);

    const lastImportedAt = healthImport.preferences.lastImportedAt
        ? fmtDateTime(new Date(healthImport.preferences.lastImportedAt), i18n.language.startsWith('de'))
        : t('common.notSet');
    const canConnect =
        healthImport.canUseHealthImport &&
        healthImport.availability === 'available' &&
        healthImport.selectedMetricIds.length > 0 &&
        !healthImport.isLoading &&
        !healthImport.isSyncing;
    const canCheckMedications =
        healthImport.canUseHealthImport &&
        Platform.OS === 'ios' &&
        healthImport.availability === 'available' &&
        !isCheckingMedications &&
        !isImportingMedications;

    const syncProgress = healthImport.syncProgress;
    const syncProgressPct = syncProgress && syncProgress.total > 0
        ? Math.min(100, Math.round((syncProgress.completed / syncProgress.total) * 100))
        : 0;
    const syncProgressText = syncProgress
        ? (syncProgress.phase === 'reading'
            ? t('healthImport.importProgressReading', { completed: syncProgress.completed, total: syncProgress.total })
            : t('healthImport.importProgressSaving', { completed: syncProgress.completed, total: syncProgress.total }))
        : '';

    return (
        <>
        <ScrollView
            style={{ backgroundColor: colors.modalBackground }}
            contentContainerStyle={styles.scrollView}
            contentInsetAdjustmentBehavior="automatic"
        >
            <ScrollViewContent>
                <ScreenHeader
                    icon="heart.text.square.fill"
                    iconTintColor={colors.brandColorMuted}
                    subtitle={t('healthImport.headerText')}
                />

                <List.Section rounded>
                    <List.Item
                        title={t('healthImport.status')}
                        rightTitle={t(`healthImport.availability.${healthImport.availability}`)}
                    />
                    <List.Item
                        title={t('healthImport.lastImport')}
                        rightTitle={lastImportedAt}
                        lastItem
                    />
                </List.Section>

                {!healthImport.canUseHealthImport && (
                    <List.Wrapper>
                        <List.Text align="center">{t('healthImport.patientOnly')}</List.Text>
                    </List.Wrapper>
                )}

                {healthImport.canUseHealthImport && (
                    <>
                        <List.Section title={t('healthImport.metrics')} rounded>
                            {[...healthImport.registryEntries]
                                .sort((a, b) => a.definition.name.localeCompare(b.definition.name, i18n.language))
                                .map((entry, index, sortedEntries) => {
                                const enabled = healthImport.selectedMetricIds.includes(entry.metricId);
                                const missingPermission = enabled && (healthImport.preferences.metricsWithoutPermission ?? []).includes(entry.metricId);
                                return (
                                    <List.Item
                                        key={entry.metricId}
                                        title={entry.definition.name}
                                        subtitle={missingPermission ? t('healthImport.metricNoPermission') : undefined}
                                        subtitleStyle={missingPermission ? { color: colors.warning } : undefined}
                                        type="checkbox"
                                        checked={enabled}
                                        onPress={() => healthImport.setMetricEnabled(entry.metricId, !enabled)}
                                        hideChevron
                                        lastItem={index === sortedEntries.length - 1}
                                    />
                                );
                            })}
                        </List.Section>

                        <List.Section rounded>
                            <View style={styles.actionButtons}>
                                <Button
                                    title={healthImport.isSyncing ? t('healthImport.syncing') : t('healthImport.syncNow')}
                                    onPress={handleSync}
                                    disabled={!healthImport.preferences.enabled || healthImport.selectedMetricIds.length === 0 || healthImport.isSyncing}
                                    loading={healthImport.isSyncing}
                                    fullWidth
                                />
                                <Button
                                    title={healthImport.preferences.enabled ? t('healthImport.reconnect') : t('healthImport.connect')}
                                    onPress={handleConnect}
                                    disabled={!canConnect}
                                    variant={healthImport.preferences.enabled ? 'secondary' : undefined}
                                    fullWidth
                                />
                                <Button
                                    title={t('healthImport.disconnect')}
                                    onPress={handleDisconnect}
                                    disabled={!healthImport.preferences.enabled || healthImport.isSyncing}
                                    variant="secondary"
                                    fullWidth
                                />
                            </View>
                        </List.Section>
                        <List.Wrapper>
                            <List.Text align="center">
                                {t('healthImport.autoImportHint')}
                            </List.Text>
                        </List.Wrapper>

                        {Platform.OS === 'ios' && (
                            <>
                                <List.Section title={t('healthImport.medications')} rounded>
                                    <List.Item
                                        title={isCheckingMedications ? t('healthImport.checkingMedications') : t('healthImport.checkMedications')}
                                        subtitle={t('healthImport.medicationImportSubtitle')}
                                        onPress={handleCheckMedications}
                                        disabled={!canCheckMedications}
                                        lastItem
                                    />
                                </List.Section>

                                {medicationPreview && (
                                    <>
                                        {medicationPreview.newItems.length > 0 && (
                                            <List.Section
                                                title={t('healthImport.medicationNewSection', { count: medicationPreview.newItems.length })}
                                                rounded
                                            >
                                                {medicationPreview.newItems.map((item, index) => (
                                                    <MedicationPreviewItem
                                                        key={item.sourceId}
                                                        item={item}
                                                        checked={selectedMedicationSourceIds.includes(item.sourceId)}
                                                        onPress={() => handleToggleMedicationSelection(item.sourceId)}
                                                        lastItem={index === medicationPreview.newItems.length - 1}
                                                        t={t}
                                                    />
                                                ))}
                                            </List.Section>
                                        )}

                                        {medicationPreview.existingItems.length > 0 && (
                                            <List.Section
                                                title={t('healthImport.medicationExistingSection', { count: medicationPreview.existingItems.length })}
                                                rounded
                                            >
                                                {medicationPreview.existingItems.map((item, index) => (
                                                    <MedicationPreviewItem
                                                        key={item.sourceId}
                                                        item={item}
                                                        lastItem={index === medicationPreview.existingItems.length - 1}
                                                        t={t}
                                                    />
                                                ))}
                                            </List.Section>
                                        )}

                                        {medicationPreview.ambiguousItems.length > 0 && (
                                            <List.Section
                                                title={t('healthImport.medicationUnclearSection', { count: medicationPreview.ambiguousItems.length })}
                                                rounded
                                            >
                                                {medicationPreview.ambiguousItems.map((item, index) => (
                                                    <MedicationPreviewItem
                                                        key={item.sourceId}
                                                        item={item}
                                                        subtitle={t('healthImport.medicationUnclearSubtitle')}
                                                        lastItem={index === medicationPreview.ambiguousItems.length - 1}
                                                        t={t}
                                                    />
                                                ))}
                                            </List.Section>
                                        )}

                                        {medicationPreview.archivedCount > 0 && (
                                            <List.Wrapper>
                                                <List.Text align="center">
                                                    {t('healthImport.medicationArchivedHint', { count: medicationPreview.archivedCount })}
                                                </List.Text>
                                            </List.Wrapper>
                                        )}

                                        <List.Section rounded>
                                            <View style={styles.actionButtons}>
                                                <Button
                                                    title={isImportingMedications ? t('healthImport.importingMedications') : t('healthImport.importSelectedMedications')}
                                                    onPress={handleImportSelectedMedications}
                                                    disabled={isImportingMedications || selectedMedicationSourceIds.length === 0}
                                                    loading={isImportingMedications}
                                                    fullWidth
                                                />
                                                <Button
                                                    title={t('healthImport.discardMedicationPreview')}
                                                    onPress={handleDiscardMedicationPreview}
                                                    disabled={isImportingMedications}
                                                    variant="secondary"
                                                    fullWidth
                                                />
                                            </View>
                                        </List.Section>
                                    </>
                                )}
                            </>
                        )}
                    </>
                )}
            </ScrollViewContent>
        </ScrollView>

        <Modal
            visible={healthImport.isSyncing}
            transparent
            animationType="fade"
            onRequestClose={healthImport.cancelSync}
        >
            <View style={styles.overlayBackdrop}>
                <View style={[styles.overlayCard, { backgroundColor: colors.card }]}>
                    <ActivityIndicator size="large" color={colors.brandColorMuted} />
                    <Text style={[styles.overlayTitle, { color: colors.text }]}>
                        {t('healthImport.importingTitle')}
                    </Text>
                    {syncProgressText.length > 0 && (
                        <Text style={[styles.overlayProgressText, { color: colors.placeholder }]}>
                            {syncProgressText}
                        </Text>
                    )}
                    <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
                        <View style={[styles.progressFill, { backgroundColor: colors.brandColorMuted, width: `${syncProgressPct}%` }]} />
                    </View>
                    <Button
                        title={t('common.cancel')}
                        onPress={healthImport.cancelSync}
                        variant="secondary"
                        fullWidth
                    />
                </View>
            </View>
        </Modal>
        </>
    );
}

function MedicationPreviewItem({
    item,
    checked,
    onPress,
    lastItem,
    subtitle,
    t,
}: {
    item: AppleHealthMedicationImportCandidate;
    checked?: boolean;
    onPress?: () => void;
    lastItem?: boolean;
    subtitle?: string;
    t: ReturnType<typeof useTranslation>['t'];
}) {
    return (
        <List.Item
            title={item.name}
            subtitle={subtitle ?? getMedicationPreviewSubtitle(item, t)}
            type={onPress ? 'checkbox' : undefined}
            checked={checked}
            onPress={onPress}
            hideChevron
            lastItem={lastItem}
        />
    );
}

function getMedicationPreviewSubtitle(
    item: AppleHealthMedicationImportCandidate,
    t: ReturnType<typeof useTranslation>['t']
): string {
    const scheduleText =
        item.schedule.type === 'daily' && item.schedule.times.length > 0
            ? t('healthImport.medicationScheduled', { times: item.schedule.times.join(', ') })
            : item.hasSchedule
                ? t('healthImport.medicationScheduleNeedsReview')
                : t('healthImport.medicationAsNeeded');
    return item.dosageText ? `${scheduleText} · ${item.dosageText}` : scheduleText;
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90,
    },
    actionButtons: {
        gap: 12,
    },
    overlayBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    overlayCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        gap: 16,
    },
    overlayTitle: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
    },
    overlayProgressText: {
        fontSize: 14,
        textAlign: 'center',
    },
    progressTrack: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
});
