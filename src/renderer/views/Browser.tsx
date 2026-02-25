import React from 'react';
import './Browser.css';
import { Globe } from 'lucide-react';
import { Tab } from '../types';
import NavigationBar from '../components/NavigationBar';
import AppHeader from '../components/AppHeader';

interface BrowserProps {
    tabs: Tab[];
    activeTabId: string;
    onSwitchTab: (id: string) => void;
    onCloseTab: (id: string) => void;
    onCreateTab: () => void;
    onUpdateTabs: any;
}

const Browser: React.FC<BrowserProps> = ({
    tabs,
    activeTabId,
    onSwitchTab,
    onCloseTab,
    onCreateTab,
    onUpdateTabs
}) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const activeTab = tabs.find(t => t.id === activeTabId);

    React.useEffect(() => {
        if (!containerRef.current || !window.electronAPI?.updateViewBounds || !activeTab) return;

        const updateBounds = () => {
            if (activeTab.type !== 'browser') return;
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                window.electronAPI?.updateViewBounds({
                    x: Math.floor(rect.x),
                    y: Math.floor(rect.y),
                    width: Math.floor(rect.width),
                    height: Math.floor(rect.height)
                });
            }
        };

        const observer = new ResizeObserver(updateBounds);
        observer.observe(containerRef.current);

        // Initial sync
        updateBounds();

        return () => observer.disconnect();
    }, [activeTabId, activeTab]);

    const handleNavigate = (url: string) => {
        if (window.electronAPI?.navigateTab) {
            window.electronAPI.navigateTab(activeTabId, url);
        }
    };

    const handleBack = () => window.electronAPI?.goBack(activeTabId);
    const handleForward = () => window.electronAPI?.goForward(activeTabId);
    const handleReload = () => window.electronAPI?.reload(activeTabId);

    return (
        <div className="browser-container">
            {activeTab && activeTab.isApp && (
                <AppHeader
                    name={activeTab.title}
                    onBack={handleBack}
                    onReload={handleReload}
                    onClose={() => onCloseTab(activeTabId)}
                />
            )}
            {activeTab && !activeTab.isApp && (
                <NavigationBar
                    tabId={activeTabId}
                    url={activeTab.url || ''}
                    onNavigate={handleNavigate}
                    onBack={handleBack}
                    onForward={handleForward}
                    onReload={handleReload}
                />
            )}

            <div className="browser-view-container" id="browser-content" ref={containerRef}>
                {tabs.length === 0 && (
                    <div className="empty-state">
                        <Globe size={64} color="var(--accent-green)" />
                        <h2>No tabs open</h2>
                        <p>Click + in the sidebar to create a new tab</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Browser;
