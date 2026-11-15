import React from 'react';
import './DownloadToasts.css';
import { CheckCircle2, Download, FolderOpen, XCircle, X } from 'lucide-react';
import {
    DownloadToast,
    downloadToastKind,
    pruneToasts,
    pushToast,
    toastHeadline
} from '../download-toast-model';

type DownloadRecordLike = {
    id: string;
    filename: string;
    state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
};

/**
 * Bottom-right toast stack for download events. The toolbar popover and the
 * Downloads page already show detail; this just taps the user on the
 * shoulder when a download starts, finishes, or fails — without stealing
 * focus or covering content in the corner where actions live.
 */
const DownloadToasts: React.FC = () => {
    const [toasts, setToasts] = React.useState<DownloadToast[]>([]);
    const lastStateById = React.useRef<Record<string, DownloadRecordLike['state']>>({});

    React.useEffect(() => {
        if (!window.electronAPI?.onDownloadUpdated) return;
        window.electronAPI.onDownloadUpdated((record: DownloadRecordLike) => {
            const previous = lastStateById.current[record.id];
            lastStateById.current[record.id] = record.state;
            const kind = downloadToastKind(record.state, previous);
            if (!kind) return;
            setToasts(current => pushToast(current, record.id, kind, record.filename, Date.now()));
        });
    }, []);

    // Sweep expired toasts twice a second; pushToast already caps the stack.
    React.useEffect(() => {
        const timer = window.setInterval((): void => {
            setToasts(current => {
                const next = pruneToasts(current, Date.now());
                return next.length === current.length ? current : next;
            });
        }, 500);
        return () => window.clearInterval(timer);
    }, []);

    const dismiss = (id: string): void => {
        setToasts(current => current.filter(toast => toast.id !== id));
    };

    if (!toasts.length) return null;

    return (
        <div className="download-toasts" aria-live="polite">
            {toasts.map(toast => (
                <div key={toast.id} className={`download-toast ${toast.kind}`} role="status">
                    <span className="download-toast-icon">
                        {toast.kind === 'completed'
                            ? <CheckCircle2 size={16} />
                            : toast.kind === 'failed'
                                ? <XCircle size={16} />
                                : <Download size={16} />}
                    </span>
                    <div className="download-toast-body">
                        <span className="download-toast-title">{toastHeadline(toast.kind, toast.filename)}</span>
                        {toast.kind !== 'failed' && (
                            <div className="download-toast-actions">
                                {toast.kind === 'completed' && (
                                    <button onClick={() => { void window.electronAPI?.openDownload?.(toast.id); }} title="Open file">Open</button>
                                )}
                                <button onClick={() => { void window.electronAPI?.showDownloadInFolder?.(toast.id); }} title="Show in folder">Folder</button>
                            </div>
                        )}
                    </div>
                    <button className="download-toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss download notification">
                        <X size={13} />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default DownloadToasts;
