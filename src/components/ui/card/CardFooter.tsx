import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-nice-ui';

export type CardFooterProps = {
    /** Footer content - can be string or custom React nodes */
    children?: React.ReactNode;
    /** Simple text shortcut (alternative to children) */
    text?: string;
};

export function CardFooter({ children, text }: CardFooterProps) {
    const { colors } = useTheme();

    if (!children && !text) {
        return null;
    }

    return (
        <View style={styles.footer}>
            {text ? (
                <Text style={[styles.footerText, { color: colors.textHint }]}>
                    {text}
                </Text>
            ) : (
                children
            )}
        </View>
    );
}

export type CardFooterTextProps = {
    children: string;
};

/** Helper component for consistent footer text styling */
export function CardFooterText({ children }: CardFooterTextProps) {
    const { colors } = useTheme();

    return (
        <Text style={[styles.footerText, { color: colors.textHint }]}>
            {children}
        </Text>
    );
}

const styles = StyleSheet.create({
    footer: {
        gap: 2
    },
    footerText: {
        fontSize: 13,
    },
});
