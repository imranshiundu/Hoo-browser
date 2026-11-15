/**
 * History page model — Firefox Library "History" behaviors in pure form:
 * group by day, keep the newest visit per page per day, label days like a
 * human, and compute cutoffs for "forget last hour / today / everything".
 */

export interface HistoryRecord {
    url: string;
    title: string;
    timestamp: number;
}

export interface HistoryDay {
    dayKey: string;          // local YYYY-MM-DD, stable for keys
    label: string;           // Today / Yesterday / weekday, Month day
    entries: HistoryRecord[];
}

const DAY_MS = 86400000;
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function localDayKey(date: Date): string {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

export function historyDayLabel(timestamp: number, nowMs: number = Date.now()): string {
    const date = new Date(timestamp);
    const today = new Date(nowMs);
    const yesterday = new Date(nowMs - DAY_MS);
    if (localDayKey(date) === localDayKey(today)) return 'Today';
    if (localDayKey(date) === localDayKey(yesterday)) return 'Yesterday';
    const ageDays = Math.floor((startOfDay(nowMs) - startOfDay(timestamp)) / DAY_MS);
    if (ageDays < 7 && ageDays >= 2) return WEEKDAY[date.getDay()];
    return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function startOfDay(ms: number): number {
    const date = new Date(ms);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

/**
 * Newest-first grouping by local day. Same page visited repeatedly within
 * one day collapses to its latest visit; it still appears on other days.
 */
export function groupHistoryByDay(records: readonly HistoryRecord[], nowMs: number = Date.now()): HistoryDay[] {
    const ordered = [...records].filter(entry =>
        entry
        && typeof entry.timestamp === 'number'
        && Number.isFinite(entry.timestamp)
        && typeof entry.url === 'string'
        && !!entry.url
    );
    ordered.sort((a, b) => b.timestamp - a.timestamp);

    const days = new Map<string, HistoryDay>();
    const seenUrlPerDay = new Map<string, string>(); // `${dayKey}|${urlKey}` -> dayKey
    for (const entry of ordered) {
        const dayKey = localDayKey(new Date(entry.timestamp));
        const dedupeKey = `${dayKey}|${entry.url.replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase()}`;
        if (seenUrlPerDay.has(dedupeKey)) continue;
        seenUrlPerDay.set(dedupeKey, dayKey);
        let day = days.get(dayKey);
        if (!day) {
            day = { dayKey, label: historyDayLabel(entry.timestamp, nowMs), entries: [] };
            days.set(dayKey, day);
        }
        day.entries.push(entry);
    }
    return [...days.values()].sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1));
}

export type HistoryRange = 'hour' | 'day' | 'all';

/** Milliseconds back from now that a range erases; null = everything. */
export function rangeCutoff(range: HistoryRange, nowMs: number = Date.now()): number | null {
    if (range === 'hour') return nowMs - 3600000;
    if (range === 'day') return startOfDay(nowMs);
    return null;
}

/** The records a "forget range" click would delete (newest edge inclusive). */
export function recordsInRange(records: readonly HistoryRecord[], range: HistoryRange, nowMs: number = Date.now()): HistoryRecord[] {
    const cutoff = rangeCutoff(range, nowMs);
    if (cutoff === null) return [...records];
    return records.filter(entry => entry.timestamp >= cutoff);
}

/** Rows shown under the search box; empty query returns everything grouped. */
export function searchHistoryRecords(
    records: readonly HistoryRecord[],
    query: string
): HistoryRecord[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...records];
    return records.filter(entry =>
        (entry.title || '').toLowerCase().includes(q) || (entry.url || '').toLowerCase().includes(q)
    );
}

/** Key for per-row delete buttons (timestamp disambiguates repeat visits). */
export function historyRowKey(entry: HistoryRecord): string {
    return `${entry.timestamp}-${entry.url}`;
}
