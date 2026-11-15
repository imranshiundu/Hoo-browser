import React, { useState, useEffect } from 'react';
import './RSSView.css';
import { Rss, ExternalLink, Clock, RefreshCw, Plus, AlertCircle, Loader, X } from 'lucide-react';
import { HooFeed, loadFeeds, makeCustomFeed, removeCustomFeed, saveCustomFeed } from '../rss-feeds';

interface FeedItem {
    title: string;
    link: string;
    source: string;
    pubDate: string;
    summary: string;
}

function timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return 'now';
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return `${Math.max(1, Math.floor(diffMs / 60000))}m ago`;
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
}

async function parseFeed(feed: HooFeed): Promise<FeedItem[]> {
    // Fetch through the main process when available (no CORS, no third-party
    // proxy); plain fetch is the fallback for stripped-down test shells.
    const response = window.electronAPI?.rssFetch
        ? await window.electronAPI.rssFetch(feed.rssUrl)
        : { ok: true, contents: await (await fetch(feed.rssUrl, { signal: AbortSignal.timeout(8000) })).text() };
    if (!response.ok || !response.contents) {
        throw new Error(response.error || 'The feed could not be loaded.');
    }
    const doc = new DOMParser().parseFromString(response.contents, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('This URL did not return a valid feed.');
    const items = Array.from(doc.querySelectorAll('item, entry')).slice(0, 8);
    if (!items.length) throw new Error('No articles found in this feed.');
    return items.map(item => ({
        title: item.querySelector('title')?.textContent?.trim() || 'Untitled',
        link: item.querySelector('link')?.textContent?.trim() || item.querySelector('link')?.getAttribute('href') || feed.url,
        source: feed.name,
        pubDate: item.querySelector('pubDate, published, updated')?.textContent?.trim() || '',
        summary: (item.querySelector('description, summary, content')?.textContent || '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 200) + (item.textContent && item.textContent.length > 200 ? '…' : '')
    }));
}

const RSSView: React.FC = () => {
    const [feeds, setFeeds] = useState<HooFeed[]>(() => loadFeeds());
    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [feedErrors, setFeedErrors] = useState<Record<string, string>>({});
    const [activeSource, setActiveSource] = useState('All');
    const [newFeedUrl, setNewFeedUrl] = useState('');
    const [adding, setAdding] = useState(false);
    const [addFormOpen, setAddFormOpen] = useState(false);

    const loadFeedsNow = async (currentFeeds: HooFeed[]): Promise<void> => {
        setLoading(true);
        setFeedErrors({});
        const results = await Promise.allSettled(currentFeeds.map(parseFeed));
        const all: FeedItem[] = [];
        const errors: Record<string, string> = {};
        results.forEach((result, index) => {
            const feed = currentFeeds[index];
            if (result.status === 'fulfilled') all.push(...result.value);
            else errors[feed.id] = result.reason instanceof Error ? result.reason.message : 'Failed to load.';
        });
        all.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
        setItems(all);
        setFeedErrors(errors);
        setLoading(false);
    };

    useEffect(() => { void loadFeedsNow(feeds); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

    const filtered = activeSource === 'All' ? items : items.filter(item => item.source === activeSource);
    const failedCount = Object.keys(feedErrors).length;
    const sources = ['All', ...feeds.map(feed => feed.name)];

    const openLink = (url: string) => {
        if (window.electronAPI?.navigateTo) window.electronAPI.navigateTo(url);
    };

    const submitFeed = (event: React.FormEvent): void => {
        event.preventDefault();
        const feed = makeCustomFeed(newFeedUrl);
        if (!feed) return;
        const next = saveCustomFeed(feed);
        setFeeds(next);
        setNewFeedUrl('');
        setAddFormOpen(false);
        setAdding(false);
        void loadFeedsNow(next);
    };

    const deleteFeed = (feedId: string): void => {
        const next = removeCustomFeed(feedId);
        setFeeds(next);
        if (activeSource !== 'All' && !next.some(feed => feed.name === activeSource)) setActiveSource('All');
        void loadFeedsNow(next);
    };

    return (
        <div className="rss-view">
            <div className="view-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Rss size={28} className="header-icon" />
                    <div>
                        <h1 className="view-title">Live Reader</h1>
                        <p className="view-subtitle">
                            {items.length} articles from {feeds.length} sources
                            {failedCount > 0 ? ` · ${failedCount} feed${failedCount === 1 ? '' : 's'} unreachable` : ' · fetched directly, no proxy'}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="rss-refresh-btn" onClick={() => setAddFormOpen(value => !value)} title="Add a feed">
                        <Plus size={16} />
                    </button>
                    <button className="rss-refresh-btn" onClick={() => void loadFeedsNow(feeds)} disabled={loading} title="Refresh feeds">
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {addFormOpen && (
                <form className="rss-add-form" onSubmit={submitFeed}>
                    <input
                        type="text"
                        value={newFeedUrl}
                        onChange={event => { setNewFeedUrl(event.target.value); setAdding(false); }}
                        placeholder="Paste an RSS/Atom feed URL, e.g. hnrss.org/frontpage"
                        autoFocus
                        spellCheck={false}
                    />
                    <button type="submit" disabled={!newFeedUrl.trim()}>Add feed</button>
                    {adding && !newFeedUrl.trim() && <span className="rss-add-hint">Enter a feed address first.</span>}
                    <button type="button" className="rss-add-cancel" onClick={() => { setAddFormOpen(false); setNewFeedUrl(''); }}>
                        <X size={14} />
                    </button>
                </form>
            )}

            <div className="rss-source-tabs">
                {sources.map(source => (
                    <button
                        key={source}
                        className={`rss-tab ${activeSource === source ? 'active' : ''}`}
                        onClick={() => setActiveSource(source)}
                    >
                        {source}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="rss-loading">
                    <Loader size={24} className="spin" />
                    <span>Fetching live feeds…</span>
                </div>
            )}

            {!loading && filtered.length === 0 && (
                <div className="rss-error">
                    <AlertCircle size={18} />
                    <span>
                        {failedCount === feeds.length
                            ? 'No feed could be reached. Check your connection or try again.'
                            : 'No articles found.'}
                    </span>
                </div>
            )}

            {!loading && filtered.length > 0 && (
                <div className="feed-list">
                    {filtered.map((feed, index) => {
                        const source = feeds.find(item => item.name === feed.source);
                        const failed = source ? feedErrors[source.id] : undefined;
                        return (
                            <div key={index} className="feed-card" onClick={() => openLink(feed.link)}>
                                <div className="feed-card-header">
                                    <span className="feed-source" style={{ color: source?.color }}>{feed.source}</span>
                                    {feed.pubDate && (
                                        <span className="feed-time"><Clock size={11} /> {timeAgo(feed.pubDate)}</span>
                                    )}
                                    {failed && <span className="feed-time" title={failed}><AlertCircle size={11} /> last load failed</span>}
                                </div>
                                <h2 className="feed-title">{feed.title}</h2>
                                <p className="feed-summary">{feed.summary}</p>
                                <div className="read-more-btn">
                                    Read Article <ExternalLink size={13} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {feeds.some(feed => feed.custom) && (
                <div className="rss-custom-note">
                    Your feeds: {feeds.filter(feed => feed.custom).map(feed => (
                        <button key={feed.id} className="rss-custom-chip" onClick={() => deleteFeed(feed.id)} title="Remove this feed">
                            {feed.name} <X size={11} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RSSView;
