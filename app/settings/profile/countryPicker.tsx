import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { List } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { countries, getSortedCountries, type Country } from '@/src/components/ui/CountryPicker';
import { emit } from '@/src/lib/bus';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';

export default function CountryPickerScreen() {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const navigation = useNavigation();
    const { selected, allowClear, prioritizeForLanguage } = useLocalSearchParams<{
        selected?: string;
        allowClear?: string;
        prioritizeForLanguage?: string;
    }>();
    const [search, setSearch] = useState("");
    const router = useSafeRouter();

    useLayoutEffect(() => {
        navigation.setOptions({
            headerSearchBarOptions: {
                placeholder: `${t('navigation.search')}...`,
                onChangeText: (e: { nativeEvent: { text: string } }) => {
                    setSearch(e.nativeEvent.text);
                }
            }
        });
    }, [navigation, t]);

    const { priority, rest } = useMemo(
        () => getSortedCountries({ prioritizeForLanguage }),
        [prioritizeForLanguage]
    );

    const isSearching = search.trim().length > 0;

    const filteredCountries = useMemo(() => {
        if (!isSearching) return null;
        const q = search.toLowerCase().trim();
        return countries.filter(
            c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
        );
    }, [search, isSearching]);

    const handleSelect = useCallback((country: Country) => {
        emit("country:selected", country.code);
        router.back();
    }, []);

    const handleClear = useCallback(() => {
        emit("country:selected", "");
        router.back();
    }, []);

    const renderCountryItem = (country: Country, isLast: boolean) => (
        <List.Item
            key={ country.code }
            title={ `${ country.flag }  ${ country.name }` }
            onPress={ () => handleSelect(country) }
            type="checkbox"
            checked={ country.code === selected }
            hideChevron
            lastItem={ isLast }
        />
    );

    const headerButtons = Platform.OS === 'android' ? (
        <Stack.Screen
            options={{
                headerRight: () => (
                    <HeaderButton icon="xmark" variant="plain" onPress={() => router.back()} />
                ),
            }}
        />
    ) : (
        <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button icon="xmark" variant="plain" onPress={() => router.back()} />
        </Stack.Toolbar>
    );

    // Search mode: flat alphabetical list
    if (isSearching) {
        return (
            <>
                {headerButtons}
                <ScrollView
                    style={ [styles.container, { backgroundColor: colors.background }] }
                    contentInsetAdjustmentBehavior="automatic"
                    keyboardShouldPersistTaps="handled"
                >
                    { filteredCountries!.length === 0 ? (
                        <Text style={ [styles.empty, { color: colors.textHint }] }>
                            { t('common.noResults') }
                        </Text>
                    ) : (
                        <List.Section rounded>
                            { filteredCountries!.map((country, index) =>
                                renderCountryItem(country, index === filteredCountries!.length - 1)
                            ) }
                        </List.Section>
                    ) }
                </ScrollView>
            </>
        );
    }

    // Default mode: optional priority section + rest
    return (
        <>
            {headerButtons}
            <ScrollView
                style={ [styles.container, { backgroundColor: colors.background }] }
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
            >
                { allowClear && (
                    <List.Section rounded>
                        <List.Item
                            title={t('common.allCountries')}
                            onPress={ handleClear }
                            type="checkbox"
                            checked={ !selected }
                            hideChevron
                            lastItem
                        />
                    </List.Section>
                ) }
                { priority.length > 0 && (
                    <List.Section rounded>
                        { priority.map((country, index) =>
                            renderCountryItem(country, index === priority.length - 1)
                        ) }
                    </List.Section>
                ) }
                <List.Section rounded>
                    { rest.map((country, index) =>
                        renderCountryItem(country, index === rest.length - 1)
                    ) }
                </List.Section>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    empty: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 17,
    },
});
