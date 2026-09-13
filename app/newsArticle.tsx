/**
 * Article detail — modal sheet in Apple-Health style. Uses the house
 * modal pattern (transparent Stack header + toolbar close button,
 * same as researchProject) instead of a hand-built header.
 */
import React from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { useContentContext } from '@/src/content';
import { ArticleImage } from '@/src/content/components/ArticleImage';
import { HtmlBody } from '@/src/content/components/HtmlBody';

export default function NewsArticleModal() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ articleId?: string }>();
    const { articles } = useContentContext();

    const article = articles.find((a) => a.articleId === params.articleId);

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle: article?.categoryLabel ?? t('news.title'),
                        headerRight: () => (
                            <HeaderButton
                                title={t('verification.done')}
                                variant="plain"
                                onPress={() => router.back()}
                            />
                        ),
                    }}
                />
            ) : (
                <>
                    <Stack.Screen
                        options={{ headerTitle: article?.categoryLabel ?? t('news.title') }}
                    />
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button variant="plain" onPress={() => router.back()}>
                            {t('verification.done')}
                        </Stack.Toolbar.Button>
                    </Stack.Toolbar>
                </>
            )}

            {article ? (
                <ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
                    contentInsetAdjustmentBehavior="automatic"
                >
                    {article.imageRef && (
                        <ArticleImage imageRef={article.imageRef} style={styles.heroImage} />
                    )}
                    <ScrollViewContent style={styles.textContent}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>
                            {article.title}
                        </Text>
                        {article.teaser !== '' && article.body !== '' && (
                            <Text style={[styles.teaser, { color: colors.textSecondary }]}>
                                {article.teaser}
                            </Text>
                        )}
                        {article.body !== '' ? (
                            <HtmlBody html={article.body} />
                        ) : (
                            article.teaser !== '' && (
                                <Text style={[styles.bodyFallback, { color: colors.textPrimary }]}>
                                    {article.teaser}
                                </Text>
                            )
                        )}
                        {article.linkUrl && (
                            <View style={styles.linkButton}>
                                <Button
                                    title={t('news.openLink')}
                                    rounded
                                    onPress={() => { void Linking.openURL(article.linkUrl!); }}
                                />
                            </View>
                        )}
                        {article.source === 'clinic' && article.clinicName && (
                            <Text style={[styles.sourceNote, { color: colors.textSecondary }]}>
                                {t('news.fromClinic', { clinic: article.clinicName })}
                            </Text>
                        )}
                    </ScrollViewContent>
                </ScrollView>
            ) : (
                <View style={styles.missing}>
                    <Text style={[styles.bodyFallback, { color: colors.textSecondary }]}>
                        {t('news.notFound')}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingBottom: 48,
    },
    heroImage: {
        width: '100%',
        aspectRatio: 16 / 9,
    },
    textContent: {
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 30,
        fontWeight: '800',
        lineHeight: 36,
        paddingBottom: 8,
    },
    teaser: {
        fontSize: 17,
        lineHeight: 24,
        paddingBottom: 12,
    },
    bodyFallback: {
        fontSize: 17,
        lineHeight: 25,
    },
    linkButton: {
        marginTop: 24,
    },
    sourceNote: {
        fontSize: 13,
        paddingTop: 24,
    },
    missing: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
});
