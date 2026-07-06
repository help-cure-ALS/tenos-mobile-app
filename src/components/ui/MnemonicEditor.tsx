import React, { useCallback, useState } from 'react';
import {
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { useAppTheme } from '@/src/theme';
import { Button, List, Space, Text } from 'react-native-nice-ui';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { FilterChip } from '@/src/components/ui/FilterChip';
import { MNEMONIC_LANGUAGES, type MnemonicLanguage } from '@/src/lib/medical-sync-vault/crypto/wordlists';
import { useTranslation } from 'react-i18next';

const MIN_WORDS = 4;

function getStrengthLevel(count: number): { color: string; label: string; width: number } {
    if (count <= 3) return { color: '#FF3B30', label: 'weak', width: 25 };
    if (count <= 5) return { color: '#FF9500', label: 'fair', width: 42 };
    if (count <= 7) return { color: '#FFCC00', label: 'good', width: 58 };
    return { color: '#34C759', label: 'strong', width: 100 };
}

type MnemonicEditorProps = {
    words: string[];
    lang: MnemonicLanguage;
    onWordsChange: (words: string[]) => void;
    onLangChange: (lang: MnemonicLanguage) => void;
    onRegenerate: () => void;
};

export function MnemonicEditor({ words, lang, onWordsChange, onLangChange, onRegenerate }: MnemonicEditorProps) {
    const { colors } = useAppTheme();
    const { t } = useTranslation();

    const filledWords = words.filter((w) => w.trim().length > 0);
    const filledCount = filledWords.length;
    const strength = getStrengthLevel(filledCount);

    const currentLangLabel = MNEMONIC_LANGUAGES.find((l) => l.code === lang)?.label ?? 'English';
    const [showLangSheet, setShowLangSheet] = useState(false);

    const handleWordChange = useCallback((index: number, value: string) => {
        const next = [...words];
        next[index] = value.toLowerCase().replace(/[^a-zà-öø-ÿáéíóúñüäöß]/g, '');
        onWordsChange(next);
    }, [words, onWordsChange]);

    const handleClearWord = useCallback((index: number) => {
        const next = [...words];
        next[index] = '';
        onWordsChange(next);
    }, [words, onWordsChange]);

    const selectLanguage = useCallback((selected: typeof MNEMONIC_LANGUAGES[number]) => {
        setShowLangSheet(false);
        if (selected.code !== lang) {
            onLangChange(selected.code);
        }
    }, [lang, onLangChange]);

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
                },
            );
        } else {
            setShowLangSheet(true);
        }
    }, [lang, t, selectLanguage]);

    return (
        <>
            <View style={styles.langChipRow}>
                <FilterChip
                    label={currentLangLabel}
                    onPress={handleLangPicker}
                    active={lang !== 'en'}
                    showChevron
                    variant="filled"
                />
            </View>

            <List.Wrapper>
                <View style={styles.grid}>
                    {words.map((word, i) => (
                        <View key={i} style={styles.wordCell}>
                            <Text style={[styles.wordIndex, { color: colors.textHint }]}>
                                {i + 1}
                            </Text>
                            <TextInput
                                style={[
                                    styles.wordInput,
                                    {
                                        color: colors.text,
                                        backgroundColor: colors.listItemBackground,
                                        borderColor: word.trim() ? colors.brandColorMuted + '40' : colors.borderLight,
                                    },
                                ]}
                                value={word}
                                onChangeText={(v) => handleWordChange(i, v)}
                                placeholder={t('onboarding.mnemonic.wordPlaceholder', { n: i + 1 })}
                                placeholderTextColor={colors.textHint}
                                autoCapitalize="none"
                                autoCorrect={false}
                                returnKeyType="next"
                            />
                            {word.trim().length > 0 && (
                                <Pressable
                                    onPress={() => handleClearWord(i)}
                                    style={styles.clearButton}
                                    hitSlop={8}
                                >
                                    <AppIcon name="xmark.circle.fill" tintColor={colors.textHint} size={20} />
                                </Pressable>
                            )}
                        </View>
                    ))}
                </View>
            </List.Wrapper>

            {/* Strength bar */}
            <List.Wrapper>
                <View style={styles.strengthContainer}>
                    <View style={[styles.strengthTrack, { backgroundColor: colors.borderLight }]}>
                        <View
                            style={[
                                styles.strengthBar,
                                { backgroundColor: strength.color, width: `${strength.width}%` },
                            ]}
                        />
                    </View>
                    <Text style={[styles.strengthLabel, { color: strength.color }]}>
                        {filledCount} {filledCount === 1 ? t('onboarding.mnemonic.word') : t('onboarding.mnemonic.words')}
                        {filledCount < MIN_WORDS && ` (${t('onboarding.mnemonic.minimum', { n: MIN_WORDS })})`}
                    </Text>
                </View>
            </List.Wrapper>

            <List.Wrapper>
                <Button
                    title={t('onboarding.mnemonic.regenerate')}
                    onPress={onRegenerate}
                    variant="secondary"
                    fullWidth
                    rounded
                />
                <Space />
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                    {t('onboarding.mnemonic.editHint')}
                </Text>
            </List.Wrapper>

            {/* Android language picker bottom sheet */}
            {Platform.OS === 'android' && (
                <Modal
                    visible={showLangSheet}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowLangSheet(false)}
                >
                    <Pressable
                        style={styles.sheetBackdrop}
                        onPress={() => setShowLangSheet(false)}
                    >
                        <View
                            style={[styles.sheetContainer, { backgroundColor: colors.listItemBackground }]}
                            onStartShouldSetResponder={() => true}
                        >
                            <View style={[styles.sheetHandle, { backgroundColor: colors.textHint }]} />
                            {MNEMONIC_LANGUAGES.map((l) => {
                                const selected = l.code === lang;
                                return (
                                    <Pressable
                                        key={l.code}
                                        style={({ pressed }) => [
                                            styles.sheetOption,
                                            pressed && { backgroundColor: colors.listItemBackgroundPress },
                                        ]}
                                        onPress={() => selectLanguage(l)}
                                    >
                                        <Text style={[
                                            styles.sheetOptionText,
                                            { color: selected ? colors.tint : colors.textPrimary },
                                            selected && { fontWeight: '700' },
                                        ]}>
                                            {l.label}
                                        </Text>
                                        {selected && (
                                            <AppIcon name="checkmark" tintColor={colors.tint} size={18} />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                    </Pressable>
                </Modal>
            )}
        </>
    );
}

/** Minimum number of filled words to continue */
MnemonicEditor.MIN_WORDS = MIN_WORDS;

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        justifyContent: 'space-between',
    },
    wordCell: {
        width: '31%',
        position: 'relative',
    },
    wordIndex: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 0,
        marginLeft: 4,
    },
    wordInput: {
        height: 40,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingRight: 28,
        fontSize: 15,
        letterSpacing: -0.2,
        fontWeight: '600',
    },
    clearButton: {
        position: 'absolute',
        right: 4,
        bottom: 10,
    },
    strengthContainer: {
        paddingHorizontal: 4,
        marginTop: 14,
        marginBottom: 14,
        gap: 2,
    },
    strengthTrack: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    strengthBar: {
        height: '100%',
        borderRadius: 3,
    },
    strengthLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    hint: {
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
    langChipRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 4,
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
});
