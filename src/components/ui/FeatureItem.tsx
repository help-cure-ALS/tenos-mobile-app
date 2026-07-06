import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useAppTheme } from '@/src/theme';

export type FeatureItemProps = {
    icon: string;
    iconColor?: string;
    title?: string;
    description?: string;
    variant?: 'plain' | 'fill' | 'bare';
    iconSize?: 'small' | 'large';
};

function getContrastColor(hexColor: string): string {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

const iconSizes = {
    small: { container: 28, icon: 16, radius: 8 },
    large: { container: 36, icon: 22, radius: 12 }
};

export function FeatureItem({
                                icon,
                                iconColor,
                                title,
                                description,
                                variant = 'plain',
                                iconSize = 'large'
                            }: FeatureItemProps) {
    const { colors } = useAppTheme();
    const size = iconSizes[iconSize];
    const effectiveColor = iconColor ?? colors.tint;
    const isBare = variant === 'bare';
    const isFill = variant === 'fill';

    return (
        <View style={ [styles.featureItem, !description && { alignItems: 'center' }] }>
            <View style={ [{
                width: size.container,
                height: size.container,
                borderRadius: size.radius,
                alignItems: 'center',
                justifyContent: 'center'
            }, !isBare && { backgroundColor: isFill ? effectiveColor : effectiveColor + '20' }, isBare && {
                justifyContent: 'flex-start',
                alignItems: 'flex-end'
            }] }>
                <AppIcon
                    name={ icon }
                    size={ size.icon }
                    tintColor={ isFill ? getContrastColor(effectiveColor) : effectiveColor }
                />
            </View>
            <View style={ styles.featureContent }>
                { !!title && (
                    <Text style={ [styles.featureTitle, { color: colors.textPrimary }] }>
                        { title }
                    </Text>
                ) }
                { !!description && (
                    <Text style={ [styles.featureDescription, { color: colors.textSecondary }] }>
                        { description }
                    </Text>
                ) }
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    featureItem: {
        flexDirection: 'row',
        gap: 12
    },
    featureContent: {
        flex: 1
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2
    },
    featureDescription: {
        fontSize: 15,
        lineHeight: 20
    }
});
