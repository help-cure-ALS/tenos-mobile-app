/**
 * Edit Patient Screen - For caregivers to edit patient aliases.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { Button } from 'react-native-nice-ui';
import { ProfilePreview } from '@/src/components/ui/ProfilePreview';
import { ColorPicker, AVAILABLE_COLORS } from '@/src/components/ui/ColorPicker';
import { IconPicker, AVAILABLE_ICONS } from '@/src/components/ui/IconPicker';

export default function PatientsEditScreen() {
    const { t } = useTranslation();
    const { patientId } = useLocalSearchParams<{ patientId: string }>();
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { getPatientAlias, setPatientAlias } = useAppRole();
    const router = useSafeRouter();

    const [name, setName] = useState('');
    const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[0]);
    const [selectedIcon, setSelectedIcon] = useState(AVAILABLE_ICONS[0]);
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Load existing alias
    useEffect(() => {
        if (!patientId) return;

        const alias = getPatientAlias(patientId);
        if (alias) {
            setName(alias.localName);
            setSelectedColor(alias.color ?? AVAILABLE_COLORS[0]);
            setSelectedIcon(alias.icon ?? AVAILABLE_ICONS[0]);
            setNotes(alias.notes ?? '');
        } else {
            setName(`Patient ${patientId.slice(0, 6)}`);
        }
    }, [patientId, getPatientAlias]);

    const handleSave = useCallback(async () => {
        if (!patientId) return;
        if (!name.trim()) {
            Alert.alert(t('common.error'), t('patientsEdit.enterName'));
            return;
        }

        setIsSaving(true);
        try {
            await setPatientAlias({
                patientId,
                localName: name.trim(),
                color: selectedColor,
                icon: selectedIcon,
                notes: notes.trim() || undefined,
                addedAt: new Date().toISOString(),
            });
            router.back();
        } catch (e: any) {
            Alert.alert(t('common.error'), e?.message ?? t('patientsEdit.saveError'));
        } finally {
            setIsSaving(false);
        }
    }, [t, patientId, name, selectedColor, selectedIcon, notes, setPatientAlias]);

    if (!patientId) {
        return (
            <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
                <Text style={{ color: colors.text }}>{t('patientsEdit.patientNotFound')}</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.modalBackground }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
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
                    subtitle={`ID: ${patientId.slice(0, 8)}...`}
                    namePlaceholder={t('patientsEdit.namePlaceholder')}
                />

                {/* Name Input */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('patientsEdit.name')}</Text>
                    <TextInput
                        style={[
                            styles.textInput,
                            {
                                backgroundColor: colors.listItemBackground,
                                color: colors.text,
                            },
                        ]}
                        placeholder={t('patientsEdit.nameInputPlaceholder')}
                        placeholderTextColor={colors.textHint}
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                    />
                </View>

                {/* Color Selection */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('patientsEdit.color')}</Text>
                    <ColorPicker colors={AVAILABLE_COLORS} selected={selectedColor} onSelect={setSelectedColor} />
                </View>

                {/* Icon Selection */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('patientsEdit.symbol')}</Text>
                    <IconPicker icons={AVAILABLE_ICONS} selected={selectedIcon} selectedColor={selectedColor} onSelect={setSelectedIcon} />
                </View>

                {/* Notes */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('patientsEdit.notes')}</Text>
                    <TextInput
                        style={[
                            styles.textInput,
                            styles.notesInput,
                            {
                                backgroundColor: colors.listItemBackground,
                                color: colors.text,
                            },
                        ]}
                        placeholder={t('patientsEdit.notesPlaceholder')}
                        placeholderTextColor={colors.textHint}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={3}
                    />
                    <Text style={[styles.inputHint, { color: colors.textHint }]}>
                        {t('patientsEdit.notesHint')}
                    </Text>
                </View>

            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                <Button
                    title={t('common.save')}
                    onPress={handleSave}
                    loading={isSaving}
                    rounded
                    style={styles.saveButton}
                />
            </View>
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
    notesInput: {
        height: 100,
        textAlignVertical: 'top',
    },
    inputHint: {
        fontSize: 13,
        marginTop: 8,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    saveButton: {
        alignSelf: 'stretch',
    },
});
