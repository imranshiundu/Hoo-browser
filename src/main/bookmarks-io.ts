/**
 * Bookmark import/export in the Netscape bookmark file format — the HTML
 * dialect every browser (Firefox, Chrome, Safari, Edge) uses for
 * "Export bookmarks" / "Import bookmarks from HTML file".
 *
 * Exported files start with `<!DOCTYPE NETSCAPE-Bookmark-file-1>` and hold
 * `<DT><A HREF="...">Title</A>` entries, optionally nested inside folder
 * `<DL><p>…</DL><p>` blocks. Import flattens that tree, keeping folder
 * names, and tolerates the slightly malformed output real browsers emit
 * (missing close tags, `<p>` separators, attributes in any order).
 */

export interface BookmarkEntry {
    id: string;
    title: string;
    url: string;
    folder: string;
    addedAt: number;
}

const MAX_IMPORT = 2000;

/** Escape text for safe inclusion in an attribute or text node. */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Serialize bookmarks into a Netscape bookmark file, grouped by folder so
 * the structure survives a round-trip through another browser. Entries
 * without a folder land in a "General" folder like Hoo's default.
 */
export function serializeNetscapeBookmarks(entries: BookmarkEntry[]): string {
    const safe = Array.isArray(entries) ? entries : [];
    const groups = new Map<string, BookmarkEntry[]>();
    for (const entry of safe) {
        if (!entry || typeof entry.url !== 'string' || !isHttpUrl(entry.url)) continue;
        const folder = typeof entry.folder === 'string' && entry.folder.trim() ? entry.folder.trim() : 'General';
        const list = groups.get(folder) || [];
        list.push(entry);
        groups.set(folder, list);
    }

    const lines: string[] = [
        '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
        '<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->',
        '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
        '<TITLE>Bookmarks</TITLE>',
        '<H1>Bookmarks</H1>',
        '<DL><p>'
    ];
    for (const [folder, list] of groups) {
        lines.push(`    <DT><H3>${escapeHtml(folder)}</H3>`);
        lines.push('    <DL><p>');
        for (const entry of list) {
            const title = typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : entry.url;
            const added = Number.isFinite(entry.addedAt) ? Math.floor(entry.addedAt / 1000) : Math.floor(Date.now() / 1000);
            lines.push(`        <DT><A HREF="${escapeHtml(entry.url)}" ADD_DATE="${added}">${escapeHtml(title)}</A>`);
        }
        lines.push('    </DL><p>');
    }
    lines.push('</DL><p>');
    return `${lines.join('\n')}\n`;
}

function isHttpUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
}

/** Decode HTML entities browsers write into bookmark files. */
function decodeEntities(text: string): string {
    return text
        .replace(/&quot;/gi, '"')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&amp;/gi, '&');
}

/** Pull the value of an attribute from an `<A …>` tag body. */
function attr(tag: string, name: string): string | null {
    const match = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)
        || new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i').exec(tag);
    return match ? decodeEntities(match[1]) : null;
}

/**
 * Parse a Netscape bookmark file (or any HTML containing bookmark links).
 * Folders become the entry's folder label; links outside any folder go to
 * "General". Duplicate URLs inside the file are kept — callers dedupe when
 * merging into the profile.
 */
export function parseNetscapeBookmarks(html: string): BookmarkEntry[] {
    if (typeof html !== 'string' || !html.trim()) return [];
    const out: BookmarkEntry[] = [];
    // Walk tags in order; folder scope comes from <H3> + <DL> openers and
    // </DL> closers, which real browsers always emit per folder. The </A>
    // is optional so slightly malformed exports still import.
    const tagPattern = /<DT>\s*<A\s([^>]*)>([^<]*)(?:<\/A>)?|<H3[^>]*>([^<]*)<\/H3>|<DL[^>]*>|<\/DL/gi;
    let match: RegExpExecArray | null;
    const folderStack: string[] = [];
    let pendingFolder: string | null = null;
    while ((match = tagPattern.exec(html)) !== null) {
        if (match[1] !== undefined) {
            const href = attr(match[1], 'href');
            if (!href || !isHttpUrl(href)) continue;
            const addDate = Number(attr(match[1], 'add_date'));
            const title = decodeEntities((match[2] || '').trim()) || href;
            out.push({
                id: '',
                title: title.slice(0, 300),
                url: href,
                folder: folderStack.length ? folderStack[folderStack.length - 1] : 'General',
                addedAt: Number.isFinite(addDate) && addDate > 0 ? addDate * 1000 : Date.now()
            });
            if (out.length >= MAX_IMPORT) break;
        } else if (match[3] !== undefined) {
            pendingFolder = decodeEntities(match[3].trim()) || 'General';
        } else if (match[0].startsWith('<DL')) {
            folderStack.push(pendingFolder || 'General');
            pendingFolder = null;
        } else {
            folderStack.pop();
        }
    }
    return out;
}

/**
 * Merge imported bookmarks into the profile list: URLs already bookmarked
 * keep their existing entry (title and folder untouched), new ones are
 * prepended. Result is capped so a huge import cannot bloat the profile.
 */
export function mergeBookmarks(existing: BookmarkEntry[], imported: BookmarkEntry[], cap = 500): BookmarkEntry[] {
    const current = Array.isArray(existing) ? existing : [];
    const seen = new Set(current.map(entry => entry.url));
    const additions: BookmarkEntry[] = [];
    for (const entry of Array.isArray(imported) ? imported : []) {
        if (!entry?.url || seen.has(entry.url)) continue;
        seen.add(entry.url);
        additions.push({ ...entry, id: `${Date.now().toString(36)}-${additions.length}-${Math.random().toString(36).slice(2, 7)}` });
    }
    return [...additions, ...current].slice(0, cap);
}
