import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { HeaderBackButton } from "expo-router/react-navigation";
import { useAppTheme } from "@/src/theme";

export default function ManagedLayout() {
    const router = useRouter();
    const { colors } = useAppTheme();
    return (
        <Stack screenOptions={{
            headerBackButtonDisplayMode: 'minimal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            gestureEnabled: true,
            animation: 'fade',
        }}>
            <Stack.Screen
                name="setup"
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
                name="createPatient"
                options={{
                    title: '',
                }}
            />
            <Stack.Screen
                name="mnemonic"
                options={{
                    title: '',
                }}
            />
            <Stack.Screen
                name="sharing"
                options={{
                    title: '',
                    headerBackVisible: false,
                    gestureEnabled: false,
                }}
            />
            <Stack.Screen
                name="link"
                options={{
                    title: '',
                }}
            />
        </Stack>
    );
}
