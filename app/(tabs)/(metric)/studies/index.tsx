import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    ActivityIndicator,
    FlatList,
    ImageBackground,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
    View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { List, Text, Space, Button } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { usePatientSwitcherToolbar } from "@/src/components/PatientSwitcher";
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { StudyCard, useStudies } from '@/src/studies';
import type { StudyStatus } from '@/src/studies';
import { useStudyFavorites } from '@/src/hooks/useStudyFavorites';
import { getCountryByCode } from '@/src/components/ui/CountryPicker';
import { getCurrentLanguage } from '@/src/i18n';
import { on } from '@/src/lib/bus';
import { useAppTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { FilterChip } from '@/src/components/ui/FilterChip';
import { tokens } from "@/src/theme/tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ALL_STATUSES: StudyStatus[] = ['recruiting', 'enrolling', 'active', 'completed', 'paused', 'withdrawn'];
const STUDIES_INFO_SEEN_KEY = '@studies_info_seen_v1';
/** Legacy key (status only) — migrated to STUDIES_FILTERS_KEY on first load */
const STUDIES_FILTER_STATUS_KEY = '@studies_filter_status';
const STUDIES_FILTERS_KEY = '@studies_filters_v1';

/** All persisted filter state, stored as one JSON blob */
type PersistedFilters = {
    country: string | null;
    status: StudyStatus | null;
    favorites: boolean;
    clinicIds: string[] | null;
};

export default function StudiesScreen() {
    const { colors, isDark, tokens } = useAppTheme();
    const router = useSafeRouter();
    const patientToolbarMenu = usePatientSwitcherToolbar();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const { width: screenWidth } = useWindowDimensions();
    const {
        studies,
        loading,
        refreshing,
        error,
        refetch,
        clinicStudies,
        openClinicStudyIds,
        clinicName,
        allClinicStudies
    } = useStudies();
    const { isFavorite, toggleFavorite } = useStudyFavorites();
    const [showInfoPage, setShowInfoPage] = useState(false);
    const [infoPageLoading, setInfoPageLoading] = useState(true);

    const statusLabels: Record<StudyStatus, string> = {
        recruiting: t('studies.statusRecruiting', 'Rekrutierend'),
        enrolling: t('studies.statusEnrolling', 'Einschreibung offen'),
        active: t('studies.statusActive', 'Aktiv'),
        completed: t('studies.statusCompleted', 'Abgeschlossen'),
        paused: t('studies.statusPaused', 'Pausiert'),
        withdrawn: t('studies.statusWithdrawn', 'Eingestellt')
    };

    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCountry, setFilterCountryRaw] = useState<string | null>(null);
    const [filterStatus, setFilterStatusRaw] = useState<StudyStatus | null>('recruiting');
    const [filterFavorites, setFilterFavorites] = useState(false);
    const [filterClinicIds, setFilterClinicIdsRaw] = useState<string[] | null>(null);
    const pickerOpenedFromHere = useRef(false);
    // Guards persistence until the stored filters have been hydrated —
    // otherwise the defaults would overwrite the stored state on mount.
    const filtersHydrated = useRef(false);

    // The favorites filter is exclusive: while it is active, the other
    // filters are PAUSED — they keep their values (and stay persisted),
    // are shown greyed out, and take effect again once favorites is
    // switched off. They are never cleared by the favorites toggle.
    const setFilterStatus = useCallback((status: StudyStatus | null) => {
        setFilterStatusRaw(status);
    }, []);

    const setFilterCountry = useCallback((country: string | null) => {
        setFilterCountryRaw(country);
    }, []);

    const setFilterClinicIds = useCallback((ids: string[] | null) => {
        setFilterClinicIdsRaw(ids);
    }, []);

    const handleFavoritesToggle = useCallback(() => {
        setFilterFavorites(prev => !prev);
    }, []);

    // Hydrate persisted filters (with one-time migration from the
    // legacy status-only key).
    useEffect(() => {
        (async () => {
            try {
                const stored = await AsyncStorage.getItem(STUDIES_FILTERS_KEY);
                if (stored !== null) {
                    const f = JSON.parse(stored) as PersistedFilters;
                    setFilterCountryRaw(f.country ?? null);
                    setFilterStatusRaw(
                        f.status && ALL_STATUSES.includes(f.status) ? f.status : null
                    );
                    setFilterFavorites(Boolean(f.favorites));
                    setFilterClinicIdsRaw(
                        Array.isArray(f.clinicIds) && f.clinicIds.length > 0 ? f.clinicIds : null
                    );
                } else {
                    const legacy = await AsyncStorage.getItem(STUDIES_FILTER_STATUS_KEY);
                    if (legacy !== null) {
                        setFilterStatusRaw(
                            legacy !== '' && ALL_STATUSES.includes(legacy as StudyStatus)
                                ? legacy as StudyStatus
                                : null
                        );
                        AsyncStorage.removeItem(STUDIES_FILTER_STATUS_KEY).catch(() => {});
                    }
                }
            } catch {
                // Corrupt storage — keep defaults.
            } finally {
                filtersHydrated.current = true;
            }
        })();
    }, []);

    // Persist all filters whenever one changes (after hydration).
    useEffect(() => {
        if (!filtersHydrated.current) return;
        const f: PersistedFilters = {
            country: filterCountry,
            status: filterStatus,
            favorites: filterFavorites,
            clinicIds: filterClinicIds,
        };
        AsyncStorage.setItem(STUDIES_FILTERS_KEY, JSON.stringify(f)).catch(() => {});
    }, [filterCountry, filterStatus, filterFavorites, filterClinicIds]);

    // Listen for country selection from CountryPicker
    useEffect(() => {
        const off = on('country:selected', (code: string) => {
            if (!pickerOpenedFromHere.current) {
                return;
            }
            pickerOpenedFromHere.current = false;
            setFilterCountry(code || null);
        });
        return () => off();
    }, [setFilterCountry]);

    // Listen for clinic selection from ClinicPicker
    useEffect(() => {
        const off = on('clinics:selected', (ids: string[]) => {
            setFilterClinicIds(ids.length > 0 ? ids : null);
        });
        return () => off();
    }, [setFilterClinicIds]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const seen = await AsyncStorage.getItem(STUDIES_INFO_SEEN_KEY);
                if (!cancelled) {
                    setShowInfoPage(seen !== '1');
                }
            }
            catch {
                if (!cancelled) {
                    setShowInfoPage(true);
                }
            }
            finally {
                if (!cancelled) {
                    setInfoPageLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const handleContinueToStudies = useCallback(async () => {
        try {
            await AsyncStorage.setItem(STUDIES_INFO_SEEN_KEY, '1');
        }
        catch {
            // Ignore storage failure and still proceed to studies list.
        }
        setShowInfoPage(false);
    }, []);

    const handleOpenInfoPage = useCallback(() => {
        setShowInfoPage(true);
    }, []);

    // Build set of study IDs for selected clinics
    const clinicStudyIdSet = useMemo(() => {
        if (!filterClinicIds) return null;
        return new Set(
            allClinicStudies
                .filter(c => filterClinicIds.includes(c.clinicId))
                .flatMap(c => c.studyIds)
        );
    }, [filterClinicIds, allClinicStudies]);

    // Filtered studies. While favorites is active, the other filters
    // are paused (not applied) — only search still narrows the result.
    const filteredStudies = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        return studies.filter(study => {
            if (query) {
                const searchable = [
                    study.title,
                    study.shortTitle,
                    study.summary,
                    study.description,
                    study.sponsor?.name,
                    ...(study.tags ?? [])
                ].filter(Boolean).join(' ').toLowerCase();
                if (!searchable.includes(query)) {
                    return false;
                }
            }

            if (filterFavorites) {
                return isFavorite(study.id);
            }

            if (clinicStudyIdSet) {
                if (!clinicStudyIdSet.has(study.id)) {
                    return false;
                }
            }

            if (filterCountry) {
                if (!study.centers.some(c => c.country === filterCountry)) {
                    return false;
                }
            }

            if (filterStatus) {
                if (study.status !== filterStatus) {
                    return false;
                }
            }

            return true;
        });
    }, [studies, searchQuery, clinicStudyIdSet, filterCountry, filterStatus, filterFavorites, isFavorite]);

    const hasActiveFilter = searchQuery.trim() !== '' || filterClinicIds !== null || filterCountry !== null || filterStatus !== null || filterFavorites;

    const handleStudyPress = useCallback((studyId: string) => {
        router.push(`/(tabs)/(metric)/studies/${ studyId }`);
    }, [router]);

    const handleSettings = useCallback(() => {
        router.push('/settings');
    }, [router]);

    const handleClinicFilter = useCallback(() => {
        router.push({
            pathname: '/(tabs)/(metric)/studies/clinicPicker',
            params: { selected: filterClinicIds?.join(',') ?? '' },
        });
    }, [filterClinicIds, router]);

    const handleCountryFilter = useCallback(() => {
        pickerOpenedFromHere.current = true;
        router.push({
            pathname: '/settings/profile/countryPicker',
            params: { selected: filterCountry ?? '', allowClear: '1', prioritizeForLanguage: getCurrentLanguage() }
        });
    }, [filterCountry]);

    const handleStatusFilter = useCallback(() => {
        const statusNames = ALL_STATUSES.map(s => statusLabels[s]);
        const allLabel = t('studies.filterAll', 'Alle');
        const cancelLabel = t('studies.filterCancel', 'Abbrechen');

        if (Platform.OS === 'ios') {
            const { ActionSheetIOS } = require('react-native');
            const options = [allLabel, ...statusNames, cancelLabel];
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    cancelButtonIndex: options.length - 1
                },
                (buttonIndex: number) => {
                    if (buttonIndex === options.length - 1) {
                        return;
                    }
                    if (buttonIndex === 0) {
                        setFilterStatus(null);
                    } else {
                        setFilterStatus(ALL_STATUSES[buttonIndex - 1]);
                    }
                }
            );
        } else {
            Alert.alert(
                t('studies.filterStatus', 'Status'),
                undefined,
                [
                    { text: allLabel, onPress: () => setFilterStatus(null) },
                    ...ALL_STATUSES.map((s, i) => ({
                        text: statusNames[i],
                        onPress: () => setFilterStatus(s),
                    })),
                    { text: cancelLabel, style: 'cancel' as const },
                ]
            );
        }
    }, [statusLabels, t]);

    const containerWidth = Math.min(screenWidth, 940) - tokens.listSectionPaddingHorizontal * 2;
    const useWideLayout = containerWidth >= 600;
    const cardWidth = useWideLayout ? (containerWidth - 12) / 2 : containerWidth;

    const clinicFilterLabel = useMemo(() => {
        if (!filterClinicIds) return t('studies.filterClinic', 'Klinik');
        if (filterClinicIds.length === 1) {
            const clinic = allClinicStudies.find(c => c.clinicId === filterClinicIds[0]);
            return clinic?.clinicName ?? t('studies.filterClinic', 'Klinik');
        }
        return t('studies.filterClinicsCount', '{{count}} Kliniken', { count: filterClinicIds.length });
    }, [filterClinicIds, allClinicStudies, t]);

    const countryLabel = filterCountry
        ? getCountryByCode(filterCountry)?.name ?? filterCountry
        : t('studies.filterCountry', 'Land');
    const statusLabel = filterStatus
        ? statusLabels[filterStatus]
        : t('studies.filterStatus', 'Status');

    const renderStudyCard = useCallback(({ item: study }: { item: typeof filteredStudies[number] }) => (
        <StudyCard
            study={ study }
            onPress={ () => handleStudyPress(study.id) }
            isFavorite={ isFavorite(study.id) }
            onFavoriteToggle={ () => toggleFavorite(study.id) }
            isOpenForApplications={ openClinicStudyIds.has(study.id) || allClinicStudies.some(c => c.openStudyIds.has(study.id)) }
            style={ { width: cardWidth } }
        />
    ), [cardWidth, isFavorite, toggleFavorite, handleStudyPress, openClinicStudyIds, allClinicStudies]);

    const { width } = useWindowDimensions();
    const contentWidth = Math.min(width, 900);
    const paddingLeft = width > contentWidth ? ((width - insets.left - contentWidth) / 2) + insets.left : insets.left + tokens.listSectionPaddingHorizontal;
    const paddingRight = width > contentWidth ? ((width - insets.right - contentWidth) / 2) + insets.right : insets.right + tokens.listSectionPaddingHorizontal;

    const listHeader = useMemo(() => (
        <>
            { loading && (
                <View style={ styles.loadingState }>
                    <ActivityIndicator size="large" color={ colors.textSecondary } />
                    <Text style={ [styles.loadingText, { color: colors.textSecondary }] }>
                        { t('studies.loading', 'Studien werden geladen...') }
                    </Text>
                </View>
            ) }

            <Space />

            {/* Clinic Studies Section */ }
            { clinicStudies.length > 0 && (
                <>
                    <List.Wrapper containerStyle={[ { maxWidth: 940, alignSelf: 'center', width: '100%' },
                        {
                            // We add the insets to the padding so that the content
                            // doesn't disappear under the sidebar.
                            paddingLeft: insets.left + tokens.listSectionPaddingHorizontal,
                            paddingRight: insets.right + tokens.listSectionPaddingHorizontal
                        },
                        insets.left > 200 && { maxWidth: 940 + insets.left }
                    ]}>
                        <Text
                            variant="titleMedium"
                            style={ { paddingBottom: 12 } }
                            numberOfLines={2}
                        >
                            { t('studies.clinicStudiesSection', { name: clinicName }) }
                        </Text>
                    </List.Wrapper>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={ false }
                        contentContainerStyle={ [{
                            paddingLeft: insets.left + tokens.listSectionPaddingHorizontal,
                            paddingRight: insets.right + tokens.listSectionPaddingHorizontal,
                            gap: 12,
                            paddingBottom: 16
                        }] }
                    >
                        { clinicStudies.map(study => (
                            <StudyCard
                                key={ study.id }
                                study={ study }
                                onPress={ () => handleStudyPress(study.id) }
                                isFavorite={ isFavorite(study.id) }
                                onFavoriteToggle={ () => toggleFavorite(study.id) }
                                isOpenForApplications={ openClinicStudyIds.has(study.id) }
                                style={ { width: cardWidth - 10 } }
                            />
                        )) }
                    </ScrollView>
                    <Space size="lg" />
                </>
            ) }

            {/* Filter Chips */ }
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={ false }
                contentContainerStyle={ [styles.chipContainer, {
                    paddingLeft: paddingLeft,
                    paddingRight: paddingRight
                }] }
            >
                { allClinicStudies.length > 0 && (
                    <FilterChip
                        label={ clinicFilterLabel }
                        onPress={ handleClinicFilter }
                        active={ filterClinicIds !== null }
                        disabled={ filterFavorites }
                        showChevron={ true }
                        variant="filled"
                        maxWidth={ 140 }
                    />
                ) }
                <FilterChip
                    label={ countryLabel }
                    onPress={ handleCountryFilter }
                    active={ filterCountry !== null }
                    disabled={ filterFavorites }
                    showChevron={ true }
                    variant="filled"
                    maxWidth={ 140 }
                />
                <FilterChip
                    label={ statusLabel }
                    onPress={ handleStatusFilter }
                    active={ filterStatus !== null }
                    disabled={ filterFavorites }
                    showChevron={ true }
                    variant="filled"
                    maxWidth={ 140 }
                />
                <FilterChip
                    label={ t('studies.filterFavorites', 'Favoriten') }
                    onPress={ handleFavoritesToggle }
                    active={ filterFavorites }
                    icon="bookmark.fill"
                    variant="filled"
                />
            </ScrollView>

            <List.Wrapper containerStyle={[ { maxWidth: 940, alignSelf: 'center', width: '100%' },
                {
                    // We add the insets to the padding so that the content
                    // doesn't disappear under the sidebar.
                    paddingLeft: insets.left + tokens.listSectionPaddingHorizontal,
                    paddingRight: insets.right + tokens.listSectionPaddingHorizontal
                },
                insets.left > 200 && { maxWidth: 940 + insets.left }
            ]}>
                {/* Result counter */ }
                <Text
                    style={ styles.resultCount }
                    variant="bodySmall"
                    color="hint"
                >
                    { hasActiveFilter
                        ? t('studies.countFiltered', '{{filtered}} von {{total}} Studien', {
                            filtered: filteredStudies.length,
                            total: studies.length
                        })
                        : t('studies.count', '{{count}} Studien', { count: studies.length })
                    }
                </Text>
            </List.Wrapper>
        </>
    ), [loading, colors, t, clinicFilterLabel, filterClinicIds, allClinicStudies.length, handleClinicFilter, countryLabel, statusLabel, filterCountry, filterStatus, filterFavorites, hasActiveFilter, filteredStudies.length, studies.length, handleCountryFilter, handleStatusFilter, clinicStudies, clinicName, handleStudyPress, isFavorite, toggleFavorite]);

    const listEmpty = useMemo(() => {
        if (loading) {
            return null;
        }
        if (hasActiveFilter) {
            return (
                <List.Wrapper containerStyle={[ { maxWidth: 940, alignSelf: 'center', width: '100%' },
                    {
                        // We add the insets to the padding so that the content
                        // doesn't disappear under the sidebar.
                        paddingLeft: insets.left + tokens.listSectionPaddingHorizontal,
                        paddingRight: insets.right + tokens.listSectionPaddingHorizontal
                    },
                    insets.left > 200 && { maxWidth: 940 + insets.left }
                ]}>
                    <View style={ [styles.emptyState, { backgroundColor: colors.listItemBackground }] }>
                        <Text variant="titleMedium" color="secondary">
                            { t('studies.noResults', 'Keine Studien gefunden') }
                        </Text>
                        <Text variant="bodySmall" color="hint">
                            { t('studies.adjustFilters', 'Passe deine Filter an oder setze sie zurück.') }
                        </Text>
                    </View>
                </List.Wrapper>
            );
        }
        return (
            <List.Wrapper containerStyle={[ { maxWidth: 940, alignSelf: 'center', width: '100%' },
                {
                    // We add the insets to the padding so that the content
                    // doesn't disappear under the sidebar.
                    paddingLeft: insets.left + tokens.listSectionPaddingHorizontal,
                    paddingRight: insets.right + tokens.listSectionPaddingHorizontal
                },
                insets.left > 200 && { maxWidth: 940 + insets.left }
            ]}>
                <View style={ [styles.emptyState, { backgroundColor: colors.listItemBackground }] }>
                    <Text variant="titleMedium" color="secondary">
                        { t('studies.noStudies', 'Keine Studien vorhanden') }
                    </Text>
                </View>
            </List.Wrapper>
        );
    }, [loading, hasActiveFilter, colors, t, insets]);

    const listFooter = useMemo(() => (
        <List.Wrapper containerStyle={[ { maxWidth: 940, alignSelf: 'center', width: '100%' },
        {
            // We add the insets to the padding so that the content
            // doesn't disappear under the sidebar.
            paddingLeft: insets.left + tokens.listSectionPaddingHorizontal,
            paddingRight: insets.right + tokens.listSectionPaddingHorizontal
        },
            insets.left > 200 && { maxWidth: 940 + insets.left }
        ]}>
            <Pressable onPress={ handleOpenInfoPage }>
                <View style={ [styles.infoSection, { backgroundColor: colors.listItemBackground }] }>
                    <View style={ styles.infoContent }>
                        <Text variant="titleMedium">
                            { t('studies.aboutTitle') }
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            { t('studies.aboutText') }
                        </Text>
                        <Text variant="bodySmall" style={ [styles.infoLink, { color: colors.tint }] }>
                            { t('studies.openInfoPage', 'Info anzeigen') }
                        </Text>
                    </View>
                </View>
            </Pressable>
        </List.Wrapper>

    ), [colors, t, handleOpenInfoPage, insets]);

    return (
        <>

            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={ {
                        title: t('studies.title'),
                        headerLargeTitle: false,
                        ...(showInfoPage ? {} : {
                            headerSearchBarOptions: showInfoPage ? undefined : {
                                placeholder: t('studies.searchPlaceholder', 'Studien durchsuchen...'),
                                onChangeText: (e: any) => setSearchQuery(e.nativeEvent.text),
                                autoCapitalize: 'none'
                            }
                        }),
                        headerRight: () => (
                            <HeaderButton
                                icon="figure.boxing"
                                variant="prominent"
                                tintColor={colors.textPrimary}
                                onPress={handleSettings}
                            />
                        )
                    } }
                />
            ) : (
                <>
                    <Stack.Screen
                        options={ {
                            headerLargeTitle: false,
                            ...(showInfoPage ? {} : {
                                headerSearchBarOptions: showInfoPage ? undefined : {
                                    placeholder: t('studies.searchPlaceholder', 'Studien durchsuchen...'),
                                    onChangeText: (e: any) => setSearchQuery(e.nativeEvent.text),
                                    autoCapitalize: 'none'
                                }
                            })
                        } }
                    />
                    <Stack.Screen.Title>{t('studies.title')}</Stack.Screen.Title>
                    <Stack.Toolbar placement="right">
                        {patientToolbarMenu}
                        <Stack.Toolbar.Button icon="figure.boxing" variant="prominent" tintColor={colors.textPrimary} onPress={handleSettings} />
                    </Stack.Toolbar>
                </>
            )}

            { infoPageLoading ? (
                <View style={ [styles.container, styles.loadingState, { backgroundColor: colors.background }] }>
                    <ActivityIndicator size="small" />
                </View>
            ) : showInfoPage ? (
                <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') } style={ styles.image }>
                    <ScrollView
                        style={ [styles.container, isDark && { backgroundColor: colors.background }] }
                        contentContainerStyle={ styles.scrollView }
                        contentInsetAdjustmentBehavior="automatic"
                    >
                        <View style={ [styles.bodyWrapper,
                            {
                                // We add the insets to the padding so that the content
                                // doesn't disappear under the sidebar.
                                paddingLeft: insets.left,
                                paddingRight: insets.right
                            },
                            insets.left > 200 && { maxWidth: 940 + insets.left }
                        ] }>
                            <ScreenHeader
                                icon="heart.text.clipboard"
                                iconTintColor={ colors.brandColorMuted }
                                title={ t('studies.infoPageTitle', 'Informationen zu Studien') }
                                subtitle={ t('studies.infoPageText', 'Klinische Studien helfen dabei, neue Behandlungen und ein besseres Verständnis von ALS zu entwickeln. Die Teilnahme ist freiwillig. Du kannst dich in Ruhe informieren und gemeinsam mit deinem Behandlungsteam entscheiden, ob eine Studie für dich sinnvoll ist.') }
                            />
                            <Space size="xl" />
                            <List.Wrapper>
                                <Button
                                    title={ t('studies.goToStudies', 'Zu den Studien') }
                                    onPress={ handleContinueToStudies }
                                    rounded
                                />
                                <List.Text align="center">
                                    { t('studies.infoPageHint', 'Du findest diese Information jederzeit wieder am Ende der Studienliste.') }
                                </List.Text>
                            </List.Wrapper>
                        </View>
                    </ScrollView>
                </ImageBackground>
            ) : (
                <FlatList
                    CellRendererComponent={ ({ children, ...props }) => (
                        <View { ...props } style={ [props.style, {
                            maxWidth: 940,
                            alignSelf: 'center',
                            width: '100%',
                            paddingHorizontal: tokens.listSectionPaddingHorizontal,
                        },
                            {
                                // We add the insets to the padding so that the content
                                // doesn't disappear under the sidebar.
                                paddingLeft: insets.left + tokens.listSectionPaddingHorizontal,
                                paddingRight: insets.right + tokens.listSectionPaddingHorizontal
                            },
                            insets.left > 200 && { maxWidth: 940 + insets.left }
                        ] }>
                            { children }
                        </View>
                    ) }
                    data={ filteredStudies }
                    keyExtractor={ item => item.id }
                    renderItem={ renderStudyCard }
                    ListHeaderComponent={ listHeader }
                    ListEmptyComponent={ listEmpty }
                    ListFooterComponent={ listFooter }
                    contentContainerStyle={ [styles.scrollView, {
                        // maxWidth: 940,
                        // alignSelf: 'center',
                        // width: '100%'
                        // paddingHorizontal: tokens.listSectionPaddingHorizontal
                    }] }
                    contentInsetAdjustmentBehavior="automatic"
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    style={ [styles.container, { backgroundColor: colors.background }] }
                    initialNumToRender={ 10 }
                    maxToRenderPerBatch={ 10 }
                    windowSize={ 5 }
                    refreshing={ refreshing }
                    onRefresh={ refetch }
                    { ...(useWideLayout ? { numColumns: 2, columnWrapperStyle: { gap: 12 } } : {}) }
                />
            ) }

        </>
    );
}

const styles = StyleSheet.create({
    image: {
        flex: 1
    },
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    container: {
        flex: 1
    },
    section: {
        marginBottom: 24
    },
    chipContainer: {
        flexDirection: 'row',
        paddingBottom: 8,
        gap: 8
    },
    resultCount: {
        // paddingHorizontal: 16,
        paddingBottom: 8
    },
    loadingState: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 48,
        gap: 12
    },
    loadingText: {
        fontSize: 14
    },
    emptyState: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        marginBottom: 12,
        alignItems: 'center',
        borderRadius: 16,
        gap: 3
    },
    infoSection: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
        borderRadius: 16,
        marginTop: 8
    },
    infoContent: {
        flex: 1,
        gap: 4
    },
    infoLink: {
        marginTop: 8,
        fontWeight: '600'
    },
    infoIntroSection: {
        padding: 16,
        borderRadius: 16,
        gap: 12
    },
    infoButton: {
        marginTop: 8,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center'
    },
    infoButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16
    }
});
