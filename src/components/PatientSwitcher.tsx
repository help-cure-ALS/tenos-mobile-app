/**
 * PatientSwitcher - Component for caregivers/doctors to switch between patients.
 *
 * Shows the current patient and allows switching to another managed patient.
 * Only visible when the user has multiple patients.
 */
import React, { useCallback, useState } from 'react';
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useAppTheme } from '@/src/theme';
import { useAppRole, usePatientDisplay } from '@/src/context/AppRoleProvider';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';

export type PatientSwitcherProps = {
    /** Compact mode shows just the avatar, full mode shows name too */
    compact?: boolean;
};

export function PatientSwitcher({ compact = false }: PatientSwitcherProps) {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const { activePatientId, patientIds, canSwitchPatient, selectActivePatient, role } = useAppRole();
    const { switchToPatient } = useAppSync();
    const [modalVisible, setModalVisible] = useState(false);
    const router = useSafeRouter();

    // Don't render if user can't switch patients
    if (!canSwitchPatient || !activePatientId) {
        return null;
    }

    const handleAddPatient = () => {
        setModalVisible(false);
        // Navigate to add patient flow
        router.push('/settings/patients/add');
    };

    // Only show add button for caregivers
    const canAddPatient = role === 'caregiver';

    return (
        <>
            <Pressable
                style={({ pressed }) => [
                    styles.trigger,
                    compact ? styles.triggerCompact : styles.triggerFull,
                    {
                        backgroundColor: colors.listItemBackground,
                        opacity: pressed ? 0.7 : 1,
                    },
                ]}
                onPress={() => setModalVisible(true)}
            >
                <PatientAvatar patientId={activePatientId} size={compact ? 28 : 32} />
                {!compact && (
                    <>
                        <PatientName patientId={activePatientId} />
                        <AppIcon
                            name="chevron.down"
                            tintColor={colors.textHint}
                            size={12}
                        />
                    </>
                )}
            </Pressable>

            <PatientSwitcherModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                patientIds={patientIds}
                activePatientId={activePatientId}
                onSelect={async (patientId) => {
                    setModalVisible(false);
                    try {
                        await switchToPatient(patientId, selectActivePatient);
                    } catch (e: any) {
                        Alert.alert(t('common.error'), e?.message ?? t('patients.switchError'));
                    }
                }}
                onAddPatient={canAddPatient ? handleAddPatient : undefined}
            />
        </>
    );
}

function PatientAvatar({ patientId, size = 32 }: { patientId: string; size?: number }) {
    const { colors } = useAppTheme();
    const { color, icon } = usePatientDisplay(patientId);

    return (
        <View
            style={[
                styles.avatar,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color + '20',
                },
            ]}
        >
            <AppIcon
                name={icon}
                tintColor={color}
                size={size * 0.5}
            />
        </View>
    );
}

function PatientName({ patientId }: { patientId: string }) {
    const { colors } = useAppTheme();
    const { displayName } = usePatientDisplay(patientId);

    return (
        <Text style={[styles.patientName, { color: colors.text }]} numberOfLines={1}>
            {displayName}
        </Text>
    );
}

type PatientSwitcherModalProps = {
    visible: boolean;
    onClose: () => void;
    patientIds: string[];
    activePatientId: string;
    onSelect: (patientId: string) => void;
    onAddPatient?: () => void;
};

