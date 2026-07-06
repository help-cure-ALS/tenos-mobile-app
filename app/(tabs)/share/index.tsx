import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    ImageBackground,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import { Stack } from 'expo-router';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { Badge, Button, List, Space, Text } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { usePatientSwitcherToolbar } from "@/src/components/PatientSwitcher";
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { FeatureItem } from '@/src/components/ui/FeatureItem';
import { tokens } from "@/src/theme/tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScrollToTop, useFocusEffect } from "expo-router/react-navigation";
import type { DeviceAccessEntry } from '@/src/stores/deviceAccessStore';
import { useSupplierProposalCounts } from '@/src/hooks/useSupplierProposalCounts';
import { useActivePatientOwnerAccess } from '@/src/hooks/useActivePatientOwnerAccess';
import { on } from '@/src/lib/bus';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { isAssistiveAidsEnabledForRole } from '@/src/features/assistiveAidsFeature';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';

// =============================================================================
// Shared With Item Component
// =============================================================================

type SharedWithItemProps = {
    name: string;
    subtitle: string;
    role: 'doctor' | 'caregiver';
    onPress?: () => void;
};

function getRoleIcon(role: 'doctor' | 'caregiver') {
    return role === 'doctor' ? 'stethoscope' : 'person.2.fill';
}

function SharedWithItem({ name, subtitle, role, onPress }: SharedWithItemProps) {
    const { colors } = useAppTheme();

    return (
        <List.Item
            title={ name }
            subtitle={ subtitle }
            leftCmpSize={40}
            leftCmp={<ListItemIcon name={getRoleIcon(role)} color={colors.textPrimary} backgroundColor={colors.listItemBackgroundMuted} size="md" />}
            onPress={ onPress }
        />
    );
}

// =============================================================================
// Main Component
// =============================================================================

