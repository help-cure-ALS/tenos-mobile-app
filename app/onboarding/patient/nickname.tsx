import React, { useCallback, useState } from 'react';
import {
    ImageBackground,
    Keyboard,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { emit } from '@/src/lib/bus';
import { Button, Space, Text } from 'react-native-nice-ui';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';

export default function NicknameScreen() {
    const { colors, isDark } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { patientPreferencesStore: prefsStore } = usePatientStores();
    const [name, setName] = useState('');

    const handleContinue = useCallback(async () => {
        const trimmed = name.trim();
        if (trimmed) {
            if (prefsStore) {
                await prefsStore.setNickname(trimmed);
            }
            emit('preferences:changed');
        }
        router.replace('/(tabs)/(metric)');
    }, [name, router]);

    const handleSkip = useCallback(() => {
        router.replace('/(tabs)/(metric)');
    }, [router]);

    return (
        <>
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') }
                             style={ [{ flex: 1 }, { backgroundColor: colors.onboardingBackground }] }>
                <ScrollView
                    contentContainerStyle={ styles.scrollView }
                    keyboardShouldPersistTaps="handled"
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <Pressable style={ styles.dismissKeyboard } onPress={ Keyboard.dismiss }>
                        <ScrollViewContent>
                            <ScreenHeader
                                icon="hand.wave.fill"
                                iconTintColor={ colors.brandColorMuted }
                                title={ t('onboarding.nickname.title') }
                                subtitle={ t('onboarding.nickname.subtitle') }
                            />

                            <Space size="xl" />

                            <View style={ styles.inputWrapper }>
                                <TextInput
                                    style={ [styles.input, {
                                        color: colors.text,
                                        borderColor: colors.brandColorMuted + '40',
                                        backgroundColor: colors.listItemBackground
                                    }] }
                                    placeholder={ t('onboarding.nickname.placeholder') }
                                    placeholderTextColor={ colors.textHint }
                                    value={ name }
                                    onChangeText={ setName }
                                    autoCapitalize="words"
                                    autoCorrect={ false }
                                    autoFocus
                                    returnKeyType="done"
                                    onSubmitEditing={ handleContinue }
                                    maxLength={ 30 }
                                />
                                <Text variant="bodySmall" color="hint" align="center" style={ styles.hint }>
                                    { t('onboarding.nickname.hint') }
                                </Text>
                            </View>
                        </ScrollViewContent>
                    </Pressable>
                </ScrollView>
            </ImageBackground>
            <View style={ [styles.footer, { paddingBottom: insets.bottom + 20 }] }>
                <Button
                    title={ t('onboarding.nickname.continue') }
                    onPress={ handleContinue }
                    disabled={ !name.trim() }
                    fullWidth
                    rounded
                />
                <Button
                    title={ t('onboarding.nickname.skip') }
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
    image: {
        flex: 1
    },
    dismissKeyboard: {
        flex: 1
    },
    inputWrapper: {
        paddingHorizontal: 20
    },
    input: {
        fontSize: 28,
        fontWeight: '600',
        textAlign: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1
    },
    hint: {
        marginTop: 12
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        gap: 12,
        alignItems: 'center',
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%',
    },
});
