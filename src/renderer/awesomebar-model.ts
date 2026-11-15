/**
 * The Awesome Bar model — Firefox's address bar brains, ported to Hoo.
 *
 * Given what the user typed and what the browser already knows (open tabs,
 * bookmarks, recent history, DuckDuckGo suggestions), it produces one flat,
 * ordered, deduplicated result list with section markers. The renderer only
 * has to draw rows and move a highlight; all ranking decisions live here in
 * pure functions.
 */

export type AwesomeKind = 'tab' | 'bookmark' | 'history' | 'search' | 'navigate' | 'action';

export interface AwesomeInputRow {
    kind: AwesomeKind;
    title: string;
    subtitle: string;
    /** Where this row goes when activated. */
    target: string;
    /** For 'tab' rows: the tab to switch to instead of navigating. */
    tabId?: string;
}

export interface AwesomeSection {
    id: 'top' | 'tabs' | 'matches' | 'suggestions';
    label: string;
    rows: AwesomeInputRow[];
}

export interface AwesomeResult {
    sections: AwesomeSection[];
    /** Flat row list in visual order — highlight indexes point into this. */
    flat: AwesomeInputRow[];
}

export interface AwesomeSources {
    tabs: readonly { id: string; title: string; url?: string; type?: string }[];
    bookmarks: readonly { title: string; url: string }[];
    history: readonly { title: string; url: string; timestamp: number }[];
    suggestions?: readonly string[];
}

const MAX_TAB_ROWS = 3;
const MAX_MATCH_ROWS = 6;
const MAX_SUGGESTION_ROWS = 6;

const DDG_SEARCH = (query: string): string => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;

export function looksLikeUrl(value: string): boolean {
    const target = value.trim();
    if (!target || /\s/.test(target)) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return true; // any scheme: https:, magnet:, mailto:…
    return target.includes('.') && target.split('/').some(part => part.includes('.'));
}

/** One resolver for the whole app so the dropdown and Enter agree. */
export function resolveAwesomeTarget(value: string): string {
    const target = value.trim();
    if (!target) return '';
    if (/^(magnet:|mailto:|tel:|sms:|bitcoin:|ethereum:|tg:|whatsapp:)/i.test(target)) return target;
    if (target.startsWith('!w ')) return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(target.slice(3))}`;
    if (target.startsWith('!y ')) return `https://www.youtube.com/results?search_query=${encodeURIComponent(target.slice(3))}`;
    if (target.startsWith('!g ')) return `https://www.google.com/search?q=${encodeURIComponent(target.slice(3))}`;
    if (target.startsWith('!d ')) return DDG_SEARCH(target.slice(3));
    if (target.startsWith('!ai ')) return `https://duck.ai/?q=${encodeURIComponent(target.slice(4))}`;
    if (!looksLikeUrl(target)) return DDG_SEARCH(target);
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(target) ? target : `https://${target}`;
}

/**
 * Adaptive match strength, Firefox-style: prefix beats word-start beats
 * substring; shorter needles win ties. 0 means no match.
 */
export function matchScore(query: string, text: string): number {
    const q = query.trim().toLowerCase();
    if (!q) return 0;
    const t = text.toLowerCase();
    const index = t.indexOf(q);
    if (index < 0) return 0;
    if (index === 0) return 300 - Math.min(t.length, 100);
    const before = t[index - 1];
    if (before === ' ' || before === '.' || before === '/' || before === '-') {
        return 200 - Math.min(t.length, 100);
    }
    return 100 - Math.min(t.length, 100);
}

/** Best score across title + URL, with a small recency bump for history. */
function entryScore(query: string, title: string, url: string, timestamp?: number): number {
    const titleScore = matchScore(query, title || '');
    const urlScore = matchScore(query, url || '');
    let score = Math.max(titleScore, urlScore);
    if (score > 0 && typeof timestamp === 'number') {
        const ageDays = Math.max(0, (Date.now() - timestamp) / 86400000);
        score += Math.max(0, 50 - Math.floor(ageDays * 2)); // fresher is better
    }
    return score;
}

function urlKey(url: string): string {
    return url.replace(/\/+$/, '').toLowerCase();
}

/**
 * Build the full result list. The first flat row is always the "primary"
 * action (go to URL, or search DuckDuckGo) — pressing Enter with no arrow
 * keys does exactly what a plain address bar would.
 */
