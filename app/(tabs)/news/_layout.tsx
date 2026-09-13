import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

function isIOS26OrLater(): boolean {
    if (Platform.OS !== 'ios') return false;
    return parseInt(Platform.Version as string, 10) >= 26;
}

export default function NewsStackLayout() {
    const { t } = useTranslation();

    return (
        <Stack screenOptions={ { headerBackButtonDisplayMode: 'minimal' } }>
            <Stack.Screen
                name="index"
                options={{
                    title: t('news.title'),
                    // No large title: the collapse animation requires the
                    // ScrollView as the screen's first subview, which the
                    // gradient ImageBackground (app standard on all tabs)
                    // rules out — hence the small transparent header like
                    // on Studien/Teilen/Übersicht.
                    headerLargeTitle: false,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
        </Stack>
    );
}
