import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from 'react-native-nice-ui';

export type CardContainerProps = {
    children: React.ReactNode;
    /** Called when the card is pressed */
    onPress?: () => void;
    /** Called when the card is long-pressed */
    onLongPress?: () => void;
    /** Additional styles for the container */
    style?: StyleProp<ViewStyle>;
    /** Override the default gap between children */
    gap?: number;
    /** Override the default padding */
    padding?: number;
    /** Override the default min height */
    minHeight?: number;
};

export function CardContainer({
    children,
    onPress,
    onLongPress,
    style,
    gap,
    padding,
    minHeight,
}: CardContainerProps) {
    const { colors, tokens } = useTheme();

    const containerStyle: ViewStyle = {
        backgroundColor: colors.listItemBackground,
        borderRadius: tokens.listSectionRadius,
        padding: padding ?? tokens.spacingLg,
        gap: gap ?? tokens.spacingMd,
        overflow: 'hidden',
        // minHeight: minHeight ?? 92,
        minHeight: minHeight ?? 100,
    };

    const content = (
        <View style={[containerStyle, style]}>
            {children}
        </View>
    );

    if (onPress || onLongPress) {
        return (
            <Pressable
                onPress={onPress}
                onLongPress={onLongPress}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
                {content}
            </Pressable>
        );
    }

    return content;
}

const styles = StyleSheet.create({});
