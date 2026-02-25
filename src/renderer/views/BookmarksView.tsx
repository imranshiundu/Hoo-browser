import React, { useState, useEffect } from 'react';
import './BookmarksView.css';
import { Bookmark, Search, Folder, Globe, Trash2, Plus, ExternalLink } from 'lucide-react';

interface BookmarkEntry {
    id: string;
    title: string;
    url: string;
    folder: string;
    addedAt: number;
}

const FOLDERS = ['All', 'General', 'Work', 'Research', 'Tech', 'Media'];
const STORAGE_KEY = 'zen_bookmarks';

function loadBookmarks(): BookmarkEntry[] {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
}

function saveBookmarks(bm: BookmarkEntry[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bm));
}

const BookmarksView: React.FC = () => {
    const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>(loadBookmarks);
    const [activeFolder, setActiveFolder] = useState('All');
    const [search, setSearch] = useState('');
    const [addUrl, setAddUrl] = useState('');
    const [addTitle, setAddTitle] = useState('');
    const [addFolder, setAddFolder] = useState('General');
    const [showAdd, setShowAdd] = useState(false);

    useEffect(() => { saveBookmarks(bookmarks); }, [bookmarks]);

    const addBookmark = () => {
        if (!addUrl.trim()) return;
        let url = addUrl.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
        const entry: BookmarkEntry = {
            id: Date.now().toString(),
            title: addTitle.trim() || url,
            url,
            folder: addFolder,
            addedAt: Date.now()
        };
        setBookmarks(prev => [entry, ...prev]);
        setAddUrl('');
        setAddTitle('');
        setShowAdd(false);
    };

    const remove = (id: string) => setBookmarks(prev => prev.filter(b => b.id !== id));

    const openBookmark = (url: string) => {
        if (window.electronAPI?.navigateTo) window.electronAPI.navigateTo(url);
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
                            <p>No bookmarks yet. Add one above.</p>
                        </div>
                    )}
                    {filtered.map(bookmark => (
                        <div key={bookmark.id} className="bookmark-card">
                            <div
                                className="bookmark-favicon"
                                onClick={() => openBookmark(bookmark.url)}
                            >
                                <img
                                    src={`https://www.google.com/s2/favicons?sz=32&domain=${new URL(bookmark.url).hostname}`}
                                    alt=""
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                                <Globe size={20} style={{ position: 'absolute', opacity: 0.3 }} />
                            </div>
                            <div className="bookmark-info" onClick={() => openBookmark(bookmark.url)}>
                                <h3 className="bookmark-title">{bookmark.title}</h3>
                                <p className="bookmark-url">{bookmark.url}</p>
                                <span className="bookmark-folder">{bookmark.folder}</span>
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
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BookmarksView;
