import React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { List } from 'react-native-nice-ui';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { FeatureItem } from '@/src/components/ui/FeatureItem';


export default function PrivacyInfoScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();

    return (
        <ScrollView
            style={{ backgroundColor: colors.modalBackground }}
            contentContainerStyle={styles.scrollView}
            contentInsetAdjustmentBehavior="automatic"
        >
            <ScrollViewContent>
                <ScreenHeader
                    icon="lock.shield"
                    iconTintColor={ colors.brandColorMuted }
                    title={t('privacyInfo.title')}
                    subtitle={t('privacyInfo.intro')}
                />

                {/* Key Privacy Features */}
                <View style={styles.featuresSection}>
                    <FeatureItem
                        icon="lock.fill"
                        iconColor={colors.textPrimary}
                        variant="fill"
                        title={t('privacyInfo.encryptionTitle')}
                        description={t('privacyInfo.encryptionDesc')}
                    />
                    <FeatureItem
                        icon="eye.slash.fill"
                        iconColor={colors.textPrimary}
                        variant="fill"
                        title={t('privacyInfo.noAccessTitle')}
                        description={t('privacyInfo.noAccessDesc')}
                    />
                    <FeatureItem
                        icon="hand.raised.fill"
                        iconColor={colors.textPrimary}
                        variant="fill"
                        title={t('privacyInfo.controlTitle')}
                        description={t('privacyInfo.controlDesc')}
                    />
                    <FeatureItem
                        icon="person.2.fill"
                        iconColor={colors.textPrimary}
                        variant="fill"
                        title={t('privacyInfo.sharingTitle')}
                        description={t('privacyInfo.sharingDesc')}
                    />
                </View>

                {/* Organization Info */}
                <View style={styles.orgSection}>
                    <Text style={[styles.orgText, { color: colors.textSecondary }]}>
                        {t('privacyInfo.orgInfo')}
                    </Text>
                </View>

                {/* Link to full privacy policy */}
                <List.Section rounded>
                    <List.Item
                        title={t('privacyInfo.fullPolicy')}
                        onPress={() => router.push('/settings/legal/privacy')}
                        lastItem
                    />
                </List.Section>
            </ScrollViewContent>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90,
    },
    featuresSection: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        gap: 16,
    },
    orgSection: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
    },
    orgText: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
});
