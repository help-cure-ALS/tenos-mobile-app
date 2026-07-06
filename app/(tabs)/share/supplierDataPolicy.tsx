// Supplier data policy screen
// Allows editing which metrics/categories are shared with a supplier

import React, { useCallback, useEffect, useState } from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { DataSelector, type DataSelection } from '@/src/components/ui/DataSelector';
import type { SupplierSelectionPolicy } from '@/src/stores/patientPreferencesStore';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { on } from '@/src/lib/bus';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { useAssistiveAidsRouteGuard } from '@/src/hooks/useAssistiveAidsRouteGuard';

export default function SupplierDataPolicyScreen() {
    const { isAllowed } = useAssistiveAidsRouteGuard('/(tabs)/share');

    if (!isAllowed) {
        return null;
    }

    return <SupplierDataPolicyContent />;
}

function SupplierDataPolicyContent() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const { patientPreferencesStore: store } = usePatientStores();
    const { integrationId } = useLocalSearchParams<{ integrationId: string }>();

    const [policy, setPolicy] = useState<SupplierSelectionPolicy | null>(null);
    const [selection, setSelection] = useState<DataSelection>({
        metricIds: [],
        categories: {},
    });
    const [hasChanges, setHasChanges] = useState(false);

    const loadData = useCallback(async () => {
        if (!store || !integrationId) return;
        const pol = await store.getSupplierPolicy(integrationId);
        setPolicy(pol ?? null);
        if (pol) {
            setSelection({
                metricIds: pol.metricIds,
                categories: pol.categories,
            });
        }
    }, [store, integrationId]);

    useEffect(() => {
        loadData();
        const offPrefs = on('preferences:changed', loadData);
        return () => {
            offPrefs();
        };
    }, [loadData]);

    const handleSelectionChange = useCallback((sel: DataSelection) => {
        setSelection(sel);
        setHasChanges(true);
    }, []);

    const handleSave = useCallback(async () => {
        if (!store || !integrationId || !policy) return;
        await store.setSupplierPolicy({
            ...policy,
            metricIds: selection.metricIds,
            categories: selection.categories,
        });
        setHasChanges(false);
        router.back();
    }, [store, integrationId, policy, selection, router]);

    const handleClose = useCallback(() => {
        router.back();
    }, [router]);

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: t('supplier.dataPolicy'),
                        headerRight: () =>
                            hasChanges ? (
                                <HeaderButton onPress={handleSave} title={t('common.save')} />
                            ) : (
                                <HeaderButton onPress={handleClose} title={t('common.done')} />
                            ),
                    }}
                />
            ) : (
                <Stack.Screen options={{ headerTitle: t('supplier.dataPolicy') }}>
                    <Stack.Toolbar placement="right">
                        {hasChanges ? (
                            <Stack.Toolbar.Button onPress={handleSave}>{t('common.save')}</Stack.Toolbar.Button>
                        ) : (
                            <Stack.Toolbar.Button onPress={handleClose}>{t('common.done')}</Stack.Toolbar.Button>
                        )}
                    </Stack.Toolbar>
                </Stack.Screen>
            )}

            <ScrollView
                contentContainerStyle={styles.scrollView}
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScreenHeader
                    subtitle={t('supplier.dataPolicyDescription')}
                />
                <DataSelector
                    selection={selection}
                    onSelectionChange={handleSelectionChange}
                />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    }
});
