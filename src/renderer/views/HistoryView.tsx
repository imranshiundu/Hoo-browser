import React from 'react';
import './HistoryView.css';
import { Clock, Search, Trash2, X, Loader, History as HistoryIcon, ChevronDown } from 'lucide-react';
import {
    HistoryRange,
    HistoryRecord,
    groupHistoryByDay,
    historyRowKey,
    recordsInRange,
    searchHistoryRecords
} from '../history-page-model';

/**
 * Firefox Library "History" as a real page: day groups, live search,
 * per-visit forget buttons and range clearing (last hour / today / all).
 */
const HistoryView: React.FC<{ onNavigate?: (url: string) => void }> = ({ onNavigate }) => {
    const [records, setRecords] = React.useState<HistoryRecord[]>([]);
    const [loaded, setLoaded] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [clearMenuOpen, setClearMenuOpen] = React.useState(false);

    const refresh = React.useCallback(async (): Promise<void> => {
        try {
            const rows = await window.electronAPI?.getAllHistory?.();
            if (Array.isArray(rows)) setRecords(rows);
        } catch { /* keep whatever we had */ }
        setLoaded(true);
    }, []);

    React.useEffect(() => { void refresh(); }, [refresh]);

    const forgetEntry = (entry: HistoryRecord): void => {
        setRecords(prev => prev.filter(row => historyRowKey(row) !== historyRowKey(entry)));
        void window.electronAPI?.deleteHistoryEntry?.(entry.url, entry.timestamp);
    };

    const forgetRange = (range: HistoryRange): void => {
        setClearMenuOpen(false);
        const doomed = new Set(recordsInRange(records, range).map(historyRowKey));
        setRecords(prev => prev.filter(row => !doomed.has(historyRowKey(row))));
        void window.electronAPI?.clearHistoryRange?.(range);
    };

    const visible = searchHistoryRecords(records, query);
    const days = groupHistoryByDay(visible);

    return (
        <div className="history-view">
            <div className="view-header">
                <div className="header-left">
                    <HistoryIcon size={32} className="header-icon" />
                    <div>
                        <h1 className="view-title">History</h1>
                        <p className="view-subtitle">
                            {records.length
                                ? `${records.length} visit${records.length === 1 ? '' : 's'} stored on this device`
                                : 'Pages you visit are remembered only here'}
                        </p>
                    </div>
                </div>
                {records.length > 0 && (
                    <div className="history-clear-wrap">
                        <button
                            className="history-clear-btn"
                            onClick={() => setClearMenuOpen(open => !open)}
                            title="Forget part of your history"
                        >
                            <Trash2 size={16} /> Forget <ChevronDown size={13} />
                        </button>
                        {clearMenuOpen && (
                            <div className="history-clear-menu" onClick={e => e.stopPropagation()}>
                                <button onClick={() => forgetRange('hour')}>The last hour</button>
                                <button onClick={() => forgetRange('day')}>Today</button>
                                <button className="danger" onClick={() => forgetRange('all')}>Everything</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {!loaded ? (
                <div className="history-empty"><Loader size={22} className="spin" /> Loading history…</div>
            ) : records.length === 0 ? (
                <div className="history-empty">
                    <Clock size={28} />
                    <p>No history yet.</p>
                    <span>Pages you open show up here, grouped by day. Clearing ranges or entries is one click away.</span>
                </div>
            ) : (
                <>
                    <div className="history-search-bar">
                        <Search size={15} />
                        <input
                            type="text"
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="Search history by title or address"
                            spellCheck={false}
                            autoFocus
                        />
                        {query && (
                            <button onClick={() => setQuery('')} title="Clear search" aria-label="Clear search"><X size={14} /></button>
                        )}
                    </div>
                    {days.length === 0 ? (
                        <div className="history-empty">
                            <Search size={26} />
                            <p>Nothing matches “{query}”.</p>
                        </div>
                    ) : (
                        <div className="history-day-list">
                            {days.map(day => (
                                <section key={day.dayKey} className="history-day">
                                    <h2 className="history-day-label">{day.label}</h2>
                                    {day.entries.map(entry => (
                                        <div key={historyRowKey(entry)} className="history-row">
                                            <span className="history-time">
                                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <button
                                                className="history-entry"
                                                onClick={() => onNavigate?.(entry.url)}
                                                title={entry.url}
                                            >
                                                <span className="history-entry-title">{entry.title || entry.url}</span>
                                                <span className="history-entry-url">{entry.url.replace(/^https?:\/\//, '').slice(0, 90)}</span>
                                            </button>
                                            <button
                                                className="history-forget-btn"
                                                onClick={() => forgetEntry(entry)}
                                                title="Forget this visit"
                                                aria-label={`Forget ${entry.title || entry.url}`}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </section>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default HistoryView;
