import React from 'react';
import './PermissionPrompt.css';
import { Camera, MapPin, Bell, Clipboard, Music, MousePointer, Maximize, Monitor, ShieldQuestion, X } from 'lucide-react';

const PERMISSION_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
    'media': Camera,
    'geolocation': MapPin,
    'notifications': Bell,
    'clipboard-sanitized-read': Clipboard,
    'midi': Music,
    'pointerLock': MousePointer,
    'fullscreen': Maximize,
    'display-capture': Monitor
};

export interface PendingPermissionRequest {
    requestId: string;
    permission: string;
    origin: string;
    description: string;
}

interface PermissionPromptProps {
    request: PendingPermissionRequest | null;
    onResolve: (requestId: string, decision: 'allow' | 'block', remember: boolean) => void;
    onDismiss: (requestId: string) => void;
}

/**
 * The site-permission bubble. Every real browser shows one of these the
 * first time a page asks for the camera, microphone, location, or similar;
 * Hoo used to answer silently, which made video calls and notifications
 * look broken. One prompt at a time; queued requests wait their turn.
 */
const PermissionPrompt: React.FC<PermissionPromptProps> = ({ request, onResolve, onDismiss }) => {
    const [remember, setRemember] = React.useState(true);
    React.useEffect(() => setRemember(true), [request?.requestId]);

    if (!request) return null;
    const Icon = PERMISSION_ICONS[request.permission] || ShieldQuestion;
    const host = request.origin.replace(/^https?:\/\//, '');

    return (
        <div className="permission-prompt" role="alertdialog" aria-label="Site permission request">
            <div className="permission-head">
                <span className="permission-icon"><Icon size={17} /></span>
                <div className="permission-copy">
                    <strong>{host}</strong> wants to {request.description}
                </div>
                <button className="permission-dismiss" onClick={() => onDismiss(request.requestId)} aria-label="Dismiss" title="Ask again next time">
                    <X size={14} />
                </button>
            </div>
            <label className="permission-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>Remember this decision for {host}</span>
            </label>
            <div className="permission-actions">
                <button className="permission-btn allow" onClick={() => onResolve(request.requestId, 'allow', remember)}>Allow</button>
                <button className="permission-btn block" onClick={() => onResolve(request.requestId, 'block', remember)}>Block</button>
            </div>
        </div>
    );
};

export default PermissionPrompt;
