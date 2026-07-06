/**
 * TodoSection Component
 *
 * "Heute erfassen" section with full-width stacked items.
 * Completed items: muted background + checkmark. Due items: dark background.
 */

import React from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useTodoItems, type TodoItem } from '@/src/hooks/useTodoItems';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppRole } from '@/src/context/AppRoleProvider';

function TodoRow({
    item,
    onPress,
}: {
    item: TodoItem;
    onPress: () => void;
}) {
    const { colors, isDark } = useAppTheme();
    const done = !item.isDue;

    const bgColor = done
        ? (isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.05)')
        : colors.brandColor;
    const textColor = done
        ? colors.textHint
        : '#ffffff';

    return (
        <Pressable
            onPress={done ? undefined : onPress}
            disabled={done}
            style={({ pressed }) => [
                styles.row,
                { backgroundColor: bgColor },
                !done && pressed && { opacity: 0.7 },
            ]}
        >
            <Text style={[styles.rowText, { color: textColor }]} numberOfLines={1}>
                {item.name}
            </Text>
            {done && (
                <AppIcon name="checkmark" tintColor={textColor} size={16} />
            )}
        </Pressable>
    );
}

export function TodoSection({ style }: { style?: import('react-native').ViewStyle }) {
    const { t } = useTranslation();
    const { colors, tokens } = useAppTheme();
    const router = useSafeRouter();
    const { role } = useAppRole();
    const isManaged = role === 'doctor' || role === 'caregiver';
    const {
        items,
        isLoading,
        hasConfiguredItems,
        yesterdayMissedItems,
    } = useTodoItems();

    if (isLoading) return null;

    const handleItemPress = (item: TodoItem) => {
        if (item.type === 'metric') {
            router.push(`/(tabs)/(metric)/${item.id}/add` as any);
        } else {
            router.push(`/(tabs)/(metric)/questionnaire/${item.id}` as any);
        }
    };

    const handleBackfillPress = () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(12, 0, 0, 0);
        const dateParam = yesterday.toISOString();

        // Navigate to first missed item with yesterday's date
        const item = yesterdayMissedItems[0];
        if (!item) return;

        if (item.type === 'metric') {
            router.push({
                pathname: `/(tabs)/(metric)/${item.id}/add` as any,
                params: { effectiveDate: dateParam },
            });
        } else {
            router.push({
                pathname: `/(tabs)/(metric)/questionnaire/${item.id}` as any,
                params: { effectiveDate: dateParam },
            });
        }
    };

    const handleSettings = () => {
        router.push('/(tabs)/(metric)/todoSettings' as any);
    };

    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: tokens.listSectionRadius }, style]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {t('todo.sectionTitle')}
                </Text>
                { !isManaged && (
                    <Pressable onPress={handleSettings} hitSlop={12}>
                        <AppIcon name="gearshape.fill" tintColor={colors.textSecondary} size={24} />
                    </Pressable>
                ) }
            </View>

            {/* Doctor/caregiver with no visible items */}
            {isManaged && items.length === 0 && (
                <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                    {t('todo.noSharedItems')}
                </Text>
            )}

            {/* No items configured — hint (patient/demo only) */}
            {!isManaged && !hasConfiguredItems && (
                <Pressable onPress={handleSettings}>
                    <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                        {t('todo.noItemsHint')}
                    </Text>
                </Pressable>
            )}

            {/* Item rows */}
            {items.length > 0 && items.map((item) => (
                <TodoRow
                    key={item.key}
                    item={item}
                    onPress={() => handleItemPress(item)}
                />
            ))}

            {/* Yesterday backfill hint */}
            {yesterdayMissedItems.length > 0 && (
                <Pressable onPress={handleBackfillPress} hitSlop={4} style={{ marginTop: 8 }}>
                    <Text style={[styles.backfillText, { color: colors.textSecondary }]}>
                        {t('todo.yesterdayMissed')}
                    </Text>
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginTop: 16,
        borderRadius: 16,
        padding: 16,
        gap: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 2,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
    },
    rowText: {
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
    },
    hintText: {
        fontSize: 16,
    },
    backfillText: {
        paddingHorizontal: 4,
        fontSize: 16,
        marginTop: 0,
    },
});
