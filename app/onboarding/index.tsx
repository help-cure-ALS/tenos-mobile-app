import React, { useCallback } from 'react';
import {
    ImageBackground,
    Platform,
    ScrollView, StatusBar,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/theme';
import { Button, List, Space } from 'react-native-nice-ui';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { Logo } from '@/assets/svg/Logo';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useTranslation } from 'react-i18next';
import * as Application from 'expo-application';
import { useLoadingOverlay } from '@/src/context/LoadingOverlayProvider';
import { useFocusEffect } from 'expo-router';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { FeatureItem } from "@/src/components/ui/FeatureItem";

export default function OnboardingWelcomeScreen() {
    const { colors, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { t } = useTranslation();
    const { hideLoading } = useLoadingOverlay();

    useFocusEffect(
        useCallback(() => {
            hideLoading();
        }, [hideLoading])
    );

    const handleContinue = () => {
        router.push('/onboarding/roleSelect');
    };

    return (
        <>
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') }
                             style={ [{ flex: 1 }, { backgroundColor: colors.background }] }>
                <ScrollView
                    style={ { flex: 1 } }
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
                            subtitle={ t('onboarding.subtitle') }
                        />
                        <Space size="xl" />
                        <List.Wrapper>
                            <View style={ styles.featuresSection }>
                                <FeatureItem
                                    icon="checkmark.circle.fill"
                                    iconColor={ colors.textPrimary }
                                    variant="bare"
                                    description={ t('onboarding.bullet1') }
                                />
                                <FeatureItem
                                    icon="checkmark.circle.fill"
                                    iconColor={ colors.textPrimary }
                                    variant="bare"
                                    description={ t('onboarding.bullet3') }
                                />
                                <FeatureItem
                                    icon="checkmark.circle.fill"
                                    iconColor={ colors.textPrimary }
                                    variant="bare"
                                    description={ t('onboarding.bullet2') }
                                />
                                <FeatureItem
                                    icon="checkmark.circle.fill"
                                    iconColor={ colors.textPrimary }
                                    variant="bare"
                                    description={ t('onboarding.bullet4') }
                                />
                            </View>
                            <Space size="xl" />
                            <Button
                                title={ t('onboarding.getStarted') }
                                textStyle={ { color: '#5A246B', fontWeight: '700' } }
                                style={ { backgroundColor: '#ffffff' } }
                                onPress={ handleContinue }
                                rounded
                            />
                            <Text style={ styles.versionText }>
                                Version { Application.nativeApplicationVersion ?? '?' } Build { Application.nativeBuildVersion ?? '?' }
                            </Text>
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
    content: {
        flex: 1
    },
    featuresSection: {
        gap: 16
    },
    versionText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 12
    }
});
