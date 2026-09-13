/**
 * Parser for article bodies written with the portal's workbench
 * RichTextEditor (tiptap). The editor emits a fixed HTML subset —
 * p, h1-h4, strong/b, em/i, u, s, a, ul, ol, li, br — and exactly
 * that subset is parsed into a block model the app can render as
 * native Text/View. Unknown tags are ignored (their text survives),
 * so the renderer can never execute anything.
 */

export interface InlineSpan {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    /** Set when the span is inside <a href="...">. */
    href?: string;
}

export type HtmlBlock =
    | { type: 'paragraph'; spans: InlineSpan[] }
    | { type: 'heading'; level: number; spans: InlineSpan[] }
    | { type: 'listItem'; ordered: boolean; index: number; spans: InlineSpan[] };

const ENTITIES: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

function decodeEntities(text: string): string {
    return text.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
        if (entity.startsWith('#x') || entity.startsWith('#X')) {
            const code = Number.parseInt(entity.slice(2), 16);
            return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
        if (entity.startsWith('#')) {
            const code = Number.parseInt(entity.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
        return ENTITIES[entity.toLowerCase()] ?? match;
    });
}

interface StyleState {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    href?: string;
}

export function parseHtmlBlocks(html: string): HtmlBlock[] {
    const blocks: HtmlBlock[] = [];
    const styleStack: StyleState[] = [{ bold: false, italic: false, underline: false, strike: false }];

    let current: HtmlBlock | null = null;
    let orderedCounters: number[] = [];
    let listOrdered: boolean[] = [];

    const flush = () => {
        if (current && current.spans.length > 0) blocks.push(current);
        current = null;
    };

    const pushText = (raw: string) => {
        const text = decodeEntities(raw).replace(/\s+/g, ' ');
        if (text.trim() === '') return;
        if (!current) current = { type: 'paragraph', spans: [] };
        const style = styleStack[styleStack.length - 1];
        current.spans.push({
            text,
            ...(style.bold ? { bold: true } : {}),
            ...(style.italic ? { italic: true } : {}),
            ...(style.underline ? { underline: true } : {}),
            ...(style.strike ? { strike: true } : {}),
            ...(style.href ? { href: style.href } : {}),
        });
    };

    // Tokenize into tags and text. The editor never nests blocks
    // beyond lists, so a flat scan with a style stack is sufficient.
    const TOKEN = /<[^>]+>|[^<]+/g;
    for (const token of html.match(TOKEN) ?? []) {
        if (!token.startsWith('<')) {
            pushText(token);
            continue;
        }

        const isClosing = token.startsWith('</');
        const name = (token.match(/^<\/?\s*([a-zA-Z0-9]+)/)?.[1] ?? '').toLowerCase();
        const top = styleStack[styleStack.length - 1];

        switch (name) {
            case 'p':
                if (isClosing) flush();
                else { flush(); current = { type: 'paragraph', spans: [] }; }
                break;
            case 'h1': case 'h2': case 'h3': case 'h4':
                if (isClosing) flush();
                else { flush(); current = { type: 'heading', level: Number(name[1]), spans: [] }; }
                break;
            case 'ul': case 'ol':
                if (isClosing) {
                    flush();
                    listOrdered.pop();
                    orderedCounters.pop();
                } else {
                    flush();
                    listOrdered.push(name === 'ol');
                    orderedCounters.push(0);
                }
                break;
            case 'li':
                if (isClosing) flush();
                else {
                    flush();
                    const ordered = listOrdered[listOrdered.length - 1] ?? false;
                    const index = (orderedCounters[orderedCounters.length - 1] ?? 0) + 1;
                    if (orderedCounters.length > 0) {
                        orderedCounters[orderedCounters.length - 1] = index;
                    }
                    current = { type: 'listItem', ordered, index, spans: [] };
                }
                break;
            case 'strong': case 'b':
                if (isClosing) styleStack.pop();
                else styleStack.push({ ...top, bold: true });
                break;
            case 'em': case 'i':
                if (isClosing) styleStack.pop();
                else styleStack.push({ ...top, italic: true });
                break;
            case 'u':
                if (isClosing) styleStack.pop();
                else styleStack.push({ ...top, underline: true });
                break;
            case 's': case 'strike': case 'del':
                if (isClosing) styleStack.pop();
                else styleStack.push({ ...top, strike: true });
                break;
            case 'a': {
                if (isClosing) styleStack.pop();
                else {
                    const href = token.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/)?.[1]
                        ?? token.match(/href\s*=\s*'([^']*)'/)?.[1];
                    const safe = href && /^https?:\/\//i.test(decodeEntities(href)) ? decodeEntities(href) : undefined;
                    styleStack.push({ ...top, href: safe });
                }
                break;
            }
            case 'br':
                pushText(' ');
                break;
            default:
                // Unknown tag — ignore the tag, keep surrounding text.
                break;
        }

        // Defensive: never pop the base style state.
        if (styleStack.length === 0) {
            styleStack.push({ bold: false, italic: false, underline: false, strike: false });
        }
    }

    flush();
    return blocks;
}
