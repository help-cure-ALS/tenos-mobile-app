import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ImageBackground,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    Pressable,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { Button, List, Space, Text } from 'react-native-nice-ui';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { FilterChip } from '@/src/components/ui/FilterChip';
import { createExpoSecureStore, createKeybag } from '@/src/lib/medical-sync-vault';
import { clearCursorV2 } from '@/src/lib/medical-sync-vault/cursor/cursor';
import { generateMnemonic, deriveKeysFromMnemonic } from '@/src/lib/medical-sync-vault/crypto/mnemonic';
import { storeMnemonic, storeDerivedKeys } from '@/src/lib/medical-sync-vault/crypto/mnemonicStore';
import { MNEMONIC_LANGUAGES, type MnemonicLanguage } from '@/src/lib/medical-sync-vault/crypto/wordlists';
import { createFhirPointerOutbox } from '@/src/stores/fhirOutbox';
import { useTranslation } from 'react-i18next';

const MIN_WORDS = 4;

function getStrengthLevel(count: number): { color: string; label: string; width: number } {
    if (count <= 3) {
        return { color: '#FF3B30', label: 'weak', width: 25 };
    }
    if (count <= 5) {
        return { color: '#FF9500', label: 'fair', width: 42 };
    }
    if (count <= 7) {
        return { color: '#FFCC00', label: 'good', width: 58 };
    }
    return { color: '#34C759', label: 'strong', width: 100 };
}

function getDefaultMnemonicLang(appLang: string): MnemonicLanguage {
    const supported = MNEMONIC_LANGUAGES.find((l) => l.code === appLang);
    return supported ? (appLang as MnemonicLanguage) : 'en';
}

