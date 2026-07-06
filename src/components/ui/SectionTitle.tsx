import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from 'react-native-nice-ui';

type SectionTitleProps = {
    title: string;
    rightCmp?: React.ReactNode;
    style?: ViewStyle;
};

export function SectionTitle({ title, rightCmp, style }: SectionTitleProps) {
    return (
        <View style={[styles.container, style]}>
            <Text style={styles.title} color="primary">
                {title}
            </Text>
            {rightCmp}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 3,
        paddingVertical: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
});
