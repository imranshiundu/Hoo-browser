// Lightweight request hygiene for Hoo. Keep this conservative so big sites do not break.

export const externalProtocolRules = ['magnet:', 'mailto:', 'tel:', 'sms:', 'bitcoin:', 'ethereum:', 'tg:', 'whatsapp:'];

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
    'youtube.com/pagead/',
    'youtube.com/get_midroll_',
    'youtube.com/ptracking',
    'youtube.com/youtubei/v1/log_event',
    'youtube.com/youtubei/v1/player/ad_break',
    'youtube.com/api/stats/qoe',
    'youtube.com/api/stats/playback',
    'youtube.com/api/stats/watchtime',
    'googlevideo.com/videoplayback/id/ad',
    'googlevideo.com/videoplayback?oad=',
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
    'safety-torrenting.com',
    'www.safety-torrenting.com',
    'torrenting.com',
    'onclickads.net',
    'popads.net',
    'popcash.net',
    'propellerads.com',
    'pushtraffic.net',
    'trafficjunky.net',
    'exoclick.com',
    'juicyads.com',
    'adsterra.com',
    'adsterra.org',
    'hilltopads.net',
    'realsrv.com',
    'onclickalgo.com',
    'ad-maven.com',
    'adskeeper.co.uk',
    'mgid.com',
    'revcontent.com',
    'popunder.net',
    'zeroredirect.com',
    'onclickperformance.com',
    'pushwelcome.com',
    'pushnest.com',
    'push.house',
    'trafficfactory.biz',
    'go2cloud.org',
    'smartadserver.com',
    'yieldmo.com',
    'media.net',
    'bidswitch.net',
    'rlcdn.com',
    'bluekai.com',
    'casalemedia.com',
    'sharethrough.com',
    '3lift.com',
    'lijit.com',
    'addthis.com',
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
    '/api/stats/qoe',
    '/api/stats/playback',
    '/api/stats/watchtime',
    '/youtubei/v1/log_event',
    '/youtubei/v1/player/ad_break',
    '/pagead/',
    '/pcs/activeview',
    'adformat=',
    'ad_type=',
    'adunit',
    'preroll',
    'midroll',
    'vast.xml',
    'redirect?',
    'popunder',
    'onclick',
    'premium-promo',
    'yt_mealbar',
    'googleads',
    'ad_break',
    'adunit=',
    'adurl=',
    'adserver',
    'interstitial',
    'popup',
    'popunder',
    'push-notification',
    'allow-notifications',
];

export const hardBlockedHosts = [
    'safety-torrenting.com',
    'www.safety-torrenting.com',
    'torrenting.com',
    'onclickads.net',
    'popads.net',
    'popcash.net',
    'propellerads.com',
    'pushtraffic.net',
    'trafficjunky.net',
    'exoclick.com',
    'juicyads.com',
    'adsterra.com',
    'adsterra.org',
    'hilltopads.net',
    'realsrv.com',
    'onclickalgo.com',
    'ad-maven.com',
    'zeroredirect.com',
    'onclickperformance.com',
    'pushwelcome.com',
    'pushnest.com',
    'push.house',
];

const adBlockSet = new Set(adBlockRules);
const hardBlockSet = new Set(hardBlockedHosts);
const SAFE_HEAVY_HOSTS = ['web.whatsapp.com', 'duckduckgo.com', 'www.duckduckgo.com', 'accounts.google.com'];

export function isExternalProtocol(url: string): boolean {
    const lower = (url || '').trim().toLowerCase();
    return externalProtocolRules.some(protocol => lower.startsWith(protocol));
}

export function hostMatches(hostname: string, rule: string): boolean {
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

export function isHardBlockedHost(url: string): boolean {
    if (isExternalProtocol(url)) return false;
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        for (const domain of hardBlockSet) {
            if (hostMatches(hostname, domain)) return true;
        }
        return false;
    } catch {
        return false;
    }
}

export function isLikelyForcedRedirect(targetUrl: string, sourceUrl?: string): boolean {
    if (isExternalProtocol(targetUrl)) return false;
    if (!sourceUrl || sourceUrl.startsWith('about:') || sourceUrl.startsWith('hoo:')) return false;
    try {
        const source = new URL(sourceUrl);
        const target = new URL(targetUrl);
        if (source.hostname === target.hostname) return false;
        if (target.hostname.endsWith(`.${source.hostname}`) || source.hostname.endsWith(`.${target.hostname}`)) return false;
        if (isHardBlockedHost(targetUrl)) return true;
        const targetLower = targetUrl.toLowerCase();
        return ['torrent', 'vpn', 'hide-my-ip', 'adult', 'casino', 'bet', 'claim', 'prize', 'download-now', 'verify-human', 'allow-notifications', 'popup', 'popunder', 'safety-torrenting'].some(signal => targetLower.includes(signal));
    } catch {
        return false;
    }
}

export function shouldBlockRequest(url: string, resourceType?: string): boolean {
    const urlLower = url.toLowerCase();
    if (isExternalProtocol(urlLower)) return false;
    if (isSafeHeavyHost(urlLower)) return false;
    if (resourceType === 'beacon' || resourceType === 'ping') return true;
    if (isHardBlockedHost(urlLower)) return true;

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
    if (!pageUrl || pageUrl.startsWith('about:') || isExternalProtocol(resourceUrl)) return false;
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
        if (isExternalProtocol(url)) return false;
        const maliciousPatterns = [
            'phish-discovery.com',
            'login-verify-account.net',
            'secure-banking-update.io',
            'testsafebrowsing.appspot.com',
            ...hardBlockedHosts,
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
