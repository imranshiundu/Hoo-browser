import { describe, expect, it } from 'vitest';
import { parseNetscapeBookmarks, serializeNetscapeBookmarks, mergeBookmarks, BookmarkEntry } from '../bookmarks-io';

const entry = (url: string, title: string, folder = 'General'): BookmarkEntry => ({
    id: `${url}-${title}`,
    title,
    url,
    folder,
    addedAt: 1700000000000
});

describe('serializeNetscapeBookmarks', () => {
    it('emits the Netscape doctype every browser expects', () => {
        const html = serializeNetscapeBookmarks([entry('https://example.com', 'Example')]);
        expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
        expect(html).toContain('HREF="https://example.com"');
        expect(html).toContain('>Example</A>');
    });

    it('groups entries into folders', () => {
        const html = serializeNetscapeBookmarks([
            entry('https://a.com', 'A', 'Work'),
            entry('https://b.com', 'B', 'Work'),
            entry('https://c.com', 'C', 'Media')
        ]);
        expect((html.match(/<H3>Work<\/H3>/g) || []).length).toBe(1);
        expect(html).toContain('<H3>Media</H3>');
        expect(html.indexOf('https://a.com')).toBeLessThan(html.indexOf('https://c.com'));
    });

    it('escapes HTML-significant characters in titles and URLs', () => {
        const html = serializeNetscapeBookmarks([entry('https://example.com/?a=1&b=2', '<Script & Co>')]);
        expect(html).toContain('&lt;Script &amp; Co&gt;');
        expect(html).toContain('a=1&amp;b=2');
        expect(html).not.toContain('<Script');
    });

    it('skips non-http URLs and junk input', () => {
        const html = serializeNetscapeBookmarks([
            entry('javascript:alert(1)', 'XSS'),
            entry('https://ok.com', 'OK'),
            null as any
        ]);
        expect(html).toContain('https://ok.com');
        expect(html).not.toContain('javascript:');
    });

    it('produces an empty (but valid) file for no bookmarks', () => {
        const html = serializeNetscapeBookmarks([]);
        expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
        expect(html).not.toContain('HREF=');
    });
});

describe('parseNetscapeBookmarks', () => {
    it('reads back what the serializer wrote (round-trip)', () => {
        const original = [
            entry('https://a.com', 'A Site', 'Work'),
            entry('https://b.com', 'B Site', 'Media'),
            entry('https://c.com', 'C Site', 'General')
        ];
        const parsed = parseNetscapeBookmarks(serializeNetscapeBookmarks(original));
        expect(parsed).toHaveLength(3);
        const byUrl = new Map(parsed.map(item => [item.url, item]));
        expect(byUrl.get('https://a.com')?.title).toBe('A Site');
        expect(byUrl.get('https://a.com')?.folder).toBe('Work');
        expect(byUrl.get('https://b.com')?.folder).toBe('Media');
        expect(byUrl.get('https://c.com')?.folder).toBe('General');
    });

    it('parses a real Firefox-style export with nested folders', () => {
        const firefoxHtml = [
            '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
            '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
            '<TITLE>Bookmarks</TITLE>',
            '<H1>Bookmarks Menu</H1>',
            '<DL><p>',
            '    <DT><H3 ADD_DATE="1690000000" LAST_MODIFIED="1690000001">Mozilla Firefox</H3>',
            '    <DL><p>',
            '        <DT><A HREF="https://www.mozilla.org/" ADD_DATE="1690000000">Getting Started</A>',
            '    </DL><p>',
            '    <DT><A HREF="https://duckduckgo.com/" ADD_DATE="1690000002">DuckDuckGo</A>',
            '</DL><p>'
        ].join('\n');
        const parsed = parseNetscapeBookmarks(firefoxHtml);
        expect(parsed).toHaveLength(2);
        const byUrl = new Map(parsed.map(item => [item.url, item]));
        expect(byUrl.get('https://www.mozilla.org/')?.folder).toBe('Mozilla Firefox');
        // After the folder's </DL>, back at root level.
        expect(byUrl.get('https://duckduckgo.com/')?.folder).toBe('General');
    });

    it('decodes HTML entities in titles', () => {
        const parsed = parseNetscapeBookmarks('<DL><p><DT><A HREF="https://x.com/?a=1&amp;b=2">Q &amp; A &quot;Site&quot;</A></DL>');
        expect(parsed[0].title).toBe('Q & A "Site"');
        expect(parsed[0].url).toBe('https://x.com/?a=1&b=2');
    });

    it('drops javascript: and other non-web links', () => {
        const parsed = parseNetscapeBookmarks([
            '<DL><p>',
            '<DT><A HREF="javascript:alert(1)">Evil</A>',
            '<DT><A HREF="https://ok.com">OK</A>',
            '</DL><p>'
        ].join('\n'));
        expect(parsed).toHaveLength(1);
        expect(parsed[0].url).toBe('https://ok.com');
    });

    it('tolerates empty and malformed input', () => {
        expect(parseNetscapeBookmarks('')).toEqual([]);
        expect(parseNetscapeBookmarks('   ')).toEqual([]);
        expect(parseNetscapeBookmarks('<html><body>not bookmarks</body></html>')).toEqual([]);
        expect(parseNetscapeBookmarks('<DL><p><DT><A HREF="https://unclosed.com">No close tag')).toHaveLength(1);
    });

    it('uses the URL as title when the link text is empty', () => {
        const parsed = parseNetscapeBookmarks('<DT><A HREF="https://notitle.com"></A>');
        expect(parsed[0].title).toBe('https://notitle.com');
    });
});

describe('mergeBookmarks', () => {
    it('adds only URLs that are not already bookmarked', () => {
        const existing = [entry('https://a.com', 'A')];
        const imported = [
            entry('https://a.com', 'Duplicate URL'),
            entry('https://b.com', 'B')
        ];
        const merged = mergeBookmarks(existing, imported);
        expect(merged).toHaveLength(2);
        expect(merged.find(item => item.url === 'https://a.com')?.title).toBe('A'); // original kept
        expect(merged.find(item => item.url === 'https://b.com')).toBeDefined();
    });

    it('prepends imports so they are visible immediately', () => {
        const merged = mergeBookmarks([entry('https://old.com', 'Old')], [entry('https://new.com', 'New')]);
        expect(merged[0].url).toBe('https://new.com');
    });

    it('gives imported entries real ids', () => {
        const merged = mergeBookmarks([], [entry('https://b.com', 'B')]);
        expect(merged[0].id).not.toBe('');
        expect(merged[0].id).toBeDefined();
    });

    it('caps the result so a huge import cannot bloat the profile', () => {
        const existing = Array.from({ length: 400 }, (_, i) => entry(`https://old-${i}.com`, `Old ${i}`));
        const imported = Array.from({ length: 400 }, (_, i) => entry(`https://new-${i}.com`, `New ${i}`));
        const merged = mergeBookmarks(existing, imported, 500);
        expect(merged).toHaveLength(500);
        expect(merged[0].url).toBe('https://new-0.com');
    });

    it('tolerates junk input', () => {
        expect(mergeBookmarks(null as any, undefined as any)).toEqual([]);
        expect(mergeBookmarks([entry('https://a.com', 'A')], 'garbage' as any)).toHaveLength(1);
    });
});
