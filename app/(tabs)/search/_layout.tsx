import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

function getIOSVersion(): number {
    if (Platform.OS !== 'ios') return 0;
    return parseInt(Platform.Version as string, 10);
}

function isIOS26OrLater(): boolean {
    return getIOSVersion() >= 26;
}

export default function SearchStackLayout() {
    const { t } = useTranslation();

    return (
        <Stack screenOptions={{
            headerBackButtonDisplayMode: 'minimal',

        }}>
            <Stack.Screen
                name="index"
                options={{
                    title: t('navigation.search'),
                    headerLargeTitle: false,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                }}
            />
            <Stack.Screen
                name="category/[categoryId]"
                options={{
                    headerLargeTitle: false,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                }}
            />
            <Stack.Screen
                name="[metricId]/index"
                options={{
                    fullScreenGestureEnabled: false,
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="[metricId]/add"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerTitle: '',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="[metricId]/unit"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="[metricId]/list"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="[metricId]/access"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="[metricId]/detail/[entryId]"
                options={{
                    presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    sheetCornerRadius: 24,
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
        </Stack>
    );
}
