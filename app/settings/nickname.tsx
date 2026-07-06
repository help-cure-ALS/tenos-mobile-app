/**
 * Nickname Screen - For patients to edit their profile (name, icon, color).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { useNickname } from '@/src/hooks/usePatientPreferences';
import { ProfilePreview } from '@/src/components/ui/ProfilePreview';
import { ColorPicker, AVAILABLE_COLORS } from '@/src/components/ui/ColorPicker';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { IconPicker, AVAILABLE_ICONS } from '@/src/components/ui/IconPicker';

export default function NicknameScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const { nickname, setNickname, profileIcon, setProfileIcon, profileColor, setProfileColor } = useNickname();

    const [name, setName] = useState('');
    const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[0]);
    const [selectedIcon, setSelectedIcon] = useState('figure.boxing');
    const [initialized, setInitialized] = useState(false);

    // Init from hook values once loaded
    useEffect(() => {
        if (initialized) return;
        if (nickname !== undefined || profileIcon !== undefined || profileColor !== undefined) {
            setName(nickname ?? '');
            setSelectedIcon(profileIcon ?? 'figure.boxing');
            setSelectedColor(profileColor ?? AVAILABLE_COLORS[0]);
            setInitialized(true);
        }
    }, [nickname, profileIcon, profileColor, initialized]);

    const handleSave = useCallback(async () => {
        await setNickname(name.trim() || undefined);
        await setProfileIcon(selectedIcon);
        await setProfileColor(selectedColor);
        router.back();
    }, [name, selectedIcon, selectedColor, setNickname, setProfileIcon, setProfileColor, router]);

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.modalBackground }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerRight: () => (
                            <HeaderButton icon="checkmark" variant="done" onPress={handleSave} />
                        ),
                    }}
                />
            ) : (
                <Stack.Toolbar placement="right">
                    <Stack.Toolbar.Button icon="checkmark" variant="done" onPress={handleSave} />
                </Stack.Toolbar>
            )}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
            >
                {/* Preview */}
                <ProfilePreview
                    name={name}
                    icon={selectedIcon}
                    color={selectedColor}
                    namePlaceholder={t('settings.profileNamePlaceholder')}
                />

                {/* Name Input */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.profileName')}</Text>
                    <TextInput
                        style={[
                            styles.textInput,
                            {
                                backgroundColor: colors.listItemBackground,
                                color: colors.text,
                            },
                        ]}
                        placeholder={t('settings.profileNamePlaceholder')}
                        placeholderTextColor={colors.textHint}
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                    />
                </View>

                {/* Color Selection */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.profileColor')}</Text>
                    <ColorPicker colors={AVAILABLE_COLORS} selected={selectedColor} onSelect={setSelectedColor} />
                </View>

                {/* Icon Selection */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.profileSymbol')}</Text>
                    <IconPicker icons={AVAILABLE_ICONS} selected={selectedIcon} selectedColor={selectedColor} onSelect={setSelectedIcon} />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    textInput: {
        fontSize: 17,
        padding: 16,
        borderRadius: 12,
    },
});
