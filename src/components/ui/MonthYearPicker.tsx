import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Modal,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';

const SHEET_HEIGHT = 350;
const ANIMATION_DURATION = 300;
const DISMISS_THRESHOLD = 100;
const DRAG_RESISTANCE_UP = 0.3;

function getLocalizedMonths(locale: string): { value: number; label: string }[] {
    const formatter = new Intl.DateTimeFormat(locale, { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: formatter.format(new Date(2024, i, 1)),
    }));
}

export interface MonthYearValue {
    month: number; // 1-12
    year: number;
}

export interface MonthYearPickerProps {
    visible: boolean;
    value?: MonthYearValue;
    /** Fallback when value is undefined (e.g. for initial picker position) */
    defaultValue?: MonthYearValue;
    title?: string;
    minYear?: number;
    maxYear?: number;
    onSelect: (value: MonthYearValue) => void;
    onClose: () => void;
}

// Fallback month names (used by monthYearToString when called outside React context)
const fallbackMonths = getLocalizedMonths('de');

function generateYears(min: number, max: number): number[] {
    const years: number[] = [];
    for (let y = max; y >= min; y--) {
        years.push(y);
    }
    return years;
}

export const MonthYearPicker = memo<MonthYearPickerProps>(({
    visible,
    value,
    defaultValue,
    title,
    minYear = 1920,
    maxYear = new Date().getFullYear(),
    onSelect,
    onClose,
}) => {
    const { colors } = useAppTheme();
    const { t, i18n } = useTranslation();
    const months = useMemo(() => getLocalizedMonths(i18n.language), [i18n.language]);
    const displayTitle = title ?? t('common.selectDate');

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const fallbackMonth = defaultValue?.month ?? currentMonth;
    const fallbackYear = defaultValue?.year ?? currentYear;

    const [selectedMonth, setSelectedMonth] = useState(value?.month ?? fallbackMonth);
    const [selectedYear, setSelectedYear] = useState(value?.year ?? fallbackYear);

    const years = generateYears(minYear, maxYear);

    // Update local state when value prop changes
    useEffect(() => {
        if (visible && value) {
            setSelectedMonth(value.month);
            setSelectedYear(value.year);
        }
    }, [visible, value]);

    // Animation values
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const sheetTranslateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

    // Animate in when visible becomes true
    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: ANIMATION_DURATION,
                    useNativeDriver: true,
                }),
                Animated.spring(sheetTranslateY, {
                    toValue: 0,
                    damping: 20,
                    stiffness: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible, backdropOpacity, sheetTranslateY]);

    // Animate out and call callback
    const animateOut = useCallback((callback: () => void) => {
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(sheetTranslateY, {
                toValue: SHEET_HEIGHT,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            // Reset animation values for next open
            backdropOpacity.setValue(0);
            sheetTranslateY.setValue(SHEET_HEIGHT);
            callback();
        });
    }, [backdropOpacity, sheetTranslateY]);

    const handleConfirm = useCallback(() => {
        animateOut(() => {
            onSelect({ month: selectedMonth, year: selectedYear });
            onClose();
        });
    }, [animateOut, selectedMonth, selectedYear, onSelect, onClose]);

    const handleCancel = useCallback(() => {
        animateOut(() => {
            setSelectedMonth(value?.month ?? fallbackMonth);
            setSelectedYear(value?.year ?? fallbackYear);
            onClose();
        });
    }, [animateOut, value, fallbackMonth, fallbackYear, onClose]);

    // Pan responder for drag gesture
    const panResponder = useMemo(() => {
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
            },
            onPanResponderMove: (_, gestureState) => {
                const { dy } = gestureState;
                if (dy < 0) {
                    // Dragging up - resist
                    sheetTranslateY.setValue(dy * DRAG_RESISTANCE_UP);
                } else {
                    // Dragging down
                    sheetTranslateY.setValue(dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                const { dy, vy } = gestureState;
                if (dy > DISMISS_THRESHOLD || (dy > 50 && vy > 0.5)) {
                    handleCancel();
                } else {
                    Animated.spring(sheetTranslateY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        });
    }, [sheetTranslateY, handleCancel]);

    return (
        <Modal
            visible={visible}
            animationType="none"
            transparent={true}
            onRequestClose={handleCancel}
        >
            <View style={styles.overlay}>
                <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />
                </Animated.View>

                <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: sheetTranslateY }] }]}>
                    <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: colors.pickerBackground }]}>
                        {/* Draggable Header Area */}
                        <View {...panResponder.panHandlers}>
                            {/* Drag Handle */}
                            <View style={styles.dragHandleContainer}>
                                <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
                            </View>

                            {/* Header */}
                            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                                <Pressable onPress={handleCancel} hitSlop={8}>
                                    <Text style={[styles.headerButton, { color: colors.primary }]}>
                                        {t('common.cancel')}
                                    </Text>
                                </Pressable>

                                <Text style={[styles.title, { color: colors.textPrimary }]}>
                                    {displayTitle}
                                </Text>

                                <Pressable onPress={handleConfirm} hitSlop={8}>
                                    <Text style={[styles.headerButton, styles.confirmButton, { color: colors.primary }]}>
                                        {t('common.done')}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        {/* Picker Row */}
                        <View style={styles.pickerRow}>
                            {/* Month Picker */}
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={selectedMonth}
                                    onValueChange={setSelectedMonth}
                                    style={styles.picker}
                                    itemStyle={[styles.pickerItem, { color: colors.textPrimary }]}
                                >
                                    {months.map((m) => (
                                        <Picker.Item
                                            key={m.value}
                                            label={m.label}
                                            value={m.value}
                                        />
                                    ))}
                                </Picker>
                            </View>

                            {/* Year Picker */}
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={selectedYear}
                                    onValueChange={setSelectedYear}
                                    style={styles.picker}
                                    itemStyle={[styles.pickerItem, { color: colors.textPrimary }]}
                                >
                                    {years.map((y) => (
                                        <Picker.Item
                                            key={y}
                                            label={String(y)}
                                            value={y}
                                        />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    </SafeAreaView>
                </Animated.View>
            </View>
        </Modal>
    );
});

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    sheetContainer: {
        // Position at bottom
    },
    sheet: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        overflow: 'hidden',
    },
    dragHandleContainer: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 6,
    },
    dragHandle: {
        width: 36,
        height: 5,
        borderRadius: 2.5,
        opacity: 0.4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 18,
        paddingTop: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerButton: {
        fontSize: 17,
        minWidth: 80,
    },
    confirmButton: {
        fontWeight: '600',
        textAlign: 'right',
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
    },
    pickerRow: {
        flexDirection: 'row',
        paddingBottom: 20,
    },
    pickerContainer: {
        flex: 1,
    },
    picker: {
        height: 216,
    },
    pickerItem: {
        fontSize: 22,
    },
});

MonthYearPicker.displayName = 'MonthYearPicker';

// Helper functions
export function monthYearToString(value: MonthYearValue | undefined, locale?: string): string {
    if (!value) return '';
    const months = locale ? getLocalizedMonths(locale) : fallbackMonths;
    const monthName = months.find(m => m.value === value.month)?.label ?? '';
    return `${monthName} ${value.year}`;
}

export function monthYearToDate(value: MonthYearValue): Date {
    return new Date(value.year, value.month - 1, 1);
}

export function dateToMonthYear(date: Date): MonthYearValue {
    return {
        month: date.getMonth() + 1,
        year: date.getFullYear(),
    };
}
