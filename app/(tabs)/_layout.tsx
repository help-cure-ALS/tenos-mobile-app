import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from "@/src/theme";
import { useAppRole } from "@/src/context/AppRoleProvider";
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSupplierProposalCounts } from '@/src/hooks/useSupplierProposalCounts';

export default function TabLayout() {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const { role } = useAppRole();
    const { syncHealth, syncBlockReason, recoverActivePatientIdentity } = useAppSync();
    const router = useSafeRouter();
    const { totalProposalCount } = useSupplierProposalCounts();

    const handleBlockedSyncAction = async () => {
        try {
            const recovered = await recoverActivePatientIdentity();
            if (recovered) {
                return;
            }
        } catch {
            // Fall through to settings navigation for manual recovery.
        }

        if (role === 'caregiver' || role === 'doctor') {
            router.push('/settings/patients');
        } else {
            router.push('/settings/account');
        }
    };

    const isBlocked = syncHealth === 'blocked_identity';
    const blockedMessage = syncBlockReason === 'missing_patient_identity'
        ? t('syncStatus.missingPatientIdentity')
        : t('syncStatus.identityBlocked');

    return (
        <View style={styles.container}>
            {isBlocked && (
                <View style={[styles.syncBanner, { backgroundColor: colors.warning + '22', borderBottomColor: colors.warning + '66' }]}>
                    <Text style={[styles.syncBannerText, { color: colors.text }]}>
                        {blockedMessage}
                    </Text>
                    <Pressable onPress={handleBlockedSyncAction} hitSlop={8}>
                        <Text style={[styles.syncBannerAction, { color: colors.warning }]}>
                            {t('syncStatus.recoverAction')}
                        </Text>
                    </Pressable>
                </View>
            )}

            <NativeTabs
                minimizeBehavior="automatic"
                tintColor={colors.tint}
                sidebarAdaptable={true}
                {...(Platform.OS === 'android' && {
                    backgroundColor: colors.mainBackground,
                    indicatorColor: colors.tint + '30',
                    rippleColor: colors.tint + '40',
                })}
            >
                <NativeTabs.Trigger name="(metric)">
                    <NativeTabs.Trigger.Label>{t('tabs.overview')}</NativeTabs.Trigger.Label>
                    <NativeTabs.Trigger.Icon
                        src={{
                            default: require('@/assets/tab-icons/staroflife.png'),
                            selected: require('@/assets/tab-icons/staroflife-fill.png'),
                        }}
                        renderingMode="template"
                    />
                </NativeTabs.Trigger>
                { role !== 'doctor' && (
                    <NativeTabs.Trigger name="share">
                        <NativeTabs.Trigger.Label>{t('tabs.share')}</NativeTabs.Trigger.Label>
                        <NativeTabs.Trigger.Icon
                            src={require('@/assets/tab-icons/figure-2-arms-open.png')}
                            renderingMode="template"
                        />
                        {
                            totalProposalCount > 0 && (
                                <NativeTabs.Trigger.Badge>
                                    {String(totalProposalCount)}
                                </NativeTabs.Trigger.Badge>
                            )
                        }
                    </NativeTabs.Trigger>
                ) }

                <NativeTabs.Trigger name="search" role="search">
                    {(Platform.OS === 'android' || Platform.isPad) && (
                        <NativeTabs.Trigger.Label>{t('tabs.search')}</NativeTabs.Trigger.Label>
                    )}
                    <NativeTabs.Trigger.Icon
                        src={require('@/assets/tab-icons/magnifyingglass.png')}
                        renderingMode="template"
                    />
                </NativeTabs.Trigger>
            </NativeTabs>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    syncBanner: {
        marginTop: 50,
        borderBottomWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    syncBannerText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
    },
    syncBannerAction: {
        fontSize: 13,
        fontWeight: '700',
    },
});
