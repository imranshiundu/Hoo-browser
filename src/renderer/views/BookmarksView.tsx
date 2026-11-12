import React, { useState, useEffect } from 'react';
import './BookmarksView.css';
import { Bookmark, Search, Folder, Globe, Trash2, Plus, ExternalLink, Upload, Download } from 'lucide-react';
import { siteInitial, siteInitialStyle } from '../types';

interface BookmarkEntry {
    id: string;
    title: string;
    url: string;
    folder?: string;
    addedAt?: number;
}

// One canonical bookmarks store. The star button, the toolbar popover and
// this library used to read/write two different keys (`hoo:bookmarks` and
// `zen_bookmarks`), so pages saved with the star never appeared here.
const BOOKMARK_KEY = 'hoo:bookmarks';
const LEGACY_BOOKMARK_KEY = 'zen_bookmarks';
const FOLDERS = ['All', 'General', 'Work', 'Research', 'Tech', 'Media'];

function normalizeEntries(raw: unknown): BookmarkEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .filter(item => typeof item.url === 'string' && /^https?:\/\//i.test(item.url))
        .map(item => ({
            id: typeof item.id === 'string' && item.id ? item.id : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            title: typeof item.title === 'string' && item.title.trim() ? item.title : String(item.url),
            url: String(item.url),
            folder: typeof item.folder === 'string' && item.folder.trim() ? item.folder : 'General',
            addedAt: typeof item.addedAt === 'number' ? item.addedAt : Date.now()
        }));
}

function loadBookmarks(): BookmarkEntry[] {
    try {
        let entries = normalizeEntries(JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]'));
        if (!entries.length) {
            // One-time migration from the pre-0.5 library key so users do
            // not lose the bookmarks they saved through this page.
            const legacy = normalizeEntries(JSON.parse(localStorage.getItem(LEGACY_BOOKMARK_KEY) || '[]'));
            if (legacy.length) {
                localStorage.setItem(BOOKMARK_KEY, JSON.stringify(legacy));
                entries = legacy;
            }
        }
        return entries;
    } catch {
        return [];
    }
}

function saveBookmarks(entries: BookmarkEntry[]): void {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(entries));
}

