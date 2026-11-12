import { describe, expect, it } from 'vitest';
import {
    DEFAULT_USER_AGENT,
    hostMatches,
    isCompatibilityHost,
    isExternalProtocol,
    isHardBlockedHost,
    isLikelyForcedRedirect,
    isMaliciousUrl,
    isThirdPartyRequest,
    shouldBlockRequest,
    stripJunkRequestHeaders,
    stripJunkResponseHeaders,
} from '../privacy-filters';

describe('isExternalProtocol', () => {
    it('detects supported external protocols', () => {
        expect(isExternalProtocol('mailto:someone@example.com')).toBe(true);
        expect(isExternalProtocol('magnet:?xt=urn:btih:abc')).toBe(true);
        expect(isExternalProtocol('tel:+254700000000')).toBe(true);
        expect(isExternalProtocol('whatsapp://send?text=hi')).toBe(true);
    });

    it('ignores http(s) and junk input', () => {
        expect(isExternalProtocol('https://duckduckgo.com')).toBe(false);
        expect(isExternalProtocol('')).toBe(false);
        expect(isExternalProtocol('not a url')).toBe(false);
    });
});

describe('hostMatches', () => {
    it('matches exact hosts and subdomains, but not lookalike suffixes', () => {
        expect(hostMatches('doubleclick.net', 'doubleclick.net')).toBe(true);
        expect(hostMatches('ad.doubleclick.net', 'doubleclick.net')).toBe(true);
        expect(hostMatches('deep.a.doubleclick.net', 'doubleclick.net')).toBe(true);
        expect(hostMatches('notdoubleclick.net', 'doubleclick.net')).toBe(false);
        expect(hostMatches('example.com', 'doubleclick.net')).toBe(false);
    });
});

describe('isCompatibilityHost', () => {
    it('exempts hosts that break under aggressive privacy rules', () => {
        expect(isCompatibilityHost('https://web.whatsapp.com')).toBe(true);
        expect(isCompatibilityHost('https://accounts.google.com/signin')).toBe(true);
        expect(isCompatibilityHost('https://github.com/imranshiundu')).toBe(true);
        expect(isCompatibilityHost('https://duckduckgo.com/?q=test')).toBe(true);
    });

    it('does not exempt arbitrary hosts or invalid URLs', () => {
        expect(isCompatibilityHost('https://evil.example.com')).toBe(false);
        expect(isCompatibilityHost('garbage')).toBe(false);
    });
});

describe('shouldBlockRequest', () => {
    it('always blocks beacons and pings outside compatibility hosts', () => {
        expect(shouldBlockRequest('https://tracker.example.com/collect', 'beacon')).toBe(true);
        expect(shouldBlockRequest('https://tracker.example.com/px.gif', 'ping')).toBe(true);
    });

    it('blocks known ad/tracker hosts for subresources', () => {
        expect(shouldBlockRequest('https://ad.doubleclick.net/ddm/adj/x', 'script')).toBe(true);
        expect(shouldBlockRequest('https://www.googlesyndication.com/pagead/js/ads.js', 'script')).toBe(true);
        expect(shouldBlockRequest('https://cdn.segment.com/analytics.js/v1/x/a.min.js', 'script')).toBe(true);
    });

    it('blocks tracker URL patterns on any host', () => {
        expect(shouldBlockRequest('https://example.com/api/stats/watchtime', 'xhr')).toBe(true);
        expect(shouldBlockRequest('https://example.com/collect?v=1', 'xhr')).toBe(true);
    });

    it('never blocks documents from generic ad rules, only hard-blocked hosts', () => {
        expect(shouldBlockRequest('https://example.com/pagead/whatever', 'mainFrame')).toBe(false);
        expect(shouldBlockRequest('https://popads.net/', 'mainFrame')).toBe(true);
    });

    it('never blocks compatibility hosts (login and playback flows keep working)', () => {
        expect(shouldBlockRequest('https://accounts.google.com/o/oauth2/auth', 'script')).toBe(false);
        expect(shouldBlockRequest('https://web.whatsapp.com/static/js/main.js', 'script')).toBe(false);
    });

    it('leaves unknown resource types alone', () => {
        expect(shouldBlockRequest('https://example.com/other', 'cspReport')).toBe(false);
        expect(shouldBlockRequest('https://example.com/other')).toBe(false);
    });
});

describe('isHardBlockedHost', () => {
    it('hard-blocks known scam/ad hosts and their subdomains', () => {
        expect(isHardBlockedHost('https://popads.net')).toBe(true);
        expect(isHardBlockedHost('https://cdn.exoclick.com/a.js')).toBe(true);
    });

    it('passes compatibility hosts and external protocols', () => {
        expect(isHardBlockedHost('https://web.whatsapp.com')).toBe(false);
        expect(isHardBlockedHost('mailto:user@example.com')).toBe(false);
    });
});

