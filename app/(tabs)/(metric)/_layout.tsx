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

export default function MetricStackLayout() {
    const { t } = useTranslation();

    return (
        <Stack screenOptions={ {
            headerBackButtonDisplayMode: 'minimal'
        } }>
            <Stack.Screen
                name="index"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerLargeTitle: false,
                    headerTitle: '',
                    // headerTitle: t('navigation.overview'),
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
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
                name="tdee"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: t('navigation.energyRequirement'),
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="alsfrsr/index"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: t('navigation.alsfrsR'),
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="alsfrsr/list"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="alsSubtype/index"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="alsSubtype/list"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="neurologicalExam/index"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="neurologicalExam/list"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="alsGeneticBackground/index"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="alsKingsStage/index"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="alsKingsStage/list"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="alsGeneticBackground/list"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="categories/index"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: t('navigation.healthCategories'),
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="categories/[categoryId]"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="questionnaires"
                options={{
                    headerShown: true,
                    headerTransparent: false,
                    headerShadowVisible: false
                }}
            />
            <Stack.Screen
                name="medications/index"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: t('navigation.medications'),
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="medications/[medicationId]"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="studies/index"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: t('tabs.studies'),
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="studies/[studyId]"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="aids/index"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: t('navigation.aids'),
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="aids/[aidId]"
                options={{
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
        </Stack>
    );
}
