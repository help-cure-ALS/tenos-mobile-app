/**
 * News tab — Apple-Health-style article cards, built from the house
 * components (FilterChip, ArticleCard). Tapping a card opens the
 * article as a modal sheet (app/newsArticle.tsx) and marks it read.
 *
 * The category chips follow the studies screen standard: filled
 * variant, edge-to-edge horizontal scroll with the padding inside
 * the chip row (insets + listSectionPaddingHorizontal).
 */
import React, { useMemo, useState } from 'react';
import { ImageBackground, Platform, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/theme';
import { tokens } from '@/src/theme/tokens';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { usePatientSwitcherToolbar } from '@/src/components/PatientSwitcher';
import { useSettingsButton } from '@/src/components/ui/navigation/SettingsButton';
import { FilterChip } from '@/src/components/ui/FilterChip';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { useContentContext } from '@/src/content';
import { ArticleCard } from '@/src/content/components/ArticleCard';
import type { ContentArticle } from '@/src/content';

export default function NewsScreen() {
    const { t } = useTranslation();
    const { colors, isDark } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { articles, refreshing, refetch, readIds, markRead, error } = useContentContext();
    const patientToolbarMenu = usePatientSwitcherToolbar();
    const settingsButton = useSettingsButton();
    const [category, setCategory] = useState<string | null>(null);

    // Same edge-padding math as the studies screen, clamped to the
    // ScrollViewContent width so chips align with the cards below.
    const contentWidth = Math.min(width, 620);
    const chipPaddingLeft = width > contentWidth
        ? ((width - insets.left - contentWidth) / 2) + insets.left + tokens.listSectionPaddingHorizontal
        : insets.left + tokens.listSectionPaddingHorizontal;
    const chipPaddingRight = width > contentWidth
        ? ((width - insets.right - contentWidth) / 2) + insets.right + tokens.listSectionPaddingHorizontal
        : insets.right + tokens.listSectionPaddingHorizontal;

    const categories = useMemo(() => {
        const seen = new Map<string, { label: string; sort: number }>();
        for (const article of articles) {
            if (!seen.has(article.category)) {
                seen.set(article.category, {
                    label: article.categoryLabel,
                    sort: article.categorySort ?? Number.MAX_SAFE_INTEGER,
                });
            }
        }
        // Editorial order from the portal (category sort), label as
        // tie-breaker for legacy articles without the sort extension.
        return [...seen.entries()]
            .map(([id, v]) => ({ id, label: v.label, sort: v.sort }))
            .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
    }, [articles]);

    // All chips including the leading "Alle" chip. With many
    // categories the single row gets unwieldy, so from
    // CHIP_WRAP_THRESHOLD chips onwards they wrap into two rows that
    // scroll horizontally together (see studies screen for the
    // single-row standard this extends).
    const chips = useMemo(() => [
        { id: null as string | null, label: t('news.filterAll') },
        ...categories,
    ], [categories, t]);
    const chipRows = useMemo(() => {
        if (chips.length < CHIP_WRAP_THRESHOLD) return [chips];
        const half = Math.ceil(chips.length / 2);
        return [chips.slice(0, half), chips.slice(half)];
    }, [chips]);

    const visible = category
        ? articles.filter((a) => a.category === category)
        : articles;

    const openArticle = (article: ContentArticle) => {
        markRead(article.articleId);
        router.push(`/newsArticle?articleId=${encodeURIComponent(article.articleId)}`);
    };

    return (
        <>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerRight: () => settingsButton,
                    }}
                />
            ) : (
                <Stack.Toolbar placement="right">
                    {patientToolbarMenu}
                    {settingsButton}
                </Stack.Toolbar>
            )}
        <ImageBackground
            source={!isDark && require('@/assets/images/bg/gradient-2.png')}
            style={[styles.image, { backgroundColor: colors.background }]}
        >
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.container}
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refetch()} />}
        >
            {categories.length > 1 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.chipContainer, {
                        paddingLeft: chipPaddingLeft,
                        paddingRight: chipPaddingRight,
                    }]}
                >
                    <View style={styles.chipRows}>
                        {chipRows.map((row, rowIndex) => (
                            <View key={rowIndex} style={styles.chipRow}>
                                {row.map((chip) => (
                                    <FilterChip
                                        key={chip.id ?? 'all'}
                                        label={chip.label}
                                        active={category === chip.id}
                                        onPress={() => setCategory(
                                            chip.id === null || category === chip.id ? null : chip.id,
                                        )}
                                        variant="filled"
                                    />
                                ))}
                            </View>
                        ))}
                    </View>
                </ScrollView>
            )}

            <ScrollViewContent style={styles.content}>
                {error && visible.length === 0 && (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        {t('news.loadFailed')}
                    </Text>
                )}

                {visible.map((article) => (
                    <ArticleCard
                        key={article.articleId}
                        article={article}
                        unread={!readIds.has(article.articleId)}
                        onPress={() => openArticle(article)}
                    />
                ))}
            </ScrollViewContent>
        </ScrollView>
        </ImageBackground>
        </>
    );
}

// From this many chips (incl. "Alle") the row wraps into two rows.
const CHIP_WRAP_THRESHOLD = 6;

const styles = StyleSheet.create({
    image: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    container: {
        paddingBottom: 32,
    },
    chipContainer: {
        paddingTop: 20,
        paddingBottom: 8,
    },
    chipRows: {
        gap: 8,
    },
    chipRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
    },
    content: {
        paddingHorizontal: tokens.listSectionPaddingHorizontal,
    },
    emptyText: {
        fontSize: 15,
        textAlign: 'center',
        marginTop: 24,
    },
});
