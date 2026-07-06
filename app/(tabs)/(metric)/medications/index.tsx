import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ImageBackground,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
    Text as RNText,
    Platform
} from 'react-native';
import { Stack } from 'expo-router';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { useTranslation } from 'react-i18next';
import { Button, List, Space, Text } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import {
    formatMedicationStrength,
    getMedicationFormIcon,
    getMedicationFormLabel,
    getScheduledSlotIso,
    getScheduleLabel,
    useMedications
} from '@/src/medications';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmtWeekdayShort, fmtWeekdayLong, fmtDayMonthLong } from '@/src/lib/formatDate';
import { useSharingFilter } from "@/src/hooks/useSharingFilter";

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function formatDayLabel(date: Date, locale: string): string {
    return fmtWeekdayShort(date, locale.startsWith('de'));
}

function formatDateTitle(date: Date, locale: string): string {
    return fmtDayMonthLong(date, locale.startsWith('de'));
}

function isToday(date: Date): boolean {
    const now = new Date();
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
}

export default function MedicationsScreen() {
    const { t, i18n } = useTranslation();
    const { colors, isDark } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { isFiltering, isLoaded: sharingLoaded, canSeeCategory } = useSharingFilter();
    const { medications, isLoading, getDaySlots, getAsNeededMedications, getDoseStatus, logDose } = useMedications();
    const locale = i18n.language === 'de' ? 'de-DE' : 'en-US';

    const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));

    const days = useMemo(() => {
        const base = startOfDay(new Date());
        return Array.from({ length: 14 }).map((_, index) => {
            const d = new Date(base);
            d.setDate(base.getDate() - 2 + index);
            return d;
        });
    }, []);

    const daySlots = useMemo(() => getDaySlots(selectedDate), [getDaySlots, selectedDate]);
    const asNeeded = useMemo(() => getAsNeededMedications(selectedDate), [getAsNeededMedications, selectedDate]);

    if (!sharingLoaded) {
        return <View style={ {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background
        } }><ActivityIndicator /></View>;
    }
    if (isFiltering && !canSeeCategory('medications')) {
        router.back();
        return null;
    }

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={ {
                        headerTitle: t('medications.title'),
                        headerLargeTitle: false,
                        headerRight: () => (
                            <HeaderButton icon="plus" variant="done" onPress={() => router.push('/(tabs)/(metric)/medications/add')} />
                        )
                    } }
                />
            ) : (
                <>
                    <Stack.Screen options={ { headerLargeTitle: false } } />
                    <Stack.Screen.Title>{t('medications.title')}</Stack.Screen.Title>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button icon="plus" variant="done" onPress={() => router.push('/(tabs)/(metric)/medications/add')} />
                    </Stack.Toolbar>
                </>
            )}

            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') }
                             style={ [{ flex: 1 }, { backgroundColor: colors.background }] }>
                <ScrollView
                    style={ { flex: 1 } }
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
                        <View style={ styles.sectionHeaderWrap }>
                            <Text variant="headlineSmall" align="center">
                                { isToday(selectedDate) ? t('common.today') : fmtWeekdayLong(selectedDate, locale.startsWith('de')) },{ ' ' }
                                { formatDateTitle(selectedDate, locale) }
                            </Text>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={ false }
                            contentContainerStyle={ styles.dayStripContent }
                        >
                            { days.map((day) => {
                                const selected = startOfDay(day).getTime() === selectedDate.getTime();
                                return (
                                    <Pressable
                                        key={ day.toISOString() }
                                        style={ [
                                            styles.dayChip,
                                            {
                                                backgroundColor: selected ? colors.tint : colors.listItemBackground
                                            }
                                        ] }
                                        onPress={ () => setSelectedDate(startOfDay(day)) }
                                    >
                                        <RNText
                                            style={ [styles.dayChipTop, { color: selected ? '#fff' : colors.textSecondary }] }>
                                            { formatDayLabel(day, locale) }
                                        </RNText>
                                        <RNText
                                            style={ [styles.dayChipBottom, { color: selected ? '#fff' : colors.textPrimary }] }>
                                            { day.getDate() }
                                        </RNText>
                                    </Pressable>
                                );
                            }) }
                        </ScrollView>

                        <Space size="2xl" />

                        <List.Wrapper rounded containerStyle={ { paddingBottom: 6 } }>
                            <Text variant="headlineSmall" style={ styles.sectionTitle }>{ t('medications.log') }</Text>
                        </List.Wrapper>

                        <List.Wrapper containerStyle={ { gap: 8 } }>
                            { daySlots.map((slot) => {
                                const allStatuses = slot.medications.map((med) => {
                                    const scheduledFor = getScheduledSlotIso(selectedDate, slot.time);
                                    return getDoseStatus(med.id, scheduledFor);
                                });
                                const allDone = allStatuses.every((s) => s !== 'pending');
                                const takenCount = allStatuses.filter((s) => s === 'taken').length;
                                const skippedCount = allStatuses.filter((s) => s === 'skipped').length;

                                return (
                                    <Pressable
                                        key={ slot.time }
                                        style={ [styles.slotCard, { backgroundColor: colors.listItemBackgroundMuted }] }
                                        onPress={ () =>
                                            router.push({
                                                pathname: '/(tabs)/(metric)/medications/log',
                                                params: { time: slot.time, date: selectedDate.toISOString() }
                                            })
                                        }
                                    >
                                        <View style={ styles.slotTitleRow }>
                                            <Text variant="titleLarge" style={ styles.slotTime }>{ slot.time }</Text>
                                        </View>

                                        { slot.medications.map((med) => {
                                            const scheduledFor = getScheduledSlotIso(selectedDate, slot.time);
                                            const status = getDoseStatus(med.id, scheduledFor);
                                            const formIcon = getMedicationFormIcon(med.form);

                                            const isTaken = status === 'taken';
                                            const isSkipped = status === 'skipped';

                                            return (
                                                <View
                                                    key={ `${ slot.time }:${ med.id }` }
                                                    style={ [styles.slotMedicationRow, isSkipped && styles.skippedRow] }
                                                >
                                                    <View
                                                        style={ [styles.pillIcon, { backgroundColor: colors.tint + '22' }] }>
                                                        <AppIcon name={ formIcon } tintColor={ colors.tint }
                                                                 size={ 14 } />
                                                    </View>
                                                    <View style={ styles.slotMedicationInfo }>
                                                        <Text
                                                            variant="titleMedium"
                                                            color={ isSkipped ? 'hint' : 'primary' }
                                                            style={ [styles.slotMedicationName, isSkipped && styles.strikethrough] }
                                                        >
                                                            { med.name }
                                                        </Text>
                                                        <Text variant="bodySmall" color="secondary">
                                                            { med.dosageText ?? getMedicationFormLabel(med.form) }
                                                        </Text>
                                                    </View>
                                                    { isTaken && (
                                                        <AppIcon name={ "checkmark.circle.fill" }
                                                                 tintColor="#34C759" size={ 24 } />
                                                    ) }
                                                    { isSkipped && (
                                                        <AppIcon name={ "xmark.circle.fill" }
                                                                 tintColor={ colors.textHint } size={ 24 } />
                                                    ) }
                                                </View>
                                            );
                                        }) }
                                    </Pressable>
                                );
                            }) }

                            <View style={ [styles.slotCard, { backgroundColor: colors.listItemBackgroundMuted }] }>
                                <View style={ styles.slotTitleRow }>
                                    <Text variant="headlineSmall">{ t('medications.asNeededMedications') }</Text>
                                </View>

                                { !asNeeded.length && (
                                    <Text variant="bodySmall"
                                          color="secondary">{ t('medications.noAsNeededMedications') }</Text>
                                ) }

                                { asNeeded.map((med) => {
                                    const formIcon = getMedicationFormIcon(med.form);

                                    return (
                                        <View key={ `prn:${ med.id }` } style={ styles.slotMedicationRow }>
                                            <Pressable
                                                style={ styles.slotMedicationMain }
                                                onPress={ () => {
                                                    const now = new Date();
                                                    const time = `${ String(now.getHours()).padStart(2, '0') }:${ String(now.getMinutes()).padStart(2, '0') }`;
                                                    router.push({
                                                        pathname: '/(tabs)/(metric)/medications/log',
                                                        params: {
                                                            time,
                                                            date: now.toISOString(),
                                                            medicationId: med.id
                                                        }
                                                    });
                                                } }
                                            >
                                                <View style={ styles.slotMedicationRow }>
                                                    <View
                                                        style={ [styles.pillIcon, { backgroundColor: colors.tint + '22' }] }>
                                                        <AppIcon name={ formIcon } tintColor={ colors.tint }
                                                                 size={ 14 } />
                                                    </View>

                                                    <View style={ styles.slotMedicationInfo }>
                                                        <Text variant="titleMedium" color="primary"
                                                              style={ [styles.slotMedicationName] }>{ med.name }</Text>
                                                        <Text variant="bodySmall"
                                                              color="secondary">{ t('medications.asNeeded') }</Text>
                                                    </View>
                                                    <AppIcon name={ "plus.circle.fill" } tintColor={ colors.tint }
                                                             size={ 24 } />
                                                </View>
                                            </Pressable>
                                        </View>
                                    );
                                }) }
                            </View>
                        </List.Wrapper>

                        <List.Section title={ t('medications.yourMedications') }
                                      titleStyle={ [styles.sectionTitle, { color: colors.textPrimary }] } rounded>
                            { medications.map((med, index) => {
                                const formIcon = getMedicationFormIcon(med.form);

                                return (
                                    <List.Item
                                        key={ med.id }
                                        title={ med.name }
                                        titleStyle={ styles.slotMedicationName }
                                        subtitle={ `${ getMedicationFormLabel(med.form) }\n${ formatMedicationStrength(med) }\n${ getScheduleLabel(med.schedule) }` }
                                        leftCmpSize={ 32 }
                                        leftCmp={
                                            <ListItemIcon name={ formIcon } color={ colors.tint }
                                                          backgroundColor={ colors.tint + '22' } />
                                        }
                                        onPress={ () => router.push(`/(tabs)/(metric)/medications/${ med.id }`) }
                                        lastItem={ index === medications.length - 1 }
                                    />
                                );
                            }) }
                            { !medications.length && !isLoading && (
                                <List.Item
                                    title={ t('medications.noMedicationsYet') }
                                    subtitle={ t('medications.noMedicationsHint') }
                                    lastItem
                                />
                            ) }
                        </List.Section>

                        <View style={ styles.footerGap }>
                            <Button
                                title={ t('medications.newMedication') }
                                onPress={ () => router.push('/(tabs)/(metric)/medications/add') }
                                rounded
                            />
                        </View>
                    </View>
                </ScrollView>
            </ImageBackground>
        </>
    );
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
    sectionHeaderWrap: {
        paddingHorizontal: 18,
        marginTop: 20,
        marginBottom: 8
    },
    sectionHeaderRow: {
        paddingHorizontal: 16,
        marginTop: 20,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    sectionTitle: {
        fontSize: 21,
        fontWeight: '700'
    },
    dayStripContent: {
        paddingHorizontal: 16,
        gap: 10
    },
    dayChip: {
        width: 54,
        height: 54,
        borderRadius: 28,
        paddingVertical: 8,
        alignItems: 'center'
    },
    dayChipTop: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase'
    },
    dayChipBottom: {
        fontSize: 18,
        fontWeight: '700'
    },
    slotList: {
        paddingHorizontal: 18,
        gap: 8
    },
    slotCard: {
        borderRadius: 22,
        padding: 19,
        gap: 10
    },
    slotTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    slotTime: {
        // fontSize: 32,
        fontWeight: '700'
    },
    slotStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    statusBadgeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2
    },
    statusBadgeText: {
        fontSize: 14,
        fontWeight: '600'
    },
    slotMedicationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    slotMedicationInfo: {
        flex: 1
    },
    slotMedicationMain: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    pillIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center'
    },
    slotMedicationName: {
        // fontSize: 20,
        fontWeight: '600'
    },
    logButton: {
        padding: 4
    },
    skippedRow: {
        opacity: 0.6
    },
    strikethrough: {
        textDecorationLine: 'line-through'
    },
    emptyText: {
        fontSize: 14
    },
    linkText: {
        fontSize: 17,
        fontWeight: '500'
    },
    footerGap: {
        paddingHorizontal: 16,
        marginTop: 18
    }
});
