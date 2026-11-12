/**
 * Per-site zoom memory: real browsers remember that you like GitHub at
 * 110% and your bank at 90%, keyed by origin, so every tab on that site
 * opens at your preferred size. Hoo only kept zoom per tab in memory —
 * restart or navigate and your preference vanished.
 *
 * Pure logic here; main.ts applies it through `webContents.setZoomFactor`.
 */

export type SiteZoomMap = Record<string, number>;

export const ZOOM_PERCENT_MIN = 30;
export const ZOOM_PERCENT_MAX = 500;
export const ZOOM_PERCENT_DEFAULT = 100;

/** Percent -> Chromium zoom factor (1 = 100%). */
export function zoomPercentToFactor(percent: number): number {
    const safe = clampZoomPercent(percent);
    return Math.min(5, Math.max(0.3, safe / 100));
}

/** Clamp a stored/entered zoom percent into the supported range. */
export function clampZoomPercent(percent: number): number {
    if (!Number.isFinite(percent)) return ZOOM_PERCENT_DEFAULT;
    return Math.min(ZOOM_PERCENT_MAX, Math.max(ZOOM_PERCENT_MIN, Math.round(percent)));
}

/**
 * Sanitize a persisted zoom map: keys must be http(s) origins, values must
 * be finite numbers within the range. Corrupt or junk entries are dropped.
 */
export function normalizeSiteZooms(raw: unknown): SiteZoomMap {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: SiteZoomMap = {};
    for (const [origin, percent] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof origin !== 'string' || origin !== originOf(origin)) continue;
        const value = Number(percent);
        if (!Number.isFinite(value)) continue;
        out[origin] = clampZoomPercent(value);
    }
    return out;
}

function originOf(value: string): string | null {
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return null;
    }
}
