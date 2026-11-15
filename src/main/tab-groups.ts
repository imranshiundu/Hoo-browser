/**
 * Tab groups, in the spirit of Firefox 137's native groups: a named, colored
 * basket of tab ids that renders as one contiguous run in the tab strip and
 * can collapse to a single labeled pill.
 *
 * Everything here is a pure function on plain data so the renderer can keep
 * groups in React state (persisted to localStorage) and tests can pin the
 * behavior without an Electron environment.
 */

export type TabGroupColor =
    | 'blue' | 'purple' | 'cyan' | 'green'
    | 'yellow' | 'orange' | 'red' | 'pink';

/** Firefox's group palette order — distinct hues so two groups never blur. */
export const GROUP_COLORS: readonly TabGroupColor[] = [
    'blue', 'purple', 'cyan', 'green', 'yellow', 'orange', 'red', 'pink'
];

export interface TabGroup {
    id: string;
    name: string;
    color: TabGroupColor;
    tabIds: string[];
    collapsed: boolean;
    createdAt: number;
}

/** Pick the least-used color so consecutive groups look different. */
export function nextGroupColor(groups: readonly TabGroup[]): TabGroupColor {
    const counts = new Map<TabGroupColor, number>();
    for (const color of GROUP_COLORS) counts.set(color, 0);
    for (const group of groups) {
        counts.set(group.color, (counts.get(group.color) || 0) + 1);
    }
    let best: TabGroupColor = GROUP_COLORS[0];
    let bestCount = Number.POSITIVE_INFINITY;
    for (const color of GROUP_COLORS) {
        const count = counts.get(color) || 0;
        if (count < bestCount) {
            best = color;
            bestCount = count;
        }
    }
    return best;
}

export function createGroup(
    id: string,
    name: string,
    color: TabGroupColor,
    tabIds: readonly string[],
    now: number = Date.now()
): TabGroup {
    // Dedupe ids but keep the caller's order — groups are unordered baskets,
    // visual order always comes from the tab strip.
    const seen = new Set<string>();
    const uniqueIds = tabIds.filter(tabId => (seen.has(tabId) ? false : (seen.add(tabId), true)));
    return {
        id,
        name: name.trim() || 'New group',
        color,
        tabIds: uniqueIds,
        collapsed: false,
        createdAt: now
    };
}

export function addTabsToGroup(group: TabGroup, tabIds: readonly string[]): TabGroup {
    const members = new Set(group.tabIds);
    const additions = tabIds.filter(tabId => (members.has(tabId) ? false : (members.add(tabId), true)));
    if (!additions.length) return group;
    return { ...group, tabIds: [...group.tabIds, ...additions], collapsed: false };
}

export function removeTabFromGroup(group: TabGroup, tabId: string): TabGroup {
    if (!group.tabIds.includes(tabId)) return group;
    return { ...group, tabIds: group.tabIds.filter(id => id !== tabId) };
}

/** One tab can only live in one group; adding it elsewhere removes it here. */
export function moveTabBetweenGroups(
    groups: readonly TabGroup[],
    fromGroupId: string,
    toGroupId: string,
    tabId: string
): TabGroup[] {
    return groups.map(group => {
        if (group.id === fromGroupId) return removeTabFromGroup(group, tabId);
        if (group.id === toGroupId) return addTabsToGroup(group, [tabId]);
        return group;
    });
}

export function renameGroup(group: TabGroup, name: string): TabGroup {
    return { ...group, name: name.trim() || group.name };
}

export function recolorGroup(group: TabGroup, color: TabGroupColor): TabGroup {
    return { ...group, color };
}

export function toggleGroupCollapse(group: TabGroup): TabGroup {
    return { ...group, collapsed: !group.collapsed };
}

/** Groups do not survive empty: pruning runs after every tab close. */
export function pruneGroups(groups: readonly TabGroup[], existingTabIds: readonly string[]): TabGroup[] {
    const alive = new Set(existingTabIds);
    return groups
        .map(group => ({ ...group, tabIds: group.tabIds.filter(tabId => alive.has(tabId)) }))
        .filter(group => group.tabIds.length > 0);
}

export function groupOf(groups: readonly TabGroup[], tabId: string): TabGroup | null {
    return groups.find(group => group.tabIds.includes(tabId)) || null;
}

export interface GroupedTab {
    tab: { id: string };
    /** null when the tab is ungrouped. */
    groupId: string | null;
}

/**
 * Collapsed groups hide their member tabs — except the active one, which
 * stays on screen so focus is never yanked away (Firefox does the same).
 */
export function visibleGroupedTabs(
    tabs: readonly { id: string }[],
    groups: readonly TabGroup[],
    activeTabId: string | null
): GroupedTab[] {
    const collapsedIds = new Set<string>();
    for (const group of groups) {
        if (!group.collapsed) continue;
        for (const tabId of group.tabIds) collapsedIds.add(tabId);
    }
    return tabs.map(tab => ({
        tab,
        groupId: groupOf(groups, tab.id)?.id || null,
        hidden: collapsedIds.has(tab.id) && tab.id !== activeTabId
    })).filter(entry => !entry.hidden);
}

/**
 * Repair pass for restoring persisted groups against live tabs: drops
 * unknown tab ids, drops now-empty groups, keeps everything else stable.
 */
export function restoreGroups(groups: readonly unknown[], existingTabIds: readonly string[]): TabGroup[] {
    const alive = new Set(existingTabIds);
    const restored: TabGroup[] = [];
    for (const raw of groups) {
        if (!raw || typeof raw !== 'object') continue;
        const candidate = raw as Partial<TabGroup>;
        if (typeof candidate.id !== 'string' || !candidate.id) continue;
        const tabIds = Array.isArray(candidate.tabIds)
            ? candidate.tabIds.filter((tabId): tabId is string => typeof tabId === 'string' && alive.has(tabId))
            : [];
        if (!tabIds.length) continue;
        restored.push({
            id: candidate.id,
            name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name : 'New group',
            color: (GROUP_COLORS as readonly string[]).includes(candidate.color as string)
                ? candidate.color as TabGroupColor
                : GROUP_COLORS[0],
            tabIds,
            collapsed: candidate.collapsed === true,
            createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : 0
        });
    }
    return restored;
}
