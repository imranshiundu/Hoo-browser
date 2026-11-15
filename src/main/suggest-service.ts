/**
 * Address-bar search suggestions, Firefox "Awesome Bar" style.
 *
 * The renderer asks the main process, and the main process alone talks to
 * DuckDuckGo's autocomplete endpoint (`/ac/`). Nothing else about the
 * keystroke — no history, no identifiers — leaves the window, and the whole
 * feature degrades silently to empty results when offline or disabled.
 */

const AC_ENDPOINT = 'https://duckduckgo.com/ac/';
const MAX_SUGGESTIONS = 8;
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2500;

export interface SuggestResult {
    ok: boolean;
    query: string;
    suggestions: string[];
    error?: string;
}

interface CacheEntry {
    at: number;
    suggestions: string[];
}

/**
 * DuckDuckGo ships two response shapes depending on parameters:
 *   ?type=list  -> [["query", ["a", "b"]]]
 *   default     -> [{ "phrase": "a" }, ...]
 * Parse both defensively; anything unexpected becomes an empty list.
 */
export function parseAcResponse(payload: unknown, query: string): string[] {
    let phrases: string[] = [];
    if (Array.isArray(payload)) {
        const first = payload[0];
        if (Array.isArray(first) && first.length >= 2 && Array.isArray(first[1])) {
            phrases = first[1];
        } else {
            phrases = payload
                .map(item => (item && typeof item === 'object' && typeof (item as { phrase?: unknown }).phrase === 'string'
                    ? (item as { phrase: string }).phrase
                    : null))
                .filter((phrase): phrase is string => typeof phrase === 'string');
        }
    }
    return dedupeSuggestions(phrases, query);
}

/** Drop blanks and duplicates (case-insensitive), drop the query itself, cap the list. */
export function dedupeSuggestions(phrases: readonly string[], query: string, max: number = MAX_SUGGESTIONS): string[] {
    const seen = new Set<string>();
    const queryKey = query.trim().toLowerCase();
    const result: string[] = [];
    for (const raw of phrases) {
        const phrase = typeof raw === 'string' ? raw.trim() : '';
        if (!phrase) continue;
        const key = phrase.toLowerCase();
        if (key === queryKey || seen.has(key)) continue;
        seen.add(key);
        result.push(phrase);
        if (result.length >= max) break;
    }
    return result;
}

export interface SuggestDeps {
    fetchImpl?: typeof fetch;
    now?: () => number;
    endpoint?: string;
    timeoutMs?: number;
    cacheTtlMs?: number;
}

export class SuggestService {
    private readonly cache = new Map<string, CacheEntry>();
    private readonly fetchImpl: typeof fetch;
    private readonly now: () => number;
    private readonly endpoint: string;
    private readonly timeoutMs: number;
    private readonly cacheTtlMs: number;

    constructor(deps: SuggestDeps = {}) {
        this.fetchImpl = deps.fetchImpl || ((input, init) => fetch(input, init));
        this.now = deps.now || (() => Date.now());
        this.endpoint = deps.endpoint || AC_ENDPOINT;
        this.timeoutMs = deps.timeoutMs || FETCH_TIMEOUT_MS;
        this.cacheTtlMs = deps.cacheTtlMs || CACHE_TTL_MS;
    }

    /** Only fire for real typing: at least 2 characters, no control junk. */
    static shouldFetch(query: string): boolean {
        const trimmed = query.trim();
        return trimmed.length >= 2 && trimmed.length <= 200;
    }

    async suggest(rawQuery: string): Promise<SuggestResult> {
        const query = rawQuery.trim();
        if (!SuggestService.shouldFetch(query)) {
            return { ok: true, query, suggestions: [] };
        }

        const cached = this.cache.get(query.toLowerCase());
        if (cached && this.now() - cached.at < this.cacheTtlMs) {
            return { ok: true, query, suggestions: cached.suggestions };
        }

        const controller = new AbortController();
        const timer = setTimeout((): void => controller.abort(), this.timeoutMs);
        try {
            const url = `${this.endpoint}?q=${encodeURIComponent(query)}&type=list`;
            const response = await this.fetchImpl(url, {
                signal: controller.signal,
                headers: { Accept: 'application/json' }
            });
            if (!response.ok) {
                return { ok: false, query, suggestions: [], error: `HTTP ${response.status}` };
            }
            const payload: unknown = await response.json();
            const suggestions = parseAcResponse(payload, query);
            this.cache.set(query.toLowerCase(), { at: this.now(), suggestions });
            // The cache is keyed per query; a walk-away session should not
            // grow it without bound.
            if (this.cache.size > 128) {
                const oldest = this.cache.keys().next().value;
                if (oldest) this.cache.delete(oldest);
            }
            return { ok: true, query, suggestions };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { ok: false, query, suggestions: [], error: message };
        } finally {
            clearTimeout(timer);
        }
    }
}
