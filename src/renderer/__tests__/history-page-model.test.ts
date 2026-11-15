import { describe, expect, it } from 'vitest';
import {
    HistoryRecord,
    groupHistoryByDay,
    historyDayLabel,
    historyRowKey,
    rangeCutoff,
    recordsInRange,
    searchHistoryRecords
} from '../history-page-model';

const DAY = 86400000;
// Fixed "now": 2026-11-15 12:00 local.
const now = new Date();
now.setHours(12, 0, 0, 0);
const NOW = now.getTime();
const at = (dayOffset: number, hour: number, minute = 0): number => {
    const date = new Date(NOW + dayOffset * DAY);
    date.setHours(hour, minute, 0, 0);
    return date.getTime();
};

const record = (url: string, title: string, timestamp: number): HistoryRecord => ({ url, title, timestamp });

describe('day labeling', () => {
    it('labels today, yesterday and older days', () => {
        expect(historyDayLabel(at(0, 9), NOW)).toBe('Today');
        expect(historyDayLabel(at(-1, 9), NOW)).toBe('Yesterday');
        expect(historyDayLabel(at(-2, 9), NOW)).toMatch(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/);
        expect(historyDayLabel(at(-30, 9), NOW)).toMatch(/^[A-Z][a-z]+ \d{1,2}$/);
    });
});

describe('groupHistoryByDay', () => {
    it('groups newest first with day labels', () => {
        const days = groupHistoryByDay([
            record('https://b.io/', 'B', at(0, 9)),
            record('https://a.io/', 'A', at(-1, 15)),
            record('https://c.io/', 'C', at(0, 11))
        ], NOW);
        expect(days.map(day => day.label)).toEqual(['Today', 'Yesterday']);
        expect(days[0].entries.map(entry => entry.title)).toEqual(['C', 'B']);
    });

    it('collapses repeat visits to the same page within one day, keeps latest', () => {
        const days = groupHistoryByDay([
            record('https://x.io/', 'First', at(0, 8)),
            record('https://x.io/', 'Second', at(0, 10)),
            record('https://x.io/', 'Next day', at(1, 10))
        ], NOW);
        expect(days).toHaveLength(2);
        expect(days[0].entries).toHaveLength(1);
        expect(days[0].entries[0].title).toBe('Next day');
        expect(days[1].entries[0].title).toBe('Second');
    });

    it('ignores junk records', () => {
        const days = groupHistoryByDay([
            record('', '', at(0, 9)),
            { url: 'https://ok.io/', title: 'ok', timestamp: Number.NaN },
            record('https://ok.io/', 'ok', at(0, 9))
        ], NOW);
        expect(days).toHaveLength(1);
        expect(days[0].entries).toHaveLength(1);
    });
});

describe('range clearing', () => {
    it('computes cutoffs for hour, day and all', () => {
        expect(rangeCutoff('hour', NOW)).toBe(NOW - 3600000);
        const midnight = new Date(NOW); midnight.setHours(0, 0, 0, 0);
        expect(rangeCutoff('day', NOW)).toBe(midnight.getTime());
        expect(rangeCutoff('all', NOW)).toBeNull();
    });

    it('selects records inside the range', () => {
        const records = [
            record('https://a/', 'a', NOW - 1800000),      // 30 min ago
            record('https://b/', 'b', NOW - 7200000),      // 2 h ago
            record('https://c/', 'c', at(-1, 9))           // yesterday
        ];
        expect(recordsInRange(records, 'hour', NOW)).toHaveLength(1);
        expect(recordsInRange(records, 'day', NOW)).toHaveLength(2);
        expect(recordsInRange(records, 'all', NOW)).toHaveLength(3);
    });
});

describe('search and keys', () => {
    const records = [
        record('https://rust-lang.org/', 'Rust', at(0, 9)),
        record('https://news.ycombinator.com/', 'HN', at(0, 10))
    ];
    it('filters by title or url case-insensitively', () => {
        expect(searchHistoryRecords(records, 'rust')).toHaveLength(1);
        expect(searchHistoryRecords(records, 'YCOMBINATOR')).toHaveLength(1);
        expect(searchHistoryRecords(records, '  ')).toHaveLength(2);
    });

    it('builds stable row keys', () => {
        expect(historyRowKey(records[0])).toBe(`${records[0].timestamp}-https://rust-lang.org/`);
    });
});
