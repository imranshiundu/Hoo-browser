// Ad and tracker blocking rules kept intentionally light.
// Hoo should feel fast first; aggressive cosmetic/ad blocking can make large apps
// like YouTube, WhatsApp and DuckDuckGo sit on skeleton screens for too long.

export const adBlockRules = [
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
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
];

const adBlockSet = new Set(adBlockRules);
const HEAVY_APP_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'web.whatsapp.com', 'duckduckgo.com', 'www.duckduckgo.com'];

function isHeavyAppUrl(url: string): boolean {
    try {
        const hostname = new URL(url).hostname.replace(/^www\./, '');
        return HEAVY_APP_HOSTS.some(host => hostname === host.replace(/^www\./, '') || hostname.endsWith(`.${host.replace(/^www\./, '')}`));
    } catch {
        return false;
    }
}

export function shouldBlockRequest(url: string): boolean {
    if (isHeavyAppUrl(url)) return false;

    const urlLower = url.toLowerCase();

    try {
        const parsedUrl = new URL(urlLower);
        const host = parsedUrl.hostname;

        let currentHost = host;
        while (currentHost.includes('.')) {
            if (adBlockSet.has(currentHost)) return true;
            currentHost = currentHost.substring(currentHost.indexOf('.') + 1);
        }
        if (adBlockSet.has(currentHost)) return true;
    } catch (e) {
        for (const domain of adBlockRules) {
            if (urlLower.includes(domain)) return true;
        }
    }

    for (const pattern of trackerBlockRules) {
        if (urlLower.includes(pattern)) return true;
    }

    return false;
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

export const userAgents = [
    DEFAULT_USER_AGENT,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

export function getRandomUserAgent(): string {
    return DEFAULT_USER_AGENT;
}