export default function MnemonicScreen() {
    const { colors, isDark } = useAppTheme();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();

    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);

    const [lang, setLang] = useState<MnemonicLanguage>(() => getDefaultMnemonicLang(i18n.language));
    const [words, setWords] = useState<string[]>(() => generateMnemonic(lang));
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const filledWords = words.filter((w) => w.trim().length > 0);
    const filledCount = filledWords.length;
    const canContinue = filledCount >= MIN_WORDS;
    const strength = getStrengthLevel(filledCount);

    const handleWordChange = useCallback((index: number, value: string) => {
        setWords((prev) => {
            const next = [...prev];
            next[index] = value.toLowerCase().replace(/[^a-zà-öø-ÿáéíóúñüäöß]/g, '');
            return next;
        });
    }, []);

    const currentLangLabel = MNEMONIC_LANGUAGES.find((l) => l.code === lang)?.label ?? 'English';

    const [showLangSheet, setShowLangSheet] = useState(false);

    const selectLanguage = useCallback((selected: typeof MNEMONIC_LANGUAGES[number]) => {
        setShowLangSheet(false);
        if (selected.code !== lang) {
            setLang(selected.code);
            setWords(generateMnemonic(selected.code));
            setError(null);
        }
    }, [lang]);

    const handleLangPicker = useCallback(() => {
        if (Platform.OS === 'ios') {
            const { ActionSheetIOS } = require('react-native');
            const labels = MNEMONIC_LANGUAGES.map((l) => l.label);
            const cancelLabel = t('common.cancel', 'Cancel');
            const options = [...labels, cancelLabel];
            ActionSheetIOS.showActionSheetWithOptions(
                { options, cancelButtonIndex: options.length - 1 },
                (buttonIndex: number) => {
                    if (buttonIndex === options.length - 1) return;
                    const selected = MNEMONIC_LANGUAGES[buttonIndex];
                    if (selected) selectLanguage(selected);
                }
            );
        } else {
            setShowLangSheet(true);
        }
    }, [lang, t, selectLanguage]);

    const handleClearWord = useCallback((index: number) => {
        setWords((prev) => {
            const next = [...prev];
            next[index] = '';
            return next;
        });
    }, []);

    const handleRegenerate = useCallback(() => {
        setWords(generateMnemonic(lang));
        setError(null);
    }, [lang]);

    const handleContinue = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        // Yield to let React render the loading state before CPU-intensive key derivation
        await new Promise<void>(resolve => setTimeout(resolve, 10));

        try {
            const activeWords = words.filter((w) => w.trim().length > 0);
            const keys = deriveKeysFromMnemonic(activeWords);
            await storeMnemonic(activeWords, lang);
            await storeDerivedKeys(keys, store, K);

            // Clear stale identity from previous role
            await store.del(K.SUBJECT_ID);
            await store.del(K.ACCESS_TOKEN);
            await store.del(K.SUBJECT_REGISTERED);
            await clearCursorV2(store, K);

            // Clear stale outbox (records carry old subject_id in pointer)
            const outbox = createFhirPointerOutbox();
            await outbox.clear();

            router.push('/onboarding/patient/create');
        }
        catch (e: any) {
            setError(e?.message ?? t('onboarding.errorOccurred'));
        }
        finally {
            setIsLoading(false);
        }
    }, [words, lang, store, K, t]);

    return (
        <>
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') }
                             style={ [{ flex: 1 }, { backgroundColor: colors.onboardingBackground }] }>
                <ScrollView
                    contentContainerStyle={ styles.scrollView }
                    keyboardShouldPersistTaps="handled"
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <View style={ styles.bodyWrapper }>
                        <ScreenHeader
                            icon="key.fill"
                            iconTintColor={ colors.brandColorMuted }
                            title={ t('onboarding.mnemonic.title') }
                            subtitle={ t('onboarding.mnemonic.subtitle') }
                        />

                        <View style={ styles.langChipRow }>
                            <FilterChip
                                label={ currentLangLabel }
                                onPress={ handleLangPicker }
                                active={ lang !== 'en' }
                                showChevron
                                variant="filled"
                            />
                        </View>

                        <List.Wrapper>
                            <View style={ styles.grid }>
                                { words.map((word, i) => (
                                    <View key={ i } style={ styles.wordCell }>
                                        <Text style={ [styles.wordIndex, { color: colors.textHint }] }>
                                            { i + 1 }
                                        </Text>
                                        <TextInput
                                            style={ [
                                                styles.wordInput,
                                                {
                                                    color: colors.text,
                                                    backgroundColor: colors.listItemBackground,
                                                    borderColor: word.trim() ? colors.brandColorMuted + '40' : colors.borderLight
                                                }
                                            ] }
                                            value={ word }
                                            onChangeText={ (v) => handleWordChange(i, v) }
                                            placeholder={ t('onboarding.mnemonic.wordPlaceholder', { n: i + 1 }) }
                                            placeholderTextColor={ colors.textHint }
                                            autoCapitalize="none"
                                            autoCorrect={ false }
                                            returnKeyType="next"
                                        />
                                        { word.trim().length > 0 && (
                                            <Pressable
                                                onPress={ () => handleClearWord(i) }
                                                style={ styles.clearButton }
                                                hitSlop={ 8 }
                                            >
                                                <AppIcon name="xmark.circle.fill" tintColor={ colors.textHint }
                                                         size={ 20 } />
                                            </Pressable>
                                        ) }
                                    </View>
                                )) }
                            </View>
                        </List.Wrapper>

                        {/* Strength bar */ }
                        <List.Wrapper>
                            <View style={ styles.strengthContainer }>
                                <View style={ [styles.strengthTrack, { backgroundColor: colors.borderLight }] }>
                                    <View
                                        style={ [
                                            styles.strengthBar,
                                            { backgroundColor: strength.color, width: `${ strength.width }%` }
                                        ] }
                                    />
                                </View>
                                <Text style={ [styles.strengthLabel, { color: strength.color }] }>
                                    { filledCount } { filledCount === 1 ? t('onboarding.mnemonic.word') : t('onboarding.mnemonic.words') }
                                    { filledCount < MIN_WORDS && ` (${ t('onboarding.mnemonic.minimum', { n: MIN_WORDS }) })` }
                                </Text>
                            </View>
                        </List.Wrapper>

                        <List.Wrapper>
                            <Button
                                title={ t('onboarding.mnemonic.regenerate') }
                                onPress={ handleRegenerate }
                                variant="secondary"
                                fullWidth
                                rounded
                            />
                            <Space />
                            <Text style={ [styles.hint, { color: colors.textSecondary }] }>
                                { t('onboarding.mnemonic.editHint') }
                            </Text>
                        </List.Wrapper>

                        { error && (
                            <List.Wrapper>
                                <View style={ [styles.errorContainer, { backgroundColor: '#FF3B3015' }] }>
                                    <Text variant="bodyMedium" style={ [styles.errorText, { color: '#FF3B30' }] }>
                                        { error }
                                    </Text>
                                </View>
                            </List.Wrapper>
                        ) }
                    </View>
                </ScrollView>
            </ImageBackground>
            <View style={ [styles.footer, { paddingBottom: insets.bottom + 20 }] }>
                <Button
                    title={ isLoading ? '' : t('onboarding.mnemonic.continue') }
                    onPress={ handleContinue }
                    disabled={ !canContinue || isLoading }
                    fullWidth
                    rounded
                    leftIcon={ isLoading ? <ActivityIndicator color="white" /> : undefined }
                />
            </View>

            {/* Android language picker bottom sheet */}
            { Platform.OS === 'android' && (
                <Modal
                    visible={ showLangSheet }
                    transparent
                    animationType="fade"
                    onRequestClose={ () => setShowLangSheet(false) }
                >
                    <Pressable
                        style={ styles.sheetBackdrop }
                        onPress={ () => setShowLangSheet(false) }
                    >
                        <View
                            style={ [styles.sheetContainer, { backgroundColor: colors.listItemBackground }] }
                            onStartShouldSetResponder={ () => true }
                        >
                            <View style={ [styles.sheetHandle, { backgroundColor: colors.textHint }] } />
                            { MNEMONIC_LANGUAGES.map((l) => {
                                const selected = l.code === lang;
                                return (
                                    <Pressable
                                        key={ l.code }
                                        style={ ({ pressed }) => [
                                            styles.sheetOption,
                                            pressed && { backgroundColor: colors.listItemBackgroundPress },
                                        ] }
                                        onPress={ () => selectLanguage(l) }
                                    >
                                        <Text style={ [
                                            styles.sheetOptionText,
                                            { color: selected ? colors.tint : colors.textPrimary },
                                            selected && { fontWeight: '700' },
                                        ] }>
                                            { l.label }
                                        </Text>
                                        { selected && (
                                            <AppIcon name="checkmark" tintColor={ colors.tint } size={ 18 } />
                                        ) }
                                    </Pressable>
                                );
                            }) }
                        </View>
                    </Pressable>
                </Modal>
            ) }
        </>
    );
}

