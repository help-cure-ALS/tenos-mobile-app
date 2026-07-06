import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LoadingOverlay } from '@/src/context/LoadingOverlayProvider';

function isIOS26OrLater(): boolean {
    if (Platform.OS !== 'ios') {
        return false;
    }
    return parseInt(Platform.Version as string, 10) >= 26;
}

export default function SettingsStackLayout() {
    const { t } = useTranslation();

    return (
        <>
        <Stack screenOptions={ { headerBackButtonDisplayMode: 'minimal' } }>
            {/* Main settings screen */ }
            <Stack.Screen
                name="index"
                options={ {
                    title: t('navigation.settings'),
                    headerLargeTitle: false,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />

            <Stack.Screen
                name="account/index"
                options={ {
                    title: t('navigation.account'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="account/verification"
                options={ {
                    title: t('navigation.verification'),
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="account/recoveryWords"
                options={ {
                    title: t('navigation.recoveryWords'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />

            <Stack.Screen
                name="devices/index"
                options={ {
                    title: t('navigation.linkDevices'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="devices/detail"
                options={ {
                    title: t('navigation.deviceInfo'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="devices/qrCode"
                options={ {
                    title: t('navigation.showQRCode'),
                    presentation: 'modal', // formSheet causes issue no conten rendering on iOS
                    animation: 'slide_from_bottom',
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />

            <Stack.Screen
                name="patients/index"
                options={ {
                    title: t('navigation.managePatients'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="patients/add"
                options={ {
                    title: t('navigation.addPatient'),
                    gestureEnabled: false,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="patients/edit"
                options={ {
                    title: t('navigation.editPatient'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="patients/mnemonic"
                options={ {
                    title: t('navigation.recoveryWords'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="patients/recoveryWords"
                options={ {
                    title: t('navigation.recoveryWords'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="patients/link"
                options={ {
                    title: t('navigation.linkPatient'),
                    presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
                    headerShown: true,
                    animation: 'slide_from_bottom',
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />

            <Stack.Screen
                name="careProvider/index"
                options={ {
                    title: t('navigation.yourCareProviders'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="careProvider/add"
                options={ {
                    title: t('navigation.addCareProvider'),
                    presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
                    animation: 'slide_from_bottom',
                    gestureEnabled: false,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="careProvider/detail"
                options={ {
                    title: t('navigation.careProvider'),
                    presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
                    animation: 'slide_from_bottom',
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="careProvider/search"
                options={ {
                    title: t('navigation.searchCareProvider'),
                    presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
                    animation: 'slide_from_bottom',
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />


            <Stack.Screen
                name="profile/index"
                options={ {
                    title: t('navigation.healthInformation'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="profile/countryPicker"
                options={ {
                    title: t('navigation.selectCountry'),
                    presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
                    animation: 'slide_from_bottom',
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />

            <Stack.Screen
                name="legal/privacyInfo"
                options={ {
                    title: t('navigation.yourData'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="legal/privacy"
                options={ {
                    title: t('navigation.privacyPolicy'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="legal/imprint"
                options={ {
                    title: t('navigation.imprint'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />

            {/* Flat screens that don't need their own folder */ }
            <Stack.Screen
                name="notifications"
                options={ {
                    title: t('navigation.notifications'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="language"
                options={ {
                    title: t('navigation.language'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="appearance"
                options={ {
                    title: t('navigation.appearance'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="displayMode"
                options={ {
                    title: t('navigation.displayMode'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="units"
                options={ {
                    title: t('navigation.units'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="healthImport"
                options={ {
                    title: t('navigation.healthImport'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
            <Stack.Screen
                name="nickname"
                options={ {
                    title: t('navigation.editProfile'),
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular'
                } }
            />
        </Stack>
        <LoadingOverlay />
        </>
    );
}
