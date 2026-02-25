import React from 'react';
import './Sidebar.css';
import {
    Home,
    LayoutDashboard,
    Rss,
    Shield,
    Bookmark,
    Puzzle,
    Settings,
    LogOut,
    Globe,
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    LayoutGrid,
    Bot
} from 'lucide-react';
import { Tab } from '../types';

interface SidebarProps {
    activeTabId: string;
    tabs: Tab[];
    collapsed?: boolean;
    user?: any;
    onToggleCollapse?: () => void;
    onSwitchTab: (id: string) => void;
    onCloseTab: (id: string) => void;
    onCreateTab: () => void;
    onSettingsClick: () => void;
    onLogin: () => void;
    onLogout: () => void;
    openClawVisible?: boolean;
    onToggleOpenClaw?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    activeTabId,
    tabs,
    collapsed = false,
    user,
    onToggleCollapse,
    onSwitchTab,
    onCloseTab,
    onCreateTab,
    onSettingsClick,
    onLogin,
    onLogout,
    openClawVisible,
    onToggleOpenClaw
}) => {
    const pinnedTabs = tabs.filter(t => t.type !== 'browser');
    const dynamicTabs = tabs.filter(t => t.type === 'browser');

    const menuItems = [
        { id: 'apps', icon: LayoutGrid, label: 'Web Apps' },
        { id: 'rss', icon: Rss, label: 'Updates', badge: '12' },
        { id: 'privacy', icon: Shield, label: 'Security' },
        { id: 'bookmarks', icon: Bookmark, label: 'Library' },
        { id: 'extensions', icon: Puzzle, label: 'Plugins' },
        { id: 'openclaw', icon: Bot, label: 'OpenClaw AI', action: 'toggle-openclaw' }
    ];

    return (
        <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="logo-wordmark">
                        <span className="logo-z">Z</span>
                        {!collapsed && <span className="logo-en">en</span>}
                    </div>
                </div>
            </div>

            <button
                className="collapse-toggle"
                onClick={onToggleCollapse}
                title={collapsed ? "Expand" : "Collapse"}
            >
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            <nav className="sidebar-nav">
                {/* Pinned Apps */}
                <div className="pinned-section">
                    {pinnedTabs.map(tab => {
                        const Icon = tab.id === 'home' ? Home : LayoutDashboard;
                        return (
                            <button
                                key={tab.id}
                                className={`nav-item pinned ${activeTabId === tab.id ? 'active' : ''}`}
                                onClick={() => onSwitchTab(tab.id)}
                                title={collapsed ? tab.title : ''}
                            >
                                <Icon size={20} className="nav-icon" />
                                {!collapsed && <span className="nav-label">{tab.title}</span>}
                            </button>
                        );
                    })}
                </div>

                <div className="sidebar-divider" />

                <div className="sidebar-divider" />

                {/* Global Navigation */}
                <div className="utility-section">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            className={`nav-item utility ${activeTabId === item.id && !item.action ? 'active' : ''} ${item.action === 'toggle-openclaw' && openClawVisible ? 'active' : ''}`}
                            onClick={() => {
                                if (item.action === 'toggle-openclaw' && onToggleOpenClaw) {
                                    onToggleOpenClaw();
                                } else {
                                    onSwitchTab(item.id);
                                }
                            }}
                            title={collapsed ? item.label : ''}
                        >
                            <item.icon size={18} className="nav-icon" />
                            {!collapsed && <span className="nav-label">{item.label}</span>}
                        </button>
                    ))}
                </div>
            </nav>

            <div className="sidebar-footer">
                <div className="user-profile-section">
                    {user ? (
                        <div className="user-info" onClick={onLogout} title={collapsed ? `Log out ${user.name}` : "Click to Logout"}>
                            <img src={user.picture} alt={user.name} className="user-avatar" />
                            {!collapsed && (
                                <div className="user-text">
                                    <span className="user-name">{user.name}</span>
                                    <span className="user-email">{user.email}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button className="login-btn" onClick={onLogin} title={collapsed ? "Sign In" : ""}>
                            <Globe size={20} />
                            {!collapsed && <span>Sign In</span>}
                        </button>
                    )}
                </div>

                <div className="footer-actions">
                    <button className="footer-btn" onClick={onSettingsClick} title={collapsed ? "Settings" : ''}>
                        <Settings size={20} />
                        {!collapsed && <span>Preferences</span>}
                    </button>
                    <button className="footer-btn logout" title={collapsed ? "Safe Exit" : ''}>
                        <LogOut size={20} />
                        {!collapsed && <span>Safe Exit</span>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
