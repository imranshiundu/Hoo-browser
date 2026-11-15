import { describe, expect, it } from 'vitest';
import { SuggestService, dedupeSuggestions, parseAcResponse } from '../suggest-service';

const jsonResponse = (body: unknown): Response => new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
});

describe('duckduckgo autocomplete parsing', () => {
    it('parses the ?type=list shape', () => {
        expect(parseAcResponse([['wea', ['weather', 'weather tomorrow', 'wea']]], 'wea'))
            .toEqual(['weather', 'weather tomorrow']);
    });

    it('parses the phrase-object shape', () => {
        expect(parseAcResponse([{ phrase: 'alpha' }, { phrase: 'beta' }, { nope: 1 }], 'al'))
            .toEqual(['alpha', 'beta']);
    });

    it('returns empty for junk payloads', () => {
        expect(parseAcResponse(null, 'q')).toEqual([]);
        expect(parseAcResponse({ odd: true }, 'q')).toEqual([]);
        expect(parseAcResponse([['only-one-element']], 'q')).toEqual([]);
    });

    it('dedupes case-insensitively, drops the query itself, caps output', () => {
        const deduped = dedupeSuggestions(
            ['News', 'news', '  ', 'Newsletter', 'news today', 'news'],
            'news',
            3
        );
        expect(deduped).toEqual(['Newsletter', 'news today']);
        expect(deduped).toHaveLength(2);
    });
});

describe('SuggestService', () => {
    it('skips short queries without hitting the network', async () => {
        let called = 0;
        const service = new SuggestService({ fetchImpl: async () => { called += 1; return jsonResponse([]); } });
        const result = await service.suggest('a');
        expect(result).toEqual({ ok: true, query: 'a', suggestions: [] });
        expect(called).toBe(0);
    });

    it('fetches, parses and caches successful results', async () => {
        const urls: string[] = [];
        let calls = 0;
        const service = new SuggestService({
            fetchImpl: async (input) => {
                calls += 1;
                urls.push(String(input));
                return jsonResponse([['rus', ['rust', 'rustling']]]);
            }
        });
        const first = await service.suggest('rus');
        expect(first.suggestions).toEqual(['rust', 'rustling']);
        expect(urls[0]).toContain('q=rus&type=list');
        const second = await service.suggest(' rus ');
        expect(second.suggestions).toEqual(['rust', 'rustling']);
        expect(calls).toBe(1);
    });

    it('expires cached entries past the TTL', async () => {
        let clock = 1000;
        let calls = 0;
        const service = new SuggestService({
            now: () => clock,
            cacheTtlMs: 1000,
            fetchImpl: async () => { calls += 1; return jsonResponse([['xyz', ['one']]]); }
        });
        await service.suggest('xyz');
        clock += 2000;
        await service.suggest('xyz');
        expect(calls).toBe(2);
    });

    it('reports network failures as ok:false with empty suggestions', async () => {
        const service = new SuggestService({
            fetchImpl: async () => { throw new Error('offline'); }
        });
        const result = await service.suggest('weather');
        expect(result.ok).toBe(false);
        expect(result.suggestions).toEqual([]);
        expect(result.error).toBe('offline');
    });

    it('reports non-200 responses as failures', async () => {
        const service = new SuggestService({
            fetchImpl: async () => new Response('nope', { status: 503 })
        });
        const result = await service.suggest('weather');
        expect(result.ok).toBe(false);
        expect(result.error).toBe('HTTP 503');
    });
});
