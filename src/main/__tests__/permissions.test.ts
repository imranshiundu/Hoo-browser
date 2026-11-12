import { describe, expect, it } from 'vitest';
import {
    originFromUrl,
    decisionKey,
    describePermission,
    normalizePermissionDecisions,
    resolvePermissionDecision,
    withDecision,
    withoutDecision,
    permissionRows,
    DECIDABLE_PERMISSIONS
} from '../permissions';

describe('originFromUrl', () => {
    it('reduces a full URL to its scheme+host origin', () => {
        expect(originFromUrl('https://meet.google.com/abc-def-ghi')).toBe('https://meet.google.com');
        expect(originFromUrl('http://example.com:8080/x?y=1')).toBe('http://example.com:8080');
    });

    it('returns null for non-web URLs', () => {
        expect(originFromUrl('file:///home/user/doc.pdf')).toBeNull();
        expect(originFromUrl('about:blank')).toBeNull();
        expect(originFromUrl('data:text/html,hi')).toBeNull();
    });

    it('returns null for junk input', () => {
        expect(originFromUrl(null)).toBeNull();
        expect(originFromUrl(undefined)).toBeNull();
        expect(originFromUrl('not a url')).toBeNull();
        expect(originFromUrl('')).toBeNull();
    });
});

describe('decisionKey', () => {
    it('pairs origin and permission', () => {
        expect(decisionKey('https://example.com', 'media')).toBe('https://example.com|media');
    });
});

describe('describePermission', () => {
    it('uses plain language for known permissions', () => {
        expect(describePermission('media')).toContain('camera');
        expect(describePermission('geolocation')).toContain('location');
        expect(describePermission('notifications')).toContain('notifications');
    });

    it('falls back to the raw permission name', () => {
        expect(describePermission('mystery-power')).toBe('use mystery-power');
    });
});

describe('normalizePermissionDecisions', () => {
    it('keeps valid decisions', () => {
        const raw = { 'https://example.com|media': 'allow', 'https://other.com|geolocation': 'block' };
        expect(normalizePermissionDecisions(raw)).toEqual(raw);
    });

    it('drops invalid values, malformed keys, non-web origins and unknown permissions', () => {
        const raw = {
            'https://ok.com|media': 'allow',
            'https://bad.com|media': 'sometimes',      // invalid value
            'no-separator': 'allow',                    // malformed key
            'not-a-url|media': 'allow',                 // origin fails validation
            'https://ok.com|warp-drive': 'allow',       // unknown permission
            'https://ok.com|geolocation': 1             // wrong value type
        };
        expect(normalizePermissionDecisions(raw)).toEqual({ 'https://ok.com|media': 'allow' });
    });

    it('returns empty for junk input', () => {
        expect(normalizePermissionDecisions(null)).toEqual({});
        expect(normalizePermissionDecisions('x')).toEqual({});
        expect(normalizePermissionDecisions(['a'])).toEqual({});
    });
});

describe('resolvePermissionDecision', () => {
    const decisions = {
        'https://allowed.com|media': 'allow',
        'https://blocked.com|notifications': 'block'
    } as const;

    it('answers instantly from stored decisions', () => {
        expect(resolvePermissionDecision(decisions, 'https://allowed.com', 'media')).toBe('allow');
        expect(resolvePermissionDecision(decisions, 'https://blocked.com', 'notifications')).toBe('block');
    });

    it('asks when nothing is stored', () => {
        expect(resolvePermissionDecision(decisions, 'https://unknown.com', 'media')).toBe('ask');
    });

    it('always blocks undecidable permissions', () => {
        expect(resolvePermissionDecision({}, 'https://example.com', 'openExternal')).toBe('block');
        expect(resolvePermissionDecision({ 'https://example.com|openExternal': 'allow' } as any, 'https://example.com', 'openExternal')).toBe('block');
    });

    it('blocks requests without a usable origin', () => {
        expect(resolvePermissionDecision(decisions, null, 'media')).toBe('block');
    });

    it('keeps the WhatsApp DeepSpoof media exemption only in compatibility mode', () => {
        expect(resolvePermissionDecision({}, 'https://web.whatsapp.com', 'media', { deepSpoofWhatsappMedia: true })).toBe('allow');
        expect(resolvePermissionDecision({}, 'https://web.whatsapp.com', 'media')).toBe('ask');
        expect(resolvePermissionDecision({}, 'https://web.whatsapp.com', 'geolocation', { deepSpoofWhatsappMedia: true })).toBe('ask');
    });

    it('a stored block wins even over the DeepSpoof exemption', () => {
        const stored = { 'https://web.whatsapp.com|media': 'block' };
        expect(resolvePermissionDecision(stored as any, 'https://web.whatsapp.com', 'media', { deepSpoofWhatsappMedia: true })).toBe('block');
    });
});

describe('withDecision / withoutDecision', () => {
    it('sets a decision without mutating the input', () => {
        const original = {};
        const next = withDecision(original, 'https://example.com', 'media', 'allow');
        expect(next).toEqual({ 'https://example.com|media': 'allow' });
        expect(original).toEqual({});
    });

    it('removes a decision so the site asks again', () => {
        const withOne = withDecision({}, 'https://example.com', 'media', 'block');
        const removed = withoutDecision(withOne, decisionKey('https://example.com', 'media'));
        expect(removed).toEqual({});
    });
});

describe('permissionRows', () => {
    it('lists decisions sorted by origin then permission', () => {
        const rows = permissionRows({
            'https://z.com|media': 'allow',
            'https://a.com|notifications': 'block',
            'https://a.com|media': 'allow',
            'garbage-entry': 'block'
        });
        expect(rows).toHaveLength(3);
        expect(rows.map(r => `${r.origin}|${r.permission}`)).toEqual([
            'https://a.com|media',
            'https://a.com|notifications',
            'https://z.com|media'
        ]);
        expect(rows[0]).toMatchObject({ origin: 'https://a.com', permission: 'media', decision: 'allow' });
    });
});

describe('DECIDABLE_PERMISSIONS', () => {
    it('covers the capabilities real sites ask for', () => {
        for (const needed of ['media', 'geolocation', 'notifications']) {
            expect(DECIDABLE_PERMISSIONS).toContain(needed);
        }
    });
});
