import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuthLock } from '@/src/context/AuthLockProvider';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { LockScreen } from './LockScreen';

type AuthGateProps = {
    children: React.ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
    const { isLocked, isLoading: isAuthLoading } = useAuthLock();
    const { role, isLoading: isRoleLoading } = useAppRole();

    const isLoading = isAuthLoading || isRoleLoading;

    // Only show lock screen if user has completed onboarding (has a role)
    // and the app is locked
    const shouldShowLockScreen = !isLoading && role !== null && isLocked;

    // Always render children to keep the navigator intact
    // Show lock screen as overlay when needed
    return (
        <View style={styles.container}>
            {children}
            {shouldShowLockScreen && (
                <View style={styles.overlay}>
                    <LockScreen />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFill,
        zIndex: 1000,
    },
});
