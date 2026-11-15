// Pure logic for the download toast stack. The main process streams
// 'download-updated' records for every byte tick; this module decides which
// of those transitions deserve a toast (a download starting, finishing, or
// failing — not every progress tick) and how the visible stack behaves.

export type DownloadToastKind = 'started' | 'completed' | 'failed';

export interface DownloadToast {
    id: string;
    kind: DownloadToastKind;
    filename: string;
    at: number;
    expiresAt: number;
}

export const MAX_TOASTS = 4;
/** Started toasts are low-value: get out of the way quickly. */
export const STARTED_TOAST_MS = 3500;
/** Completed/failed toasts carry actions; keep them around longer. */
export const FINAL_TOAST_MS = 6500;

type DownloadState = 'progressing' | 'completed' | 'cancelled' | 'interrupted';

/**
 * Which toast a download-state transition produces. Progress ticks are
 * intentionally silent — the toolbar popover already shows live progress —
 * and a cancelled download is the user's own deliberate act.
 */
export function downloadToastKind(state: DownloadState, previousState: DownloadState | undefined): DownloadToastKind | null {
    if (state === 'progressing') return previousState === undefined ? 'started' : null;
    if (state === 'completed') return 'completed';
    if (state === 'interrupted') return 'failed';
    return null;
}

/** Banner text for one toast, mirroring the toolbar's wording. */
export function toastHeadline(kind: DownloadToastKind, filename: string): string {
    if (kind === 'started') return `Downloading ${filename}`;
    if (kind === 'completed') return `Downloaded ${filename}`;
    return `Download failed — ${filename}`;
}

function lifetimeMs(kind: DownloadToastKind): number {
    return kind === 'started' ? STARTED_TOAST_MS : FINAL_TOAST_MS;
}

/**
 * Add a toast for a download. Re-adding the same download replaces its old
 * toast (a failed retry must not stack), and the stack never grows past
 * MAX_TOASTS — the oldest entry drops off first.
 */
export function pushToast(
    toasts: DownloadToast[],
    downloadId: string,
    kind: DownloadToastKind,
    filename: string,
    now: number
): DownloadToast[] {
    const next = toasts.filter(toast => toast.id !== downloadId);
    next.push({ id: downloadId, kind, filename, at: now, expiresAt: now + lifetimeMs(kind) });
    return next.slice(Math.max(0, next.length - MAX_TOASTS));
}

/** Drop expired toasts; used on a timer and on render. */
export function pruneToasts(toasts: DownloadToast[], now: number): DownloadToast[] {
    return toasts.filter(toast => toast.expiresAt > now);
}
