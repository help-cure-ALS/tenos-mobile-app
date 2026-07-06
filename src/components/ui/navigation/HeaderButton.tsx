import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '@/src/theme';
import { AppIcon } from '@/src/components/ui/AppIcon';
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

interface HeaderButtonProps {
    onPress?: () => void;
    /** Icon name from the SVG icon registry */
    icon?: string;
    /** Text label (used when no icon provided) */
    title?: string;
    /** Icon/text tint color override */
    tintColor?: string;
    /** Bold / prominent style */
    variant?: 'plain' | 'done' | 'prominent';
    disabled?: boolean;
}

export function HeaderButton({
    onPress,
    icon,
    title,
    tintColor: tintColorProp,
    variant = 'plain',
    disabled = false,
}: HeaderButtonProps) {
    const { colors, isDark } = useAppTheme();

    const tintColor = tintColorProp ?? colors.tint;
    const pressedBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

    const variantBg = variant === 'done' || variant === 'prominent'
        ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)')
        : 'transparent';

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            hitSlop={HIT_SLOP}
            android_ripple={{ color: pressedBg, borderless: true, radius: 20 }}
            style={({ pressed }) => [
                styles.container,
                { backgroundColor: pressed ? pressedBg : variantBg },
                disabled && styles.disabled,
            ]}
        >
            {icon && (
                <AppIcon
                    name={icon}
                    tintColor={tintColor}
                    size={22}
                />
            )}
            {title && !icon && (
                <Text
                    style={[
                        styles.text,
                        { color: tintColor },
                        (variant === 'done' || variant === 'prominent') && styles.textBold,
                    ]}
                    numberOfLines={1}
                >
                    {title}
                </Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 44,
        minHeight: 44,
        borderRadius: 22,
    },
    disabled: {
        opacity: 0.4,
    },
    text: {
        fontSize: 17,
    },
    textBold: {
        fontWeight: '600',
    },
});
