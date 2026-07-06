/**
 * Patient Management Screen - For caregivers to manage their patients.
 *
 * Shows all managed patients with options to edit aliases, add new patients,
 * and remove patients.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { useAppTheme } from '@/src/theme';
import { useAppRole, usePatientDisplay } from '@/src/context/AppRoleProvider';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { createExpoSecureStore, createKeybag } from '@/src/lib/medical-sync-vault';
import { getOrCreateStableDeviceId } from '@/src/lib/medical-sync-vault/deviceId';
import { getManagedPatientsStore, type ManagedPatient } from '@/src/stores/managedPatientsStore';
import { createDeviceAccessStore } from '@/src/stores/deviceAccessStore';
import { clearPatientLocalData } from '@/src/utils/clearPatientLocalData';
import { useLoadingOverlay } from '@/src/context/LoadingOverlayProvider';
import { Badge, Button, List, Space } from 'react-native-nice-ui';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useTranslation } from 'react-i18next';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { fmtDate } from '@/src/lib/formatDate';
import { getCaregiverDoctorName } from '@/src/utils/caregiverDoctorName';
import { getDeviceDisplayName, getDeviceInfo } from '@/src/utils/deviceInfo';

export default function PatientsScreen() {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const { role, patientIds, activePatientId, selectActivePatient, removePatient, getPatientAlias, reset: resetRole } = useAppRole();
    const { switchToPatient, deleteAccountOnServer, clearVaultIdentity, ensureDataSynced, probePatientAccess } = useAppSync();
    const router = useSafeRouter();
    const [managedPatients, setManagedPatients] = useState<ManagedPatient[]>([]);
    const [relinkNotice, setRelinkNotice] = useState<string | null>(null);
    // Neutral hint for patients linked under a DIFFERENT role (not an error → kept separate
    // from the red relinkNotice so a role mismatch is never shown as "re-link").
    const [otherRoleNotice, setOtherRoleNotice] = useState<string | null>(null);
    const [isSwitching, setIsSwitching] = useState(false);
    // T-002: a background patient who revoked this device is removed entirely (a revoked grant is
    // dead — keeping it around corrupts a later re-link). This notice explains the auto-removal.
    const [removedNotice, setRemovedNotice] = useState<string | null>(null);
    const handledRevokedRef = useRef<Set<string>>(new Set());
    const { showLoading, hideLoading } = useLoadingOverlay();

    const managedPatientsStore = getManagedPatientsStore();
    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);
    const visiblePatientIds = useMemo(() => managedPatients.map((patient) => patient.patientId), [managedPatients]);
    const visiblePatientCount = visiblePatientIds.length;

    // Load managed patients
    useEffect(() => {
        loadManagedPatients();
    }, [patientIds, role]);

    // T-002: fully tear down a revoked (background) patient locally — without touching the active
    // identity. Mirrors the active-patient path (handleDeviceRevoked) so both behave the same.
    const teardownRevoked = useCallback(async (patientId: string): Promise<string> => {
        const name = getPatientAlias(patientId)?.localName ?? patientId.slice(0, 8);
        await clearPatientLocalData(patientId).catch(() => {});
        await managedPatientsStore.remove(patientId).catch(() => {});
        await removePatient(patientId).catch(() => {}); // background patient is never the last → safe
        return name;
    }, [getPatientAlias, managedPatientsStore, removePatient]);

    // T-002: proactively probe each background patient on open. If the patient revoked this
    // device, remove it entirely (a dead grant left behind corrupts a later re-link). The active
    // patient is already covered by live sync, so we skip it here.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const targets = managedPatients.filter(
                (p) => p.patientId !== activePatientId && !handledRevokedRef.current.has(p.patientId)
            );
            if (targets.length === 0) return;
            const results = await Promise.all(
                targets.map(async (p) => [p.patientId, await probePatientAccess(p.patientId)] as const)
            );
            if (cancelled) return;
            const revoked = results.filter(([, status]) => status === 'revoked').map(([id]) => id);
            if (revoked.length === 0) return;
            revoked.forEach((id) => handledRevokedRef.current.add(id));
            const names: string[] = [];
            for (const id of revoked) {
                names.push(await teardownRevoked(id));
            }
            if (cancelled) return;
            setRemovedNotice(t('patients.autoRemovedNotice', { names: names.join(', ') }));
            await loadManagedPatients();
        })();
        return () => { cancelled = true; };
    }, [managedPatients, activePatientId, probePatientAccess, teardownRevoked, t]);

    const loadManagedPatients = async () => {
        const patients = await managedPatientsStore.getAll();
        const deviceId = await getOrCreateStableDeviceId(store, K);

        if (deviceId && (role === 'doctor' || role === 'caregiver')) {
            const storedName = role === 'caregiver' ? await getCaregiverDoctorName('caregiver') : null;
            const results = await Promise.all(
                patients.map(async (p) => {
                    const accessStore = createDeviceAccessStore(p.patientId);
                    let entry = await accessStore.getEntry(deviceId);

                    if (!entry && role === 'caregiver' && p.source === 'created') {
                        const info = getDeviceInfo();
                        await accessStore.addEntry({
                            device_id: deviceId,
                            role: 'owner',
                            name: storedName ?? getDeviceDisplayName(),
                            addedByDeviceId: deviceId,
                            ...info,
                            lastSeenAt: new Date().toISOString(),
                        });
                        entry = await accessStore.getEntry(deviceId);
                    }

                    const visible = role === 'caregiver'
                        ? entry?.role === 'owner' || entry?.role === 'caregiver'
                        : entry?.role === 'doctor';

                    if (visible) {
                        return { patient: p, kind: 'visible' as const };
                    }
                    if (p.source !== 'linked') {
                        return { patient: null, kind: 'hidden' as const };
                    }
                    // Non-visible LINKED: a complete identity under a DIFFERENT role is not an
                    // error (just not part of the current role); only a genuinely incomplete
                    // identity warrants the "re-link" notice.
                    const hasIdentity = await managedPatientsStore.hasFullIdentity(p.patientId);
                    if (entry && hasIdentity) {
                        return { patient: null, kind: 'otherRole' as const };
                    }
                    return { patient: null, kind: 'incomplete' as const };
                })
            );
            const visiblePatients = results
                .map((result) => result.patient)
                .filter((p): p is ManagedPatient => p !== null);
            const orderedVisiblePatients = patientIds
                .map((patientId) => visiblePatients.find((patient) => patient.patientId === patientId) ?? null)
                .filter((patient): patient is ManagedPatient => patient !== null);

            setManagedPatients(orderedVisiblePatients);
            const hasIncomplete = results.some((result) => result.kind === 'incomplete');
            const hasOtherRole = results.some((result) => result.kind === 'otherRole');
            setRelinkNotice(hasIncomplete ? t('onboarding.managedSetup.missingPatientIdentity') : null);
            setOtherRoleNotice(!hasIncomplete && hasOtherRole
                ? t(role === 'caregiver'
                    ? 'onboarding.managedSetup.otherRoleHintDoctor'
                    : 'onboarding.managedSetup.otherRoleHintCaregiver')
                : null);
        } else {
            setManagedPatients(patients);
            setRelinkNotice(null);
            setOtherRoleNotice(null);
        }
    };

    const handleSelectPatient = useCallback(async (patientId: string) => {
        if (patientId === activePatientId || isSwitching) return;

        setIsSwitching(true);
        try {
            // T-002: re-check access right before switching. If the patient revoked this device
            // (possibly since the screen opened), remove it instead of switching into a dead
            // identity and getting routed to the start screen.
            const status = await probePatientAccess(patientId);
            if (status === 'revoked') {
                handledRevokedRef.current.add(patientId);
                const name = await teardownRevoked(patientId);
                setRemovedNotice(t('patients.autoRemovedNotice', { names: name }));
                await loadManagedPatients();
                return;
            }
            await switchToPatient(patientId, selectActivePatient);
        }
        catch (e: any) {
            if (e?.code === 'device_disabled') {
                handledRevokedRef.current.add(patientId);
                const name = await teardownRevoked(patientId);
                setRemovedNotice(t('patients.autoRemovedNotice', { names: name }));
                await loadManagedPatients();
                return;
            }
            console.error('handleSelectPatient failed:', e);
            Alert.alert(t('common.error'), e?.message ?? t('patients.switchError'));
        }
        finally {
            setIsSwitching(false);
        }
    }, [activePatientId, isSwitching, switchToPatient, selectActivePatient, probePatientAccess, teardownRevoked, loadManagedPatients, t]);

    const ensureCurrentPatientCanBeChanged = useCallback(async () => {
        const isSafe = await ensureDataSynced();
        if (!isSafe) {
            Alert.alert(t('patients.dataNotSynced'), t('patients.dataNotSyncedMessage'));
            return false;
        }
        return true;
    }, [ensureDataSynced, t]);

    const handleRemovePatient = useCallback(async (patientId: string, displayName: string) => {
        const remainingPatientIds = patientIds.filter((id) => id !== patientId);
        const isLastPatient = remainingPatientIds.length === 0;
        const replacementPatientId = remainingPatientIds[0] ?? null;

        Alert.alert(
            t('patients.remove'),
            isLastPatient
                ? t('patients.removeLastMessage', { name: displayName })
                : t('patients.removeMessage', { name: displayName }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.remove'),
                    style: 'destructive',
                    onPress: async () => {
                        showLoading();
                        try {
                            if (isLastPatient) {
                                const isSafe = await ensureCurrentPatientCanBeChanged();
                                if (!isSafe) return;

                                await clearPatientLocalData(patientId);
                                await managedPatientsStore.remove(patientId);
                                await clearVaultIdentity();
                                await resetRole(false);
                                router.replace('/onboarding');
                                return;
                            }

                            if (patientId === activePatientId && replacementPatientId) {
                                const isSafe = await ensureCurrentPatientCanBeChanged();
                                if (!isSafe) return;

                                await switchToPatient(replacementPatientId, selectActivePatient);
                            }

                            await clearPatientLocalData(patientId);
                            await managedPatientsStore.remove(patientId);
                            await removePatient(patientId);
                            await loadManagedPatients();
                        }
                        catch (e: any) {
                            Alert.alert(t('common.error'), e?.message ?? t('patients.removeError'));
                        } finally {
                            hideLoading();
                        }
                    }
                }
            ]
        );
    }, [
        activePatientId,
        clearVaultIdentity,
        ensureCurrentPatientCanBeChanged,
        hideLoading,
        loadManagedPatients,
        managedPatientsStore,
        patientIds,
        removePatient,
        resetRole,
        router,
        selectActivePatient,
        showLoading,
        switchToPatient,
        t,
    ]);

    const handleDeletePatientAccount = useCallback(async (patientId: string, displayName: string) => {
        const remainingPatientIds = patientIds.filter((id) => id !== patientId);
        const replacementPatientId = remainingPatientIds[0] ?? null;
        const isLastPatient = remainingPatientIds.length === 0;

        Alert.alert(
            t('patients.deleteAccountTitle', { name: displayName }),
            t('patients.deleteAccountMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        showLoading();
                        try {
                            if (patientId !== activePatientId) {
                                await switchToPatient(patientId, selectActivePatient);
                            }

                            const isSafe = await ensureCurrentPatientCanBeChanged();
                            if (!isSafe) return;

                            await deleteAccountOnServer();

                            if (isLastPatient) {
                                await clearPatientLocalData(patientId);
                                await managedPatientsStore.remove(patientId);
                                await clearVaultIdentity();
                                await resetRole(false);
                                router.replace('/onboarding');
                                return;
                            }

                            if (!replacementPatientId) {
                                throw new Error('No replacement patient available');
                            }

                            await switchToPatient(replacementPatientId, selectActivePatient);
                            await clearPatientLocalData(patientId);
                            await managedPatientsStore.remove(patientId);
                            await removePatient(patientId);
                            await loadManagedPatients();
                        } catch (e: any) {
                            Alert.alert(t('common.error'), e?.message);
                        } finally {
                            hideLoading();
                        }
                    },
                },
            ]
        );
    }, [
        activePatientId,
        clearVaultIdentity,
        deleteAccountOnServer,
        ensureCurrentPatientCanBeChanged,
        hideLoading,
        loadManagedPatients,
        managedPatientsStore,
        patientIds,
        removePatient,
        resetRole,
        router,
        selectActivePatient,
        showLoading,
        switchToPatient,
        t,
    ]);

    // Only show for caregivers
    if (role !== 'caregiver' && role !== 'doctor') {
        return (
            <View style={ [styles.container, { backgroundColor: colors.modalBackground }] }>
                <View style={ styles.emptyState }>
                    <AppIcon
                        name="person.2.slash"
                        tintColor={ colors.textHint }
                        size={ 48 }
                    />
                    <Text style={ [styles.emptyTitle, { color: colors.text }] }>
                        { t('patients.notAvailable') }
                    </Text>
                    <Text style={ [styles.emptyDescription, { color: colors.textSecondary }] }>
                        { t('patients.caregiverOnly') }
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <ScrollView
            style={ [styles.scrollView, { backgroundColor: colors.modalBackground }] }
            contentContainerStyle={ styles.scrollContent }
            contentInsetAdjustmentBehavior="automatic"
        >
            <ScrollViewContent>
                <ScreenHeader
                    icon="figure.strengthtraining.traditional"
                    iconTintColor={ colors.brandColorMuted }
                    title={ t('patients.title') }
                    subtitle={ t(visiblePatientCount === 1 ? 'patients.subtitle' : 'patients.subtitle_plural', { count: visiblePatientCount }) + ' ' + t('patients.tapToEdit') }
                />

                { relinkNotice && (
                    <List.Wrapper>
                        <Text style={{ color: '#FF3B30', textAlign: 'center' }}>
                            { relinkNotice }
                        </Text>
                    </List.Wrapper>
                ) }

                { removedNotice && (
                    <List.Wrapper>
                        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                            { removedNotice }
                        </Text>
                    </List.Wrapper>
                ) }

                { otherRoleNotice && (
                    <List.Wrapper>
                        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                            { otherRoleNotice }
                        </Text>
                    </List.Wrapper>
                ) }

                {/* Patient List */ }
                <List.Section rounded>
                    { managedPatients.map((managedPatient, index) => {
                        const patientId = managedPatient.patientId;
                        return (
                            <PatientCard
                                key={ patientId }
                                patientId={ patientId }
                                isActive={ patientId === activePatientId }
                                source={ managedPatient?.source }
                                addedAt={ managedPatient?.addedAt }
                                isLast={ index === managedPatients.length - 1 }
                                onPress={ () => router.push(`/settings/patients/edit?patientId=${ patientId }`) }
                                onSelect={ () => handleSelectPatient(patientId) }
                                isSwitching={ isSwitching }
                                onRemove={ (displayName) => handleRemovePatient(patientId, displayName) }
                                onDeleteAccount={ (displayName) => handleDeletePatientAccount(patientId, displayName) }
                            />
                        );
                    }) }
                </List.Section>

                <Space size="lg" />

                <List.Wrapper>
                    {/* Add Patient Button */ }
                    <Button
                        title={ t('patients.addNew') }
                        leftIcon={
                            <AppIcon
                                name="plus"
                                tintColor="white"
                                size={ 18 }
                            />
                        }
                        onPress={ () => router.push('/settings/patients/add') }
                        rounded
                    />
                </List.Wrapper>
            </ScrollViewContent>
        </ScrollView>
    );
}