function PatientSwitcherModal({
    visible,
    onClose,
    patientIds,
    activePatientId,
    onSelect,
    onAddPatient,
}: PatientSwitcherModalProps) {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.modalContainer, { backgroundColor: colors.modalBackground }]}>
                {/* Header */}
                <View style={[styles.modalHeader, { paddingTop: insets.top + 16 }]}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                        {t('patients.selectPatient')}
                    </Text>
                    <Pressable onPress={onClose} hitSlop={8}>
                        <AppIcon
                            name="xmark.circle.fill"
                            tintColor={colors.textHint}
                            size={28}
                        />
                    </Pressable>
                </View>

                {/* Patient List */}
                <ScrollView
                    contentContainerStyle={[
                        styles.modalContent,
                        { paddingBottom: insets.bottom + 20 },
                    ]}
                >
                    {patientIds.map((patientId) => (
                        <PatientListItem
                            key={patientId}
                            patientId={patientId}
                            isActive={patientId === activePatientId}
                            onPress={() => onSelect(patientId)}
                        />
                    ))}

                    {/* Add Patient Button */}
                    {onAddPatient && (
                        <>
                            <View style={[styles.divider, { backgroundColor: colors.listItemBackground }]} />
                            <Pressable
                                style={({ pressed }) => [
                                    styles.addPatientButton,
                                    {
                                        backgroundColor: colors.listItemBackground,
                                        opacity: pressed ? 0.7 : 1,
                                    },
                                ]}
                                onPress={onAddPatient}
                            >
                                <View style={[styles.addPatientIcon, { backgroundColor: colors.primary + '15' }]}>
                                    <AppIcon
                                        name="plus"
                                        tintColor={colors.primary}
                                        size={20}
                                    />
                                </View>
                                <Text style={[styles.addPatientText, { color: colors.primary }]}>
                                    {t('patients.addNew')}
                                </Text>
                            </Pressable>
                        </>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}

function PatientListItem({
    patientId,
    isActive,
    onPress,
}: {
    patientId: string;
    isActive: boolean;
    onPress: () => void;
}) {
    const { colors } = useAppTheme();
    const { displayName, color } = usePatientDisplay(patientId);

    return (
        <Pressable
            style={({ pressed }) => [
                styles.patientItem,
                {
                    backgroundColor: isActive
                        ? colors.primary + '15'
                        : colors.listItemBackground,
                    borderColor: isActive ? colors.primary : 'transparent',
                    opacity: pressed ? 0.7 : 1,
                },
            ]}
            onPress={onPress}
        >
            <PatientAvatar patientId={patientId} size={44} />
            <View style={styles.patientItemContent}>
                <Text style={[styles.patientItemName, { color: colors.text }]}>
                    {displayName}
                </Text>
                <Text style={[styles.patientItemId, { color: colors.textHint }]}>
                    ID: {patientId.slice(0, 8)}...
                </Text>
            </View>
            {isActive && (
                <AppIcon
                    name="checkmark.circle.fill"
                    tintColor={colors.primary}
                    size={24}
                />
            )}
        </Pressable>
    );
}

/**
 * Header component showing current patient for caregivers.
 * Can be used in navigation headers.
 */
export function PatientSwitcherHeader() {
    const { activePatientId, canSwitchPatient, role } = useAppRole();

    // Only show for caregivers/doctors with patients
    if (!activePatientId || (role !== 'caregiver' && role !== 'doctor')) {
        return null;
    }

    return (
        <View style={styles.headerContainer}>
            <PatientSwitcher compact={!canSwitchPatient} />
        </View>
    );
}

// =============================================================================
// Patient Switcher Menu Hook (legacy — prefer usePatientSwitcherToolbar)
// =============================================================================

/**
 * Menu item type for patient switcher.
 */
export type PatientSwitcherMenuItem = {
    type: 'action';
    label: string;
    icon?: { type: 'sfSymbol'; name: string };
    state?: 'on' | 'off';
    onPress: () => void;
};

/**
 * Menu type returned by usePatientSwitcherMenu.
 */
export type PatientSwitcherMenu = {
    type: 'menu';
    label: string;
    icon?: { type: 'sfSymbol'; name: string };
    tintColor?: string;
    menu: {
        items: PatientSwitcherMenuItem[];
    };
};

/**
 * Hook that returns a native menu object (legacy — prefer usePatientSwitcherToolbar).
 * Returns null if not a caregiver/doctor or no patients.
 */
export function usePatientSwitcherMenu(): PatientSwitcherMenu | null {
    const { t } = useTranslation();
    const {
        activePatientId,
        patientIds,
        selectActivePatient,
        role,
        getPatientAlias,
    } = useAppRole();
    const { switchToPatient } = useAppSync();

    // Only for caregivers/doctors with patients
    if (!activePatientId || (role !== 'caregiver' && role !== 'doctor')) {
        return null;
    }

    // Helper to get display info for a patient
    const getPatientDisplay = (patientId: string) => {
        const alias = getPatientAlias(patientId);
        return {
            displayName: alias?.localName ?? `${t('roleAwareText.defaultPatientName')} ${patientId.slice(0, 6)}`,
            color: alias?.color ?? '#888888',
            icon: alias?.icon ?? 'person.fill',
        };
    };

    const activePatient = getPatientDisplay(activePatientId);

    // Build menu items for each patient
    const menuItems: PatientSwitcherMenuItem[] = patientIds.map(patientId => {
        const patient = getPatientDisplay(patientId);
        const isActive = patientId === activePatientId;

        return {
            type: 'action',
            label: patient.displayName,
            icon: {
                type: 'sfSymbol',
                name: patient.icon,
            },
            state: isActive ? 'on' : 'off',
            onPress: () => {
                switchToPatient(patientId, selectActivePatient).catch((e) =>
                    Alert.alert(t('common.error'), e?.message ?? t('patients.switchError'))
                );
            },
        };
    });

    return {
        type: 'menu',
        label: activePatient.displayName,
        icon: {
            type: 'sfSymbol',
            name: activePatient.icon,
        },
        tintColor: activePatient.color,
        menu: {
            items: menuItems,
        },
    };
}

// =============================================================================
// Patient Switcher Toolbar Hook (for Stack.Toolbar)
// =============================================================================

/**
 * Hook that returns a Stack.Toolbar.Menu element for use inside Stack.Toolbar.
 * Returns null if not a caregiver/doctor or no active patient.
 *
 * Must be rendered directly as child of Stack.Toolbar (not wrapped in a component),
 * because Stack.Toolbar validates child.type against its known subcomponents.
 */
export function usePatientSwitcherToolbar(options?: { showName?: boolean }): React.ReactElement | null {
    const showName = options?.showName ?? false;
    const { t } = useTranslation();
    const {
        activePatientId,
        patientIds,
        selectActivePatient,
        role,
        getPatientAlias,
    } = useAppRole();
    const { switchToPatient } = useAppSync();

    if (!activePatientId || (role !== 'caregiver' && role !== 'doctor')) {
        return null;
    }

    const getPatientDisplay = (patientId: string) => {
        const alias = getPatientAlias(patientId);
        return {
            displayName: alias?.localName ?? `${t('roleAwareText.defaultPatientName')} ${patientId.slice(0, 6)}`,
            color: alias?.color ?? '#888888',
            icon: alias?.icon ?? 'person.fill',
        };
    };

    const activePatient = getPatientDisplay(activePatientId);

    const menuActions = patientIds.map(patientId => {
        const patient = getPatientDisplay(patientId);
        const isActive = patientId === activePatientId;
        return (
            <Stack.Toolbar.MenuAction
                key={patientId}
                icon={patient.icon as any}
                isOn={isActive}
                onPress={() => {
                    switchToPatient(patientId, selectActivePatient).catch((e) =>
                        Alert.alert(t('common.error'), e?.message ?? t('patients.switchError'))
                    );
                }}
            >
                {patient.displayName}
            </Stack.Toolbar.MenuAction>
        );
    });

    if (showName) {
        return (
            // <Stack.Toolbar.Menu tintColor={activePatient.color}>
            <Stack.Toolbar.Menu>
                <Stack.Toolbar.Icon sf={activePatient.icon as any} />
                <Stack.Toolbar.Label>{activePatient.displayName}</Stack.Toolbar.Label>
                {menuActions}
            </Stack.Toolbar.Menu>
        );
    }

    return (
        <Stack.Toolbar.Menu
            icon={activePatient.icon as any}
            tintColor={activePatient.color}
        >
            {menuActions}
        </Stack.Toolbar.Menu>
    );
}

const styles = StyleSheet.create({
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    triggerCompact: {
        padding: 4,
        borderRadius: 20,
    },
    triggerFull: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    avatar: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    patientName: {
        fontSize: 15,
        fontWeight: '500',
        maxWidth: 120,
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    modalContent: {
        paddingHorizontal: 20,
        gap: 12,
    },
    patientItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        gap: 12,
    },
    patientItemContent: {
        flex: 1,
    },
    patientItemName: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 2,
    },
    patientItemId: {
        fontSize: 13,
    },
    headerContainer: {
        marginRight: 8,
    },
    divider: {
        height: 1,
        marginVertical: 8,
    },
    addPatientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        gap: 12,
    },
    addPatientIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addPatientText: {
        fontSize: 17,
        fontWeight: '600',
    },
});
