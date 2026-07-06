import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { Space, Text, TextProps, useTheme } from 'react-native-nice-ui';
import { dynamicFontSize } from "@/src/theme";

type TextVariant = TextProps['variant'];

export type ScreenHeaderProps = {
    /** SF Symbol name for the icon */
    icon?: string;
    /** Custom icon component — replaces AppIcon when provided */
    iconComponent?: React.ReactNode;
    /** Main title text */
    title?: string;
    /** Optional subtitle text */
    subtitle?: string;
    /** Title text variant (default: headlineMedium) */
    titleVariant?: TextVariant;
    /** Subtitle text variant (default: bodyLarge) */
    subtitleVariant?: TextVariant;
    /** Icon size (default: 48) */
    iconSize?: number;
    /** Icon container size (default: 100) */
    iconContainerSize?: number;
    /** Custom icon tint color (default: colors.brandColorMuted) */
    iconTintColor?: string;
    /** Custom icon container background color (default: colors.listItemBackground) */
    iconContainerColor?: string;

    customIconContainerStyle?: object;
    /** Text alignment for title and subtitle (default: center) */
    textAlign?: 'left' | 'center';
};

export function ScreenHeader({
    icon,
    iconComponent,
    title,
    subtitle,
    titleVariant = 'headlineMedium',
    subtitleVariant = 'bodyLarge',
    iconSize = 48,
    iconContainerSize = 100,
    iconTintColor,
    iconContainerColor,
    textAlign = 'center',
    customIconContainerStyle,
}: ScreenHeaderProps) {
    const { colors, tokens } = useTheme();

    const containerStyle = {
        width: iconContainerSize,
        height: iconContainerSize,
        borderRadius: iconContainerSize / 2,
        backgroundColor: iconContainerColor ?? colors.listItemBackground,
    };

    return (
        <View style={[styles.container, { paddingHorizontal: tokens.listSectionPaddingHorizontal + 16}]}>
            {(icon || iconComponent) && (
            <View style={[styles.iconContainer, containerStyle, customIconContainerStyle]}>
                {iconComponent ?? (
                    <AppIcon
                        name={icon!}
                        tintColor={iconTintColor ?? colors.tint}
                        size={iconSize}
                    />
                )}
            </View>
            )}
            {title && (
            <Text
                variant={titleVariant}
                color="primary"
                align={textAlign}
                style={[styles.title, textAlign === 'left' && styles.textFullWidth]}
            >
                {title}
            </Text>
            )}
            {subtitle && (
                <>
                    <Space />
                    <Text
                        variant={subtitleVariant}
                        color="secondary"
                        align={textAlign}
                        style={[textAlign === 'left' && styles.textFullWidth, styles.subtitle]}
                    >
                        {subtitle}
                    </Text>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginBottom: 10
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 17,
    },
    title: {
        fontWeight: '700',
        letterSpacing: -0.6,
        fontSize: dynamicFontSize(28, { min: 26, max: 36 }),
        lineHeight: 30
    },
    textFullWidth: {
        width: '100%',
    },
    subtitle: {
        lineHeight: 22,
        fontSize: dynamicFontSize(18, { min: 16, max: 19 }),
        fontWeight: '500'
    }
});
