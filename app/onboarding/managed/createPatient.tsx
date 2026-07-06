import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    TextInput,
    View,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { Button, Text } from 'react-native-nice-ui';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { useTranslation } from 'react-i18next';

// Caregiver-only: enter patient name before generating mnemonic.
export default function CreatePatientScreen() {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { existingPatientIds } = useLocalSearchParams<{ existingPatientIds?: string }>();

    const [patientName, setPatientName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreatePatient = useCallback(() => {
        if (!patientName.trim()) {
            setError(t('onboarding.createPatient.enterName'));
            return;
        }
        router.push({
            pathname: '/onboarding/managed/mnemonic',
            params: { patientName: patientName.trim(), existingPatientIds: existingPatientIds ?? '' },
        });
    }, [patientName, existingPatientIds, t]);

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.onboardingBackground }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScreenHeader
                    icon="person.badge.plus"
                    iconTintColor={colors.brandColorMuted}
                    title={t('onboarding.createPatient.title')}
                    subtitle={t('onboarding.createPatient.subtitle')}
                />

                <View style={styles.content}>
                    <View style={styles.inputSection}>
                        <Text style={[styles.inputLabel, { color: colors.text }]}>
                            {t('onboarding.createPatient.whoAreYouCaringFor')}
                        </Text>
                        <TextInput
                            style={[
                                styles.textInput,
                                {
                                    backgroundColor: colors.listItemBackground,
                                    color: colors.text,
                                    borderColor: error && !patientName.trim() ? '#FF3B30' : colors.listItemBackground,
                                },
                            ]}
                            placeholder={t('onboarding.createPatient.namePlaceholder')}
                            placeholderTextColor={colors.textHint}
                            value={patientName}
                            onChangeText={setPatientName}
                            autoCapitalize="words"
                            autoCorrect={false}
                        />
                        <Text style={[styles.inputHint, { color: colors.textHint }]}>
                            {t('onboarding.createPatient.nameHint')}
                        </Text>
                    </View>

                    {error && (
                        <View style={[styles.errorContainer, { backgroundColor: '#FF3B3015' }]}>
                            <Text style={[styles.errorText, { color: '#FF3B30' }]}>
                                {error}
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                <View style={styles.footerButtons}>
                    <Button
                        title={isLoading ? '' : t('onboarding.createPatient.createButton')}
                        onPress={handleCreatePatient}
                        disabled={isLoading}
                        rounded
                        style={styles.primaryButton}
                        leftIcon={isLoading ? <ActivityIndicator color="white" /> : undefined}
                    />
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingTop: 20,
    },
    inputSection: {
        alignSelf: 'stretch',
        marginBottom: 32,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    textInput: {
        fontSize: 17,
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
    },
    inputHint: {
        fontSize: 13,
        marginTop: 8,
        lineHeight: 18,
    },
    errorContainer: {
        marginTop: 24,
        padding: 16,
        borderRadius: 12,
        alignSelf: 'stretch',
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    footerButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    primaryButton: {
        flex: 1,
    },
});
