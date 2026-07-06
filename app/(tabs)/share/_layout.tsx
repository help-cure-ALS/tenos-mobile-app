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
                name="addDoctor"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: t('share.addDoctor.title'),
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="addCaregiver"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: t('share.addCaregiver.title'),
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="sharingSettings"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
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
            <Stack.Screen
                name="exportFhir"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="exportPdf"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="accessLog"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="supplierLink"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="supplierAccept"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="supplierManage"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="supplierDataPolicy"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="supplierInbox"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
        </Stack>
    );
}
