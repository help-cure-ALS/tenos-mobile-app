/**
 * Nested stack for the research project flow. The root stack presents
 * this route as one modal (like app/settings), so it can be opened from
 * anywhere — share tab, metric access screen — without switching tabs.
 * Inside, the screens (detail → clinic → code, data, privacy) push as
 * regular cards with native swipe-back.
 */
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

function isIOS26OrLater(): boolean {
    if (Platform.OS !== 'ios') {
        return false;
    }
    return parseInt(Platform.Version as string, 10) >= 26;
}

export default function ResearchProjectStackLayout() {
    const screenOptions = {
        headerShown: true,
        headerTransparent: Platform.OS === 'ios',
        headerTitle: '',
        headerBlurEffect: isIOS26OrLater() ? undefined : ('regular' as const),
    };

    return (
        <Stack screenOptions={ { headerBackButtonDisplayMode: 'minimal' } }>
            <Stack.Screen name="index" options={screenOptions} />
            <Stack.Screen name="clinic" options={screenOptions} />
            <Stack.Screen name="code" options={screenOptions} />
            <Stack.Screen name="data" options={screenOptions} />
            <Stack.Screen name="privacy" options={screenOptions} />
        </Stack>
    );
}
