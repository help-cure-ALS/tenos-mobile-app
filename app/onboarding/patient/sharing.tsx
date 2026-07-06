import React, { useCallback, useState } from 'react';
import {
    ImageBackground,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { getSortedMetricDefinitions } from '@/src/metrics/definitions';
import { emit } from '@/src/lib/bus';
import { Button, List, Space, Text } from 'react-native-nice-ui';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import type { ShareTarget } from '@/src/stores/patientPreferencesStore';
import { getEnabledSharingCategories } from '@/src/features/assistiveAidsFeature';

type RoleConfig = {
    role: ShareTarget;
    labelKey: string;
    descKey: string;
};

const ROLES: RoleConfig[] = [
    { role: 'doctor', labelKey: 'onboarding.sharing.doctor', descKey: 'onboarding.sharing.doctorDesc' },
    { role: 'caregiver', labelKey: 'onboarding.sharing.caregiver', descKey: 'onboarding.sharing.caregiverDesc' },
    { role: 'research', labelKey: 'onboarding.sharing.research', descKey: 'onboarding.sharing.researchDesc' }
];

export default function SharingScreen() {
    const { colors, isDark } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { patientPreferencesStore: prefsStore } = usePatientStores();

    const [toggles, setToggles] = useState<Record<string, boolean>>({
        doctor: true,
        caregiver: true,
        research: false
    });

    const handleToggle = useCallback((role: ShareTarget) => {
        setToggles(prev => ({ ...prev, [role]: !prev[role] }));
    }, []);

    const handleContinue = useCallback(async () => {
        if (prefsStore) {
            const metricIds = getSortedMetricDefinitions().map(m => m.id);
            const categories = getEnabledSharingCategories();
            for (const { role } of ROLES) {
                if (toggles[role]) {
                    await prefsStore.batchSetSharing(role, true, metricIds, categories);
                }
            }
            emit('preferences:changed');
        }
        router.replace('/onboarding/patient/nickname');
    }, [toggles, prefsStore, router]);

    const handleSkip = useCallback(() => {
        router.replace('/onboarding/patient/nickname');
    }, [router]);

    return (
        <>
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') }
                             style={ [{ flex: 1 }, { backgroundColor: colors.onboardingBackground }] }>
                <ScrollView
                    contentContainerStyle={ styles.scrollView }
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <ScrollViewContent>
                        <ScreenHeader
                            icon="square.and.arrow.up.fill"
                            iconTintColor={ colors.brandColorMuted }
                            title={ t('onboarding.sharing.title') }
                            subtitle={ t('onboarding.sharing.subtitle') }
                        />

                        <List.Section rounded>
                            { ROLES.map(({ role, labelKey, descKey }) => (
                                <List.Item
                                    key={ role }
                                    title={ t(labelKey) }
                                    subtitle={ t(descKey) }
                                    rightCmp={
                                        <Switch
                                            value={ toggles[role] }
                                            onValueChange={ () => handleToggle(role) }
                                        />
                                    }
                                    hideChevron
                                />
                            )) }
                        </List.Section>

                        <Space size="sm" />
                        <Text variant="bodySmall" color="hint" align="center" style={ styles.hint }>
                            { t('onboarding.sharing.hint') }
                        </Text>
                    </ScrollViewContent>
                </ScrollView>
            </ImageBackground>
            <View style={ [styles.footer, { paddingBottom: insets.bottom + 20 }] }>
                <Button
                    title={ t('onboarding.sharing.continue') }
                    onPress={ handleContinue }
                    fullWidth
                    rounded
                />
                <Button
                    title={ t('onboarding.sharing.skip') }
                    onPress={ handleSkip }
                    variant="tinted"
                    fullWidth
                    rounded
                />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    container: {
        flex: 1
    },
    hint: {
        paddingHorizontal: 20
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        gap: 12,
        alignItems: 'center',
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    }
});
