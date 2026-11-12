/**
 * Site permission decisions: which origins may use the camera, microphone,
 * location, notifications, and similar capabilities.
 *
 * Every real browser shows a prompt the first time a site asks for a
 * sensitive capability, remembers the answer, and lets you change it later.
 * Hoo used to silently deny everything, which made video calls, push
 * notifications and map lookups feel broken; and its permission *check*
 * handler quietly answered "yes" to every media query from any page.
 *
 * This module holds the pure decision logic so it is trivially testable;
 * main.ts wires it to Electron session handlers and IPC.
 */

/** Permissions a user can decide on. Unknown ones are always denied. */
export const DECIDABLE_PERMISSIONS = [
    'media',
    'geolocation',
    'notifications',
    'clipboard-sanitized-read',
    'midi',
    'pointerLock',
    'fullscreen',
    'display-capture'
] as const;

export type DecidablePermission = (typeof DECIDABLE_PERMISSIONS)[number];

export type PermissionDecision = 'allow' | 'block';
export type PermissionResolution = PermissionDecision | 'ask';

/** Map of `origin|permission` -> decision, exactly as stored in the profile. */
export type PermissionDecisionMap = Record<string, PermissionDecision>;

/** What each Electron permission means to a normal person. */
const PERMISSION_LABELS: Record<string, string> = {
    'media': 'use your camera and microphone',
    'geolocation': 'see your location',
    'notifications': 'show desktop notifications',
    'clipboard-sanitized-read': 'read text you copied',
    'midi': 'access MIDI devices',
    'pointerLock': 'lock your mouse pointer',
    'fullscreen': 'take over the full screen',
    'display-capture': 'record your screen'
};

/** Fallback text for permissions Hoo does not present a checkbox for. */
export function describePermission(permission: string): string {
    return PERMISSION_LABELS[permission] || `use ${permission}`;
}

/**
 * Origin used for permission keys. Permissions are per-site in real
 * browsers, not per-page: `https://meet.google.com/abc/def` and any other
 * path on that host share one decision. Returns null for URLs without a
 * sensible origin (file://, data:, about:blank) — those never get prompts.
 */
export function originFromUrl(url: string | undefined | null): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return null;
    }
}

/** Storage key for one origin+permission pair. */
export function decisionKey(origin: string, permission: string): string {
    return `${origin}|${permission}`;
}

/**
 * Sanitize whatever the profile file contains into a valid decision map.
 * Unknown permissions, malformed keys and invalid values are dropped so a
 * hand-edited or corrupted profile cannot inject decisions for arbitrary
 * origins.
 */
export function normalizePermissionDecisions(raw: unknown): PermissionDecisionMap {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: PermissionDecisionMap = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof key !== 'string' || !key.includes('|')) continue;
        const [origin, permission] = key.split('|');
        if (!origin || !permission) continue;
        if (!isPermissionKeyOrigin(origin) || !isDecidable(permission)) continue;
        if (value !== 'allow' && value !== 'block') continue;
        out[key] = value;
    }
    return out;
}

function isPermissionKeyOrigin(origin: string): boolean {
    return origin === originFromUrl(origin);
}

function isDecidable(permission: string): permission is DecidablePermission {
    return (DECIDABLE_PERMISSIONS as readonly string[]).includes(permission);
}

/**
 * Decide a request. Stored decisions always win — including over the
 * compatibility exemption, so a user who blocked WhatsApp media stays
 * blocked. Undecidable permissions are always denied; anything else asks
 * the user.
 */
export function resolvePermissionDecision(
    decisions: PermissionDecisionMap,
    origin: string | null,
    permission: string,
    options: { deepSpoofWhatsappMedia?: boolean } = {}
): PermissionResolution {
    if (!origin) return 'block';
    if (!isDecidable(permission)) return 'block';
    const stored = decisions[decisionKey(origin, permission)];
    if (stored) return stored;
    if (options.deepSpoofWhatsappMedia && permission === 'media' && origin === 'https://web.whatsapp.com') {
        return 'allow';
    }
    return 'ask';
}

/**
 * Toggle or set one decision, returning a new map (profile state stays
 * immutable in callers). Same value with `overwrite: false` keeps it.
 */
export function withDecision(
    decisions: PermissionDecisionMap,
    origin: string,
    permission: string,
    decision: PermissionDecision
): PermissionDecisionMap {
    const next = { ...decisions };
    if (decision === 'block') next[decisionKey(origin, permission)] = 'block';
    else next[decisionKey(origin, permission)] = 'allow';
    return next;
}

/** Remove one stored decision (site falls back to asking again). */
export function withoutDecision(
    decisions: PermissionDecisionMap,
    key: string
): PermissionDecisionMap {
    const next = { ...decisions };
    delete next[key];
    return next;
}

export interface SitePermissionRow {
    key: string;
    origin: string;
    permission: string;
    decision: PermissionDecision;
}

/** Rows for the settings manager, newest-change-friendly ordering. */
export function permissionRows(decisions: PermissionDecisionMap): SitePermissionRow[] {
    return Object.entries(decisions)
        .filter(([key]) => {
            const [origin, permission] = key.split('|');
            return !!origin && !!permission && isPermissionKeyOrigin(origin) && isDecidable(permission);
        })
        .map(([key, decision]) => {
            const [origin, permission] = key.split('|');
            return { key, origin, permission, decision };
        })
        .sort((a, b) => a.origin.localeCompare(b.origin) || a.permission.localeCompare(b.permission));
}
