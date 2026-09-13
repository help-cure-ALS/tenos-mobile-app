/**
 * Renders an article body written with the portal's RichTextEditor.
 * The HTML is parsed into a block model (htmlBlocks.ts) and rendered
 * as native Text/View — nothing is ever interpreted as code, links
 * open via Linking after the usual scheme check in the parser.
 */
import React from 'react';
import { Linking, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useAppTheme } from '@/src/theme';
import { parseHtmlBlocks, type InlineSpan } from '../htmlBlocks';

function spanStyle(span: InlineSpan, linkColor: string): TextStyle {
    return {
        ...(span.bold ? { fontWeight: '700' as const } : {}),
        ...(span.italic ? { fontStyle: 'italic' as const } : {}),
        ...(span.underline || span.href ? { textDecorationLine: 'underline' as const } : {}),
        ...(span.strike ? { textDecorationLine: 'line-through' as const } : {}),
        ...(span.href ? { color: linkColor } : {}),
    };
}

function Spans({ spans }: { spans: InlineSpan[] }) {
    const { colors } = useAppTheme();
    return (
        <>
            {spans.map((span, i) => (
                <Text
                    key={i}
                    style={spanStyle(span, colors.tint)}
                    {...(span.href
                        ? { onPress: () => { void Linking.openURL(span.href!); } }
                        : {})}
                >
                    {span.text}
                </Text>
            ))}
        </>
    );
}

export function HtmlBody({ html }: { html: string }) {
    const { colors } = useAppTheme();
    const blocks = parseHtmlBlocks(html);

    return (
        <View style={styles.container}>
            {blocks.map((block, i) => {
                if (block.type === 'heading') {
                    return (
                        <Text key={i} style={[styles.heading, block.level >= 3 && styles.headingSmall, { color: colors.textPrimary }]}>
                            <Spans spans={block.spans} />
                        </Text>
                    );
                }
                if (block.type === 'listItem') {
                    return (
                        <View key={i} style={styles.bulletRow}>
                            <Text style={[styles.body, styles.bulletMarker, { color: colors.textPrimary }]}>
                                {block.ordered ? `${block.index}.` : '•'}
                            </Text>
                            <Text style={[styles.body, styles.bulletText, { color: colors.textPrimary }]}>
                                <Spans spans={block.spans} />
                            </Text>
                        </View>
                    );
                }
                return (
                    <Text key={i} style={[styles.body, { color: colors.textPrimary }]}>
                        <Spans spans={block.spans} />
                    </Text>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 10,
    },
    heading: {
        fontSize: 22,
        fontWeight: '700',
        marginTop: 10,
    },
    headingSmall: {
        fontSize: 18,
    },
    body: {
        fontSize: 17,
        lineHeight: 25,
    },
    bulletRow: {
        flexDirection: 'row',
    },
    bulletMarker: {
        marginRight: 8,
        minWidth: 16,
    },
    bulletText: {
        flex: 1,
    },
});
