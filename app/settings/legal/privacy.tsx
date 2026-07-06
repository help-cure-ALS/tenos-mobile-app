import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { AppIcon } from "@/src/components/ui/AppIcon";

export default function Privacy() {
    const { t, i18n } = useTranslation('legal-privacy');
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const { modal } = useLocalSearchParams<{ modal?: string }>();
    const showCloseButton = modal === '1';

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

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
            {showCloseButton && (
                <>
                {Platform.OS === 'android' ? (
                        <Stack.Screen
                            options={{
                                animation: 'slide_from_bottom',
                                headerShown: true,
                                headerTransparent: false,
                                headerBackVisible: false,
                                headerRight: () => (
                                    <TouchableOpacity onPress={() => router.back()}>
                                        <AppIcon name="xmark" tintColor={colors.primary} size={22} />
                                    </TouchableOpacity>
                                )
                            }}
                        />
                    ) : (
                        <Stack.Screen>
                            <Stack.Toolbar placement="right">
                                <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} />
                            </Stack.Toolbar>
                        </Stack.Screen>
                    )}
                </>
            )}
            <ScrollView
                style={[styles.container, { backgroundColor: colors.background }]}
                contentContainerStyle={styles.content}
                contentInsetAdjustmentBehavior="automatic"
            >
                {/* Header */}
                <Text style={[styles.title, { color: colors.text }]}>{t('title')}</Text>
                <Text style={[styles.date, { color: colors.textSecondary }]}>
                    {t('lastUpdated')}
                </Text>

                {/* Translation Notice (only for non-German) */}
                {!isGerman && (
                    <View style={[styles.notice, { backgroundColor: colors.listItemBackground }]}>
                        <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                            {t('translationNotice')}
                        </Text>
                    </View>
                )}

                {/* Summary */}
                <View style={[styles.summary, { backgroundColor: colors.tint + '15' }]}>
                    <Text style={[styles.summaryLabel, { color: colors.tint }]}>
                        {t('summary.label')}
                    </Text>
                    <Text style={[styles.summaryText, { color: colors.text }]}>
                        {t('summary.text')}
                    </Text>
                </View>

                {/* Section 1: Responsible */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.responsible.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.responsible.content')}
                </Text>
                <View style={[styles.address, { backgroundColor: colors.listItemBackground }]}>
                    <Text style={[styles.addressOrg, { color: colors.text }]}>
                        {t('sections.responsible.organization')}
                    </Text>
                    <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                        {t('sections.responsible.address')}
                    </Text>
                    <Text style={[styles.addressLink, { color: colors.tint }]}>
                        {t('sections.responsible.email')}
                    </Text>
                    <Text style={[styles.addressLink, { color: colors.tint }]}>
                        {t('sections.responsible.website')}
                    </Text>
                </View>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.responsible.description')}
                </Text>

                {/* Section 2: Principles */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.principles.title')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.principles.encryption.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.principles.encryption.content')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.principles.minimization.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.principles.minimization.content')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.principles.sovereignty.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.principles.sovereignty.content')}
                </Text>
                {renderList(t('sections.principles.sovereignty.items', { returnObjects: true }) as string[])}

                {/* Section 3: Data Processed */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.dataProcessed.title')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.dataProcessed.healthProfile.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.dataProcessed.healthProfile.intro')}
                </Text>
                {renderList(t('sections.dataProcessed.healthProfile.items', { returnObjects: true }) as string[])}
                <Text style={[styles.legalBasis, { color: colors.textSecondary }]}>
                    {t('sections.dataProcessed.healthProfile.legalBasis')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.dataProcessed.metrics.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.dataProcessed.metrics.intro')}
                </Text>
                {renderList(t('sections.dataProcessed.metrics.items', { returnObjects: true }) as string[])}
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.dataProcessed.metrics.storage')}
                </Text>
                <Text style={[styles.legalBasis, { color: colors.textSecondary }]}>
                    {t('sections.dataProcessed.metrics.legalBasis')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.dataProcessed.questionnaires.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.dataProcessed.questionnaires.intro')}
                </Text>
                {renderList(t('sections.dataProcessed.questionnaires.items', { returnObjects: true }) as string[])}
                <View style={[styles.disclaimer, { backgroundColor: colors.warning + '20' }]}>
                    <Text style={[styles.disclaimerText, { color: colors.text }]}>
                        {t('sections.dataProcessed.questionnaires.disclaimer')}
                    </Text>
                </View>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.dataProcessed.medications.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.dataProcessed.medications.intro')}
                </Text>
                {renderList(t('sections.dataProcessed.medications.items', { returnObjects: true }) as string[])}

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.dataProcessed.deviceData.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.dataProcessed.deviceData.intro')}
                </Text>
                {renderList(t('sections.dataProcessed.deviceData.items', { returnObjects: true }) as string[])}
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.dataProcessed.deviceData.purpose')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.dataProcessed.biometrics.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.dataProcessed.biometrics.content')}
                </Text>

                {/* Section 4: Storage */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.storage.title')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.storage.local.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.storage.local.content')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.storage.local.keyStorage')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.storage.cloud.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.storage.cloud.intro')}
                </Text>
                {renderList(t('sections.storage.cloud.items', { returnObjects: true }) as string[])}
                <Text style={[styles.legalBasis, { color: colors.textSecondary }]}>
                    {t('sections.storage.cloud.legalBasis')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.storage.serverAccess.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.storage.serverAccess.intro')}
                </Text>
                {renderList(t('sections.storage.serverAccess.visible', { returnObjects: true }) as string[])}
                <Text style={[styles.highlightText, { color: colors.text }]}>
                    {t('sections.storage.serverAccess.notVisible')}
                </Text>

                {/* Section 5: Sharing */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.sharing.title')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.sharing.withOthers.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.sharing.withOthers.content')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.sharing.withOthers.rolesIntro')}
                </Text>
                {renderList(t('sections.sharing.withOthers.roles', { returnObjects: true }) as string[])}
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.sharing.withOthers.revoke')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.sharing.careAndSuppliers.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.sharing.careAndSuppliers.content')}
                </Text>
                {renderList(t('sections.sharing.careAndSuppliers.items', { returnObjects: true }) as string[])}

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.sharing.studies.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.sharing.studies.intro')}
                </Text>
                {renderList(t('sections.sharing.studies.conditions', { returnObjects: true }) as string[])}
                <Text style={[styles.legalBasis, { color: colors.textSecondary }]}>
                    {t('sections.sharing.studies.legalBasis')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.sharing.noThirdParties.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.sharing.noThirdParties.content')}
                </Text>
                {renderList(t('sections.sharing.noThirdParties.exceptions', { returnObjects: true }) as string[])}

                {/* Section 6: Notifications */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.notifications.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.notifications.content')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.notifications.disable')}
                </Text>

                {/* Section 7: Permissions */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.permissions.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.permissions.intro')}
                </Text>
                {renderList(t('sections.permissions.items', { returnObjects: true }) as string[])}
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.permissions.optional')}
                </Text>

                {/* Section 8: No Tracking */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.noTracking.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.noTracking.intro')}
                </Text>
                {renderList(t('sections.noTracking.items', { returnObjects: true }) as string[])}

                {/* Section 9: Recipients */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.recipients.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.recipients.content')}
                </Text>
                {renderList(t('sections.recipients.items', { returnObjects: true }) as string[])}
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.recipients.thirdCountries')}
                </Text>

                {/* Section 10: Automated Decisions */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.automatedDecision.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.automatedDecision.content')}
                </Text>

                {/* Section 11: Retention */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.retention.title')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.retention.duration.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.retention.duration.content')}
                </Text>

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.retention.deletion.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.retention.deletion.intro')}
                </Text>
                {renderList(t('sections.retention.deletion.options', { returnObjects: true }) as string[])}

                <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                    {t('sections.retention.deviceDeactivation.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.retention.deviceDeactivation.content')}
                </Text>

                {/* Section 12: Security */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.security.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.security.intro')}
                </Text>
                {renderList(t('sections.security.measures', { returnObjects: true }) as string[])}

                {/* Section 13: Rights */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.rights.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.rights.intro')}
                </Text>
                {renderList(t('sections.rights.items', { returnObjects: true }) as string[])}
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.rights.exercise')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.rights.complaint')}
                </Text>

                {/* Section 14: Health Data */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.healthData.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.healthData.special')}
                </Text>
                <View style={[styles.disclaimer, { backgroundColor: colors.warning + '20' }]}>
                    <Text style={[styles.disclaimerText, { color: colors.text }]}>
                        {t('sections.healthData.disclaimer')}
                    </Text>
                </View>

                {/* Section 15: Minors */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.minors.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.minors.content')}
                </Text>

                {/* Section 16: Changes */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.changes.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.changes.content')}
                </Text>

                {/* Section 17: Contact */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('sections.contact.title')}
                </Text>
                <Text style={[styles.paragraph, { color: colors.text }]}>
                    {t('sections.contact.intro')}
                </Text>
                <View style={[styles.address, { backgroundColor: colors.listItemBackground }]}>
                    <Text style={[styles.addressOrg, { color: colors.text }]}>
                        {t('sections.contact.organization')}
                    </Text>
                    <Text style={[styles.addressLink, { color: colors.tint }]}>
                        {t('sections.contact.email')}
                    </Text>
                    <Text style={[styles.addressLink, { color: colors.tint }]}>
                        {t('sections.contact.website')}
                    </Text>
                </View>

                {/* Footer */}
                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                    <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                        {t('footer')}
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
        marginBottom: 4,
    },
    date: {
        fontSize: 14,
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
    summary: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
    },
    summaryLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    summaryText: {
        fontSize: 15,
        lineHeight: 22,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginTop: 28,
        marginBottom: 12,
    },
    subsectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 8,
    },
    paragraph: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 12,
    },
    highlightText: {
        fontSize: 15,
        lineHeight: 22,
        fontWeight: '600',
        marginBottom: 12,
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
    legalBasis: {
        fontSize: 13,
        fontStyle: 'italic',
        marginBottom: 12,
    },
    address: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    addressOrg: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    addressText: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8,
    },
    addressLink: {
        fontSize: 14,
        marginBottom: 4,
    },
    disclaimer: {
        padding: 14,
        borderRadius: 10,
        marginVertical: 12,
    },
    disclaimerText: {
        fontSize: 14,
        lineHeight: 20,
    },
    footer: {
        marginTop: 32,
        paddingTop: 20,
        borderTopWidth: 1,
    },
    footerText: {
        fontSize: 13,
        lineHeight: 19,
    },
});
