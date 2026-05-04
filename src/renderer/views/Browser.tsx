import React from 'react';
import './Browser.css';
import { Tab } from '../types';
import NavigationBar from '../components/NavigationBar';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';

interface BrowserProps {
    tabs: Tab[];
    activeTabId: string;
    onSwitchTab: (id: string) => void;
    onCloseTab: (id: string) => void;
    onCreateTab: () => void;
    onUpdateTabs: any;
    onOpenSettings?: () => void;
}

const Browser: React.FC<BrowserProps> = ({ tabs, activeTabId, onOpenSettings }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const findInputRef = React.useRef<HTMLInputElement>(null);
    const activeTab = tabs.find(t => t.id === activeTabId);
    const [splitTabId, setSplitTabId] = React.useState<string | null>(null);
    const [findOpen, setFindOpen] = React.useState(false);
    const [findQuery, setFindQuery] = React.useState('');
    const [findStatus, setFindStatus] = React.useState('');

    React.useEffect(() => {
        if (!tabs.some(tab => tab.id === splitTabId)) setSplitTabId(null);
    }, [tabs, splitTabId]);

    React.useEffect(() => {
        if (!containerRef.current || !window.electronAPI?.updateViewBounds || !activeTab) return;

        let raf = 0;
        const updateBounds = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                window.electronAPI?.updateViewBounds({
                    x: Math.max(0, Math.floor(rect.left)),
                    y: Math.max(0, Math.floor(rect.top)),
                    width: Math.max(100, Math.floor(rect.width)),
                    height: Math.max(100, Math.floor(rect.height))
                });
            });
        };

        const observer = new ResizeObserver(updateBounds);
        observer.observe(containerRef.current);
        window.addEventListener('resize', updateBounds);
        updateBounds();
        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
            window.removeEventListener('resize', updateBounds);
        };
    }, [activeTabId, activeTab?.url, splitTabId, findOpen]);

    React.useEffect(() => {
        const handleFindShortcut = (event: KeyboardEvent): void => {
            const mod = event.ctrlKey || event.metaKey;
            if (mod && event.key.toLowerCase() === 'f') {
                event.preventDefault();
                setFindOpen(true);
                requestAnimationFrame(() => findInputRef.current?.focus());
            }
            if (event.key === 'Escape' && findOpen) {
                event.preventDefault();
                closeFind();
            }
        };
        window.addEventListener('keydown', handleFindShortcut);
        return () => window.removeEventListener('keydown', handleFindShortcut);
    }, [findOpen, activeTabId]);

    const runFind = (query: string, forward = true): void => {
        setFindQuery(query);
        if (!query.trim()) {
            setFindStatus('');
            void window.electronAPI?.stopFindInPage?.(activeTabId);
            return;
        }

        if (window.electronAPI?.findInPage) {
            void window.electronAPI.findInPage(activeTabId, query, { forward, findNext: true });
            setFindStatus('Searching');
        } else {
            setFindStatus('Find needs main-process wiring');
        }
    };

    const closeFind = (): void => {
        setFindOpen(false);
        setFindQuery('');
        setFindStatus('');
        void window.electronAPI?.stopFindInPage?.(activeTabId);
    };

    const handleNavigate = (url: string) => window.electronAPI?.navigateTab?.(activeTabId, url);
    const handleBack = () => window.electronAPI?.goBack(activeTabId);
    const handleForward = () => window.electronAPI?.goForward(activeTabId);
    const handleReload = () => window.electronAPI?.reload(activeTabId);
    const handleSplitWithTab = (nextSplitTabId: string) => {
        setSplitTabId(nextSplitTabId);
        void window.electronAPI?.setMosaicView?.(activeTabId, nextSplitTabId);
    };
    const handleClearSplit = () => {
        setSplitTabId(null);
        void window.electronAPI?.clearMosaicView?.();
    };

    return (
        <main className={`browser-container ${splitTabId ? 'split-active' : ''}`}>
            <NavigationBar
                tabId={activeTabId}
                url={activeTab?.url || ''}
                tabs={tabs}
                splitTabId={splitTabId}
                onNavigate={handleNavigate}
                onBack={handleBack}
                onForward={handleForward}
                onReload={handleReload}
                onSplitWithTab={handleSplitWithTab}
                onClearSplit={handleClearSplit}
                onOpenSettings={onOpenSettings}
            />
            {findOpen && (
                <div className="find-in-page-bar">
                    <Search size={15} />
                    <input
                        ref={findInputRef}
                        value={findQuery}
                        onChange={(event) => runFind(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') runFind(findQuery, !event.shiftKey);
                            if (event.key === 'Escape') closeFind();
                        }}
                        placeholder="Find in page"
                        spellCheck={false}
                    />
                    <span>{findStatus}</span>
                    <button onClick={() => runFind(findQuery, false)} title="Previous match"><ChevronUp size={15} /></button>
                    <button onClick={() => runFind(findQuery, true)} title="Next match"><ChevronDown size={15} /></button>
                    <button onClick={closeFind} title="Close find"><X size={15} /></button>
                </div>
            )}
            <section className="browser-view-container" id="browser-content" ref={containerRef}>
                {splitTabId && <div className="split-screen-gutter" aria-hidden="true" />}
            </section>
        </main>
    );
};

export default Browser;
