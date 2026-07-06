import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-nice-ui';
import { CardContainer, CardHeader } from './card';

export type QuickEntryCardProps = {
    /** Card title (e.g., "Gewicht erfassen") */
    title: string;
    /** SF Symbol icon name */
    icon?: string;
    /** Icon tint color */
    iconColor?: string;
    /** Current/last value to display */
    currentValue?: string;
    /** Label for current value (e.g., "Aktuell") */
    currentValueLabel?: string;
    /** Time since last entry (e.g., "vor 5 Tagen") */
    lastEntryTime?: string;
    /** Button text (e.g., "Neue Messung") */
    buttonText?: string;
    /** Called when the button is pressed */
    onButtonPress?: () => void;
    /** Called when the card is pressed (optional, for navigation) */
    onPress?: () => void;
};

export function QuickEntryCard({
    title,
    icon = 'plus.circle.fill',
    iconColor,
    currentValue,
    currentValueLabel = 'Aktuell',
    lastEntryTime,
    buttonText = 'Neue Messung',
    onButtonPress,
    onPress,
}: QuickEntryCardProps) {
    const { tokens } = useTheme();

    return (
        <CardContainer onPress={onPress}>
            {/* Header */}
            <CardHeader
                title={title}
                icon={icon}
                iconColor={iconColor}
                iconSize={24}
                iconContainerSize={44}
            />

            {/* Current Value */}
            {currentValue && (
                <View style={[styles.valueSection, { gap: tokens.spacingXs }]}>
                    <Text variant="bodySmall" color="secondary">{currentValueLabel}</Text>
                    <Text variant="headlineMedium" style={styles.value}>{currentValue}</Text>
                </View>
            )}

            {/* Last Entry */}
            {lastEntryTime && (
                <Text variant="bodySmall" color="hint">
                    Zuletzt: {lastEntryTime}
                </Text>
            )}

            {/* Button */}
            {onButtonPress && (
                <Button
                    title={buttonText}
                    onPress={onButtonPress}
                    variant="tinted"
                    size="small"
                    rounded
                    style={{ marginTop: tokens.spacingXs }}
                />
            )}
        </CardContainer>
    );
}

const styles = StyleSheet.create({
    valueSection: {},
    value: {
        fontWeight: '600',
    },
});
