import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { List, useTheme } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/src/components/ui/AppIcon';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';
import { useALSSubtype } from '@/src/questionnaires/structured/alsSubtype/hooks/useALSSubtype';
import { formatClassificationCode, summarizeALSSubtype } from '@/src/questionnaires/structured/alsSubtype/opmCodes';
import { fmtDateTime } from '@/src/lib/formatDate';
import { getMetricDefinition } from '@/src/metrics/definitions';

export default function ALSSubtypeListScreen() {
    const { colors } = useTheme();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();
    const { role, isDemo } = useAppRole();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();
    const { entries, deleteEntry, isLoading } = useALSSubtype();
    const [isEditing, setIsEditing] = useState(false);
    const isDE = i18n.language === 'de';
    const definition = getMetricDefinition('als_subtype', i18n.language);
    const canDelete = role === 'doctor' || isDemo;

    if (!sharingLoaded || (isFiltering && !canSeeMetric('als_subtype'))) {
        if (isFiltering && sharingLoaded) router.back();
        return null;
    }

    const handleDelete = (entryId: string) => {
        Alert.alert(
            t('metric.deleteEntry'),
            t('metric.deleteEntryConfirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteEntry(entryId);
                        } catch {
                            Alert.alert(t('common.error'), t('metric.deleteEntryError'));
                        }
                    },
                },
            ]
        );
    };

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: definition?.name ?? (isDE ? 'Subtyp-Verlauf' : 'Subtype history'),
                        headerBackButtonDisplayMode: 'minimal',
                        headerRight: () => canDelete && entries.length > 0 ? (
                            <HeaderButton title={isEditing ? t('common.done') : t('common.edit')} tintColor={colors.primary} onPress={() => setIsEditing(!isEditing)} />
                        ) : null,
                    }}
                />
            ) : (
                <>
                    <Stack.Screen.Title>{definition?.name ?? (isDE ? 'Subtyp-Verlauf' : 'Subtype history')}</Stack.Screen.Title>
                    {canDelete && entries.length > 0 && (
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button tintColor={colors.primary} onPress={() => setIsEditing(!isEditing)}>
                                {isEditing ? t('common.done') : t('common.edit')}
                            </Stack.Toolbar.Button>
                        </Stack.Toolbar>
                    )}
                </>
            )}
            <ScrollView
                style={{ backgroundColor: colors.background }}
                contentContainerStyle={styles.scrollView}
                contentInsetAdjustmentBehavior="automatic"
            >
                <View style={[styles.bodyWrapper, { paddingLeft: insets.left, paddingRight: insets.right }, insets.left > 200 && { maxWidth: 940 + insets.left }]}>
                    {entries.length === 0 ? (
                        isLoading ? (
                            <View style={styles.emptyState}>
                                <ActivityIndicator size="small" color={colors.textHint} />
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={[styles.emptyText, { color: colors.textHint }]}>
                                    {t('metric.noEntriesYet')}
                                </Text>
                            </View>
                        )
                    ) : (
                        <List.Section rounded>
                            {entries.map((entry, index) => (
                                <View key={entry.id} style={styles.listItemRow}>
                                    {isEditing && (
                                        <Pressable
                                            style={styles.deleteButton}
                                            onPress={() => handleDelete(entry.id)}
                                        >
                                            <AppIcon name="minus.circle.fill" size={22} tintColor="#FF3B30" />
                                        </Pressable>
                                    )}
                                    <View style={styles.listItemContent}>
                                        <List.Item
                                            title={formatClassificationCode(entry.classificationCode)}
                                            subtitle={`${fmtDateTime(new Date(entry.assessedAt), isDE)} · ${summarizeALSSubtype(entry, i18n.language)}`}
                                            subtitleNumberOfLines={3}
                                            hideChevron={isEditing}
                                            onPress={() => !isEditing && router.push(`/(tabs)/(metric)/alsSubtype/add?entryId=${entry.id}`)}
                                            lastItem={index === entries.length - 1}
                                        />
                                    </View>
                                </View>
                            ))}
                        </List.Section>
                    )}
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90,
    },
    bodyWrapper: {
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%',
    },
    listItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deleteButton: {
        paddingLeft: 16,
        paddingRight: 8,
        paddingVertical: 12,
    },
    listItemContent: {
        flex: 1,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
    },
});
