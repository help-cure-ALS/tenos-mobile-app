import React from 'react';
import {
    ImageBackground,
    Platform,
    ScrollView, StatusBar,
    StyleSheet,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/theme';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { seedDemoData, DEMO_PATIENT_ID } from '@/src/demo/demoData';
import { getKeyProvider } from '@/src/services/keyProvider';
import { emit } from '@/src/lib/bus';
import { useLoadingOverlay } from '@/src/context/LoadingOverlayProvider';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { List, Text } from "react-native-nice-ui";
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { useTranslation } from 'react-i18next';
import { Logo } from "@/assets/svg/Logo";

type RoleOption = {
    id: 'patient' | 'caregiver' | 'doctor' | 'demo';
    titleKey: string;
    descKey: string;
    icon: string;
    route: string | null;
};

const ROLE_OPTIONS: RoleOption[] = [
    {
        id: 'patient',
        titleKey: 'onboarding.roleSelect.patient',
        descKey: 'onboarding.roleSelect.patientDesc',
        icon: 'person.fill',
        route: '/onboarding/patient'
    },
    {
        id: 'caregiver',
        titleKey: 'onboarding.roleSelect.caregiver',
        descKey: 'onboarding.roleSelect.caregiverDesc',
        icon: 'person.2.fill',
        route: '/onboarding/managed/setup'
    },
    {
        id: 'doctor',
        titleKey: 'onboarding.roleSelect.doctor',
        descKey: 'onboarding.roleSelect.doctorDesc',
        icon: 'stethoscope',
        route: '/onboarding/managed/setup'
    },
    {
        id: 'demo',
        titleKey: 'onboarding.roleSelect.demo',
        descKey: 'onboarding.roleSelect.demoDesc',
        icon: 'eye.circle.fill',
        route: null // Direct activation
    }
];

export default function OnboardingRoleSelectScreen() {
    const { colors, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { setDemo } = useAppRole();
    const { patientFhirStore } = useAppSync();
    const router = useSafeRouter();
    const { t } = useTranslation();
    const { showLoading, hideLoading } = useLoadingOverlay();

    const handleRoleSelect = async (option: RoleOption) => {
        if (option.id === 'demo') {
            showLoading();
            try {
                await setDemo();
                // Set keyProvider context immediately — the React useEffect in
                // AppRoleProvider hasn't fired yet, but patientFhirStore needs
                // a valid key to encrypt the seeded data.
                getKeyProvider().setContext({ role: 'demo', activePatientId: DEMO_PATIENT_ID });
                await seedDemoData(patientFhirStore);
                emit('fhir:changed');
                emit('preferences:changed');
                router.replace('/(tabs)/(metric)');
            } catch {
                hideLoading();
            }
        } else if (option.route) {
            if (option.id === 'caregiver' || option.id === 'doctor') {
                router.push({
                    pathname: '/onboarding/managed/setup' as any,
                    params: { role: option.id },
                });
            } else {
                router.push(option.route as any);
            }
        }
    };

    return (
        <>
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') } style={ [{ flex: 1 }, { backgroundColor: colors.background }] }>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={ styles.scrollView }
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <View style={ styles.bodyWrapper }>
                        <ScreenHeader
                            customIconContainerStyle={ {
                                backgroundColor: 'transparent',
                                borderRadius: 0,
                                width: 220,
                                height: 70,
                                marginBottom: 20
                            } }
                            iconComponent={ <Logo
                                fill={ isDark ? '#ffffff' : '#5A246B' }
                                width={ 220 }
                                height={ 70 }
                            /> }
                            subtitle={ t('onboarding.roleSelect.subtitle') }
                        />

                        {/* Role Options */ }
                        <List.Section rounded spaced>
                            { ROLE_OPTIONS.map((option) => (
                                <List.Item
                                    key={ option.id }
                                    title={ t(option.titleKey) }
                                    titleNumberOfLines={ 2 }
                                    titleStyle={ { fontWeight: '600' } }
                                    subtitle={ t(option.descKey) }
                                    onPress={ () => handleRoleSelect(option) }
                                    leftCmpSize={56}
                                    leftCmp={<ListItemIcon name={option.icon} color={colors.textPrimary} size="lg" backgroundColor={colors.listItemBackgroundMuted} />}
                                />
                            )) }
                        </List.Section>

                        <List.Wrapper>
                            <List.Text align="center">
                                { t('onboarding.roleSelect.changeHint') }
                            </List.Text>
                        </List.Wrapper>
                    </View>
                </ScrollView>
            </ImageBackground>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        paddingTop: 20,
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    container: {
        flex: 1
    },
    scrollContent: {
        flexGrow: 1
    },
    headerText: {
        fontSize: 17,
        lineHeight: 22,
        fontWeight: 500,
        textAlign: 'center'
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 17,
        textAlign: 'center',
        lineHeight: 24
    },
    optionsContainer: {
        gap: 10
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        gap: 16
    },
    optionContent: {
        flex: 1
    },
    optionTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 4
    },
    optionDescription: {
        fontSize: 14,
        lineHeight: 20
    },
    footer: {
        marginTop: 32,
        paddingHorizontal: 20
    },
    footerText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20
    },
});
