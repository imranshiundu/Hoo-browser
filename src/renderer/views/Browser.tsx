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

const Browser: React.FC<BrowserProps> = ({
    tabs,
    activeTabId,
    onOpenSettings
}) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const activeTab = tabs.find(t => t.id === activeTabId);

    React.useEffect(() => {
        if (!containerRef.current || !window.electronAPI?.updateViewBounds || !activeTab) return;

        const updateBounds = () => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            window.electronAPI?.updateViewBounds({
                x: Math.floor(rect.x),
                y: Math.floor(rect.y),
                width: Math.floor(rect.width),
                height: Math.floor(rect.height)
            });
        };

        const observer = new ResizeObserver(updateBounds);
        observer.observe(containerRef.current);
        updateBounds();
        return () => observer.disconnect();
    }, [activeTabId, activeTab]);

    const handleNavigate = (url: string) => window.electronAPI?.navigateTab?.(activeTabId, url);
    const handleBack = () => window.electronAPI?.goBack(activeTabId);
    const handleForward = () => window.electronAPI?.goForward(activeTabId);
    const handleReload = () => window.electronAPI?.reload(activeTabId);

    return (
        <div className="browser-container">
            <NavigationBar
                tabId={activeTabId}
                url={activeTab?.url || ''}
                onNavigate={handleNavigate}
                onBack={handleBack}
                onForward={handleForward}
                onReload={handleReload}
                onOpenSettings={onOpenSettings}
            />
            <div className="browser-view-container" id="browser-content" ref={containerRef} />
        </div>
    );
};

export default Browser;
