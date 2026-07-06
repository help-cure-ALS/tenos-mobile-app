/**
 * Recovery Words Screen - Shows mnemonic recovery words for caregiver-created patients.
 */
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { List, Text } from 'react-native-nice-ui';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { getManagedPatientsStore } from '@/src/stores/managedPatientsStore';
import { MNEMONIC_LANGUAGES } from '@/src/lib/medical-sync-vault/crypto/wordlists';

export default function PatientRecoveryWordsScreen() {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const { patientId } = useLocalSearchParams<{ patientId: string }>();

    const [words, setWords] = useState<string[] | null>(null);
    const [langLabel, setLangLabel] = useState('English');
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!patientId) return;

        getManagedPatientsStore().get(patientId).then((patient) => {
            if (patient?.mnemonicWords?.length) {
                setWords(patient.mnemonicWords);
                setLangLabel(
                    MNEMONIC_LANGUAGES.find((l) => l.code === patient.mnemonicLang)?.label ?? 'English'
                );
            }
            setLoaded(true);
        });
    }, [patientId]);

    if (!loaded) {
        return <View style={[styles.container, { backgroundColor: colors.modalBackground }]} />;
    }

    if (!words) {
        return (
            <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
                <View style={styles.centered}>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        {t('recoveryWords.noWords')}
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <ScrollView
            style={{ backgroundColor: colors.modalBackground }}
            contentContainerStyle={styles.scrollView}
            contentInsetAdjustmentBehavior="automatic"
        >
            <ScrollViewContent>
                <ScreenHeader
                    icon="key.fill"
                    iconTintColor={colors.brandColorMuted}
                    title={t('onboarding.mnemonic.title')}
                    subtitle={t('recoveryWords.subtitle')}
                />

                <List.Wrapper>
                    <View style={[styles.langBadge, { backgroundColor: colors.listItemBackground }]}>
                        <Text style={[styles.langBadgeText, { color: colors.textSecondary }]}>
                            {t('recoveryWords.language')}: {langLabel}
                        </Text>
                    </View>

                    <View style={styles.grid}>
                        {Array.from({ length: 12 }, (_, i) => {
                            const word = words[i] ?? '';
                            const hasWord = word.length > 0;
                            return (
                                <View key={i} style={styles.wordCell}>
                                    <View
                                        style={[
                                            styles.wordBox,
                                            {
                                                backgroundColor: hasWord ? colors.listItemBackground : 'transparent',
                                                borderColor: hasWord ? colors.borderLight : 'transparent',
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.wordIndex, { color: colors.textHint }]}>
                                            {i + 1}
                                        </Text>
                                        <Text style={[styles.wordText, { color: hasWord ? colors.text : colors.textHint }]}>
                                            {hasWord ? word : '—'}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </List.Wrapper>

                <List.Wrapper>
                    <View style={[styles.warningBox, { backgroundColor: '#FF950015' }]}>
                        <AppIcon name="exclamationmark.triangle.fill" tintColor="#FF9500" size={20} />
                        <Text style={[styles.warningText, { color: colors.text }]}>
                            {t('recoveryWords.warning')}
                        </Text>
                    </View>
                </List.Wrapper>
            </ScrollViewContent>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { paddingBottom: Platform.OS === 'ios' ? 80 : 90 },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 32,
    },
    infoText: {
        fontSize: 16,
        textAlign: 'center',
    },
    langBadge: {
        alignSelf: 'center',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    langBadgeText: {
        fontSize: 14,
        fontWeight: '600',
    },
    grid: {
        marginTop: 18,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
    },
    wordCell: {
        width: '31%',
    },
    wordBox: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 40,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 8,
        gap: 2,
    },
    wordIndex: {
        fontSize: 11,
        fontWeight: '700',
        width: 16,
    },
    wordText: {
        fontSize: 15,
        letterSpacing: -0.2,
        fontWeight: '600',
    },
    warningBox: {
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 14,
        borderRadius: 12,
    },
    warningText: {
        fontSize: 13,
        lineHeight: 18,
        flex: 1,
    },
});