export default function Share() {
    const { t } = useTranslation();
    const { colors, isDark } = useAppTheme();
    const router = useSafeRouter();
    const { isDemo, role } = useAppRole();
    const { fullSync } = useAppSync();
    const { deviceAccessStore } = usePatientStores();
    const patientToolbarMenu = usePatientSwitcherToolbar({ showName: true });
    const insets = useSafeAreaInsets();

    const scrollRef = useRef<ScrollView>(null);
    const { supplierIntegrations, proposalCounts } = useSupplierProposalCounts();
    const [sharedWithDoctors, setSharedWithDoctors] = useState<DeviceAccessEntry[]>([]);
    const [sharedWithCaregivers, setSharedWithCaregivers] = useState<DeviceAccessEntry[]>([]);
    const { hasOwnerAccess, isLoaded: ownerAccessLoaded } = useActivePatientOwnerAccess();
    const canManageSharing = role === 'patient' || role === 'demo' || (role === 'caregiver' && ownerAccessLoaded && hasOwnerAccess);
    const assistiveAidsEnabled = isAssistiveAidsEnabledForRole(role);

    useScrollToTop(scrollRef);

    const loadSharedDevices = useCallback(async () => {
        if (!deviceAccessStore) {
            return;
        }
        const doctors = await deviceAccessStore.getEntriesByRole('doctor');
        const caregivers = await deviceAccessStore.getEntriesByRole('caregiver');
        setSharedWithDoctors(doctors);
        setSharedWithCaregivers(caregivers);

    }, [deviceAccessStore]);

    useEffect(() => {
        loadSharedDevices();
        const off = on('fhir:changed', loadSharedDevices);
        return off;
    }, [loadSharedDevices]);

    useFocusEffect(
        useCallback(() => {
            loadSharedDevices();
            fullSync('share focus').catch(console.error);
        }, [fullSync, loadSharedDevices])
    );

    const showDemoAlert = useCallback(() => {
        Alert.alert(t('common.demoModeTitle'), t('common.demoModeMessage'), [{ text: t('common.ok') }]);
    }, [t]);

    const handleShareWithDoctor = () => {
        if (!canManageSharing) return;
        if (isDemo) {
            showDemoAlert();
            return;
        }
        router.push('/(tabs)/share/addDoctor');
    };

    const handleShareWithCaregiver = () => {
        if (!canManageSharing) return;
        if (isDemo) {
            showDemoAlert();
            return;
        }
        router.push('/(tabs)/share/addCaregiver');
    };

    const handleLinkSupplier = () => {
        if (!assistiveAidsEnabled) return;
        if (!canManageSharing) return;
        if (isDemo) {
            showDemoAlert();
            return;
        }
        router.push('/(tabs)/share/supplierLink');
    };

    const handleSettings = useCallback(() => {
        router.push('/settings');
    }, [router]);

    return (
        <>
            {
                Platform.OS === 'android' ? (
                    <Stack.Screen
                        options={ {
                            headerTitle: t('share.title'),
                            headerLargeTitle: false,
                            headerRight: () => (
                                <HeaderButton
                                    icon="figure.boxing"
                                    variant="prominent"
                                    tintColor={ colors.textPrimary }
                                    onPress={ handleSettings }
                                />
                            )
                        } }
                    />
                ) : (
                    <>
                        <Stack.Screen
                            options={ {
                                headerTitle: t('share.title'),
                                headerLargeTitle: false
                            } }
                        />
                        <Stack.Toolbar placement="right">
                            { patientToolbarMenu }
                            <Stack.Toolbar.Button
                                icon="figure.boxing"
                                variant="prominent"
                                tintColor={ colors.textPrimary }
                                onPress={ handleSettings }
                            />
                        </Stack.Toolbar>
                    </>
                )
            }
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') } style={ [{ flex: 1 }, { backgroundColor: colors.background }] }>
                <ScrollView
                    ref={ scrollRef }
                    style={{ flex: 1 }}
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
                        <ScreenHeader
                            icon="figure.2.arms.open"
                            iconTintColor={ colors.brandColorMuted }
                            title={ t('share.heroTitle') }
                        />

                        <Space size="xl" />

                        <List.Wrapper>
                            <View style={ styles.featuresContainer }>
                                <FeatureItem
                                    icon="figure.stand.line.dotted.figure.stand"
                                    iconColor={ colors.textPrimary }
                                    variant="fill"
                                    title={ t('share.featureControlTitle') }
                                    description={ t('share.featureControlDesc') }
                                />
                                <FeatureItem
                                    icon="lock.shield.fill"
                                    iconColor={ colors.textPrimary }
                                    variant="fill"
                                    title={ t('share.featureSecureTitle') }
                                    description={ t('share.featureSecureDesc') }
                                />
                            </View>
                            { canManageSharing && (
                                <>
                                    <Button
                                        title={ t('share.shareWithDoctor') }
                                        onPress={ handleShareWithDoctor }
                                        rounded
                                    />
                                    <Space />
                                    <Button
                                        title={ t('share.shareWithCaregiver') }
                                        onPress={ handleShareWithCaregiver }
                                        variant="secondary"
                                        rounded
                                    />
                                    <Space />
                                </>
                            ) }
                            <Button
                                title={ t('share.exportData') }
                                onPress={ () => router.push('/(tabs)/share/export') }
                                variant="secondary"
                                rounded
                            />
                        </List.Wrapper>

                        <Space size="xl" />

                        {/* Doctors Section */ }
                        <List.Section
                            title={ t('share.doctorsSection') }
                            rounded
                            rightCmp={ canManageSharing ? (
                                <Pressable
                                    onPress={ () => router.push({
                                        pathname: '/(tabs)/share/sharingSettings',
                                        params: {
                                            role: 'doctor',
                                            name: sharedWithDoctors[0]?.name ?? '',
                                            deviceId: sharedWithDoctors[0]?.device_id ?? ''
                                        }
                                    }) }
                                    hitSlop={ 8 }
                                >
                                    <Text style={ [styles.permissionsLink, { color: colors.tint }] }>
                                        { t('share.permissions') }
                                    </Text>
                                </Pressable>
                            ) : undefined }
                        >
                            { sharedWithDoctors.length > 0 ? (
                                sharedWithDoctors.map((entry) => (
                                    <SharedWithItem
                                        key={ entry.device_id }
                                        name={ entry.name }
                                        role="doctor"
                                        subtitle={ t('share.sharedSince', {
                                            date: new Date(entry.addedAt).toLocaleDateString()
                                        }) }
                                        onPress={ canManageSharing
                                            ? () => router.push({
                                                pathname: '/(tabs)/share/accessLog',
                                                params: { role: 'doctor', name: entry.name, deviceId: entry.device_id }
                                            })
                                            : undefined }
                                    />
                                ))
                            ) : (
                                <List.Item
                                    title={ t('share.noSharesYet') }
                                    subtitle={ t('share.noSharesDesc') }
                                    subtitleNumberOfLines={ 2 }
                                    hideChevron
                                />
                            ) }
                        </List.Section>

                        {/* Caregivers Section */ }
                        <List.Section
                            title={ t('share.caregiversSection') }
                            rounded
                            rightCmp={ canManageSharing ? (
                                <Pressable
                                    onPress={ () => router.push({
                                        pathname: '/(tabs)/share/sharingSettings',
                                        params: {
                                            role: 'caregiver',
                                            name: sharedWithCaregivers[0]?.name ?? '',
                                            deviceId: sharedWithCaregivers[0]?.device_id ?? ''
                                        }
                                    }) }
                                    hitSlop={ 8 }
                                >
                                    <Text style={ [styles.permissionsLink, { color: colors.tint }] }>
                                        { t('share.permissions') }
                                    </Text>
                                </Pressable>
                            ) : undefined }
                        >
                            { sharedWithCaregivers.length > 0 ? (
                                sharedWithCaregivers.map((entry) => (
                                    <SharedWithItem
                                        key={ entry.device_id }
                                        name={ entry.name }
                                        role="caregiver"
                                        subtitle={ t('share.sharedSince', {
                                            date: new Date(entry.addedAt).toLocaleDateString()
                                        }) }
                                        onPress={ canManageSharing
                                            ? () => router.push({
                                                pathname: '/(tabs)/share/accessLog',
                                                params: {
                                                    role: 'caregiver',
                                                    name: entry.name,
                                                    deviceId: entry.device_id
                                                }
                                            })
                                            : undefined }
                                    />
                                ))
                            ) : (
                                <List.Item
                                    title={ t('share.noCaregivers') }
                                    subtitle={ t('share.noCaregiversDesc') }
                                    subtitleNumberOfLines={ 2 }
                                    hideChevron
                                />
                            ) }
                        </List.Section>

                        {/* Research Section */ }
                        <List.Section
                            title={ t('share.researchSection') }
                            rounded
                        >
                            <List.Item
                                title={ t('share.researchTitle') }
                                subtitle={ t('share.researchDesc') }
                                subtitleNumberOfLines={ 3 }
                                leftCmpSize={40}
                                leftCmp={<ListItemIcon name="waveform.path.ecg.rectangle" color={colors.textPrimary} backgroundColor={colors.listItemBackgroundMuted} size="md" />}
                                onPress={ canManageSharing
                                    ? () => router.push({
                                        pathname: '/(tabs)/share/sharingSettings',
                                        params: { role: 'research' }
                                    })
                                    : undefined }
                            />
                        </List.Section>

                        { assistiveAidsEnabled && (
                            <List.Section
                                title={ t('supplier.sectionTitle') }
                                rounded
                                rightCmp={ canManageSharing ? (
                                    <Pressable onPress={ handleLinkSupplier } hitSlop={ 8 }>
                                        <Text style={ [styles.permissionsLink, { color: colors.tint }] }>
                                            { t('supplier.add') }
                                        </Text>
                                    </Pressable>
                                ) : undefined }
                            >
                                { supplierIntegrations.length > 0 ? (
                                    supplierIntegrations.map((integration) => (
                                        <List.Item
                                            key={ integration.id }
                                            title={ integration.organizationName }
                                            subtitle={ integration.active ? t('supplier.statusActive') : t('supplier.statusPaused') }
                                            leftCmpSize={40}
                                            leftCmp={<ListItemIcon name="cross.case.fill" color={colors.textPrimary} backgroundColor={colors.listItemBackgroundMuted} size="md" />}
                                            rightCmp={(proposalCounts[integration.id] ?? 0) > 0 ? (
                                                <Badge label={String(proposalCounts[integration.id])} variant="error" />
                                            ) : undefined}
                                            onPress={ () => router.push({
                                                pathname: '/(tabs)/share/supplierManage',
                                                params: { integrationId: integration.id }
                                            }) }
                                        />
                                    ))
                                ) : (
                                    <List.Item
                                        title={ t('supplier.noIntegrations') }
                                        subtitle={ t('supplier.noIntegrationsDesc') }
                                        subtitleNumberOfLines={ 2 }
                                        hideChevron
                                        lastItem
                                    />
                                ) }
                            </List.Section>
                        ) }

                    </View>
                </ScrollView>
            </ImageBackground>
        </>
    );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    image: {
        flex: 1
    },
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        paddingTop: 20,
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    container: {
        flex: 1
    },
    content: {
        paddingBottom: 40
    },
    featuresContainer: {
        gap: 20,
        marginBottom: 24
    },
    ctaContainer: {
        paddingHorizontal: 20,
        marginBottom: 32
    },
    permissionsLink: {
        fontWeight: '500'
    },
});
