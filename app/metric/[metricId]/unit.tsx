/**
 * Unit Selection Screen
 *
 * Allows the user to select the preferred unit for a metric.
 * The preference is stored on the Patient resource and synced across devices.
 */

import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { List, useTheme } from 'react-native-nice-ui';

import { useMetric } from '@/src/metrics';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharingFilter } from '@/src/hooks/useSharingFilter';

export default function UnitSelection() {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { metricId } = useLocalSearchParams<{ metricId: string }>();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();

    const { definition, preferredUnit, setUnitPreference, isLoading } = useMetric({
        metricId
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleSelectUnit = async (unitValue: string) => {
        if (isSaving || unitValue === preferredUnit) {
            return;
        }

        setIsSaving(true);

        try {
            await setUnitPreference(unitValue);
            router.back();
        }
        catch (e) {
            Alert.alert(
                t('common.error'),
                e instanceof Error ? e.message : t('metric.unitSaveError')
            );
        }
        finally {
            setIsSaving(false);
        }
    };

    if (!sharingLoaded || (isFiltering && !canSeeMetric(metricId))) {
        if (isFiltering && sharingLoaded) router.back();
        return null;
    }

    if (!definition || !definition.availableUnits || definition.availableUnits.length <= 1) {
        return null;
    }

    return (
        <>
            <Stack.Screen
                options={ {
                    headerTitle: t('metric.unit'),
                    headerShown: true,
                    headerTransparent: Platform.OS === 'ios',
                    headerBackButtonDisplayMode: 'minimal',
                } }
            />

            <ScrollView
                style={ { backgroundColor: colors.background } }
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
                    <List.Section rounded>
                        { definition.availableUnits.map((unit, index) => (
                            <List.Item
                                key={ unit.value }
                                title={ unit.label }
                                subtitle={ unit.value }
                                type="checkbox"
                                checked={ preferredUnit === unit.value }
                                disabled={ isLoading || isSaving }
                                onPress={ () => handleSelectUnit(unit.value) }
                                lastItem={ index === definition.availableUnits!.length - 1 }
                            />
                        )) }
                    </List.Section>
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        flex: 1,
        paddingTop: 20,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    }
});
