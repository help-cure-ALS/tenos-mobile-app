/**
 * IconPicker - Reusable icon selection grid.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useAppTheme } from '@/src/theme';

export const AVAILABLE_ICONS = [
    'person.fill',
    'heart.fill',
    'star.fill',
    'leaf.fill',
    'sun.max.fill',
    'moon.fill',
    'cloud.fill',
    'drop.fill',
    'figure.martial.arts',
    'figure.roll',
    'figure.boxing',
    'figure.yoga',
    'baseball.fill',
    'american.football.fill',
];

type IconPickerProps = {
    icons: string[];
    selected: string;
    selectedColor: string;
    onSelect: (icon: string) => void;
};

export function IconPicker({ icons, selected, selectedColor, onSelect }: IconPickerProps) {
    const { colors } = useAppTheme();

    return (
        <View style={styles.iconGrid}>
            {icons.map((icon) => (
                <Pressable
                    key={icon}
                    style={[
                        styles.iconButton,
                        {
                            backgroundColor: selected === icon
                                ? selectedColor + '20'
                                : colors.listItemBackground,
                            borderWidth: selected === icon ? 2 : 0,
                            borderColor: selectedColor,
                        },
                    ]}
                    onPress={() => onSelect(icon)}
                >
                    <AppIcon
                        name={icon}
                        tintColor={selected === icon ? selectedColor : colors.textHint}
                        size={24}
                    />
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    iconButton: {
        width: 52,
        height: 52,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
