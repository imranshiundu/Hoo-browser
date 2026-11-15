import { describe, expect, it } from 'vitest';
import {
    AwesomeSources,
    buildAwesomeResults,
    looksLikeUrl,
    matchScore,
    moveHighlight,
    resolveAwesomeTarget
} from '../awesomebar-model';

const now = Date.now();
const sources: AwesomeSources = {
    tabs: [
        { id: 't1', title: 'Rust programming — Mozilla', url: 'https://rust-lang.org/', type: 'browser' },
        { id: 't2', title: 'Home', type: 'home' }
    ],
    bookmarks: [{ title: 'Rust book', url: 'https://doc.rust-lang.org/book/' }],
    history: [
        { title: 'Rust crates', url: 'https://crates.io/', timestamp: now - 1000 },
        { title: 'Ancient rust post', url: 'https://blog.example/rust-old', timestamp: now - 400 * 86400000 }
    ],
    suggestions: ['rust vs go', 'rust vs go 2024', 'rust']
};

describe('URL detection and resolution', () => {
    it('accepts domains, rejects sentences', () => {
        expect(looksLikeUrl('example.com')).toBe(true);
        expect(looksLikeUrl('https://example.com/a')).toBe(true);
        expect(looksLikeUrl('magnet:?xt=urn:btih:x')).toBe(true);
        expect(looksLikeUrl('what is rust')).toBe(false);
        expect(looksLikeUrl('')).toBe(false);
    });

    it('resolves bangs, search strings and bare hosts consistently', () => {
        expect(resolveAwesomeTarget('!w Cat')).toContain('wikipedia.org');
        expect(resolveAwesomeTarget('!d cat')).toContain('duckduckgo.com/?q=cat');
        expect(resolveAwesomeTarget('rust vs go')).toBe('https://duckduckgo.com/?q=rust%20vs%20go');
        expect(resolveAwesomeTarget('example.com')).toBe('https://example.com');
        expect(resolveAwesomeTarget('https://a.b/c')).toBe('https://a.b/c');
        expect(resolveAwesomeTarget('')).toBe('');
    });
});

describe('ranking', () => {
    it('scores prefix over word-start over substring', () => {
        const prefix = matchScore('rust', 'rust lang');
        const word = matchScore('rust', 'the rust book');
        const substring = matchScore('rust', 'trustfall');
        expect(prefix).toBeGreaterThan(word);
        expect(word).toBeGreaterThan(substring);
        expect(matchScore('rust', 'golang')).toBe(0);
    });
});

describe('buildAwesomeResults', () => {
    it('leads with the primary action row', () => {
        const result = buildAwesomeResults('example.com', sources);
        expect(result.flat[0]).toMatchObject({ kind: 'navigate', title: 'Go to example.com' });
    });

    it('makes plain queries a DuckDuckGo search', () => {
        const result = buildAwesomeResults('rust vs go', sources);
        expect(result.flat[0].kind).toBe('search');
        expect(result.flat[0].target).toContain('duckduckgo.com');
    });

    it('offers open-tab switching with section header', () => {
        const result = buildAwesomeResults('rust', sources);
        const tabsSection = result.sections.find(section => section.id === 'tabs');
        expect(tabsSection?.label).toBe('Switch to tab');
        expect(tabsSection?.rows[0]).toMatchObject({ kind: 'tab', tabId: 't1' });
    });

    it('merges bookmarks and history, deduped by URL, bookmarks boosted', () => {
        const result = buildAwesomeResults('rust', { ...sources, suggestions: [] });
        const matchSection = result.sections.find(section => section.id === 'matches');
        const urls = matchSection?.rows.map(row => row.subtitle) || [];
        expect(urls).toContain('https://doc.rust-lang.org/book/');
        expect(urls).toContain('https://crates.io/');
        expect(urls.filter(url => url === 'https://crates.io/')).toHaveLength(1);
        const kinds = matchSection?.rows.map(row => row.kind) || [];
        expect(kinds).toContain('bookmark');
        expect(kinds).toContain('history');
    });

    it('never suggests the same target twice across sections', () => {
        const result = buildAwesomeResults('rust', sources);
        const targets = result.flat.map(row => `${row.kind}:${row.target}`);
        expect(new Set(targets).size).toBe(targets.length);
    });

    it('appends live search suggestions', () => {
        const result = buildAwesomeResults('rust', sources);
        const suggestions = result.sections.find(section => section.id === 'suggestions');
        expect(suggestions?.rows.map(row => row.title)).toEqual(['rust vs go', 'rust vs go 2024']);
    });

    it('produces nothing for empty input', () => {
        const result = buildAwesomeResults('   ', sources);
        expect(result.sections).toEqual([]);
        expect(result.flat).toEqual([]);
    });

    it('skips home tabs from switch-to-tab', () => {
        const result = buildAwesomeResults('home', sources);
        const tabsSection = result.sections.find(section => section.id === 'tabs');
        expect(tabsSection?.rows.some(row => row.tabId === 't2')).toBeFalsy();
    });
});

describe('highlight movement', () => {
    it('moves down, up, wraps both ends', () => {
        expect(moveHighlight(0, 1, 4)).toBe(1);
        expect(moveHighlight(1, -1, 4)).toBe(0);
        expect(moveHighlight(3, 1, 4)).toBe(0);
        expect(moveHighlight(0, -1, 4)).toBe(3);
        expect(moveHighlight(0, 1, 0)).toBe(-1);
    });
});
