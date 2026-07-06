import { AppIcon } from '@/src/components/ui/AppIcon';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { List } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';

import { useMetric, getValueLabel, type MetricInputType } from '@/src/metrics';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useMetricBasePath } from '@/src/hooks/useMetricBasePath';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmtDateTime } from '@/src/lib/formatDate';
import { useSharingFilter } from '@/src/hooks/useSharingFilter';

export default function MetricList() {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { metricId } = useLocalSearchParams<{ metricId: string }>();
    const basePath = useMetricBasePath(metricId);
    const [isEditing, setIsEditing] = useState(false);
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();

    const { displayDefinition, displayEntries, entries, deleteEntry, isLoading } = useMetric({ metricId, mode: 'full' });

    // Pre-compute all display strings once (avoids per-render work)
    const listEntries = useMemo(() => {
        if (!displayDefinition) return [];
        const isDE = i18n.language === 'de';

        return displayEntries.map(entry => {
            let title: string;
            if (displayDefinition.fields.length === 1) {
                const field = displayDefinition.fields[0];
                title = formatField(entry.values[field.key], field, displayDefinition, entry.unit, isDE);
            } else {
                title = displayDefinition.fields
                    .map(field => `${field.label}: ${formatField(entry.values[field.key], field, displayDefinition, entry.unit, isDE)}`)
                    .join(' / ');
            }
            return {
                id: entry.id,
                title,
                subtitle: fmtDateTime(entry.date, isDE),
            };
        });
    }, [displayEntries, displayDefinition, i18n.language]);

    if (!displayDefinition) {
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
                        }
                        catch (e) {
                            Alert.alert(t('common.error'), t('metric.deleteEntryError'));
                        }
                    }
                }
            ]
        );
    };

    if (!sharingLoaded || (isFiltering && !canSeeMetric(metricId))) {
        if (isFiltering && sharingLoaded) router.back();
        return null;
    }

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={ {
                        headerShown: true,
                        headerTitle: t('metric.allData'),
                        headerBackButtonDisplayMode: 'minimal',
                        headerRight: () => entries.length > 0 ? (
                            <HeaderButton
                                title={isEditing ? t('common.done') : t('common.edit')}
                                variant="plain"
                                tintColor={colors.primary}
                                onPress={() => setIsEditing(!isEditing)}
                            />
                        ) : null
                    } }
                />
            ) : (
                <>
                    <Stack.Screen
                        options={ {
                            headerShown: true,
                            headerTransparent: true,
                            headerBackButtonDisplayMode: 'minimal',
                        } }
                    />
                    <Stack.Screen.Title>{t('metric.allData')}</Stack.Screen.Title>
                    {entries.length > 0 && (
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button
                                title={isEditing ? t('common.done') : t('common.edit')}
                                variant="plain"
                                tintColor={colors.primary}
                                onPress={() => setIsEditing(!isEditing)}
                            />
                        </Stack.Toolbar>
                    )}
                </>
            )}

            <ScrollView
                style={ { backgroundColor: colors.background } }
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
                    { listEntries.length === 0 ? (
                        isLoading ? (
                            <View style={ styles.emptyState }>
                                <ActivityIndicator size="small" color={ colors.textHint } />
                            </View>
                        ) : (
                            <View style={ styles.emptyState }>
                                <Text style={ [styles.emptyText, { color: colors.textHint }] }>
                                    { t('metric.noEntriesYet') }
                                </Text>
                            </View>
                        )
                    ) : (
                        <List.Section title={ displayDefinition.showUnit !== false ? displayDefinition.defaultUnit : undefined }
                                      rounded>
                            { listEntries.map((entry, index) => (
                                <View key={ entry.id } style={ styles.listItemRow }>
                                    { isEditing && (
                                        <Pressable
                                            style={ styles.deleteButton }
                                            onPress={ () => handleDelete(entry.id) }
                                        >
                                            <AppIcon
                                                name="minus.circle.fill"
                                                size={ 22 }
                                                tintColor={ colors.error }
                                            />
                                        </Pressable>
                                    ) }
                                    <View style={ styles.listItemContent }>
                                        <List.Item
                                            title={ entry.title }
                                            subtitle={ entry.subtitle }
                                            onPress={ () => !isEditing && router.push(`${basePath}/detail/${ entry.id }` as any) }
                                            lastItem={ index === listEntries.length - 1 }
                                        />
                                    </View>
                                </View>
                            )) }
                        </List.Section>
                    ) }
                </View>
            </ScrollView>
        </>
    );
}

function formatField(
    value: number,
    field: { key: string; label: string; unit?: string; inputType?: MetricInputType; decimalPlaces?: number; valueLabels?: any },
    definition: { showUnit?: boolean },
    entryUnit: string,
    isDE: boolean
): string {
    const label = getValueLabel(field, value);
    if (label) return label;

    const showUnit = definition.showUnit !== false;
    const fieldUnit = showUnit ? (field.unit ?? entryUnit) : '';
    if (field.inputType === 'decimal' && field.decimalPlaces !== undefined) {
        const decimalSep = isDE ? ',' : '.';
        return `${ value.toFixed(field.decimalPlaces).replace('.', decimalSep) }${ fieldUnit ? ` ${ fieldUnit }` : '' }`;
    }
    return `${ Math.round(value) }${ fieldUnit ? ` ${ fieldUnit }` : '' }`;
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    listItemRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    deleteButton: {
        paddingLeft: 16,
        paddingRight: 8,
        paddingVertical: 12
    },
    listItemContent: {
        flex: 1
    },
    emptyState: {
        padding: 40,
        alignItems: 'center'
    },
    emptyText: {
        fontSize: 16,
    },
});
