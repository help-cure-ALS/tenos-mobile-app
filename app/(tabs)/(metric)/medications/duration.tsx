import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { AppDateTimePicker } from '@/src/components/ui/AppDateTimePicker';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { List } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { emit } from '@/src/lib/bus';
import { getAppLocale } from '@/src/lib/formatDate';

export default function DurationScreen() {
    const { colors, isDark } = useAppTheme();
    const router = useSafeRouter();
    const { t, i18n } = useTranslation();
    const params = useLocalSearchParams<{ startDate: string; endDate: string }>();
    const pickerLocale = getAppLocale(i18n.language);

    const [startDate, setStartDate] = useState<Date>(() => {
        if (params.startDate) {
            return new Date(params.startDate);
        }
        return new Date();
    });

    const [endDate, setEndDate] = useState<Date | null>(() => {
        if (params.endDate && params.endDate !== 'null') {
            return new Date(params.endDate);
        }
        return null;
    });

    const handleSave = () => {
        emit('medication:duration:selected', {
            startDate: startDate.toISOString(),
            endDate: endDate ? endDate.toISOString() : null,
        });
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
                        headerTitle: t('medications.editDuration'),
                        headerBackVisible: false,
                        headerLeft: () => (
                            <HeaderButton icon="xmark" onPress={() => router.back()} />
                        ),
                        headerRight: () => (
                            <HeaderButton icon="checkmark" variant="done" onPress={handleSave} />
                        ),
                    }}
                />
            ) : (
                <>
                    <Stack.Screen.Title>{t('medications.editDuration')}</Stack.Screen.Title>
                    <Stack.Toolbar placement="left">
                        <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} />
                    </Stack.Toolbar>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button icon="checkmark" variant="done" onPress={handleSave} />
                    </Stack.Toolbar>
                </>
            )}

            <List.Section rounded>
                <List.Item
                    title={t('medications.startDateLabel')}
                    hideChevron
                    rightCmp={
                        <AppDateTimePicker
                            value={startDate}
                            mode="date"
                            onChange={(selectedDate) => setStartDate(selectedDate)}
                        />
                    }
                />
                <List.Item
                    title={t('medications.endDateLabel')}
                    hideChevron
                    lastItem
                    rightCmp={
                        endDate ? (
                            <View style={styles.endDateRow}>
                                <AppDateTimePicker
                                    value={endDate}
                                    mode="date"
                                    minimumDate={startDate}
                                    onChange={(selectedDate) => setEndDate(selectedDate)}
                                />
                                <Pressable onPress={() => setEndDate(null)} hitSlop={8}>
                                    <AppIcon name="xmark.circle.fill" tintColor={colors.textHint} size={18} />
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable onPress={() => setEndDate(new Date())}>
                                <Text style={[styles.noEndDateText, { color: colors.tint }]}>{t('medications.noEndDateButton')}</Text>
                            </Pressable>
                        )
                    }
                />
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
    endDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    noEndDateText: {
        fontSize: 17,
        fontWeight: '500',
    },
});
