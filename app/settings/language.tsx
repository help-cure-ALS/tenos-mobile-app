import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { List } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { AppColors, useAppTheme } from '@/src/theme';
import {
    supportedLanguages,
    changeLanguage,
    type LanguageCode
} from '@/src/i18n';

export default function Language() {
    const { colors } = useAppTheme();
    const { i18n } = useTranslation();
    const styles = createStyles(colors);

    const currentLanguage = i18n.language as LanguageCode;

    const handleLanguageChange = async (code: LanguageCode) => {
        await changeLanguage(code);
    };

    return (
        <ScrollView
            style={{ backgroundColor: colors.modalBackground }}
            contentContainerStyle={styles.scrollView}
            contentInsetAdjustmentBehavior="automatic"
        >
            <View style={styles.scrollViewWrapper}>
                <List.Section rounded>
                    {supportedLanguages.map((language, index) => (
                        <List.Item
                            key={language.code}
                            title={language.nativeName}
                            subtitle={language.name}
                            lastItem={index === supportedLanguages.length - 1}
                            type="checkbox"
                            checked={currentLanguage === language.code}
                            hideChevron
                            onPress={() => handleLanguageChange(language.code)}
                        />
                    ))}
                </List.Section>
            </View>
        </ScrollView>
    );
}

const createStyles = (colors: AppColors) =>
    StyleSheet.create({
        scrollView: {
            paddingBottom: Platform.OS === 'ios' ? 80 : 90
        },
        scrollViewWrapper: {
            alignSelf: 'center',
            width: '100%',
            maxWidth: 664
        }
    });