function PatientCard({
                         patientId,
                         isActive,
                         source,
                         addedAt,
                         onPress,
                         isLast,
                         onSelect,
                         onRemove,
                         onDeleteAccount,
                         isSwitching
                     }: {
    patientId: string;
    isActive: boolean;
    source?: 'created' | 'linked';
    addedAt?: string;
    isLast: boolean;
    onPress: () => void;
    onSelect: () => void;
    onRemove: (displayName: string) => void;
    onDeleteAccount: (displayName: string) => void;
    isSwitching: boolean;
}) {
    const { t, i18n } = useTranslation();
    const { displayName, color, icon } = usePatientDisplay(patientId);

    const sourceLabel = source === 'linked' ? t('patients.sourceLinked') : t('patients.sourceCreated');
    const addedDate = addedAt ? fmtDate(new Date(addedAt), i18n.language === 'de') : '';

    return (
        <List.Item
            title={ displayName }
            subtitle={ sourceLabel + ' • ' + addedDate }
            // subtitle={ sourceLabel + ' • ' + addedDate + ' • ' + patientId.slice(0, 8) }
            onPress={ onPress }
            leftCmpSize={56}
            leftCmp={
                <ListItemIcon name={icon} color={color} size="lg" />
            }
            badge={ isActive ? <Badge label={ t('patients.active') } variant="success" size="small" /> : undefined }
            badgePosition="top-right"
            childrenStyle={ styles.childrenRow }
        >
            { source === 'created' && (
                <Button
                    title={ t('patients.deleteAccount') }
                    variant="destructive"
                    size="small"
                    onPress={ () => onDeleteAccount(displayName) }
                />
            )}
            <Button
                title={ t('common.remove') }
                variant="destructive"
                size="small"
                onPress={ () => onRemove(displayName) }
            />
            { !isActive && (
                <Button
                    title={ t('patients.activate') }
                    variant="outline"
                    size="small"
                    onPress={ onSelect }
                    disabled={ isSwitching }
                    loading={ isSwitching }
                />
            ) }
        </List.Item>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 20,
        maxWidth: 620,
        marginHorizontal: 'auto',
        width: '100%'
    },
    scrollView: {
        flex: 1
    },
    scrollContent: {
        paddingBottom: Platform.OS === 'ios' ? 100 : 40
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20
    },
    headerDescription: {
        fontSize: 15,
        lineHeight: 22
    },
    patientList: {
        marginHorizontal: 16,
        borderRadius: 12,
        overflow: 'hidden'
    },
    patientCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12
    },
    cardContent: {
        flex: 1
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4
    },
    patientName: {
        fontSize: 17,
        fontWeight: '600',
        flexShrink: 1
    },
    childrenRow: {
        flexDirection: 'row',
        gap: 8,
        paddingBottom: 8,
        paddingLeft: 62
    },
    patientMeta: {
        fontSize: 13
    },
    addButtonContainer: {
        paddingHorizontal: 20,
        paddingTop: 24
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8
    },
    emptyDescription: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24
    }
});
