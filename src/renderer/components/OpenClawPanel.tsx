import React, { useState, useEffect, useRef, useCallback } from 'react';
import './OpenClawPanel.css';
import { Bot, Send, RefreshCw, X, Loader, Zap, FileText, Globe, AlertCircle } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

interface OpenClawPanelProps {
    activeTabUrl?: string;
    activeTabTitle?: string;
    onClose: () => void;
}

const GATEWAY_URL = 'http://localhost:3008';

const OpenClawPanel: React.FC<OpenClawPanelProps> = ({ activeTabUrl, activeTabTitle, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: "👋 Hi! I'm **OpenClaw**, your AI co-pilot. I can see the page you're browsing and help you summarize, analyze, or answer questions about it. What would you like to know?",
            timestamp: Date.now()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [gatewayStatus, setGatewayStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [isStarting, setIsStarting] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const checkGatewayStatus = useCallback(async () => {
        try {
            const res = await fetch(`${GATEWAY_URL}/health`, { signal: AbortSignal.timeout(2000) });
            setGatewayStatus(res.ok ? 'online' : 'offline');
        } catch {
            setGatewayStatus('offline');
        }
    }, []);

    useEffect(() => {
        checkGatewayStatus();
        const interval = setInterval(checkGatewayStatus, 10000);
        return () => clearInterval(interval);
    }, [checkGatewayStatus]);

    // When the active tab changes, inject context
    useEffect(() => {
        if (activeTabUrl && activeTabUrl !== 'about:blank') {
            setMessages(prev => [...prev, {
                role: 'system',
                content: `📄 Context updated: Now viewing **${activeTabTitle || activeTabUrl}** (${activeTabUrl})`,
                timestamp: Date.now()
            }]);
        }
    }, [activeTabUrl]);

    const startOpenClaw = async () => {
        setIsStarting(true);
        try {
            await window.electronAPI?.startOpenClaw?.();
            setTimeout(() => {
                checkGatewayStatus();
                setIsStarting(false);
            }, 5000);
        } catch (e) {
            console.error(e);
            setIsStarting(false);
        }
    };

    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        const userMessage: Message = { role: 'user', content: trimmed, timestamp: Date.now() };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        // Build context-aware system prompt
        const systemPrompt = activeTabUrl && activeTabUrl !== 'about:blank'
            ? `You are OpenClaw, an AI assistant built into the Zen Browser. The user is currently viewing: "${activeTabTitle}" at ${activeTabUrl}. Help them with questions about this page or anything else.`
            : `You are OpenClaw, an AI assistant built into the Zen Browser. Help the user with their questions.`;

        try {
            if (gatewayStatus === 'online') {
                // Talk to real OpenClaw gateway
                const res = await fetch(`${GATEWAY_URL}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system: systemPrompt,
                        messages: [...messages.filter(m => m.role !== 'system'), userMessage].map(m => ({
                            role: m.role === 'system' ? 'user' : m.role,
                            content: m.content
                        }))
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    const reply = data?.content || data?.message || data?.choices?.[0]?.message?.content || 'I received your message but got an unexpected response format.';
                    setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }]);
                } else {
                    throw new Error(`Gateway returned ${res.status}`);
                }
            } else {
                // Fallback: show offline message
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '⚠️ OpenClaw gateway is offline. Please start it using the button above, then try again.',
                    timestamp: Date.now()
                }]);
            }
        } catch (error) {
            console.error('[OpenClaw]', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ Could not reach OpenClaw: ${error}. Make sure the gateway is running.`,
                timestamp: Date.now()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const quickActions = [
        { label: 'Summarize page', action: () => setInput('Summarize the page I am currently viewing.') },
        { label: 'Key points', action: () => setInput('What are the key points on this page?') },
        { label: 'Explain simply', action: () => setInput('Explain what this page is about in simple terms.') },
    ];

    const renderMessageContent = (content: string) => {
        // Simple markdown rendering: bold
        return content
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br/>');
    };

    return (
        <div className="openclaw-panel">
            {/* Header */}
            <div className="openclaw-header">
                <div className="openclaw-header-left">
                    <div className={`openclaw-status-dot ${gatewayStatus}`} />
                    <Bot size={18} />
                    <span className="openclaw-title">OpenClaw AI</span>
                </div>
                <div className="openclaw-header-right">
                    <button
                        className="openclaw-icon-btn"
                        onClick={checkGatewayStatus}
                        title="Refresh status"
                    >
                        <RefreshCw size={14} />
                    </button>
                    <button className="openclaw-icon-btn" onClick={onClose} title="Close">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Gateway Status Banner */}
            {gatewayStatus === 'offline' && (
                <div className="openclaw-offline-banner">
                    <AlertCircle size={14} />
                    <span>Gateway offline</span>
                    <button
                        className="openclaw-start-btn"
                        onClick={startOpenClaw}
                        disabled={isStarting}
                    >
                        {isStarting ? <><Loader size={12} className="spin" /> Starting...</> : <><Zap size={12} /> Start</>}
                    </button>
                </div>
            )}

            {/* Current Page Context */}
            {activeTabUrl && activeTabUrl !== 'about:blank' && (
                <div className="openclaw-context-bar">
                    <Globe size={12} />
                    <span className="openclaw-context-url" title={activeTabUrl}>
                        {activeTabTitle || activeTabUrl}
                    </span>
                    <FileText size={12} />
                </div>
            )}

            {/* Quick Actions */}
            {activeTabUrl && activeTabUrl !== 'about:blank' && (
                <div className="openclaw-quick-actions">
                    {quickActions.map((qa, i) => (
                        <button key={i} className="openclaw-quick-btn" onClick={qa.action}>
                            {qa.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Messages */}
            <div className="openclaw-messages">
                {messages.map((msg, i) => (
                    <div key={i} className={`openclaw-message ${msg.role}`}>
                        {msg.role === 'system' ? (
                            <div className="openclaw-system-msg"
                                dangerouslySetInnerHTML={{ __html: renderMessageContent(msg.content) }}
                            />
                        ) : (
                            <div className="openclaw-bubble">
                                <div
                                    className="openclaw-bubble-content"
                                    dangerouslySetInnerHTML={{ __html: renderMessageContent(msg.content) }}
                                />
                                <div className="openclaw-bubble-time">
                                    {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="openclaw-message assistant">
                        <div className="openclaw-bubble">
                            <div className="openclaw-typing">
                                <span /><span /><span />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="openclaw-input-area">
                <textarea
                    ref={inputRef}
                    className="openclaw-input"
                    placeholder="Ask OpenClaw about this page..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    disabled={isLoading}
                />
                <button
                    className="openclaw-send-btn"
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    title="Send (Enter)"
                >
                    {isLoading ? <Loader size={16} className="spin" /> : <Send size={16} />}
                </button>
            </div>
        </div>
    );
};

export default OpenClawPanel;
