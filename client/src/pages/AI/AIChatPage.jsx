import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BiBot,
    BiUser,
    BiSend,
    BiPlus,
    BiTrash,
    BiCog,
    BiShieldQuarter,
    BiLoaderAlt,
    BiSearch,
    BiLineChart,
    BiFolder,
    BiCopy,
    BiCheck
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import styles from './AIChatPage.module.css';

const QUICK_PROMPTS = [
    { title: '➕ Create New Project', prompt: 'Create a new project with title (Commercial Medical Center Takeoff)' },
    { title: '✏️ Update Project Status', prompt: 'Update project status to Completed' },
    { title: '🔍 Find Project by Name', prompt: 'Find project with name Iron Wolf and show details' },
    { title: '📊 Active Projects Summary', prompt: 'Give me a summary of all active projects in the system' },
    { title: '⏱️ Compare Team Tracker', prompt: 'Compare team tracker records and activity report' },
    { title: '👥 Staff Workload & Points', prompt: 'Analyze recent staff activity, idle hours, and team member points' }
];

// Helper to format basic markdown to safe HTML
const renderMarkdown = (text) => {
    if (!text) return '';
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:#1e293b; color:#f8fafc; padding:12px; border-radius:8px; overflow-x:auto;"><code>$1</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9; color:#e11d48; padding:2px 6px; border-radius:4px; font-size:12px;">$1</code>');
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3 style="font-size:16px; font-weight:800; margin:12px 0 6px;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="font-size:18px; font-weight:800; margin:14px 0 8px;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="font-size:20px; font-weight:800; margin:16px 0 10px;">$1</h1>');

    // Simple table parsing
    if (html.includes('|')) {
        const lines = html.split('\n');
        let inTable = false;
        let tableHtml = '<table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:12.5px;">';
        const newLines = [];

        for (let line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
                if (!inTable) {
                    inTable = true;
                    tableHtml += '<thead><tr>' + cells.map(c => `<th style="background:#f1f5f9; padding:8px 10px; border:1px solid #e2e8f0; font-weight:700;">${c}</th>`).join('') + '</tr></thead><tbody>';
                } else if (trimmed.includes('---')) {
                    // separator line, skip
                    continue;
                } else {
                    tableHtml += '<tr>' + cells.map(c => `<td style="padding:8px 10px; border:1px solid #e2e8f0; background:#fff;">${c}</td>`).join('') + '</tr>';
                }
            } else {
                if (inTable) {
                    inTable = false;
                    tableHtml += '</tbody></table>';
                    newLines.push(tableHtml);
                    tableHtml = '<table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:12.5px;">';
                }
                newLines.push(line);
            }
        }
        if (inTable) {
            tableHtml += '</tbody></table>';
            newLines.push(tableHtml);
        }
        html = newLines.join('\n');
    }

    // Line breaks
    html = html.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');
    return html;
};

const AIChatPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { setCustomBreadcrumbs } = usePageActions();
    const toast = useToast();

    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(0);
    const [messages, setMessages] = useState([]);
    const [inputPrompt, setInputPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeProvider, setActiveProvider] = useState('gemini');
    const [activeModel, setActiveModel] = useState('gemini-1.5-pro');
    const [copiedIdx, setCopiedIdx] = useState(null);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadConversations = useCallback(async () => {
        try {
            const res = await apiClient.get('/settings/ai/conversations');
            if (res.success && Array.isArray(res.data)) {
                setConversations(res.data);
            }
        } catch (err) {
            console.error('Failed to load conversations:', err);
        }
    }, []);

    const loadSettings = useCallback(async () => {
        try {
            const res = await apiClient.get('/settings');
            if (res.success && res.data) {
                const prov = res.data.ai_active_provider || 'gemini';
                setActiveProvider(prov);
                const pConfig = res.data[`ai_provider_${prov}`];
                if (pConfig && pConfig.model) {
                    setActiveModel(pConfig.model);
                }
            }
        } catch (err) {
            console.error('Failed to load AI settings:', err);
        }
    }, []);

    const selectConversation = useCallback(async (convId) => {
        setCurrentConversationId(convId);
        if (convId <= 0) {
            setMessages([]);
            return;
        }

        try {
            const res = await apiClient.get(`/settings/ai/messages?id=${convId}`);
            if (res.success && Array.isArray(res.data)) {
                setMessages(res.data);
            }
        } catch (err) {
            toast.error('Error', 'Failed to load conversation history');
        }
    }, [toast]);

    useEffect(() => {
        setCustomBreadcrumbs([
            { label: 'AI Assistant', to: '/ai-assistant' }
        ]);
        loadConversations();
        loadSettings();
    }, [setCustomBreadcrumbs, loadConversations, loadSettings]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    const handleSendMessage = async (customText = null) => {
        const textToSend = customText || inputPrompt;
        if (!textToSend.trim() || loading) return;

        const userMsg = {
            id: Date.now(),
            role: 'user',
            content: textToSend,
            created_at: new Date().toISOString()
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputPrompt('');
        setLoading(true);

        try {
            const res = await apiClient.post('/settings/ai/chat', {
                message: textToSend,
                conversation_id: currentConversationId
            });

            if (res.success && res.data) {
                const aiMsg = {
                    id: Date.now() + 1,
                    role: 'assistant',
                    content: res.data.reply,
                    model: res.data.model,
                    created_at: new Date().toISOString()
                };
                setMessages((prev) => [...prev, aiMsg]);

                if (res.data.conversation_id && res.data.conversation_id !== currentConversationId) {
                    setCurrentConversationId(res.data.conversation_id);
                    loadConversations();
                }
            } else {
                toast.error('AI Error', res.message || 'No response generated');
            }
        } catch (err) {
            toast.error('Error', err.message || 'AI request failed');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleCopy = (text, idx) => {
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    const handleDeleteConversation = async (e, convId) => {
        e.stopPropagation();
        try {
            const res = await apiClient.post('/settings/ai/conversations/clear', { id: convId });
            if (res.success) {
                if (currentConversationId === convId) {
                    setCurrentConversationId(0);
                    setMessages([]);
                }
                loadConversations();
            }
        } catch (err) {
            toast.error('Error', 'Failed to delete conversation');
        }
    };

    return (
        <div className={styles.chatStudio}>
            {/* Sidebar with History */}
            <div className={styles.chatSidebar}>
                <div className={styles.sidebarHeader}>
                    <button
                        type="button"
                        onClick={() => selectConversation(0)}
                        className={styles.newChatBtn}
                    >
                        <BiPlus size={18} /> New Conversation
                    </button>
                </div>

                <div className={styles.conversationsList}>
                    {conversations.length > 0 ? (
                        conversations.map((c) => (
                            <div
                                key={c.id}
                                className={`${styles.conversationItem} ${currentConversationId === c.id ? styles.conversationItemActive : ''}`}
                                onClick={() => selectConversation(c.id)}
                            >
                                <span className={styles.conversationTitle}>{c.title || `Chat #${c.id}`}</span>
                                <button
                                    type="button"
                                    onClick={(e) => handleDeleteConversation(e, c.id)}
                                    className={styles.deleteConvBtn}
                                    title="Delete chat"
                                >
                                    <BiTrash size={14} />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8', fontSize: '12px' }}>
                            No saved chats yet.
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat Interface */}
            <div className={styles.chatMain}>
                {/* Header */}
                <div className={styles.chatHeader}>
                    <div className={styles.chatHeaderLeft}>
                        <div className={styles.modelBadge}>
                            <span className={styles.modelDot}></span>
                            <span className={styles.providerName}>{activeProvider}</span>
                            <span className={styles.modelDivider}>/</span>
                            <span className={styles.modelName}>{activeModel}</span>
                        </div>
                        <span className={styles.guardrailTag} title="Safety Policy: Permanent Data Deletion is blocked">
                            <BiShieldQuarter size={14} /> Delete Blocked (Safe Mode)
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate('/settings/ai-models')}
                        className={styles.headerSettingsBtn}
                        title="AI Model & Provider Settings"
                        aria-label="Model Settings"
                    >
                        <BiCog size={18} />
                    </button>
                </div>

                {/* Messages Thread */}
                <div className={styles.chatMessages}>
                    {messages.length === 0 ? (
                        <div className={styles.welcomeBox}>
                            <div className={styles.welcomeIcon}>
                                <BiBot />
                            </div>
                            <h2 className={styles.welcomeTitle}>How can I help you today?</h2>
                            <div className={styles.welcomeSub}>
                                I am connected to your ERP database. Ask me to find projects, query staff activity records, or summarize deliverables.
                            </div>

                            <div className={styles.promptChips}>
                                {QUICK_PROMPTS.map((qp, idx) => (
                                    <div
                                        key={idx}
                                        className={styles.promptChip}
                                        onClick={() => handleSendMessage(qp.prompt)}
                                    >
                                        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
                                            {qp.title}
                                        </div>
                                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                            "{qp.prompt}"
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const isUser = msg.role === 'user';
                            return (
                                <div
                                    key={msg.id || idx}
                                    className={`${styles.messageRow} ${isUser ? styles.userMessageRow : styles.aiMessageRow}`}
                                >
                                    <div className={`${styles.avatar} ${isUser ? styles.userAvatar : styles.aiAvatar}`}>
                                        {isUser ? <BiUser /> : <BiBot />}
                                    </div>
                                    <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.aiBubble}`}>
                                        {isUser ? (
                                            msg.content
                                        ) : (
                                            <div>
                                                <div
                                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                                />
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(msg.content, idx)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: '#94a3b8',
                                                            fontSize: '11px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        {copiedIdx === idx ? <BiCheck color="#10b981" /> : <BiCopy />}
                                                        {copiedIdx === idx ? 'Copied' : 'Copy'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {loading && (
                        <div className={`${styles.messageRow} ${styles.aiMessageRow}`}>
                            <div className={`${styles.avatar} ${styles.aiAvatar}`}>
                                <BiBot />
                            </div>
                            <div className={styles.typingIndicator}>
                                <span className={styles.dotPulse}></span>
                                <span className={styles.dotPulse}></span>
                                <span className={styles.dotPulse}></span>
                                <span style={{ marginLeft: '4px' }}>Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Bottom Input Box */}
                <div className={styles.chatInputArea}>
                    <div className={styles.inputWrapper}>
                        <textarea
                            ref={textareaRef}
                            value={inputPrompt}
                            onChange={(e) => setInputPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask AI anything about your projects, tracker records, or team metrics... (Press Enter to send)"
                            rows={1}
                            className={styles.textarea}
                        />
                        <button
                            type="button"
                            onClick={() => handleSendMessage()}
                            disabled={!inputPrompt.trim() || loading}
                            className={styles.sendBtn}
                        >
                            {loading ? <BiLoaderAlt className="spin" /> : <BiSend />}
                        </button>
                    </div>

                    <div className={styles.inputFooter}>
                        <span>🔒 AI operates under Read/Add/Edit boundaries. Data deletion is permanently disabled.</span>
                        <span>Shift + Enter for new line</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIChatPage;

