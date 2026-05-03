import React from 'react';
import './Browser.css';
import { Tab } from '../types';
import NavigationBar from '../components/NavigationBar';

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
    const activeTab = tabs.find(t => t.id === activeTabId);

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
    }, [activeTabId, activeTab?.url]);

    const handleNavigate = (url: string) => window.electronAPI?.navigateTab?.(activeTabId, url);
    const handleBack = () => window.electronAPI?.goBack(activeTabId);
    const handleForward = () => window.electronAPI?.goForward(activeTabId);
    const handleReload = () => window.electronAPI?.reload(activeTabId);

    return (
        <main className="browser-container">
            <NavigationBar
                tabId={activeTabId}
                url={activeTab?.url || ''}
                onNavigate={handleNavigate}
                onBack={handleBack}
                onForward={handleForward}
                onReload={handleReload}
                onOpenSettings={onOpenSettings}
            />
            <section className="browser-view-container" id="browser-content" ref={containerRef} />
        </main>
    );
};

export default Browser;
