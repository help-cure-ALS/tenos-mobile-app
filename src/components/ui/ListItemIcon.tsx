import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon } from './AppIcon';

const PRESETS = {
    sm: { container: 32, radius: 8, icon: 18 },
    md: { container: 40, radius: 20, icon: 20 },
    lg: { container: 56, radius: 28, icon: 28 },
} as const;

type ListItemIconProps = {
    /** SF Symbol name */
    name: string;
    /** Icon tintColor + basis for auto-generated background */
    color: string;
    /** Preset size (default: 'sm') */
    size?: 'sm' | 'md' | 'lg';
    /** Override auto-generated background (default: color + '20') */
    backgroundColor?: string;
};

export function ListItemIcon({ name, color, size = 'sm', backgroundColor }: ListItemIconProps) {
    const preset = PRESETS[size];
    const bg = backgroundColor ?? (color + '20');

    return (
        <View
            style={[
                styles.container,
                {
                    width: preset.container,
                    height: preset.container,
                    borderRadius: preset.radius,
                    backgroundColor: bg,
                },
            ]}
        >
            <AppIcon name={name} size={preset.icon} tintColor={color} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
