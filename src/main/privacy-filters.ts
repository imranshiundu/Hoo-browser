// Ad and Tracker Blocking Filter Lists
// Simplified subset of EasyList rules for demonstration

export const adBlockRules = [
    // Common ad servers
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'google-analytics.com',
    'googletagmanager.com',
    'facebook.net',
    'facebook.com/tr',
    'connect.facebook.net',

    // Tracking domains
    'scorecardresearch.com',
    'quantserve.com',
    'chartbeat.com',
    'hotjar.com',
    'crazyegg.com',
    'mouseflow.com',

    // Ad networks
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

    // YouTube / Google Specific Ads
    'pagead2.googlesyndication.com',
    'ad.doubleclick.net',
    'googleadservices.com',
    'stats.g.doubleclick.net',
    'adservice.google.com',

    // Analytics
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
    '/log?',
    '/track?',
    '/event?',
    '/ads?',
    '/ads/',
    '/adv/',
    '/advert/',
    'googlesyndication.com/pagead/',
    'youtube.com/api/stats/ads',
    'youtube.com/ptracking',
    'youtube.com/pagead/',
    'safeframe.googlesyndication.com',
    'googlevideo.com/videoplayback?.*adformat=',
    'googlevideo.com/videoplayback?.*ptchn=',
    'youtube.com/get_midroll_info',
    'youtube.com/get_video_info?.*adformat=',
];

const adBlockSet = new Set(adBlockRules);

export function shouldBlockRequest(url: string): boolean {
    const urlLower = url.toLowerCase();

    try {
        const parsedUrl = new URL(urlLower);
        const host = parsedUrl.hostname;

        // Check exact host and parent domains
        let currentHost = host;
        while (currentHost.includes('.')) {
            if (adBlockSet.has(currentHost)) return true;
            currentHost = currentHost.substring(currentHost.indexOf('.') + 1);
        }
        if (adBlockSet.has(currentHost)) return true;

    } catch (e) {
        // Fallback to substring matching if URL parsing fails
        for (const domain of adBlockRules) {
            if (urlLower.includes(domain)) return true;
        }
    }

    // Check pattern blocking
    for (const pattern of trackerBlockRules) {
        if (urlLower.includes(pattern)) {
            return true;
        }
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
        return false; // Default to safe if check fails to prevent black screens
    }
}

export const userAgents = [
    // Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Chrome on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    // Firefox on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    // Safari on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

export function getRandomUserAgent(): string {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}
