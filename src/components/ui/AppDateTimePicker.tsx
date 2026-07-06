/**
 * Cross-platform DateTimePicker wrapper.
 *
 * iOS:     Renders the native compact inline picker (display="compact").
 * Android: Shows a styled text button that opens the native modal dialog on tap.
 *
 * This avoids the Android bug where the modal dialog fires on every render
 * when the picker component is mounted inline.
 */

import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from 'react-native-nice-ui';

import { fmtDate, fmtTime, uses24HourClock, getAppLocale } from '@/src/lib/formatDate';
import { useTranslation } from 'react-i18next';

export interface AppDateTimePickerProps {
    value: Date;
    mode: 'date' | 'time';
    onChange: (date: Date) => void;
    maximumDate?: Date;
    minimumDate?: Date;
    is24Hour?: boolean;
}

export function AppDateTimePicker({
    value,
    mode,
    onChange,
    maximumDate,
    minimumDate,
    is24Hour,
}: AppDateTimePickerProps) {
    const { colors, isDark } = useTheme();
    const { i18n } = useTranslation();

    const pickerLocale = getAppLocale(i18n.language);
    const isDE = i18n.language?.startsWith('de') ?? false;
    const use24Hour = is24Hour ?? uses24HourClock(i18n.language);

    // Android: control dialog visibility
    const [showAndroid, setShowAndroid] = useState(false);

    const handleValueChange = useCallback(
        (_event: unknown, selectedDate: Date) => {
            // Android: hide dialog after value is selected
            if (Platform.OS === 'android') {
                setShowAndroid(false);
            }
            onChange(selectedDate);
        },
        [onChange],
    );

    const handleDismiss = useCallback(() => {
        setShowAndroid(false);
    }, []);

    // — iOS: inline compact picker —
    if (Platform.OS === 'ios') {
        return (
            <DateTimePicker
                value={value}
                mode={mode}
                display="compact"
                locale={pickerLocale}
                themeVariant={isDark ? 'dark' : 'light'}
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                onValueChange={handleValueChange}
            />
        );
    }

    // — Android: button + conditional dialog —
    const displayText =
        mode === 'date' ? fmtDate(value, isDE) : fmtTime(value);

    return (
        <>
            <Pressable
                onPress={() => setShowAndroid(true)}
                style={({ pressed }) => [
                    styles.androidButton,
                    {
                        backgroundColor: pressed
                            ? colors.listItemBackgroundPress
                            : colors.listItemBackground,
                    },
                ]}
            >
                <Text style={[styles.androidButtonText, { color: colors.tint }]}>
                    {displayText}
                </Text>
            </Pressable>

            {showAndroid && (
                <DateTimePicker
                    value={value}
                    mode={mode}
                    display={mode === 'date' ? 'calendar' : 'clock'}
                    is24Hour={use24Hour}
                    maximumDate={maximumDate}
                    minimumDate={minimumDate}
                    onValueChange={handleValueChange}
                    onDismiss={handleDismiss}
                />
            )}
        </>
    );
}

const styles = StyleSheet.create({
    androidButton: {
        paddingLeft: 14,
        paddingRight: 4,
        paddingVertical: 8,
        borderRadius: 8,
        minWidth: 90,
        alignItems: 'flex-end',
    },
    androidButtonText: {
        fontSize: 16,
        fontWeight: '500',
        fontVariant: ['tabular-nums'],
    },
});
