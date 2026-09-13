/**
 * Article card for the news tab — same conventions as StudyCard
 * (listItemBackground, listSectionRadius, nice-ui Badge). With a
 * cover image the card renders it edge-to-edge on top, Apple-Health
 * style; without one it is a compact text card.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import type { ContentArticle } from '../types';
import { ArticleImage } from './ArticleImage';

type Props = {
    article: ContentArticle;
    unread: boolean;
    onPress: () => void;
};

export function ArticleCard({ article, unread, onPress }: Props) {
    const { colors, tokens } = useAppTheme();

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.container,
                {
                    backgroundColor: colors.listItemBackground,
                    borderRadius: tokens.listSectionRadius,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    opacity: pressed ? 0.7 : 1,
                },
            ]}
        >
            {article.imageRef && (
                <ArticleImage imageRef={article.imageRef} style={styles.image} />
            )}
            <View style={styles.body}>
                <View style={styles.metaRow}>
                    <Badge
                        label={article.source === 'clinic' && article.clinicName
                            ? article.clinicName
                            : article.categoryLabel}
                        size="small"
                        color={colors.listItemBackgroundMuted}
                        textColor={colors.textSecondary}
                    />
                    {unread && <View style={[styles.unreadDot, { backgroundColor: colors.tint }]} />}
                </View>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {article.title}
                </Text>
                {article.teaser !== '' && (
                    <Text style={[styles.teaser, { color: colors.textSecondary }]} numberOfLines={3}>
                        {article.teaser}
                    </Text>
                )}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        marginBottom: 20,
    },
    image: {
        width: '100%',
        aspectRatio: 16 / 9,
    },
    body: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        gap: 6,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 25,
    },
    teaser: {
        fontSize: 14,
        lineHeight: 19,
    },
});
