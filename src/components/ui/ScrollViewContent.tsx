import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

export function ScrollViewContent({ style, children, ...props }: ViewProps) {
    return (
        <View style={[styles.container, style]} {...props}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 20,
        maxWidth: 620,
        marginHorizontal: 'auto',
        width: '100%',
    },
});
