/**
 * Entry Detail Screen
 *
 * Shows details of a single metric entry.
 */

import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { List, useTheme } from 'react-native-nice-ui';

import { useMetric, getValueLabel, toDisplayEntry, type MetricEntry } from '@/src/metrics';
import { on } from '@/src/lib/bus';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { fmtDateTimeSec } from '@/src/lib/formatDate';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { CloseButton } from "@/src/components/ui/navigation/CloseButton";
import { useSharingFilter } from '@/src/hooks/useSharingFilter';

export default function EntryDetail() {
    const { t, i18n } = useTranslation();
    const { colors } = useTheme();
    const { metricId, entryId } = useLocalSearchParams<{
        metricId: string;
        entryId: string;
    }>();
    const router = useSafeRouter();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();

    const { definition, displayDefinition, displayUnit, getEntry } = useMetric({ metricId });
    const [entry, setEntry] = useState<MetricEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadEntry = useCallback(async () => {
        if (!entryId) {
            setEntry(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const result = await getEntry(entryId);
        setEntry(result && definition && displayUnit
            ? toDisplayEntry(result, definition, displayUnit)
            : result);
        setIsLoading(false);
    }, [entryId, getEntry, definition, displayUnit]);

    useEffect(() => {
        loadEntry();

        const off = on('fhir:changed', () => {
            loadEntry();
        });

        return () => off();
    }, [loadEntry]);

    if (!sharingLoaded || (isFiltering && !canSeeMetric(metricId))) {
        if (isFiltering && sharingLoaded) router.back();
        return null;
    }

    // Show loading indicator while data is loading
    if (isLoading) {
        return (
            <>
                <Stack.Screen options={ { headerTitle: t('metric.details') } } />
                <View style={ [styles.container, styles.centered, { backgroundColor: colors.background }] }>
                    <ActivityIndicator size="small" color={ colors.textSecondary } />
                </View>
            </>
        );
    }

    if (!definition || !displayDefinition || !entry) {
        return (
            <>
                <Stack.Screen options={ { headerTitle: t('metric.details') } } />
                <View style={ [styles.container, styles.centered, { backgroundColor: colors.background }] }>
                    <Text style={ { color: colors.textHint } }>{ t('metric.entryNotFound') }</Text>
                </View>
            </>
        );
    }

    const formatFieldValue = (value: number, field: typeof displayDefinition.fields[0], unit: string): string => {
        // If field has value labels, use the label
        const label = getValueLabel(field, value);
        if (label) {
            return label;
        }

        const showUnit = displayDefinition.showUnit !== false;
        const fieldUnit = showUnit ? (field.unit ?? unit) : '';
        if (field.inputType === 'decimal' && field.decimalPlaces !== undefined) {
            const decimalSep = i18n.language === 'de' ? ',' : '.';
            return `${ value.toFixed(field.decimalPlaces).replace('.', decimalSep) }${ fieldUnit ? ` ${ fieldUnit }` : '' }`;
        }
        return `${ Math.round(value) }${ fieldUnit ? ` ${ fieldUnit }` : '' }`;
    };

    const formatValue = (values: Record<string, number>, unit: string): string => {
        if (displayDefinition.fields.length === 1) {
            const field = displayDefinition.fields[0];
            const value = values[field.key];
            return formatFieldValue(value, field, unit);
        }

        // Multi-value: show each field with its label
        return displayDefinition.fields
            .map((field) => `${ field.label }: ${ formatFieldValue(values[field.key], field, unit) }`)
            .join(' / ');
    };

    const formatDateTime = (date: Date): string => {
        return fmtDateTimeSec(date, i18n.language === 'de');
    };

    const formatRole = (role: string): string => {
        const roleKey = `roles.${ role }`;
        const translated = t(roleKey);
        // If no translation found (key returned as-is), return original role
        return translated === roleKey ? role : translated;
    };

    return (
        <>
            {
                Platform.OS === 'android' ? (
                    <Stack.Screen
                        options={ {
                            gestureEnabled: false,
                            headerTransparent: false,
                            headerBackVisible: false,
                            headerTitle: t('metric.details'),
                            headerRight: () => (
                                <CloseButton onPress={ () => router.back() } />
                            )
                        } }
                    />
                ) : (
                    <>
                        <Stack.Screen.Title>{ t('metric.details') }</Stack.Screen.Title>
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="xmark" variant="plain" onPress={ () => router.back() } />
                        </Stack.Toolbar>
                    </>
                )
            }

            <ScrollView
                style={ { backgroundColor: colors.background } }
                contentContainerStyle={ styles.scrollView }
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScrollViewContent>
                    <ScreenHeader
                        icon={ displayDefinition.icon }
                        iconTintColor={ displayDefinition.iconColor }
                        title={ displayDefinition.name }
                    />
                    <List.Section title={ t('metric.entryDetails') } rounded>
                        <List.Item
                            title={ displayDefinition.name }
                            subtitle={ formatValue(entry.values, entry.unit) }
                            hideChevron
                        />
                        <List.Item
                            title={ t('metric.measurementDate') }
                            subtitle={ formatDateTime(entry.date) }
                            hideChevron
                            lastItem={ !entry.source && !entry.addedAt && !entry.recordedByRole }
                        />
                        { entry.source && (
                            <List.Item
                                title={ t('metric.source') }
                                subtitle={ entry.source }
                                hideChevron
                                lastItem={ !entry.addedAt && !entry.recordedByRole }
                            />
                        ) }
                        { entry.addedAt && (
                            <List.Item
                                title={ t('metric.addedToHealth') }
                                subtitle={ formatDateTime(entry.addedAt) }
                                hideChevron
                                lastItem={ !entry.recordedByRole }
                            />
                        ) }
                        { entry.recordedByRole && (
                            <List.Item
                                title={ t('metric.recordedBy') }
                                subtitle={ formatRole(entry.recordedByRole) }
                                hideChevron
                                lastItem
                            />
                        ) }
                    </List.Section>
                </ScrollViewContent>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    container: {
        flex: 1
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    content: {
        paddingTop: 16
    }
});
