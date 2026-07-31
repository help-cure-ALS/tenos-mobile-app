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

// Modal screens (addDoctor, sharingSettings, supplier*, exports, ...) live in
// the root-level app/share/ group so they cover the tab bar on Android too.
// Only card screens remain in this tab stack.
export default function ShareStackLayout() {
    const { t } = useTranslation();

    return (
        <Stack screenOptions={ {
            headerBackButtonDisplayMode: 'minimal'
        } }>
            <Stack.Screen
                name="index"
                options={{
                    title: t('share.title'),
                    headerLargeTitle: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                }}
            />
            <Stack.Screen
                name="export"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
        </Stack>
    );
}
