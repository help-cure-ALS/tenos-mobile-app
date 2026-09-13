/**
 * Care-server access for editorial articles.
 *
 * Reuses the anonymous care client (client_credentials) the studies
 * already use. Cover images live as Binary resources next to the
 * articles and are cached on disk for offline rendering.
 */

import type { Basic, Bundle } from '@medplum/fhirtypes';
import { getCareClient } from '../studies/careClient';
import { CONTENT_CODE_SYSTEM } from './fhirMapping';

/** All published articles (the mirror only ever contains public ones). */
export async function fetchArticleResources(): Promise<Basic[]> {
    const client = await getCareClient();
    const out: Basic[] = [];
    let offset = 0;
    const PAGE = 100;
    for (;;) {
        // no-cache: MedplumClient serves GET searches from its request
        // cache (default ~60s) — pull-to-refresh must hit the server,
        // otherwise the spinner spins and nothing updates.
        const bundle: Bundle = await client.search('Basic', {
            code: `${CONTENT_CODE_SYSTEM}|article`,
            _count: String(PAGE),
            _offset: String(offset),
        }, { cache: 'no-cache' });
        const page = (bundle.entry ?? [])
            .map((e) => e.resource as Basic | undefined)
            .filter((r): r is Basic => r?.resourceType === 'Basic');
        out.push(...page);
        if (page.length < PAGE) break;
        offset += PAGE;
    }
    return out;
}

/**
 * Local file URI for a cover image ("Binary/<id>" reference).
 *
 * Images are cached on disk (Paths.cache/content-images): once
 * downloaded they render offline; the Binary id changes on every
 * republish, so a cached file never goes stale. Returns null when
 * the ref is malformed or the download fails (e.g. offline before
 * the first load) — the card then falls back to text-only.
 */
export async function cachedImageUri(imageRef: string | undefined): Promise<string | null> {
    if (!imageRef || !imageRef.startsWith('Binary/')) return null;
    const binaryId = imageRef.slice('Binary/'.length);
    if (!/^[0-9a-fA-F-]+$/.test(binaryId)) return null;

    // Lazy import: keeps the native file-system module out of the
    // app-start path (the content provider mounts at startup).
    const { Directory, File, Paths } = await import('expo-file-system');

    const dir = new Directory(Paths.cache, 'content-images');
    const file = new File(dir, `${binaryId}.img`);
    try {
        if (file.exists) return file.uri;
    } catch {
        // fall through to download
    }

    try {
        const client = await getCareClient();
        const token = client.getAccessToken();
        if (!token) return null;
        if (!dir.exists) dir.create();
        const base = client.getBaseUrl().replace(/\/$/, '');
        const downloaded = await File.downloadFileAsync(
            `${base}/fhir/R4/${imageRef}`,
            file,
            { headers: { Authorization: `Bearer ${token}`, Accept: 'image/*' } },
        );
        return downloaded.uri;
    } catch {
        // Concurrent resolvers (card + detail) can race the download;
        // if the other one won, the file is there now.
        try {
            if (file.exists) return file.uri;
        } catch {
            // ignore
        }
        return null;
    }
}
