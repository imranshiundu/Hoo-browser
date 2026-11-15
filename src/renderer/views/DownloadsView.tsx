import React from 'react';
import './DownloadsView.css';
import { Download, FolderOpen, ExternalLink, Trash2, FileWarning, Loader } from 'lucide-react';
import { DownloadEntry, downloadStatusText, upsertDownloadEntry } from '../download-model';

const DownloadsView: React.FC = () => {
    const [entries, setEntries] = React.useState<DownloadEntry[]>([]);
    const [loaded, setLoaded] = React.useState(false);

    React.useEffect(() => {
        const load = async (): Promise<void> => {
            try {
                const records = await window.electronAPI?.getDownloads?.();
                if (Array.isArray(records)) setEntries(records);
            } catch { /* empty list on failure */ }
            setLoaded(true);
        };
        void load();
        window.electronAPI?.onDownloadUpdated?.((record: DownloadEntry) => {
            setEntries(prev => upsertDownloadEntry(prev, record));
        });
    }, []);

    const openFile = (entry: DownloadEntry): void => { void window.electronAPI?.openDownload?.(entry.id); };
    const showInFolder = (entry: DownloadEntry): void => { void window.electronAPI?.showDownloadInFolder?.(entry.id); };
    const clearAll = (): void => {
        void window.electronAPI?.clearDownloads?.();
        setEntries([]);
    };

    return (
        <div className="downloads-view">
            <div className="view-header">
                <div className="header-left">
                    <Download size={32} className="header-icon" />
                    <div>
                        <h1 className="view-title">Downloads</h1>
                        <p className="view-subtitle">
                            {entries.length ? `${entries.length} download${entries.length === 1 ? '' : 's'} in this profile` : 'Files you save land here'}
                        </p>
                    </div>
                </div>
                {entries.length > 0 && (
                    <button className="downloads-clear-btn" onClick={clearAll} title="Forget the download list (files on disk are kept)">
                        <Trash2 size={16} /> Clear list
                    </button>
                )}
            </div>

            {!loaded ? (
                <div className="downloads-empty"><Loader size={22} className="spin" /> Loading downloads…</div>
            ) : entries.length === 0 ? (
                <div className="downloads-empty">
                    <Download size={28} />
                    <p>No downloads yet.</p>
                    <span>Files you save from any page appear here with their progress and location.</span>
                </div>
            ) : (
                <div className="download-list">
                    {entries.map(entry => (
                        <div key={entry.id} className={`download-row ${entry.state}`}>
                            <div className={`download-file-icon ${entry.danger ? 'risky' : ''}`}>
                                {entry.danger ? <FileWarning size={20} /> : <Download size={20} />}
                            </div>
                            <div className="download-info">
                                <span className="download-filename" title={entry.filename}>{entry.filename}</span>
                                <span className="download-url" title={entry.url}>{entry.url.replace(/^https?:\/\//, '').slice(0, 80)}</span>
                                {entry.danger && <span className="download-danger-hint">{entry.danger}</span>}
                            </div>
                            <div className="download-meta">
                                {entry.state === 'progressing' && <Loader size={13} className="spin" />}
                                <span className="download-state">{downloadStatusText(entry)}</span>
                            </div>
                            <div className="download-actions">
                                {entry.state === 'completed' && (
                                    <button className="download-action-btn" onClick={() => openFile(entry)} title="Open file">
                                        <ExternalLink size={14} /> Open
                                    </button>
                                )}
                                <button className="download-action-btn" onClick={() => showInFolder(entry)} title="Show in folder">
                                    <FolderOpen size={14} /> Folder
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DownloadsView;
