import React from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/theme';

export default function Imprint() {
    const { t, i18n } = useTranslation('legal-imprint');
    const { colors } = useAppTheme();

    const isGerman = i18n.language === 'de';

    const renderList = (items: string[]) => (
        <View style={styles.list}>
            {items.map((item, index) => (
                <View key={index} style={styles.listItem}>
                    <Text style={[styles.bullet, { color: colors.textSecondary }]}>•</Text>
                    <Text style={[styles.listItemText, { color: colors.text }]}>{item}</Text>
                </View>
            ))}
        </View>
    );

    const handleEmailPress = () => {
        Linking.openURL(`mailto:${t('sections.contact.email')}`);
    };

    const handleWebsitePress = () => {
        Linking.openURL(t('sections.contact.website'));
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
            <ScrollView
                style={[styles.container, { backgroundColor: colors.background }]}
                contentContainerStyle={styles.content}
                contentInsetAdjustmentBehavior="automatic"
            >
                {/* Header */}
                <Text style={[styles.title, { color: colors.text }]}>{t('title')}</Text>

                {/* Translation Notice (only for non-German) */}
                {!isGerman && (
                    <View style={[styles.notice, { backgroundColor: colors.listItemBackground }]}>
                        <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                            {t('translationNotice')}
                        </Text>
                    </View>
                )}

                {/* Provider */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.provider.title')}
                </Text>
                <View style={[styles.address, { backgroundColor: colors.listItemBackground }]}>
                    <Text style={[styles.addressOrg, { color: colors.text }]}>
                        {t('sections.provider.organization')}
                    </Text>
                    <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                        {t('sections.provider.address')}
                    </Text>
                </View>

                {/* Representation */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.representation.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.representation.content')}
                </Text>

                {/* Registration */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.registration.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.registration.content')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.registration.court')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.registration.number')}
                </Text>

                {/* Contact */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.contact.title')}
                </Text>
                <Text
                    style={[styles.link, { color: colors.tint }]}
                    onPress={handleEmailPress}
                >
                    {t('sections.contact.email')}
                </Text>
                <Text
                    style={[styles.link, { color: colors.tint }]}
                    onPress={handleWebsitePress}
                >
                    {t('sections.contact.website')}
                </Text>

                {/* Responsible for Content */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.responsible.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.responsible.content')}
                </Text>

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* Liability */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.liability.title')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.liability.content.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.liability.content.text')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.liability.content.tmg')}
                </Text>

                {/* Medical Disclaimer */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.medicalDisclaimer.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.medicalDisclaimer.intro')}
                </Text>
                {renderList(t('sections.medicalDisclaimer.items', { returnObjects: true }) as string[])}
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.medicalDisclaimer.advice')}
                </Text>
                <View style={[styles.emergency, { backgroundColor: colors.error + '20' }]}>
                    <Text style={[styles.emergencyText, { color: colors.error }]}>
                        {t('sections.medicalDisclaimer.emergency')}
                    </Text>
                </View>

                {/* Availability */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.availability.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.availability.content')}
                </Text>

                {/* Links */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.links.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.links.content')}
                </Text>

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* Copyright */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.copyright.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.copyright.content')}
                </Text>

                {/* Open Source */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.openSource.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.openSource.content')}
                </Text>

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* About */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.about.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.about.content')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.about.moreInfo')}
                </Text>
                <Text
                    style={[styles.link, { color: colors.tint }]}
                    onPress={handleWebsitePress}
                >
                    {t('sections.contact.website')}
                </Text>

                {/* Footer */}
                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                    <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                        {t('lastUpdated')}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 20,
    },
    notice: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    noticeText: {
        fontSize: 13,
        fontStyle: 'italic',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 24,
        marginBottom: 10,
    },
    subsectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
    },
    paragraph: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 8,
    },
    address: {
        padding: 16,
        borderRadius: 12,
        marginTop: 4,
    },
    addressOrg: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    addressText: {
        fontSize: 14,
        lineHeight: 20,
    },
    link: {
        fontSize: 15,
        marginBottom: 6,
    },
    list: {
        marginBottom: 12,
    },
    listItem: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    bullet: {
        fontSize: 15,
        marginRight: 8,
        marginTop: 1,
    },
    listItemText: {
        fontSize: 15,
        lineHeight: 22,
        flex: 1,
    },
    emergency: {
        padding: 14,
        borderRadius: 10,
        marginVertical: 12,
    },
    emergencyText: {
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
    divider: {
        height: 1,
        marginVertical: 24,
    },
    footer: {
        marginTop: 32,
        paddingTop: 20,
        borderTopWidth: 1,
    },
    footerText: {
        fontSize: 13,
    },
});
