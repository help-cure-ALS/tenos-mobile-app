import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '@/src/theme';
import { AppIcon } from '@/src/components/ui/AppIcon';

interface CloseButtonProps {
    onPress: () => void;
    size?: number;
    tintColor?: string;
}

export function CloseButton({ onPress, size = 22, tintColor: tintColorProp }: CloseButtonProps) {
    const { colors, isDark } = useAppTheme();
    const tintColor = tintColorProp ?? colors.text;
    const pressedBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

    return (
        <Pressable
            onPress={onPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            android_ripple={{ color: pressedBg, borderless: true, radius: 20 }}
            style={({ pressed }) => [
                styles.container,
                { backgroundColor: pressed ? pressedBg : 'transparent' },
            ]}
        >
            <AppIcon name="xmark" tintColor={tintColor} size={size} />
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
});
