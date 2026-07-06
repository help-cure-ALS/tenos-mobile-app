import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ImageBackground,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { createDeviceAccessStore } from '@/src/stores/deviceAccessStore';
import { getOwnedPatientStore } from '@/src/stores/ownedPatientStore';
import { getDeviceInfo, getDeviceDisplayName } from '@/src/utils/deviceInfo';
import { Button, List, Text } from 'react-native-nice-ui';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { FilterChip } from '@/src/components/ui/FilterChip';
import {
    createExpoSecureStore,
    createKeybag,
    lookupSubjectByPubkey
} from '@/src/lib/medical-sync-vault';
import { getOrCreateStableDeviceId } from '@/src/lib/medical-sync-vault/deviceId';
import { deriveKeysFromMnemonic } from '@/src/lib/medical-sync-vault/crypto/mnemonic';
import { storeMnemonic } from '@/src/lib/medical-sync-vault/crypto/mnemonicStore';
import { MNEMONIC_LANGUAGES, type MnemonicLanguage } from '@/src/lib/medical-sync-vault/crypto/wordlists';
import { getKeyProvider } from '@/src/services/keyProvider';
import { useTranslation } from 'react-i18next';

const WORD_COUNT = 12;
const MIN_WORDS = 4;
const FOOTER_SCROLL_SPACE = 112;

function getDefaultMnemonicLang(appLang: string): MnemonicLanguage {
    const supported = MNEMONIC_LANGUAGES.find((l) => l.code === appLang);
    return supported ? (appLang as MnemonicLanguage) : 'en';
}

export default function RestoreScreen() {
    const { colors, isDark } = useAppTheme();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { setPatient } = useAppRole();
    const { cfg, activateIdentity } = useAppSync();

    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);

    const [lang, setLang] = useState<MnemonicLanguage>(() => getDefaultMnemonicLang(i18n.language));
    const [words, setWords] = useState<string[]>(() => Array(WORD_COUNT).fill(''));
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const filledWords = words.filter((w) => w.trim().length > 0);
    const canRestore = filledWords.length >= MIN_WORDS;

    const currentLangLabel = MNEMONIC_LANGUAGES.find((l) => l.code === lang)?.label ?? 'English';
    const footerBottomPadding = insets.bottom + 20;

    const [showLangSheet, setShowLangSheet] = useState(false);

    const selectLanguage = useCallback((selected: typeof MNEMONIC_LANGUAGES[number]) => {
        setShowLangSheet(false);
        if (selected.code !== lang) {
            setLang(selected.code);
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

    const handleWordChange = useCallback((index: number, value: string) => {
        setWords((prev) => {
            const next = [...prev];
            next[index] = value.toLowerCase().replace(/[^a-zà-öø-ÿáéíóúñüäöß]/g, '');
            return next;
        });
    }, []);

    const handleRestore = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const activeWords = words.filter((w) => w.trim().length > 0);
            const keys = deriveKeysFromMnemonic(activeWords);

            // Look up subject_id by derived public key
            const vaultCfg = { baseUrl: cfg.baseUrl, appIssueToken: cfg.appIssueToken };
            let subjectId: string;
            try {
                const result = await lookupSubjectByPubkey(vaultCfg, keys.publicKeyB64);
                subjectId = result.subject_id;
            }
            catch (e: any) {
                if (e?.code === 'not_found') {
                    setError(t('onboarding.restore.notFound'));
                    return;
                }
                throw e;
            }

            await storeMnemonic(activeWords, lang);
            await activateIdentity({
                patientId: subjectId,
                transportKeyB64: keys.transportKeyB64,
                pubkeyB64: keys.publicKeyB64,
                seckeyB64: keys.secretKeyB64,
            }, 'switch');

            // Set role
            await setPatient(subjectId);

            const keyProvider = getKeyProvider();
            keyProvider.setContext({
                role: 'patient',
                activePatientId: subjectId
            });

            const deviceId = await getOrCreateStableDeviceId(store, K);
            const devAccessStore = createDeviceAccessStore(subjectId);
            const info = getDeviceInfo();
            await devAccessStore.addEntry({
                device_id: deviceId,
                role: 'owner',
                name: getDeviceDisplayName(),
                addedByDeviceId: deviceId,
                ...info,
                lastSeenAt: new Date().toISOString()
            });

            const now = new Date().toISOString();
            await getOwnedPatientStore().save({
                patientId: subjectId,
                transportKeyB64: keys.transportKeyB64,
                pubkeyB64: keys.publicKeyB64,
                seckeyB64: keys.secretKeyB64,
                source: 'restored',
                addedAt: now,
                lastUsedAt: now,
                mnemonicWords: activeWords,
                mnemonicLang: lang,
            });

            router.replace('/(tabs)/(metric)');
        }
        catch (e: any) {
            setError(e?.message ?? t('onboarding.restore.error'));
        }
        finally {
            setIsLoading(false);
        }
    }, [words, lang, cfg, activateIdentity, store, K, setPatient, t]);

    return (
        <KeyboardAvoidingView
            style={ styles.container }
            behavior={ Platform.OS === 'ios' ? 'padding' : 'height' }
        >
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') }
                             style={ [{ flex: 1 }, { backgroundColor: colors.onboardingBackground }] }>
                <ScrollView
                    contentContainerStyle={ [
                        styles.scrollView,
                        { paddingBottom: footerBottomPadding + FOOTER_SCROLL_SPACE }
                    ] }
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={ Platform.OS === 'ios' ? 'interactive' : 'none' }
                    contentInsetAdjustmentBehavior="automatic"
                    automaticallyAdjustKeyboardInsets={ Platform.OS === 'ios' }
                >
                    <View style={ styles.bodyWrapper }>
                        <ScreenHeader
                            icon="arrow.counterclockwise"
                            iconTintColor={ colors.brandColorMuted }
                            title={ t('onboarding.restore.title') }
                            subtitle={ t('onboarding.restore.subtitle') }
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
                                            placeholder={ t('onboarding.restore.wordPlaceholder', { n: i + 1 }) }
                                            placeholderTextColor={ colors.textHint }
                                            autoCapitalize="none"
                                            autoCorrect={ false }
                                            returnKeyType="next"
                                        />
                                    </View>
                                )) }
                            </View>
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
            <View style={ [styles.footer, { paddingBottom: footerBottomPadding }] }>
                <Button
                    title={ isLoading ? '' : t('onboarding.restore.restoreButton') }
                    onPress={ handleRestore }
                    disabled={ !canRestore || isLoading }
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
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        flexGrow: 1,
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
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
        width: '31%'
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
        fontSize: 15,
        letterSpacing: -0.2,
        fontWeight: '600'
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
