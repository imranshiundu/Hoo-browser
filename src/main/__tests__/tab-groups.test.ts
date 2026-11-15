import { describe, expect, it } from 'vitest';
import {
    GROUP_COLORS,
    TabGroup,
    addTabsToGroup,
    createGroup,
    groupOf,
    moveTabBetweenGroups,
    nextGroupColor,
    pruneGroups,
    recolorGroup,
    removeTabFromGroup,
    renameGroup,
    restoreGroups,
    toggleGroupCollapse,
    visibleGroupedTabs
} from '../tab-groups';

const group = (id: string, tabIds: string[], overrides: Partial<TabGroup> = {}): TabGroup =>
    ({ ...createGroup(id, `Group ${id}`, 'blue', tabIds, 1000), ...overrides });

describe('tab groups', () => {
    it('creates a group with deduped members and a default name', () => {
        const made = createGroup('g1', '  ', 'blue', ['a', 'b', 'a']);
        expect(made.name).toBe('New group');
        expect(made.tabIds).toEqual(['a', 'b']);
        expect(made.collapsed).toBe(false);
    });

    it('keeps an explicit name when given one', () => {
        expect(createGroup('g1', 'Docs', 'red', []).name).toBe('Docs');
    });

    it('adds tabs without duplicates and expands the group', () => {
        const made = group('g1', ['a']);
        const next = addTabsToGroup(made, ['b', 'a', 'c']);
        expect(next.tabIds).toEqual(['a', 'b', 'c']);
        expect(next.collapsed).toBe(false);
    });

    it('returns the same object when nothing new is added', () => {
        const made = group('g1', ['a']);
        expect(addTabsToGroup(made, ['a'])).toBe(made);
    });

    it('removes a member and ignores unknown ids', () => {
        const made = group('g1', ['a', 'b']);
        expect(removeTabFromGroup(made, 'a').tabIds).toEqual(['b']);
        expect(removeTabFromGroup(made, 'zzz')).toBe(made);
    });

    it('moves a tab between groups', () => {
        const groups = [group('g1', ['a', 'b']), group('g2', ['c'])];
        const next = moveTabBetweenGroups(groups, 'g1', 'g2', 'a');
        expect(next[0].tabIds).toEqual(['b']);
        expect(next[1].tabIds).toEqual(['c', 'a']);
    });

    it('renames with fallback to the old name on blank input', () => {
        const made = group('g1', ['a'], { name: 'Docs' });
        expect(renameGroup(made, '  Research ').name).toBe('Research');
        expect(renameGroup(made, '   ').name).toBe('Docs');
    });

    it('recolors and toggles collapse', () => {
        const made = group('g1', ['a']);
        expect(recolorGroup(made, 'pink').color).toBe('pink');
        expect(toggleGroupCollapse(made).collapsed).toBe(true);
        expect(toggleGroupCollapse(toggleGroupCollapse(made)).collapsed).toBe(false);
    });

    it('prunes closed tabs and drops emptied groups', () => {
        const groups = [group('g1', ['a', 'b']), group('g2', ['c'])];
        const next = pruneGroups(groups, ['b', 'c']);
        // g1 survives with its one remaining member; nothing is empty.
        expect(next.map(g => g.id)).toEqual(['g1', 'g2']);
        expect(next[0].tabIds).toEqual(['b']);
        // Closing every member dissolves the group.
        expect(pruneGroups(groups, ['a']).map(g => g.id)).toEqual(['g1']);
        expect(pruneGroups(groups, []).map(g => g.id)).toEqual([]);
    });

    it('reports membership', () => {
        const groups = [group('g1', ['a'])];
        expect(groupOf(groups, 'a')?.id).toBe('g1');
        expect(groupOf(groups, 'zzz')).toBeNull();
    });

    it('collapsed groups hide members but never the active tab', () => {
        const groups = [group('g1', ['a', 'b'], { collapsed: true })];
        const tabs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
        const visible = visibleGroupedTabs(tabs, groups, 'a');
        expect(visible.map(entry => entry.tab.id)).toEqual(['a', 'c']);
        expect(visible.find(entry => entry.tab.id === 'a')?.groupId).toBe('g1');
        expect(visible.find(entry => entry.tab.id === 'c')?.groupId).toBeNull();
    });

    it('expanded groups show everything', () => {
        const groups = [group('g1', ['a', 'b'])];
        const visible = visibleGroupedTabs([{ id: 'a' }, { id: 'b' }], groups, null);
        expect(visible).toHaveLength(2);
    });

    it('picks the least-used color in palette order', () => {
        expect(nextGroupColor([])).toBe(GROUP_COLORS[0]);
        const once = [group('g1', ['a'], { color: 'blue' })];
        expect(nextGroupColor(once)).toBe('purple');
        const all = GROUP_COLORS.map((color, index) => group(`g${index}`, [], { color }));
        expect(GROUP_COLORS).toContain(nextGroupColor(all));
    });

    it('restores persisted groups safely against live tabs', () => {
        const persisted = [
            { id: 'g1', name: 'Docs', color: 'green', tabIds: ['a', 'ghost'], collapsed: true, createdAt: 5 },
            { id: 'g2', name: '', color: 'magenta', tabIds: ['gone'] },
            null,
            { id: 'g3', name: 'Orphans', tabIds: ['also-gone'] }
        ];
        const restored = restoreGroups(persisted, ['a', 'b']);
        expect(restored).toHaveLength(1);
        expect(restored[0]).toMatchObject({ id: 'g1', name: 'Docs', color: 'green', tabIds: ['a'], collapsed: true });
    });
});
