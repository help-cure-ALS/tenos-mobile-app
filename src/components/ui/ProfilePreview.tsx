/**
 * ProfilePreview - Avatar + name preview for profile editing screens.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useAppTheme } from '@/src/theme';

type ProfilePreviewProps = {
    name: string;
    icon: string;
    color: string;
    subtitle?: string;
    namePlaceholder: string;
};

export function ProfilePreview({ name, icon, color, subtitle, namePlaceholder }: ProfilePreviewProps) {
    const { colors } = useAppTheme();

    return (
        <View style={styles.previewSection}>
            <View
                style={[
                    styles.previewAvatar,
                    { backgroundColor: color + '20' },
                ]}
            >
                <AppIcon
                    name={icon}
                    tintColor={color}
                    size={40}
                />
            </View>
            <Text style={[styles.previewName, { color: colors.text }]}>
                {name || namePlaceholder}
            </Text>
            {subtitle ? (
                <Text style={[styles.previewSubtitle, { color: colors.textHint }]}>
                    {subtitle}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    previewSection: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    previewAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    previewName: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 4,
    },
    previewSubtitle: {
        fontSize: 14,
    },
});
