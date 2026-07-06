import React from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CloseButton } from '@/src/components/ui/navigation/CloseButton';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import ManagedLinkFlow from '@/src/features/managed-link/ManagedLinkFlow';

export default function PatientsLinkScreen() {
    const { t } = useTranslation();
    const router = useSafeRouter();
    const { role } = useAppRole();
    const { expectedRole } = useLocalSearchParams<{ expectedRole?: string }>();
    const roleFromScope = role === 'doctor' ? 'doctor' : 'caregiver';
    const effectiveRole = expectedRole === 'doctor' ? 'doctor' : roleFromScope;

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: t('patientsAdd.linkExisting'),
                        headerRight: () => (
                            <CloseButton onPress={() => router.back()} />
                        ),
                    }}
                />
            ) : (
                <Stack.Toolbar placement="right">
                    <Stack.Toolbar.Button icon="xmark" variant="plain" onPress={() => router.back()} />
                </Stack.Toolbar>
            )}

            <ManagedLinkFlow context="settings" expectedRole={effectiveRole} />
        </>
    );
}
