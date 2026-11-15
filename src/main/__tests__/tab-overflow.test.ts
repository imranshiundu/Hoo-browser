import { describe, expect, it } from 'vitest';
import { isStripOverflowing, overflowRowLabel, overflowRows } from '../tab-overflow';

describe('tab strip overflow', () => {
    it('detects overflow with 1px slack', () => {
        expect(isStripOverflowing(500, 500)).toBe(false);
        expect(isStripOverflowing(502, 500)).toBe(true);
        expect(isStripOverflowing(501, 500)).toBe(false);
    });

    it('rejects non-finite measurements', () => {
        expect(isStripOverflowing(Number.NaN, 100)).toBe(false);
        expect(isStripOverflowing(100, Number.NaN)).toBe(false);
    });

    it('copies rows so menus cannot mutate strip state', () => {
        const tabs = [{ id: 'a', title: 'A', isActive: true }];
        const rows = overflowRows(tabs);
        expect(rows).toEqual(tabs);
        expect(rows).not.toBe(tabs);
    });

    it('labels rows and truncates long titles', () => {
        expect(overflowRowLabel('', 'https://example.com')).toBe('https://example.com');
        expect(overflowRowLabel('   ', undefined)).toBe('New Tab');
        const long = 'x'.repeat(80);
        expect(overflowRowLabel(long)).toHaveLength(58); // 57 chars + ellipsis
        expect(overflowRowLabel(long).endsWith('…')).toBe(true);
    });
});
