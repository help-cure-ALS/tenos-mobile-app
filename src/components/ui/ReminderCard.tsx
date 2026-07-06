import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { Button, Text, useTheme } from 'react-native-nice-ui';

export type ReminderPriority = 'normal' | 'warning' | 'urgent';

export type ReminderCardProps = {
    /** Card title (e.g., "ALSFRS-R fällig") */
    title: string;
    /** Description text */
    description?: string;
    /** SF Symbol icon name */
    icon?: string;
    /** Reminder priority - affects colors */
    priority?: ReminderPriority;
    /** Action button text (e.g., "Jetzt ausfüllen") */
    actionText?: string;
    /** Called when the action button is pressed */
    onAction?: () => void;
    /** Called when dismiss is pressed */
    onDismiss?: () => void;
    /** Called when the card is pressed */
    onPress?: () => void;
};

function getPriorityColors(priority: ReminderPriority): { bg: string; accent: string } {
    switch (priority) {
        case 'urgent':
            return { bg: '#FF3B3015', accent: '#FF3B30' };
        case 'warning':
            return { bg: '#FF950015', accent: '#FF9500' };
        default:
            return { bg: '#007AFF15', accent: '#007AFF' };
    }
}

export function ReminderCard({
    title,
    description,
    icon = 'bell.fill',
    priority = 'normal',
    actionText,
    onAction,
    onDismiss,
    onPress,
}: ReminderCardProps) {
    const { colors, tokens } = useTheme();
    const priorityColors = getPriorityColors(priority);

    // ReminderCard has custom styling (priority-based background color)
    // so we don't use CardContainer here
    const content = (
        <View style={[
            styles.container,
            {
                backgroundColor: priorityColors.bg,
                borderRadius: tokens.listSectionRadius,
                padding: tokens.spacingLg,
                gap: tokens.spacingMd,
            }
        ]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={[styles.titleRow, { gap: tokens.spacingSm }]}>
                    <View style={[styles.iconContainer, { backgroundColor: priorityColors.accent + '30', borderRadius: tokens.radiusMd }]}>
                        <AppIcon
                            name={icon}
                            tintColor={priorityColors.accent}
                            size={18}
                        />
                    </View>
                    <Text variant="titleMedium" style={[styles.title, { color: priorityColors.accent }]}>
                        {title}
                    </Text>
                </View>
                {onDismiss && (
                    <Pressable onPress={onDismiss} hitSlop={12}>
                        <AppIcon
                            name="xmark"
                            tintColor={colors.textHint}
                            size={16}
                        />
                    </Pressable>
                )}
            </View>

            {/* Description */}
            {description && (
                <Text variant="bodyMedium" color="primary" style={styles.description}>
                    {description}
                </Text>
            )}

            {/* Action Button */}
            {actionText && onAction && (
                <Button
                    title={actionText}
                    onPress={onAction}
                    variant="primary"
                    size="small"
                    rounded
                    style={[styles.button, { backgroundColor: priorityColors.accent, marginTop: tokens.spacingXs }]}
                />
            )}
        </View>
    );

    if (onPress) {
        return (
            <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                {content}
            </Pressable>
        );
    }

    return content;
}

const styles = StyleSheet.create({
    container: {},
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontWeight: '600',
        flex: 1,
    },
    description: {
        lineHeight: 22,
    },
    button: {},
});
