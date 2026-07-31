import React from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { List } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { emit } from '@/src/lib/bus';
import type { ScheduleType } from '@/src/medications';

const SCHEDULE_TYPE_KEYS: ScheduleType[] = ['daily', 'cycle', 'weekly', 'every_x_days', 'as_needed'];

export default function ScheduleTypeScreen() {
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams<{ current: string }>();
    const currentType = (params.current as ScheduleType) ?? 'daily';

    const scheduleTypes = SCHEDULE_TYPE_KEYS.map(key => ({
        value: key,
        label: t(`medications.scheduleTypes.${key}`),
        description: t(`medications.scheduleTypes.${key}Desc`),
    }));

    const handleSelect = (value: ScheduleType) => {
        emit('medication:scheduleType:selected', value);
        router.back();
    };

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="automatic"
        >
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: t('medications.schedule'),
                        headerBackVisible: false,
                        headerLeft: () => (
                            <HeaderButton icon="xmark" onPress={() => router.back()} />
                        ),
                    }}
                />
            ) : (
                <>
                    <Stack.Screen.Title>{t('medications.schedule')}</Stack.Screen.Title>
                    <Stack.Toolbar placement="left">
                        <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} />
                    </Stack.Toolbar>
                </>
            )}

            <List.Section rounded>
                {scheduleTypes.map((item, index) => (
                    <List.Item
                        key={item.value}
                        title={item.label}
                        subtitle={item.description}
                        hideChevron
                        onPress={() => handleSelect(item.value)}
                        rightCmp={
                            currentType === item.value ? (
                                <AppIcon name="checkmark" tintColor={colors.tint} size={18} />
                            ) : undefined
                        }
                        lastItem={index === scheduleTypes.length - 1}
                    />
                ))}
            </List.Section>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingTop: 16,
        paddingBottom: 40,
    },
});
