import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { LoadingOverlay } from '@/src/context/LoadingOverlayProvider';

export default function OnboardingLayout() {
    return (
        <>
        <Stack screenOptions={{
            headerBackButtonDisplayMode: 'minimal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            gestureEnabled: true,
            animation: 'fade',
        }}>
            <Stack.Screen
                name="index"
                options={{
                    title: '',
                }}
            />
            <Stack.Screen
                name="roleSelect"
                options={{
                    title: '',
                }}
            />
            <Stack.Screen
                name="patient"
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="managed"
                options={{
                    headerShown: false,
                }}
            />
        </Stack>
        <LoadingOverlay />
        </>
    );
}
