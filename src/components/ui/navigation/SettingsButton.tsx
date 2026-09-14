/**
 * The one settings entry point in screen headers — a gear icon,
 * top right, navigating to /settings.
 *
 * A HOOK returning the element, not a component: on iOS the element
 * lives inside `Stack.Toolbar`, which validates child.type against
 * its known subcomponents and silently drops the whole toolbar when
 * a wrapper component sneaks in (same reason usePatientSwitcherToolbar
 * is a hook). Android embeds the element via `headerRight`.
 *
 * No icon fonts: iOS renders the native SF symbol through
 * Stack.Toolbar.Button, Android the same name from the SVG icon
 * registry through HeaderButton/AppIcon.
 */
import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';

const SETTINGS_ICON = 'gearshape.fill';

export function useSettingsButton(): React.ReactElement {
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const openSettings = () => router.push('/settings');

    if (Platform.OS === 'android') {
        return (
            <HeaderButton
                icon={SETTINGS_ICON}
                variant="prominent"
                tintColor={colors.textPrimary}
                onPress={openSettings}
            />
        );
    }
    return (
        <Stack.Toolbar.Button
            icon={SETTINGS_ICON as any}
            variant="prominent"
            tintColor={colors.textPrimary}
            onPress={openSettings}
        />
    );
}