describe('isLikelyForcedRedirect', () => {
    it('flags redirects to hard-blocked hosts from normal pages', () => {
        expect(isLikelyForcedRedirect('https://popads.net/click', 'https://news.example.com/article')).toBe(true);
    });

    it('flags redirects to known scam signals', () => {
        expect(isLikelyForcedRedirect('https://random.example.com/claim-prize', 'https://news.example.com/article')).toBe(true);
        expect(isLikelyForcedRedirect('https://random.example.com/verify-human', 'https://news.example.com/article')).toBe(true);
    });

    it('ignores same-site navigation and first-load scenarios', () => {
        expect(isLikelyForcedRedirect('https://site.com/a', 'https://site.com/b')).toBe(false);
        expect(isLikelyForcedRedirect('https://site.com/a', 'https://sub.site.com/b')).toBe(false);
        expect(isLikelyForcedRedirect('https://site.com/a')).toBe(false);
        expect(isLikelyForcedRedirect('https://site.com/a', 'about:blank')).toBe(false);
    });

    it('ignores compatibility hosts and external protocols', () => {
        expect(isLikelyForcedRedirect('https://web.whatsapp.com', 'https://news.example.com')).toBe(false);
        expect(isLikelyForcedRedirect('mailto:x@y.com', 'https://news.example.com')).toBe(false);
    });
});

describe('isThirdPartyRequest', () => {
    it('detects cross-site resources', () => {
        expect(isThirdPartyRequest('https://tracker.example.net/t.js', 'https://news.example.com/a')).toBe(true);
    });

    it('allows same-site and subdomain resources, ignoring www', () => {
        expect(isThirdPartyRequest('https://news.example.com/a.js', 'https://news.example.com/a')).toBe(false);
        expect(isThirdPartyRequest('https://cdn.news.example.com/a.js', 'https://www.news.example.com/a')).toBe(false);
    });

    it('exempts compatibility hosts entirely', () => {
        expect(isThirdPartyRequest('https://accounts.google.com/x', 'https://random.example.com')).toBe(false);
    });
});

describe('request and response header hygiene', () => {
    it('strips cookies and referers for third-party requests', () => {
        const cleaned = stripJunkRequestHeaders({
            Cookie: 'a=b',
            Referer: 'https://news.example.com',
            'User-Agent': 'Hoo',
        }, 'https://tracker.example.net/t.js', 'https://news.example.com/a');
        expect(cleaned.Cookie).toBeUndefined();
        expect(cleaned.Referer).toBeUndefined();
        expect(cleaned['User-Agent']).toBe('Hoo');
    });

    it('never touches headers for compatibility hosts', () => {
        const headers = { Cookie: 'session=keep', Referer: 'https://mail.google.com' };
        const cleaned = stripJunkRequestHeaders(headers, 'https://accounts.google.com/x', 'https://mail.google.com');
        expect(cleaned.Cookie).toBe('session=keep');
        expect(cleaned.Referer).toBe('https://mail.google.com');
    });

    it('always removes X-Client-Data (Chrome client telemetry)', () => {
        const cleaned = stripJunkRequestHeaders({
            'X-Client-Data': 'abc',
            cookie: 'x=y',
        }, 'https://example.com/script.js', 'https://example.com');
        expect(cleaned['X-Client-Data']).toBeUndefined();
        expect(cleaned.cookie).toBe('x=y');
    });

    it('flattens array header values instead of dropping them', () => {
        const cleaned = stripJunkRequestHeaders({ Accept: ['a', 'b'] }, 'https://example.com/a.js', 'https://example.com');
        expect(cleaned.Accept).toBe('a; b');
    });

    it('strips third-party Set-Cookie from responses', () => {
        const cleaned = stripJunkResponseHeaders({
            'Content-Type': 'text/html',
            'Set-Cookie': 'track=1',
        }, 'https://tracker.example.net/t.js', 'https://news.example.com/a');
        expect(cleaned?.['Set-Cookie']).toBeUndefined();
        expect(cleaned?.['Content-Type']).toBe('text/html');
    });
});

describe('isMaliciousUrl', () => {
    it('flags known phishing-pattern hosts', async () => {
        await expect(isMaliciousUrl('https://phish-discovery.com/login')).resolves.toBe(true);
        await expect(isMaliciousUrl('https://secure-banking-update.io/')).resolves.toBe(true);
    });

    it('passes normal and compatibility hosts', async () => {
        await expect(isMaliciousUrl('https://duckduckgo.com')).resolves.toBe(false);
        await expect(isMaliciousUrl('https://accounts.google.com')).resolves.toBe(false);
        await expect(isMaliciousUrl('mailto:x@y.com')).resolves.toBe(false);
    });
});

describe('user agent', () => {
    it('stays a stable desktop Chrome UA for auth compatibility', () => {
        expect(DEFAULT_USER_AGENT).toContain('Chrome/');
        expect(DEFAULT_USER_AGENT).toContain('X11; Linux x86_64');
    });
});
