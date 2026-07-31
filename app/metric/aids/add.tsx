import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { List, Text } from 'react-native-nice-ui';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import {
    useAids,
    AID_CATALOG,
    AID_CATEGORY_ICONS,
    AID_CATEGORY_COLORS,
    ALL_AID_CATEGORIES,
    getCatalogName,
} from '@/src/aids';
import type { AidCategory } from '@/src/aids';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';
import { useAssistiveAidsRouteGuard } from '@/src/hooks/useAssistiveAidsRouteGuard';

export default function AddAidScreen() {
    const { isAllowed } = useAssistiveAidsRouteGuard('/(tabs)/(metric)');

    if (!isAllowed) {
        return null;
    }

    return <AddAidContent />;
}

function AddAidContent() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const { aids, addAids } = useAids();
    const { isFiltering, isLoaded: sharingLoaded, canSeeCategory } = useSharingFilter();

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchText, setSearchText] = useState('');
    const [customName, setCustomName] = useState('');
    const [customCategory, setCustomCategory] = useState<AidCategory | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const filteredCatalog = useMemo(() => {
        if (!searchText.trim()) return AID_CATALOG;
        const lower = searchText.toLowerCase();
        return AID_CATALOG.filter(entry => {
            const name = getCatalogName(entry, i18n.language).toLowerCase();
            const tags = entry.tags.toLowerCase();
            return name.includes(lower) || tags.includes(lower);
        });
    }, [searchText, i18n.language]);

    const toggleEntry = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const hasChanges = selectedIds.size > 0 || (customName.trim().length > 0 && customCategory !== null);

    const handleSave = useCallback(async () => {
        if (isSaving) return;
        setIsSaving(true);

        try {
            const inputs: Array<{ catalogId?: string; name: string; category: AidCategory }> = [];

            for (const id of selectedIds) {
                const entry = AID_CATALOG.find(e => e.id === id);
                if (entry) {
                    inputs.push({
                        catalogId: entry.id,
                        name: getCatalogName(entry, i18n.language),
                        category: entry.category,
                    });
                }
            }

            if (customName.trim() && customCategory) {
                inputs.push({
                    name: customName.trim(),
                    category: customCategory,
                });
            }

            if (inputs.length > 0) {
                await addAids(inputs);
            }

            router.back();
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, selectedIds, customName, customCategory, addAids, router, i18n.language]);

    const handleClose = useCallback(() => {
        router.back();
    }, []);

    const handleCategoryPicker = useCallback(() => {
        const categoryLabels = ALL_AID_CATEGORIES.map(cat => t(`aids.categories.${cat}`));

        if (Platform.OS === 'ios') {
            const { ActionSheetIOS } = require('react-native');
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: [t('common.cancel'), ...categoryLabels],
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex > 0) {
                        setCustomCategory(ALL_AID_CATEGORIES[buttonIndex - 1]);
                    }
                },
            );
        } else {
            Alert.alert(
                t('aids.selectCategory'),
                undefined,
                [
                    ...ALL_AID_CATEGORIES.map((cat, i) => ({
                        text: categoryLabels[i],
                        onPress: () => setCustomCategory(cat),
                    })),
                    { text: t('common.cancel'), style: 'cancel' as const },
                ],
            );
        }
    }, [t]);

    const searchBarOptions = {
        placeholder: t('aids.searchPlaceholder'),
        onChangeText: (e: { nativeEvent: { text: string } }) => setSearchText(e.nativeEvent.text),
        autoCapitalize: 'none' as const,
    };

    if (!sharingLoaded || (isFiltering && !canSeeCategory('aids'))) {
        if (isFiltering && sharingLoaded) router.back();
        return null;
    }

    return (
        <>
            {
                Platform.OS === 'android' ? (
                    <Stack.Screen
                        options={{
                            animation: 'slide_from_bottom',
                            headerShown: true,
                            headerTransparent: false,
                            headerBackVisible: false,
                            headerTitle: t('navigation.newAid'),
                            headerSearchBarOptions: searchBarOptions,
                            headerRight: () => (
                                <HeaderButton
                                    onPress={handleSave}
                                    icon="checkmark"
                                    variant="done"
                                    disabled={!hasChanges || isSaving}
                                />
                            ),
                        }}
                    />
                ) : (
                    <Stack.Screen options={{ headerSearchBarOptions: searchBarOptions }}>
                        <Stack.Screen.Title>{t('navigation.newAid')}</Stack.Screen.Title>
                        <Stack.Toolbar placement="left">
                            <Stack.Toolbar.Button icon="xmark" onPress={handleClose} />
                        </Stack.Toolbar>
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="checkmark" onPress={handleSave} disabled={!hasChanges || isSaving} />
                        </Stack.Toolbar>
                    </Stack.Screen>
                )
            }

            <ScrollView
                style={{ backgroundColor: colors.background }}
                contentContainerStyle={styles.scrollView}
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
            >
                <ScrollViewContent>
                    {/* Catalog sections by category */}
                    {ALL_AID_CATEGORIES.map(cat => {
                        const entries = filteredCatalog.filter(e => e.category === cat);
                        if (entries.length === 0) return null;

                        return (
                            <List.Section
                                key={cat}
                                title={t(`aids.categories.${cat}`)}
                                rounded
                            >
                                {entries.map((entry, idx) => {
                                    const selected = selectedIds.has(entry.id);
                                    return (
                                        <List.Item
                                            key={entry.id}
                                            title={getCatalogName(entry, i18n.language)}
                                            titleNumberOfLines={2}
                                            hideChevron={true}
                                            leftCmpSize={32}
                                            leftCmp={
                                                <ListItemIcon
                                                    name={AID_CATEGORY_ICONS[cat]}
                                                    color={AID_CATEGORY_COLORS[cat]}
                                                    backgroundColor={AID_CATEGORY_COLORS[cat] + '20'}
                                                />
                                            }
                                            rightCmp={
                                                selected ? (
                                                    <AppIcon name="checkmark.circle.fill" tintColor={colors.tint} size={22} />
                                                ) : (
                                                    <AppIcon name="circle" tintColor={colors.textTertiary} size={22} />
                                                )
                                            }
                                            onPress={() => toggleEntry(entry.id)}
                                            lastItem={idx === entries.length - 1}
                                        />
                                    );
                                })}
                            </List.Section>
                        );
                    })}

                    {/* Custom entry section */}
                    <List.Section title={t('aids.customEntry')} rounded>
                        <List.Item
                            title={
                                <TextInput
                                    style={[styles.inlineInput, { color: colors.textPrimary }]}
                                    placeholder={t('aids.customNamePlaceholder')}
                                    placeholderTextColor={colors.textTertiary}
                                    value={customName}
                                    onChangeText={setCustomName}
                                />
                            }
                        />
                        {customName.trim().length > 0 && (
                            <List.Item
                                title={t('aids.selectCategory')}
                                subtitle={customCategory ? t(`aids.categories.${customCategory}`) : undefined}
                                onPress={handleCategoryPicker}
                                lastItem
                            />
                        )}
                    </List.Section>
                </ScrollViewContent>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90,
    },
    inlineInput: {
        fontSize: 16,
        padding: 0,
        flex: 1,
    },
});
