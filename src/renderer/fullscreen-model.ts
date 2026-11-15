// Pure logic behind the Firefox-style fullscreen experience. The shell asks
// these helpers three questions: whose page went fullscreen, whether the
// chrome should disappear right now, and whether the pointer is close enough
// to the top edge to slide the tab strip back down.

export type ImmersiveInputs = {
    /** Tab whose webContents entered HTML5 fullscreen, if any. */
    pageFullscreenTabId: string | null;
    /** Tab the shell is currently showing. */
    activeTabId: string;
    /** True while the window itself is in OS fullscreen (F11). */
    osFullscreen: boolean;
};

/** How close to the top edge (px) the pointer must be to reveal the chrome. */
export const CHROME_REVEAL_EDGE_PX = 6;
/** Pointer must travel below this line (px) before the chrome hides again. */
export const CHROME_HIDE_EDGE_PX = 88;
/** How long the "{origin} is now full screen" banner stays up. */
export const INFOBAR_AUTO_HIDE_MS = 4500;

/**
 * The site label shown in the fullscreen banner. Real browsers show the
 * origin ("youtube.com is now full screen"), not the full URL.
 */
export function fullscreenOriginLabel(url: string | undefined): string {
    if (!url) return 'This page';
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return 'This page';
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'This page';
    return parsed.hostname.replace(/^www\./, '') || 'This page';
}

/**
 * Immersive mode (chrome hidden) is active when the window is in OS
 * fullscreen, or when the ACTIVE tab's page took over the screen. A page
 * going fullscreen in a background tab must not disturb the current view.
 */
export function isImmersive({ pageFullscreenTabId, activeTabId, osFullscreen }: ImmersiveInputs): boolean {
    if (osFullscreen) return true;
    return !!pageFullscreenTabId && pageFullscreenTabId === activeTabId;
}

/** Pointer entered the reveal zone at the very top of the window. */
export function shouldRevealChrome(clientY: number, edgePx: number = CHROME_REVEAL_EDGE_PX): boolean {
    return clientY >= 0 && clientY <= edgePx;
}

/** Pointer left the overlay strip; the chrome should hide again. */
export function shouldHideChrome(clientY: number, edgePx: number = CHROME_HIDE_EDGE_PX): boolean {
    return clientY > edgePx;
}
