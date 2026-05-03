// Lightweight request hygiene for Hoo. Keep this conservative so big sites do not break.

export const adBlockRules = [
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'pagead2.googlesyndication.com',
    'tpc.googlesyndication.com',
    'securepubads.g.doubleclick.net',
    'static.doubleclick.net',
    'adservice.google.com',
    'ads.youtube.com',
    'youtube.com/api/stats/ads',
    'facebook.com/tr',
    'scorecardresearch.com',
    'quantserve.com',
    'hotjar.com',
    'crazyegg.com',
    'mouseflow.com',
    'adnxs.com',
    'adsrvr.org',
    'advertising.com',
    'adform.net',
    'pubmatic.com',
    'rubiconproject.com',
    'openx.net',
    'criteo.com',
    'outbrain.com',
    'taboola.com',
    'doubleverify.com',
    'iasdirect.com',
    'moatads.com',
    'mixpanel.com',
    'segment.com',
    'amplitude.com',
    'heap.io',
    'fullstory.com',
];

export const trackerBlockRules = [
    '/analytics.',
    '/tracking.',
    '/tracker.',
    '/pixel.',
    '/beacon.',
    '/collect?',
    '/track?',
    '/event?',
    '/ptracking?',
    '/api/stats/ads',
    '/pagead/',
    '/pcs/activeview',
];

const adBlockSet = new Set(adBlockRules);
const SAFE_HEAVY_HOSTS = ['web.whatsapp.com', 'duckduckgo.com', 'www.duckduckgo.com', 'accounts.google.com'];

function hostMatches(hostname: string, rule: string): boolean {
    return hostname === rule || hostname.endsWith(`.${rule}`);
}

function isSafeHeavyHost(url: string): boolean {
    try {
        const hostname = new URL(url).hostname;
        return SAFE_HEAVY_HOSTS.some(host => hostMatches(hostname, host));
    } catch {
        return false;
    }
}

export function shouldBlockRequest(url: string, resourceType?: string): boolean {
    const urlLower = url.toLowerCase();
    if (isSafeHeavyHost(urlLower)) return false;
    if (resourceType === 'beacon' || resourceType === 'ping') return true;

    try {
        const parsedUrl = new URL(urlLower);
        const host = parsedUrl.hostname;
        for (const domain of adBlockSet) {
            if (hostMatches(host, domain)) return true;
        }
    } catch {
        for (const domain of adBlockRules) {
            if (urlLower.includes(domain)) return true;
        }
    }

    return trackerBlockRules.some(pattern => urlLower.includes(pattern));
}

export function isThirdPartyRequest(resourceUrl: string, pageUrl?: string): boolean {
    if (!pageUrl || pageUrl.startsWith('about:')) return false;
    try {
        const resourceHost = new URL(resourceUrl).hostname.replace(/^www\./, '');
        const pageHost = new URL(pageUrl).hostname.replace(/^www\./, '');
        return resourceHost !== pageHost && !resourceHost.endsWith(`.${pageHost}`) && !pageHost.endsWith(`.${resourceHost}`);
    } catch {
        return false;
    }
}

function flattenHeaderValue(value: string | string[] | undefined): string | undefined {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join('; ');
    return undefined;
}

export function stripJunkRequestHeaders(headers: Record<string, string | string[] | undefined>, resourceUrl: string, pageUrl?: string): Record<string, string> {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers || {})) {
        const flat = flattenHeaderValue(value);
        if (flat !== undefined) next[key] = flat;
    }

    if (isThirdPartyRequest(resourceUrl, pageUrl)) {
        delete next.Cookie;
        delete next.cookie;
        delete next.Referer;
        delete next.referer;
    }
    delete next['X-Client-Data'];
    delete next['x-client-data'];
    return next;
}

export function stripJunkResponseHeaders(headers: Record<string, string | string[] | undefined> | undefined, resourceUrl: string, pageUrl?: string): Record<string, string | string[]> | undefined {
    if (!headers) return headers;
    const next: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (typeof value === 'string' || Array.isArray(value)) next[key] = value;
    }
    if (isThirdPartyRequest(resourceUrl, pageUrl)) {
        delete next['set-cookie'];
        delete next['Set-Cookie'];
    }
    return next;
}

export async function isMaliciousUrl(url: string): Promise<boolean> {
    try {
        const maliciousPatterns = [
            'phish-discovery.com',
            'login-verify-account.net',
            'secure-banking-update.io',
            'testsafebrowsing.appspot.com'
        ];
        if (!url || !url.includes('://')) return false;
        const host = new URL(url).hostname;
        return maliciousPatterns.some(pattern => host.includes(pattern));
    } catch (e) {
        console.error('[Security] Error checking URL safety:', e);
        return false;
    }
}

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function getRandomUserAgent(): string {
    return DEFAULT_USER_AGENT;
}
