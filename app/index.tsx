import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useAppTheme } from '@/src/theme';

/**
 * Root index - handles initial routing based on app role state
 */
export default function RootIndex() {
    const { scope, isLoading } = useAppRole();
    const { colors } = useAppTheme();

    // Show loading spinner while checking persisted scope
    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
            </View>
        );
    }

    // If no scope is set, redirect to onboarding
    if (!scope) {
        return <Redirect href="/onboarding" />;
    }

    // If scope is set, redirect to main app
    return <Redirect href="/(tabs)/(metric)" />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
