/**
 * Small pure helpers shared by the browser chrome (tabs, zoom, find bar).
 * Kept dependency-free so they are trivially unit-testable.
 */

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 5.0;
const ZOOM_STEP = 1.2;

/**
 * Monotonic tab-id factory. `Date.now().toString()` collided when two tabs
 * were created within the same millisecond (context-menu actions, session
 * restore), corrupting the tab map.
 */
export function createTabIdFactory(): () => string {
    let counter = 0;
    return (): string => {
        counter = (counter + 1) % 100000;
        return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    };
}

/** Clamp a zoom factor into the range Chromium itself allows. */
export function clampZoomFactor(factor: number): number {
    if (!Number.isFinite(factor) || factor <= 0) return 1;
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, factor));
}

/** One zoom step in (default 1.2x), clamped. */
export function stepZoomFactor(current: number, direction: 'in' | 'out' | 'reset'): number {
    if (direction === 'reset') return 1;
    const next = direction === 'in' ? current * ZOOM_STEP : current / ZOOM_STEP;
    return clampZoomFactor(next);
}

/** Round a zoom factor to the percentage shown in the zoom badge. */
export function zoomPercent(factor: number): number {
    return Math.round(clampZoomFactor(factor) * 100);
}

/**
 * Human text for the find bar: "3 of 17" while searching,
 * "No matches" once a search completed with zero hits.
 */
export function findStatusText(activeMatch: number | undefined, matches: number | undefined, hasQuery: boolean): string {
    if (!hasQuery) return '';
    if (matches === undefined) return 'Searching';
    if (matches === 0) return 'No matches';
    const safeActive = activeMatch && activeMatch > 0 ? activeMatch : 1;
    return `${safeActive} of ${matches}`;
}

/** Friendly label for a renderer crash reason (shown on the crashed-tab page). */
export function crashReasonLabel(reason: string): string {
    const labels: Record<string, string> = {
        'crashed': 'The renderer process crashed.',
        'oom': 'The tab ran out of memory.',
        'killed': 'The tab was terminated by the system.',
        'launch-failure': 'The tab failed to start.',
        'integrity-failure': 'The tab failed an integrity check and was stopped.'
    };
    return labels[reason] || `The tab stopped unexpectedly (${reason}).`;
}

/** Format download byte counts without pulling in a dependency. */
export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    const text = unit === 0 ? String(Math.round(value)) : value.toFixed(1);
    return `${text} ${units[unit]}`;
}
