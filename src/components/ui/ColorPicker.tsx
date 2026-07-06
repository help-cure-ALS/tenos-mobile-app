/**
 * ColorPicker - Reusable color selection grid.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useAppTheme } from '@/src/theme';

export const AVAILABLE_COLORS = [
    '#007AFF', // Blue
    '#34C759', // Green
    '#FF9500', // Orange
    '#FF2D55', // Pink
    '#AF52DE', // Purple
    '#5856D6', // Indigo
    '#FF3B30', // Red
    '#00C7BE', // Teal
];

type ColorPickerProps = {
    colors: string[];
    selected: string;
    onSelect: (color: string) => void;
};

export function ColorPicker({ colors, selected, onSelect }: ColorPickerProps) {
    const { colors: themeColors } = useAppTheme();

    return (
        <View style={styles.colorGrid}>
            {colors.map((color) => (
                <Pressable
                    key={color}
                    style={[
                        styles.colorButton,
                        {
                            backgroundColor: color,
                            borderWidth: selected === color ? 3 : 0,
                            borderColor: themeColors.text,
                        },
                    ]}
                    onPress={() => onSelect(color)}
                >
                    {selected === color && (
                        <AppIcon
                            name="checkmark"
                            tintColor="white"
                            size={20}
                        />
                    )}
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    colorButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
