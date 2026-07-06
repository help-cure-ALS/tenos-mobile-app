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
                name="[metricId]/add"
                options={{
                    presentation: 'modal', // formSheet causes issue no conten rendering on iOS
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
                name="alsSubtype/add"
                options={{
                    gestureEnabled: false,
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
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
                name="neurologicalExam/add"
                options={{
                    gestureEnabled: false,
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
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
                name="alsKingsStage/add"
                options={{
                    gestureEnabled: false,
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
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
                name="alsGeneticBackground/add"
                options={{
                    gestureEnabled: false,
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="progressRateInfo"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                    headerTitle: '',
                }}
            />
            <Stack.Screen
                name="questionnaire/[questionnaireId]/index"
                options={{
                    gestureEnabled: false,
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: '',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="todoSettings"
                options={{
                    presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: t('todo.settingsTitle'),
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="pinOrder"
                options={{
                    presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: t('navigation.pinOrder'),
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
                name="medications/add"
                options={{
                    gestureEnabled: false,
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: t('navigation.newMedication'),
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
                name="medications/log"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="medications/editSchedule"
                options={{
                    gestureEnabled: false,
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="medications/editDetails"
                options={{
                    gestureEnabled: false,
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="medications/scheduleType"
                options={{
                    presentation: 'formSheet',
                    sheetAllowedDetents: [0.6],
                    sheetGrabberVisible: true,
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="medications/duration"
                options={{
                    presentation: 'formSheet',
                    sheetAllowedDetents: [0.4],
                    sheetGrabberVisible: true,
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
                name="studies/clinicPicker"
                options={{
                    gestureEnabled: false,
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerTitle: t('studies.clinicPickerTitle', 'Ambulanzen auswählen'),
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
                name="aids/add"
                options={{
                    gestureEnabled: false,
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerTitle: t('navigation.newAid'),
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
            <Stack.Screen
                name="aids/supplierManage"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="aids/supplierDataPolicy"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="aids/supplierLink"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
            <Stack.Screen
                name="aids/supplierInbox"
                options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
                }}
            />
        </Stack>
    );
}
