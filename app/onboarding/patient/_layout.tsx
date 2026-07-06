import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LoadingOverlay } from '@/src/context/LoadingOverlayProvider';
import { HeaderBackButton } from "expo-router/react-navigation";
import { useAppTheme } from "@/src/theme";

export default function PatientLayout() {
    const router = useRouter();
    const { colors } = useAppTheme();

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
                    headerLeft: () => (
                        <HeaderBackButton
                            displayMode="default"
                            tintColor={ colors.textPrimary }
                            onPress={() => router.back()}
                        />
                    ),
                }}
            />
            <Stack.Screen
                name="mnemonic"
                options={{
                    title: '',
                }}
            />
            <Stack.Screen
                name="create"
                options={{
                    title: '',
                }}
            />
            <Stack.Screen
                name="scan"
                options={{
                    title: '',
                }}
            />
            <Stack.Screen
                name="restore"
                options={{
                    title: '',
                }}
            />
            <Stack.Screen
                name="health"
                options={{
                    title: '',
                }}
            />
            <Stack.Screen
                name="sharing"
                options={{
                    title: '',
                }}
            />
            <Stack.Screen
                name="nickname"
                options={{
                    title: '',
                    headerBackVisible: false,
                }}
            />
        </Stack>
        <LoadingOverlay />
        </>
    );
}
