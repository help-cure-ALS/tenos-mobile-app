import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { Text } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';

interface FilterChipProps {
    label: string;
    onPress: () => void;
    active?: boolean;
    /** Icon name from the SVG icon registry */
    icon?: string;
    /** "outlined" = border tint (default), "filled" = solid tint background */
    variant?: 'outlined' | 'filled';
    /** Show trailing chevron when no icon is set (default: true) */
    showChevron?: boolean;
    /** Maximum width — label will be truncated with ellipsis */
    maxWidth?: number;
    /** Greyed out and non-pressable (e.g. paused while another exclusive filter is active) */
    disabled?: boolean;
}

export function FilterChip({ label, onPress, active = false, icon, variant = 'outlined', showChevron = false, maxWidth, disabled = false }: FilterChipProps) {
    const { colors } = useAppTheme();

    const filled = variant === 'filled';

    const backgroundColor = active
        ? (filled ? colors.tint : colors.tint + '20')
        : (filled ? colors.listItemBackground : colors.listItemBackground);

    const textColor = active
        ? (filled ? '#FFFFFF' : colors.tint)
        : (filled ? colors.textSecondary : colors.textPrimary);

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={[
                styles.chip,
                {
                    backgroundColor,
                    maxWidth,
                },
                disabled && styles.chipDisabled,
            ]}
            hitSlop={4}
        >
            {icon && (
                <AppIcon
                    name={icon}
                    size={16}
                    tintColor={textColor}
                />
            )}
            <Text style={[styles.chipText, { color: textColor }]} numberOfLines={1}>
                {label}
            </Text>
            {!icon && showChevron && (
                <AppIcon
                    name="chevron.down"
                    size={12}
                    tintColor={textColor}
                />
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 6,
    },
    chipSelected: {
        paddingHorizontal: 12,
        paddingVertical: 3,
    },
    chipDisabled: {
        opacity: 0.4,
    },
    chipText: {
        fontSize: 15,
        fontWeight: '500',
        flexShrink: 1,
    },
});
