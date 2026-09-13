/**
 * Unit tests for the on-device article targeting and the Basic →
 * ContentArticle mapping. Run via `npm run test:content` (tsx).
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { isArticleVisible, isReadExpired } from '../src/content/targeting';
import { mapFhirArticle } from '../src/content/fhirMapping';
import { parseHtmlBlocks } from '../src/content/htmlBlocks';
import type { ContentArticle, ContentAudience } from '../src/content/types';

function article(overrides: Partial<ContentArticle>): ContentArticle {
    return {
        id: 'res-1',
        articleId: 'a-1',
        source: 'hca',
        category: 'news',
        categoryLabel: 'News',
        title: 'Titel',
        teaser: '',
        body: '',
        articleDate: '2026-01-01',
        startsAt: '2026-01-01',
        endsAt: '2026-12-31',
        targeting: { countries: [], roles: [], phaseMinMonths: null, phaseMaxMonths: null, alsfrs: null },
        ...overrides,
    };
}

const TODAY = '2026-06-15';

test('window, country and phase targeting', () => {
    const audience: ContentAudience = { country: 'DE', monthsSinceOnset: 38 };

    assert.equal(isArticleVisible(article({}), audience, TODAY), true);
    assert.equal(isArticleVisible(article({ endsAt: '2026-06-14' }), audience, TODAY), false);
    assert.equal(isArticleVisible(article({ startsAt: '2026-06-16' }), audience, TODAY), false);
    // No window at all = always visible
    assert.equal(isArticleVisible(article({ startsAt: undefined, endsAt: undefined }), audience, TODAY), true);
    assert.equal(isArticleVisible(article({ startsAt: '2026-01-01', endsAt: undefined }), audience, TODAY), true);

    const deOnly = article({ targeting: { countries: ['DE', 'AT'], roles: [], phaseMinMonths: null, phaseMaxMonths: null, alsfrs: null } });
    assert.equal(isArticleVisible(deOnly, audience, TODAY), true);
    assert.equal(isArticleVisible(deOnly, { ...audience, country: 'US' }, TODAY), false);
    // Unknown country: articles stay visible (missing data never hides)
    assert.equal(isArticleVisible(deOnly, { monthsSinceOnset: 38 }, TODAY), true);

    const earlyPhase = article({ targeting: { countries: [], roles: [], phaseMinMonths: null, phaseMaxMonths: 6, alsfrs: null } });
    assert.equal(isArticleVisible(earlyPhase, { monthsSinceOnset: 2 }, TODAY), true);
    assert.equal(isArticleVisible(earlyPhase, { monthsSinceOnset: 38 }, TODAY), false);
    assert.equal(isArticleVisible(earlyPhase, {}, TODAY), true);

    const latePhase = article({ targeting: { countries: [], roles: [], phaseMinMonths: 24, phaseMaxMonths: null, alsfrs: null } });
    assert.equal(isArticleVisible(latePhase, { monthsSinceOnset: 38 }, TODAY), true);
    assert.equal(isArticleVisible(latePhase, { monthsSinceOnset: 2 }, TODAY), false);
});

test('ALSFRS targeting on total and domain scores', () => {
    const respiratory = article({
        targeting: {
            countries: [],
            roles: [],
            phaseMinMonths: null,
            phaseMaxMonths: null,
            alsfrs: { scale: 'respiratory', min: null, max: 8 },
        },
    });
    assert.equal(isArticleVisible(respiratory, { alsfrsDomains: { respiratory: 6 } }, TODAY), true);
    assert.equal(isArticleVisible(respiratory, { alsfrsDomains: { respiratory: 11 } }, TODAY), false);
    // No questionnaire yet → visible
    assert.equal(isArticleVisible(respiratory, {}, TODAY), true);
    assert.equal(isArticleVisible(respiratory, { alsfrsTotal: 40 }, TODAY), true);

    const total = article({
        targeting: {
            countries: [],
            roles: [],
            phaseMinMonths: null,
            phaseMaxMonths: null,
            alsfrs: { scale: 'total', min: 30, max: null },
        },
    });
    assert.equal(isArticleVisible(total, { alsfrsTotal: 42 }, TODAY), true);
    assert.equal(isArticleVisible(total, { alsfrsTotal: 20 }, TODAY), false);
});

test('clinic articles require the matching verified clinic', () => {
    const clinicArticle = article({ source: 'clinic', clinicId: 'org-1', clinicName: 'Ambulanz X' });
    assert.equal(isArticleVisible(clinicArticle, { verifiedClinicId: 'org-1' }, TODAY), true);
    assert.equal(isArticleVisible(clinicArticle, { verifiedClinicId: 'org-2' }, TODAY), false);
    // Missing verification HIDES clinic articles (binding, not health data)
    assert.equal(isArticleVisible(clinicArticle, {}, TODAY), false);
});

test('mapFhirArticle picks translations and parses targeting defensively', () => {
    const EXT = 'http://help-cure-als.org/ext';
    const resource: any = {
        resourceType: 'Basic',
        id: 'res-9',
        identifier: [{ system: 'http://help-cure-als.org/content-article', value: 'a-9' }],
        code: { coding: [{ system: 'http://help-cure-als.org/content', code: 'article' }] },
        extension: [
            { url: `${EXT}/content-source`, valueString: 'hca' },
            { url: `${EXT}/content-category`, valueString: 'announcement' },
            { url: `${EXT}/category-label`, valueString: 'Ankündigungen' },
            { url: `${EXT}/category-label-en`, valueString: 'Announcements' },
            { url: `${EXT}/title`, valueString: 'Hallo' },
            { url: `${EXT}/title-en`, valueString: 'Hello' },
            { url: `${EXT}/content-date`, valueDate: '2026-03-01' },
            { url: `${EXT}/content-starts-at`, valueDate: '2026-01-01' },
            { url: `${EXT}/content-ends-at`, valueDate: '2026-12-31' },
            {
                url: `${EXT}/content-targeting`,
                valueString: '{"countries":["de"],"phase_min_months":6,"phase_max_months":null,"alsfrs":{"scale":"respiratory","min":null,"max":8}}',
            },
        ],
    };

    const en = mapFhirArticle(resource, 'en-US');
    assert.ok(en);
    assert.equal(en!.title, 'Hello');
    assert.equal(en!.articleDate, '2026-03-01');
    assert.equal(en!.categoryLabel, 'Announcements');
    assert.deepEqual(en!.targeting.countries, ['DE']);
    assert.equal(en!.targeting.phaseMinMonths, 6);
    assert.equal(en!.targeting.alsfrs?.scale, 'respiratory');

    const de = mapFhirArticle(resource, 'de');
    assert.equal(de!.title, 'Hallo');
    assert.equal(de!.categoryLabel, 'Ankündigungen');

    // Untranslated language falls back to the original
    const ja = mapFhirArticle(resource, 'ja');
    assert.equal(ja!.title, 'Hallo');

    // Malformed targeting → no restriction instead of a crash
    const broken = {
        ...resource,
        extension: resource.extension.map((e: any) =>
            e.url === `${EXT}/content-targeting` ? { ...e, valueString: '{nope' } : e),
    };
    assert.deepEqual(mapFhirArticle(broken, 'de')!.targeting, {
        countries: [], roles: [], phaseMinMonths: null, phaseMaxMonths: null, alsfrs: null,
    });

    // Missing mandatory fields drop the article
    const noTitle = { ...resource, extension: resource.extension.filter((e: any) => !e.url.endsWith('/title') && !e.url.endsWith('/title-en')) };
    assert.equal(mapFhirArticle(noTitle, 'de'), null);

    // Missing window is fine — unbounded visibility
    const noWindow = { ...resource, extension: resource.extension.filter((e: any) => !e.url.includes('content-starts-at') && !e.url.includes('content-ends-at')) };
    const unbounded = mapFhirArticle(noWindow, 'de');
    assert.ok(unbounded);
    assert.equal(unbounded!.startsAt, undefined);
    assert.equal(unbounded!.endsAt, undefined);
});

test('parseHtmlBlocks handles the tiptap subset defensively', () => {
    const blocks = parseHtmlBlocks(
        '<h2>Atmung</h2><p>Ein <strong>wichtiger</strong> Punkt mit <a href="https://example.org/x">Link</a>.</p>'
        + '<ul><li>Erstens</li><li>Zweitens &amp; mehr</li></ul>'
        + '<ol><li>Eins</li><li>Zwei</li></ol>',
    );
    assert.equal(blocks[0].type, 'heading');
    assert.equal(blocks[0].spans[0].text, 'Atmung');

    assert.equal(blocks[1].type, 'paragraph');
    const spans = blocks[1].spans;
    assert.equal(spans.find((s) => s.bold)?.text, 'wichtiger');
    assert.equal(spans.find((s) => s.href)?.href, 'https://example.org/x');

    const items = blocks.filter((b) => b.type === 'listItem');
    assert.equal(items.length, 4);
    assert.equal(items[1].spans[0].text, 'Zweitens & mehr');
    assert.equal(items[2].ordered, true);
    assert.equal(items[3].index, 2);

    // javascript: links are dropped, the text survives
    const unsafe = parseHtmlBlocks('<p><a href="javascript:alert(1)">klick</a></p>');
    assert.equal(unsafe[0].spans[0].text, 'klick');
    assert.equal(unsafe[0].spans[0].href, undefined);

    // Unknown tags are ignored, text kept; broken HTML never throws
    const messy = parseHtmlBlocks('<div><p>Text <span>bleibt</span></p></div><p>offen');
    assert.equal(messy.length, 2);
    assert.equal(messy[1].spans[0].text, 'offen');
});

test('isReadExpired hides read articles after the configured days', () => {
    const expiring = article({ hideReadAfterDays: 3 });

    // Unread or no option: never expires
    assert.equal(isReadExpired(expiring, undefined, TODAY), false);
    assert.equal(isReadExpired(article({}), '2026-01-01T10:00:00Z', TODAY), false);

    // Read 2 days ago with 3-day window: still visible
    assert.equal(isReadExpired(expiring, '2026-06-13T08:00:00Z', TODAY), false);
    // Read exactly 3 days ago: hidden
    assert.equal(isReadExpired(expiring, '2026-06-12T23:00:00Z', TODAY), true);
    // Read long ago: hidden
    assert.equal(isReadExpired(expiring, '2026-01-01T00:00:00Z', TODAY), true);

    // Garbage read date: fail open (stays visible)
    assert.equal(isReadExpired(expiring, 'kaputt', TODAY), false);
});

test('role targeting: doctors opt-in, others default audience', () => {
    const openArticle = article({});
    const caregiverOnly = article({ targeting: { countries: [], roles: ['caregiver'], phaseMinMonths: null, phaseMaxMonths: null, alsfrs: null } });
    const doctorArticle = article({ targeting: { countries: [], roles: ['doctor'], phaseMinMonths: null, phaseMaxMonths: null, alsfrs: null } });

    // Empty roles: visible to patient and caregiver, NOT to doctors.
    assert.equal(isArticleVisible(openArticle, { role: 'patient' }, TODAY), true);
    assert.equal(isArticleVisible(openArticle, { role: 'caregiver' }, TODAY), true);
    assert.equal(isArticleVisible(openArticle, { role: 'doctor' }, TODAY), false);

    // Explicit roles restrict accordingly.
    assert.equal(isArticleVisible(caregiverOnly, { role: 'caregiver' }, TODAY), true);
    assert.equal(isArticleVisible(caregiverOnly, { role: 'patient' }, TODAY), false);
    assert.equal(isArticleVisible(doctorArticle, { role: 'doctor' }, TODAY), true);
    assert.equal(isArticleVisible(doctorArticle, { role: 'patient' }, TODAY), false);

    // Unknown role: no restriction (missing data never hides), but
    // doctor-only articles need the explicit doctor role.
    assert.equal(isArticleVisible(openArticle, {}, TODAY), true);
});
