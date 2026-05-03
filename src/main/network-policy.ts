type NetworkPolicySettings = {
    lowDataMode?: boolean;
    blockThirdPartyFonts?: boolean;
    blockAutoplayMedia?: boolean;
    performanceMode?: 'balanced' | 'lite' | 'extreme' | 'compatibility';
};

const fontExtensions = ['.woff', '.woff2', '.ttf', '.otf', '.eot'];
const mediaExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.flac', '.ogg'];
const prefetchSignals = ['prefetch', 'preload', 'prerender', 'generate_204', 'pagead', 'watchtime', 'ptracking', 'log_event'];
const liteTrackerHosts = [
    'googletagmanager.com',
    'google-analytics.com',
    'analytics.google.com',
    'stats.g.doubleclick.net',
    'connect.facebook.net',
    'static.hotjar.com',
    'cdn.segment.com',
    'cdn.amplitude.com',
    'fullstory.com',
];

function hasAnyExtension(url: string, extensions: string[]): boolean {
    const clean = url.split('?')[0].toLowerCase();
    return extensions.some(ext => clean.endsWith(ext));
}

function hostMatches(url: string, hosts: string[]): boolean {
    try {
        const hostname = new URL(url).hostname;
        return hosts.some(host => hostname === host || hostname.endsWith(`.${host}`));
    } catch {
        return hosts.some(host => url.toLowerCase().includes(host));
    }
}

function mode(settings: NetworkPolicySettings): 'balanced' | 'lite' | 'extreme' | 'compatibility' {
    if (settings.performanceMode) return settings.performanceMode;
    return settings.lowDataMode ? 'lite' : 'balanced';
}

export function shouldBlockForLowData(url: string, resourceType: string, settings: NetworkPolicySettings): { block: boolean; reason?: string } {
    const currentMode = mode(settings);
    if (currentMode === 'compatibility') return { block: false };

    const lower = url.toLowerCase();
    const inLiteFamily = currentMode === 'lite' || currentMode === 'extreme' || settings.lowDataMode;

    if (inLiteFamily && settings.blockThirdPartyFonts && (resourceType === 'font' || hasAnyExtension(lower, fontExtensions))) {
        return { block: true, reason: 'font' };
    }

    if (inLiteFamily && settings.blockAutoplayMedia && (resourceType === 'media' || hasAnyExtension(lower, mediaExtensions))) {
        return { block: true, reason: 'media' };
    }

    if (inLiteFamily && (resourceType === 'beacon' || resourceType === 'ping')) {
        return { block: true, reason: 'background telemetry' };
    }

    if (inLiteFamily && prefetchSignals.some(signal => lower.includes(signal))) {
        return { block: true, reason: 'prefetch or metrics junk' };
    }

    if (inLiteFamily && hostMatches(lower, liteTrackerHosts)) {
        return { block: true, reason: 'lite tracker host' };
    }

    if (currentMode === 'extreme' && (resourceType === 'subFrame' || resourceType === 'object')) {
        return { block: true, reason: 'extreme embedded content' };
    }

    return { block: false };
}