const BookmarksView: React.FC<{ onNavigate?: (url: string) => void }> = ({ onNavigate }) => {
    const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>(loadBookmarks);
    const [activeFolder, setActiveFolder] = useState('All');
    const [search, setSearch] = useState('');
    const [addUrl, setAddUrl] = useState('');
    const [addTitle, setAddTitle] = useState('');
    const [addFolder, setAddFolder] = useState('General');
    const [showAdd, setShowAdd] = useState(false);
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

    // The star button in the toolbar and "Bookmark all tabs" write to the
    // same key in other components; pick their changes up without a restart.
    useEffect(() => {
        const refresh = (): void => setBookmarks(loadBookmarks());
        window.addEventListener('focus', refresh);
        window.addEventListener('hoo-bookmarks-changed', refresh);
        return () => {
            window.removeEventListener('focus', refresh);
            window.removeEventListener('hoo-bookmarks-changed', refresh);
        };
    }, []);

    useEffect(() => { saveBookmarks(bookmarks); }, [bookmarks]);

    const addBookmark = (): void => {
        if (!addUrl.trim()) return;
        let url = addUrl.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
        const entry: BookmarkEntry = {
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            title: addTitle.trim() || url,
            url,
            folder: addFolder,
            addedAt: Date.now()
        };
        setBookmarks(prev => [entry, ...prev.filter(b => b.url !== url)]);
        setAddUrl('');
        setAddTitle('');
        setShowAdd(false);
    };

    const remove = (id: string): void => {
        setBookmarks(prev => prev.filter(b => b.id !== id));
        window.dispatchEvent(new Event('hoo-bookmarks-changed'));
    };

    const openBookmark = (url: string): void => {
        if (onNavigate) onNavigate(url);
        else if (window.electronAPI?.navigateTo) void window.electronAPI.navigateTo(url);
    };

    const exportBookmarks = async (): Promise<void> => {
        if (!window.electronAPI?.exportBookmarks) return;
        const result = await window.electronAPI.exportBookmarks(bookmarks);
        setNotice(result.ok
            ? { ok: true, text: `Exported ${bookmarks.length} bookmarks to ${result.path}` }
            : { ok: false, text: result.error || 'Export failed.' });
    };

    const importBookmarks = async (): Promise<void> => {
        if (!window.electronAPI?.importBookmarks) return;
        const result = await window.electronAPI.importBookmarks();
        if (!result.ok || !result.bookmarks?.length) {
            setNotice({ ok: false, text: result.error || 'Nothing imported.' });
            return;
        }
        const seen = new Set(bookmarks.map(b => b.url));
        const fresh = result.bookmarks
            .filter(b => b.url && !seen.has(b.url))
            .map((b, index): BookmarkEntry => ({
                id: `${Date.now().toString(36)}-imp-${index}`,
                title: b.title || b.url,
                url: b.url,
                folder: b.folder || 'General',
                addedAt: b.addedAt || Date.now()
            }));
        setBookmarks(prev => [...fresh, ...prev].slice(0, 500));
        setNotice({ ok: true, text: `Imported ${fresh.length} bookmarks (${result.bookmarks.length - fresh.length} duplicates skipped).` });
    };

    const filtered = bookmarks
        .filter(b => activeFolder === 'All' || b.folder === activeFolder)
        .filter(b => !search || b.title.toLowerCase().includes(search.toLowerCase()) || b.url.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="bookmarks-view">
            <div className="view-sidebar">
                <div className="sidebar-header">
                    <Bookmark size={18} className="header-icon" />
                    <span>Library</span>
                </div>
                <div className="folder-list">
                    {FOLDERS.map(folder => (
                        <div
                            key={folder}
                            className={`folder-item ${activeFolder === folder ? 'active' : ''}`}
                            onClick={() => setActiveFolder(folder)}
                        >
                            <Folder size={14} />
                            <span>{folder}</span>
                            <span className="folder-count">
                                {folder === 'All' ? bookmarks.length : bookmarks.filter(b => b.folder === folder).length}
                            </span>
                        </div>
                    ))}
                </div>

                <button className="add-bookmark-btn" onClick={() => setShowAdd(!showAdd)}>
                    <Plus size={14} /> Add Bookmark
                </button>

                <div className="io-buttons">
                    <button className="io-btn" onClick={() => void importBookmarks()} title="Import a bookmarks HTML file exported from another browser">
                        <Upload size={13} /> Import
                    </button>
                    <button className="io-btn" onClick={() => void exportBookmarks()} title="Save all bookmarks as a standard HTML file">
                        <Download size={13} /> Export
                    </button>
                </div>
            </div>

            <div className="view-content">
                <div className="content-tools">
                    <div className="search-bar">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search bookmarks..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {notice && (
                    <div className={`io-notice ${notice.ok ? 'ok' : 'error'}`} onClick={() => setNotice(null)}>
                        {notice.text}
                    </div>
                )}

                {showAdd && (
                    <div className="add-bookmark-form">
                        <input
                            type="url"
                            placeholder="https://example.com"
                            value={addUrl}
                            onChange={e => setAddUrl(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addBookmark()}
                        />
                        <input
                            type="text"
                            placeholder="Title (optional)"
                            value={addTitle}
                            onChange={e => setAddTitle(e.target.value)}
                        />
                        <select value={addFolder} onChange={e => setAddFolder(e.target.value)}>
                            {FOLDERS.filter(f => f !== 'All').map(f => <option key={f}>{f}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="save-btn" onClick={addBookmark}>Save</button>
                            <button className="cancel-btn" onClick={() => setShowAdd(false)}>Cancel</button>
                        </div>
                    </div>
                )}

                <div className="bookmarks-grid">
                    {filtered.length === 0 && (
                        <div className="bm-empty">
                            <Bookmark size={40} style={{ opacity: 0.2 }} />
                            <p>No bookmarks yet. Add one above, or import from another browser.</p>
                        </div>
                    )}
                    {filtered.map(bookmark => {
                        const initial = siteInitial(bookmark.url);
                        return (
                            <div key={bookmark.id} className="bookmark-card">
                                <div
                                    className="bookmark-favicon"
                                    onClick={() => openBookmark(bookmark.url)}
                                    style={siteInitialStyle(initial)}
                                    title={bookmark.url}
                                >
                                    {initial ? <span className="bookmark-initial">{initial.letter}</span> : <Globe size={20} />}
                                </div>
                                <div className="bookmark-info" onClick={() => openBookmark(bookmark.url)}>
                                    <h3 className="bookmark-title">{bookmark.title}</h3>
                                    <p className="bookmark-url">{bookmark.url}</p>
                                    <span className="bookmark-folder">{bookmark.folder || 'General'}</span>
                                </div>
                                <div className="bookmark-actions">
                                    <button className="bm-action-btn" onClick={() => openBookmark(bookmark.url)} title="Open">
                                        <ExternalLink size={14} />
                                    </button>
                                    <button className="bm-action-btn delete" onClick={() => remove(bookmark.id)} title="Delete">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default BookmarksView;