export function buildAwesomeResults(query: string, sources: AwesomeSources): AwesomeResult {
    const trimmed = query.trim();
    const sections: AwesomeSection[] = [];
    const flat: AwesomeInputRow[] = [];
    const claimed = new Set<string>();

    const pushRow = (section: AwesomeSection, row: AwesomeInputRow): void => {
        const key = `${row.kind}:${urlKey(row.target)}`;
        if (claimed.has(key)) return;
        claimed.add(key);
        section.rows.push(row);
        flat.push(row);
    };

    if (!trimmed) {
        return { sections, flat };
    }

    // 1. Primary action — what Enter does out of the box.
    const primaryKind: AwesomeKind = looksLikeUrl(trimmed) ? 'navigate' : 'search';
    const top: AwesomeSection = { id: 'top', label: '', rows: [] };
    pushRow(top, primaryKind === 'navigate'
        ? { kind: 'navigate', title: `Go to ${trimmed}`, subtitle: resolveAwesomeTarget(trimmed), target: resolveAwesomeTarget(trimmed) }
        : { kind: 'search', title: `Search DuckDuckGo for “${trimmed}”`, subtitle: 'duckduckgo.com', target: resolveAwesomeTarget(trimmed) });
    if (top.rows.length) sections.push(top);

    // 2. Switch to an open tab — Firefox puts this first because it is the
    //    antidote to re-opening pages you already have open.
    const lowered = trimmed.toLowerCase();
    const tabMatches = sources.tabs
        .filter(tab => tab.type !== 'home')
        .map(tab => ({ tab, score: Math.max(entryScore(trimmed, tab.title || '', tab.url || '') - 25, tab.url && urlKey(tab.url) === urlKey(trimmed) ? 400 : 0) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_TAB_ROWS);
    if (tabMatches.length) {
        const section: AwesomeSection = { id: 'tabs', label: 'Switch to tab', rows: [] };
        for (const entry of tabMatches) {
            pushRow(section, {
                kind: 'tab',
                title: entry.tab.title || 'New Tab',
                subtitle: entry.tab.url || '',
                target: entry.tab.url || '',
                tabId: entry.tab.id
            });
        }
        sections.push(section);
    }

    // 3. Bookmarks and history, ranked together like Firefox's unified list.
    const matches: Array<{ title: string; url: string; score: number; kind: AwesomeKind }> = [];
    for (const bookmark of sources.bookmarks) {
        const score = entryScore(trimmed, bookmark.title || '', bookmark.url || '');
        if (score > 0) matches.push({ ...bookmark, score: score + 30, kind: 'bookmark' }); // bookmarks outrank history
    }
    for (const entry of sources.history) {
        const score = entryScore(trimmed, entry.title || '', entry.url || '', entry.timestamp);
        if (score > 0) matches.push({ title: entry.title, url: entry.url, score, kind: 'history' });
    }
    matches.sort((a, b) => b.score - a.score);
    const seenUrls = new Set<string>();
    const matchRows: AwesomeInputRow[] = [];
    for (const match of matches) {
        const key = urlKey(match.url);
        if (seenUrls.has(key)) continue;
        seenUrls.add(key);
        matchRows.push({
            kind: match.kind,
            title: match.title || match.url,
            subtitle: match.url,
            target: match.url
        });
        if (matchRows.length >= MAX_MATCH_ROWS) break;
    }
    if (matchRows.length) {
        sections.push({ id: 'matches', label: 'Bookmarks and history', rows: matchRows });
        matchRows.forEach(row => flat.push(row));
    }

    // 4. Live DuckDuckGo suggestions (optional — absent when disabled/offline).
    const suggestionRows = (sources.suggestions || [])
        .slice(0, MAX_SUGGESTION_ROWS)
        .map((phrase): AwesomeInputRow => ({
            kind: 'search',
            title: phrase,
            subtitle: 'DuckDuckGo search',
            target: resolveAwesomeTarget(phrase)
        }));
    if (suggestionRows.length) {
        const section: AwesomeSection = { id: 'suggestions', label: 'Search suggestions', rows: [] };
        for (const row of suggestionRows) pushRow(section, row);
        sections.push(section);
    }

    return { sections, flat };
}

/** Wrapped highlight movement for ↑/↓. */
export function moveHighlight(current: number, delta: number, count: number): number {
    if (count <= 0) return -1;
    const next = current + delta;
    if (next < 0) return count - 1;
    if (next >= count) return 0;
    return next;
}