const styles = StyleSheet.create({
    image: { flex: 1 },
    scrollView: { paddingBottom: Platform.OS === 'ios' ? 80 : 90 },
    bodyWrapper: {
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    container: { flex: 1 },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        justifyContent: 'space-between'
    },
    wordCell: {
        width: '31%',
        position: 'relative'
    },
    wordIndex: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 0,
        marginLeft: 4
    },
    wordInput: {
        height: 40,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingRight: 28,
        fontSize: 15,
        letterSpacing: -0.2,
        fontWeight: '600'
    },
    clearButton: {
        position: 'absolute',
        right: 4,
        bottom: 10
    },
    strengthContainer: {
        paddingHorizontal: 4,
        marginTop: 14,
        marginBottom: 14,
        gap: 2
    },
    strengthTrack: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden'
    },
    strengthBar: {
        height: '100%',
        borderRadius: 3
    },
    strengthLabel: {
        fontSize: 13,
        fontWeight: '500'
    },
    hint: {
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center'
    },
    errorContainer: {
        padding: 16,
        borderRadius: 12,
        alignSelf: 'stretch'
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center'
    },
    langChipRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 4
    },
    sheetBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 32,
        paddingTop: 8,
    },
    sheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 8,
        opacity: 0.4,
    },
    sheetOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    sheetOptionText: {
        fontSize: 17,
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
