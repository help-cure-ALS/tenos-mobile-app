import React, { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { List } from 'react-native-nice-ui';

import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { emit, on } from '@/src/lib/bus';
import type { PreferredMeasurementSystem } from '@/src/stores/patientPreferencesStore';
import { useAppTheme } from '@/src/theme';

const SYSTEM_KEYS: PreferredMeasurementSystem[] = ['auto', 'metric', 'us'];

export default function UnitsSettingsScreen() {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const { patientPreferencesStore } = usePatientStores();
    const [measurementSystem, setMeasurementSystemState] = useState<PreferredMeasurementSystem>('auto');
    const [pendingSystem, setPendingSystem] = useState<PreferredMeasurementSystem | null>(null);

    const load = useCallback(async () => {
        if (pendingSystem) return;
        if (!patientPreferencesStore) {
            setMeasurementSystemState('auto');
            return;
        }
        const system = await patientPreferencesStore.getMeasurementSystem();
        setMeasurementSystemState(system);
    }, [patientPreferencesStore, pendingSystem]);

    useEffect(() => {
        load();
        const offFhir = on('fhir:changed', load);
        const offPrefs = on('preferences:changed', load);
        return () => {
            offFhir();
            offPrefs();
        };
    }, [load]);

    const handleSelect = useCallback(async (system: PreferredMeasurementSystem) => {
        if (!patientPreferencesStore || pendingSystem || system === measurementSystem) return;

        setPendingSystem(system);
        setMeasurementSystemState(system);
        try {
            await patientPreferencesStore.setMeasurementSystem(system);
            emit('preferences:changed');
        } finally {
            setPendingSystem(null);
        }
    }, [patientPreferencesStore, pendingSystem, measurementSystem]);

    return (
        <ScrollView
            style={{ backgroundColor: colors.modalBackground }}
            contentContainerStyle={styles.scrollView}
            contentInsetAdjustmentBehavior="automatic"
        >
            <ScrollViewContent>
                <ScreenHeader
                    icon="ruler"
                    iconTintColor={colors.brandColorMuted}
                    subtitle={t('units.headerText')}
                />

                <List.Section rounded>
                    {SYSTEM_KEYS.map((system, index) => (
                        <List.Item
                            key={system}
                            title={t(`units.${system}`)}
                            subtitle={t(`units.${system}Desc`)}
                            subtitleNumberOfLines={3}
                            type="checkbox"
                            checked={measurementSystem === system}
                            hideChevron
                            onPress={() => handleSelect(system)}
                            lastItem={index === SYSTEM_KEYS.length - 1}
                        />
                    ))}
                </List.Section>
            </ScrollViewContent>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90,
    },
});
