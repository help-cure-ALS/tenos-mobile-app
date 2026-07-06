import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ImageBackground,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import { Stack } from 'expo-router';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { useTranslation } from 'react-i18next';
import { Badge, List, Space, Text } from 'react-native-nice-ui';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useAppTheme } from '@/src/theme';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    useAids,
    AID_CATEGORY_ICONS,
    AID_CATEGORY_COLORS,
    AID_STATUS_COLORS,
    ALL_AID_CATEGORIES,
    getCatalogEntry,
    getCatalogName
} from '@/src/aids';
import type { AidCategory, AidItem, AidStatus } from '@/src/aids';
import { useSharingFilter } from "@/src/hooks/useSharingFilter";
import { useSupplierProposalCounts } from '@/src/hooks/useSupplierProposalCounts';
import { useAssistiveAidsRouteGuard } from '@/src/hooks/useAssistiveAidsRouteGuard';

type StatusFilter = 'all' | 'suggested' | 'requested' | 'approved' | 'rejected';

export default function AidsListScreen() {
    const { isAllowed } = useAssistiveAidsRouteGuard('/(tabs)/(metric)');

    if (!isAllowed) {
        return null;
    }

    return <AidsListContent />;
}

function AidsListContent() {
    const { t, i18n } = useTranslation();
    const { colors, isDark } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { isFiltering, isLoaded: sharingLoaded, canSeeCategory } = useSharingFilter();
    const { aids, deleteAid } = useAids();
    const { isDemo } = useAppRole();
    const [filter, setFilter] = useState<StatusFilter>('all');
    const { supplierIntegrations, proposalCounts } = useSupplierProposalCounts();

    const filteredAids = useMemo(() => {
        if (filter === 'all') {
            return aids;
        }
        return aids.filter(a => a.status === filter);
    }, [aids, filter]);

    // Group by category
    const groupedAids = useMemo(() => {
        const groups: Partial<Record<AidCategory, AidItem[]>> = {};
        for (const aid of filteredAids) {
            if (!groups[aid.category]) {
                groups[aid.category] = [];
            }
            groups[aid.category]!.push(aid);
        }
        return groups;
    }, [filteredAids]);

    const handleDelete = useCallback((aid: AidItem) => {
        Alert.alert(
            t('aids.deleteTitle'),
            t('aids.deleteMessage', { name: aid.name }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => deleteAid(aid.id)
                }
            ]
        );
    }, [deleteAid, t]);

    const getDisplayName = useCallback((aid: AidItem) => {
        if (aid.catalogId) {
            const entry = getCatalogEntry(aid.catalogId);
            if (entry) {
                return getCatalogName(entry, i18n.language);
            }
        }
        return aid.name;
    }, [i18n.language]);

    const renderStatusBadge = useCallback((status: AidStatus) => {
        if (status === 'none') {
            return null;
        }
        const color = AID_STATUS_COLORS[status];
        return (
            <Badge
                label={ t(`aids.status.${ status }`) }
                color={ color + '20' }
                textColor={ color }
                style={ { alignSelf: 'flex-start' } }
            />
        );
    }, [t]);

    const handleAddSupplier = useCallback(() => {
        if (isDemo) {
            Alert.alert(t('common.demoModeTitle'), t('common.demoModeMessage'), [{ text: t('common.ok') }]);
            return;
        }
        router.push('/(tabs)/(metric)/aids/supplierLink');
    }, [isDemo, router, t]);

    const filterChips: { key: StatusFilter; label: string }[] = [
        { key: 'all', label: t('aids.filters.all') },
        { key: 'suggested', label: t('aids.filters.suggested') },
        { key: 'requested', label: t('aids.filters.requested') },
        { key: 'approved', label: t('aids.filters.approved') },
        { key: 'rejected', label: t('aids.filters.rejected') }
    ];

    if (!sharingLoaded) {
        return <View style={ {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background
        } }><ActivityIndicator /></View>;
    }
    if (isFiltering && !canSeeCategory('aids')) {
        router.back();
        return null;
    }

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={ {
                        headerTitle: t('navigation.aids'),
                        headerLargeTitle: false,
                        headerRight: () => (
                            <HeaderButton
                                icon="plus"
                                variant="done"
                                onPress={() => router.push('/(tabs)/(metric)/aids/add')}
                            />
                        )
                    } }
                />
            ) : (
                <>
                    <Stack.Screen options={ { headerLargeTitle: false } } />
                    <Stack.Screen.Title>{t('navigation.aids')}</Stack.Screen.Title>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button icon="plus" variant="done" tintColor={colors.textPrimary} onPress={() => router.push('/(tabs)/(metric)/aids/add')} />
                    </Stack.Toolbar>
                </>
            )}
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') }
                             style={ [{ flex: 1 }, { backgroundColor: colors.background }] }>
                <ScrollView
                    style={ { flex: 1 } }
                    contentContainerStyle={ styles.scrollView }
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <View style={ [styles.bodyWrapper,
                        {
                            paddingLeft: insets.left,
                            paddingRight: insets.right
                        },
                        insets.left > 200 && { maxWidth: 940 + insets.left }
                    ] }>
                        <ScreenHeader
                            icon="figure.roll"
                            subtitle={ t('aids.headerSubtitle') }
                        />
                        <Space size="sm" />

                        {/* Filter chips */ }
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={ false }
                            contentContainerStyle={ styles.chipRow }
                        >
                            { filterChips.map(chip => {
                                const active = filter === chip.key;
                                return (
                                    <Pressable
                                        key={ chip.key }
                                        onPress={ () => setFilter(chip.key) }
                                        style={ [
                                            styles.chip,
                                            {
                                                backgroundColor: active ? colors.tint : colors.listItemBackground,
                                                borderColor: active ? colors.tint : colors.borderLight
                                            }
                                        ] }
                                    >
                                        <Text
                                            variant="bodySmall"
                                            style={ {
                                                color: active ? '#FFFFFF' : colors.textSecondary,
                                                fontWeight: active ? '600' : '400'
                                            } }
                                        >
                                            { chip.label }
                                        </Text>
                                    </Pressable>
                                );
                            }) }
                        </ScrollView>

                        {/* Supplier section */ }
                        <List.Section
                            title={ t('supplier.sectionTitle') }
                            rounded
                            rightCmp={
                                <Pressable onPress={ handleAddSupplier } hitSlop={ 8 }>
                                    <Text style={ { fontWeight: '500', color: colors.tint } }>
                                        { t('supplier.add') }
                                    </Text>
                                </Pressable>
                            }
                        >
                            { supplierIntegrations.length > 0 ? (
                                supplierIntegrations.map((integration, idx) => (
                                    <List.Item
                                        key={ integration.id }
                                        title={ integration.organizationName }
                                        subtitle={ integration.active ? t('supplier.statusActive') : t('supplier.statusPaused') }
                                        leftCmpSize={ 32 }
                                        leftCmp={ <ListItemIcon name="cross.case.fill" color={colors.textPrimary} backgroundColor={colors.listItemBackgroundMuted} />}
                                        rightCmp={ (proposalCounts[integration.id] ?? 0) > 0 ? (
                                            <Badge label={ String(proposalCounts[integration.id]) } variant="error" />
                                        ) : undefined }
                                        onPress={ () => router.push({
                                            pathname: '/(tabs)/(metric)/aids/supplierManage',
                                            params: { integrationId: integration.id, origin: 'aids' }
                                        }) }
                                        lastItem={ idx === supplierIntegrations.length - 1 }
                                    />
                                ))
                            ) : (
                                <List.Item
                                    title={ t('supplier.noIntegrations') }
                                    subtitle={ t('supplier.noIntegrationsDesc') }
                                    subtitleNumberOfLines={ 2 }
                                    onPress={ handleAddSupplier }
                                    lastItem
                                />
                            ) }
                        </List.Section>

                        {/* Empty state */ }
                        { aids.length === 0 && (
                            <List.Wrapper>
                            <View style={ styles.emptyState }>
                                <Text variant="bodyMedium" color="tertiary" align="center">
                                    { t('aids.noAidsHint') }
                                </Text>
                            </View>
                            </List.Wrapper>
                        ) }

                        {/* No results for filter */ }
                        { aids.length > 0 && filteredAids.length === 0 && (
                            <View style={ styles.emptyState }>
                                <Text variant="bodyLarge" color="secondary" align="center">
                                    { t('aids.noAidsYet') }
                                </Text>
                            </View>
                        ) }

                        {/* Grouped list */ }
                        { ALL_AID_CATEGORIES.map(cat => {
                            const items = groupedAids[cat];
                            if (!items || items.length === 0) {
                                return null;
                            }
                            return (
                                <List.Section
                                    key={ cat }
                                    title={ t(`aids.categories.${ cat }`) }
                                    rounded
                                >
                                    { items.map((aid, idx) => (
                                        <List.Item
                                            key={ aid.id }
                                            title={ getDisplayName(aid) }
                                            titleNumberOfLines={ 2 }
                                            leftCmpSize={ 32 }
                                            leftCmp={
                                                <ListItemIcon name={ AID_CATEGORY_ICONS[cat] }
                                                              color={ AID_CATEGORY_COLORS[cat] } />
                                            }
                                            rightCmp={ renderStatusBadge(aid.status) }
                                            onPress={ () => router.push(`/(tabs)/(metric)/aids/${ aid.id }`) }
                                            onLongPress={ () => handleDelete(aid) }
                                            lastItem={ idx === items.length - 1 }
                                        />
                                    )) }
                                </List.Section>
                            );
                        }) }

                        {/* Footer hint */ }
                        { aids.length > 0 && (
                            <Text
                                variant="labelSmall"
                                color="tertiary"
                                align="center"
                                style={ styles.footerHint }
                            >
                                { t('aids.longPressHint') }
                            </Text>
                        ) }
                    </View>
                </ScrollView>
            </ImageBackground>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        paddingTop: 20,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    chipRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 12,
    },
    emptyText: {
        marginTop: 4,
    },
    footerHint: {
        marginTop: 12,
        marginBottom: 20,
    },
});
