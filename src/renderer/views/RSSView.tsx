import React, { useState, useEffect } from 'react';
import './RSSView.css';
import { Rss, ExternalLink, Clock, RefreshCw, Plus, AlertCircle, Loader } from 'lucide-react';

interface FeedItem {
    title: string;
    link: string;
    source: string;
    pubDate: string;
    summary: string;
}

interface Feed {
    name: string;
    url: string;
    rssUrl: string;
    color: string;
}

const DEFAULT_FEEDS: Feed[] = [
    { name: 'Hacker News', url: 'https://news.ycombinator.com', rssUrl: 'https://hnrss.org/frontpage', color: '#ff6600' },
    { name: 'The Register', url: 'https://www.theregister.com', rssUrl: 'https://www.theregister.com/headlines.atom', color: '#c0392b' },
    { name: 'Ars Technica', url: 'https://arstechnica.com', rssUrl: 'https://feeds.arstechnica.com/arstechnica/index', color: '#e74c3c' },
    { name: 'Wired', url: 'https://wired.com', rssUrl: 'https://www.wired.com/feed/rss', color: '#3498db' },
    { name: 'Linux Today', url: 'https://linuxtoday.com', rssUrl: 'https://linuxtoday.com/feed', color: '#2ecc71' },
];

async function parseFeed(feed: Feed): Promise<FeedItem[]> {
    const CORS_PROXY = 'https://api.allorigins.win/get?url=';
    const res = await fetch(`${CORS_PROXY}${encodeURIComponent(feed.rssUrl)}`, { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    const parser = new DOMParser();
    const doc = parser.parseFromString(json.contents, 'text/xml');
    const items = Array.from(doc.querySelectorAll('item, entry')).slice(0, 8);
    return items.map(item => ({
        title: item.querySelector('title')?.textContent?.trim() || 'Untitled',
        link: item.querySelector('link')?.textContent?.trim() || item.querySelector('link')?.getAttribute('href') || feed.url,
        source: feed.name,
        pubDate: item.querySelector('pubDate, published, updated')?.textContent?.trim() || '',
        summary: (item.querySelector('description, summary, content')?.textContent || '').replace(/<[^>]+>/g, '').slice(0, 200) + '...',
    }));
}

function timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
}

const RSSView: React.FC = () => {
    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeSource, setActiveSource] = useState('All');
    const [newFeedUrl, setNewFeedUrl] = useState('');
    const [addingFeed, setAddingFeed] = useState(false);

    const loadFeeds = async () => {
        setLoading(true);
        setError('');
        try {
            const results = await Promise.allSettled(DEFAULT_FEEDS.map(parseFeed));
            const all: FeedItem[] = [];
            results.forEach(r => {
                if (r.status === 'fulfilled') all.push(...r.value);
            });
            all.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
            setItems(all);
        } catch (e) {
            setError('Could not load feeds. Check your internet connection.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadFeeds(); }, []);

    const filtered = activeSource === 'All' ? items : items.filter(i => i.source === activeSource);
    const sources = ['All', ...DEFAULT_FEEDS.map(f => f.name)];

    const openLink = (url: string) => {
        if (window.electronAPI?.navigateTo) window.electronAPI.navigateTo(url);
    };

    return (
        <div className="rss-view">
            <div className="view-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Rss size={28} className="header-icon" />
                    <div>
                        <h1 className="view-title">Live Reader</h1>
                        <p className="view-subtitle">{items.length} articles from {DEFAULT_FEEDS.length} tech sources</p>
                    </div>
                </div>
                <button className="rss-refresh-btn" onClick={loadFeeds} disabled={loading} title="Refresh feeds">
                    <RefreshCw size={16} className={loading ? 'spin' : ''} />
                </button>
            </div>

            <div className="rss-source-tabs">
                {sources.map(s => (
                    <button
                        key={s}
                        className={`rss-tab ${activeSource === s ? 'active' : ''}`}
                        onClick={() => setActiveSource(s)}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="rss-loading">
                    <Loader size={24} className="spin" />
                    <span>Fetching live feeds...</span>
                </div>
            )}

            {error && (
                <div className="rss-error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {!loading && (
                <div className="feed-list">
                    {filtered.map((feed, i) => {
                        const src = DEFAULT_FEEDS.find(f => f.name === feed.source);
                        return (
                            <div key={i} className="feed-card" onClick={() => openLink(feed.link)}>
                                <div className="feed-card-header">
                                    <span className="feed-source" style={{ color: src?.color }}>
                                        {feed.source}
                                    </span>
                                    {feed.pubDate && (
                                        <span className="feed-time">
                                            <Clock size={11} /> {timeAgo(feed.pubDate)}
                                        </span>
                                    )}
                                </div>
                                <h2 className="feed-title">{feed.title}</h2>
                                <p className="feed-summary">{feed.summary}</p>
                                <div className="read-more-btn">
                                    Read Article <ExternalLink size={13} />
                                </div>
                            </div>
                        );
                    })}
                    {!loading && filtered.length === 0 && !error && (
                        <div className="rss-empty">No articles found.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RSSView;
