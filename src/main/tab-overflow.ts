/**
 * "List all tabs" overflow, the Firefox tab-strip behavior: when the tabs
 * no longer fit, a chevron appears at the end of the strip and opens a menu
 * listing every open tab.
 *
 * The measuring is done live in the renderer (scrollWidth vs clientWidth);
 * this module holds the pure decision logic and the flatten helpers so the
 * menu can share them with tests.
 */

export interface OverflowTabRow {
    id: string;
    title: string;
    url?: string;
    isActive: boolean;
}

/** True when the strip content is wider than the visible box (1px slack). */
export function isStripOverflowing(scrollWidth: number, clientWidth: number): boolean {
    if (!Number.isFinite(scrollWidth) || !Number.isFinite(clientWidth)) return false;
    return scrollWidth > clientWidth + 1;
}

/** Menu order mirrors the strip (pinned-first is handled upstream). */
export function overflowRows(tabs: readonly OverflowTabRow[]): OverflowTabRow[] {
    return tabs.map(tab => ({ ...tab }));
}

/** Trim a row title for the menu; favicon comes from the renderer. */
export function overflowRowLabel(title: string, url?: string): string {
    const label = (typeof title === 'string' ? title.trim() : '')
        || (typeof url === 'string' ? url.trim() : '')
        || 'New Tab';
    return label.length > 60 ? `${label.slice(0, 57)}…` : label;
}
