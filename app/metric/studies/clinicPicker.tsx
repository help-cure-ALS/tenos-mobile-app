import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { List, Text } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useStudies } from '@/src/studies';
import type { ClinicStudyInfo } from '@/src/studies';
import { emit } from '@/src/lib/bus';

export default function ClinicPickerScreen() {
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { selected: selectedParam } = useLocalSearchParams<{ selected?: string }>();
    const { allClinicStudies } = useStudies();

    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
        if (!selectedParam) return new Set();
        return new Set(selectedParam.split(',').filter(Boolean));
    });

    const sortedClinics = useMemo(() => {
        // Priority sorting: verified clinic first, then vault clinics, then rest alphabetically
        // For now we sort alphabetically — the priority markers come from the parent screen via params
        return [...allClinicStudies].sort((a, b) => a.clinicName.localeCompare(b.clinicName));
    }, [allClinicStudies]);

    const isSearching = search.trim().length > 0;

    const filteredClinics = useMemo(() => {
        if (!isSearching) return sortedClinics;
        const q = search.toLowerCase().trim();
        return sortedClinics.filter(
            (c) => c.clinicName.toLowerCase().includes(q),
        );
    }, [sortedClinics, search, isSearching]);

    const allSelected = selectedIds.size === allClinicStudies.length && allClinicStudies.length > 0;

    const toggleClinic = useCallback((clinicId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(clinicId)) {
                next.delete(clinicId);
            } else {
                next.add(clinicId);
            }
            return next;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        if (allSelected) {
            // Deselect all — stay open
            setSelectedIds(new Set());
        } else {
            // Select all → emit immediately and close
            emit('clinics:selected', allClinicStudies.map((c) => c.clinicId));
            router.back();
        }
    }, [allSelected, allClinicStudies, router]);

    const handleDone = useCallback(() => {
        emit('clinics:selected', [...selectedIds]);
        router.back();
    }, [selectedIds, router]);

    const renderClinicItem = useCallback((clinic: ClinicStudyInfo, isLast: boolean) => (
        <List.Item
            key={clinic.clinicId}
            title={clinic.clinicName}
            subtitle={t('studies.count', '{{count}} Studien', { count: clinic.studyIds.length })}
            onPress={() => toggleClinic(clinic.clinicId)}
            type="checkbox"
            checked={selectedIds.has(clinic.clinicId)}
            hideChevron
            lastItem={isLast}
        />
    ), [selectedIds, toggleClinic, t]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerSearchBarOptions: {
                            placeholder: t('studies.searchPlaceholder', 'Suchen...'),
                            onChangeText: (e: { nativeEvent: { text: string } }) => {
                                setSearch(e.nativeEvent.text);
                            },
                        },
                        headerRight: () => (
                            <HeaderButton
                                icon="xmark"
                                variant="plain"
                                tintColor={colors.text}
                                onPress={() => router.back()}
                            />
                        )
                    }}
                />
            ) : (
                <>
                    <Stack.Screen
                        options={{
                            headerSearchBarOptions: {
                                placeholder: t('studies.searchPlaceholder', 'Suchen...'),
                                onChangeText: (e: { nativeEvent: { text: string } }) => {
                                    setSearch(e.nativeEvent.text);
                                },
                            },
                        }}
                    />
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button icon="xmark" variant="plain" tintColor={colors.text} onPress={() => router.back()} />
                    </Stack.Toolbar>
                </>
            )}
            <ScrollView
                style={styles.scrollView}
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
            >
                {/* Select all */}
                <List.Section rounded>
                    <List.Item
                        title={t('studies.allClinics', 'Alle Ambulanzen')}
                        onPress={handleSelectAll}
                        type="checkbox"
                        checked={allSelected}
                        hideChevron
                        lastItem
                    />
                </List.Section>

                {filteredClinics.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.textHint }]}>
                        {t('studies.noClinicsFound', 'Keine Ambulanzen gefunden')}
                    </Text>
                ) : (
                    <List.Section rounded>
                        {filteredClinics.map((clinic, index) =>
                            renderClinicItem(clinic, index === filteredClinics.length - 1),
                        )}
                    </List.Section>
                )}
            </ScrollView>

            {/* Sticky done button */}
            <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
                <Pressable
                    onPress={handleDone}
                    style={[styles.doneButton, { backgroundColor: colors.tint }]}
                >
                    <Text style={styles.doneButtonText}>
                        {t('common.done', 'Fertig')}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    empty: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 17,
    },
    footer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    doneButton: {
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    doneButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 17,
    },
});
