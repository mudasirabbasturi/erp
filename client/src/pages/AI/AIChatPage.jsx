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
    BiCopy,
    BiCheck,
    BiPaperclip,
    BiX,
    BiFile
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import { renderAIMarkdown, AI_PROVIDER_MODELS } from '../../utils/aiMarkdown';
import styles from './AIChatPage.module.css';

const QUICK_PROMPTS = [
    { title: '📊 Export Pending to Excel', prompt: 'Export all projects with status Pending into an Excel sheet (.xlsx) with client details' },
    { title: '📄 Generate Bid Summary PDF', prompt: 'Generate an executive bid summary PDF report of all active projects' },
    { title: '🔍 Fuzzy Project Lookup', prompt: 'Find project Canadain 17 or Iron Wolf and summarize full scope, client & team' },
    { title: '⏱️ Team Tracker & Activity', prompt: 'Compare team tracker activity logs, clicks, keystrokes and top apps for yesterday and today' },
    { title: '🎨 Architectural Concept Image', prompt: 'Generate a modern commercial architectural facade rendering with brick and ACP panels' },
    { title: '➕ Create Project Entry', prompt: 'Create a new project with title Commercial Medical Center Takeoff' }
];

const AIChatPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { setCustomBreadcrumbs } = usePageActions();
    const toast = useToast();

    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(0);
    const [messages, setMessages] = useState([]);
    const [inputPrompt, setInputPrompt] = useState('');
    const [attachedFiles, setAttachedFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeProvider, setActiveProvider] = useState('groq');
    const [activeModel, setActiveModel] = useState('llama-3.3-70b-versatile');
    const [providerConfigs, setProviderConfigs] = useState({});
    const [switchingModel, setSwitchingModel] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState(null);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

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
                const prov = res.data.ai_active_provider || 'groq';
                setActiveProvider(prov);
                const cfgs = {};
                Object.keys(AI_PROVIDER_MODELS).forEach((pid) => {
                    cfgs[pid] = res.data[`ai_provider_${pid}`] || {};
                });
                setProviderConfigs(cfgs);
                const pConfig = res.data[`ai_provider_${prov}`];
                if (pConfig && pConfig.model) {
                    setActiveModel(pConfig.model);
                } else {
                    setActiveModel(AI_PROVIDER_MODELS[prov]?.models?.[0] || '');
                }
            }
        } catch (err) {
            console.error('Failed to load AI settings:', err);
        }
    }, []);

    const handleQuickSwitch = async (nextProvider, nextModel = '') => {
        const chosenModel = nextModel || providerConfigs[nextProvider]?.model || AI_PROVIDER_MODELS[nextProvider]?.models?.[0] || '';
        setActiveProvider(nextProvider);
        setActiveModel(chosenModel);
        setSwitchingModel(true);
        try {
            const res = await apiClient.post('/settings/ai/switch-model', {
                provider: nextProvider,
                model: chosenModel
            });
            if (!res.success) {
                toast.error('Switch Failed', res.message || 'Could not switch AI model');
            }
        } catch (err) {
            toast.error('Switch Failed', err.message || 'Could not switch AI model');
        } finally {
            setSwitchingModel(false);
        }
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setAttachedFiles((prev) => [...prev, ...files].slice(0, 5));
        e.target.value = '';
    };

    const removeAttachedFile = (idx) => {
        setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
    };

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
        const textToSend = (customText !== null ? customText : inputPrompt).trim();
        const filesToSend = customText !== null ? [] : attachedFiles;
        if ((!textToSend && filesToSend.length === 0) || loading) return;

        const fileBadgeText = filesToSend.length > 0
            ? `\n\n📎 Attached: ${filesToSend.map((f) => f.name).join(', ')}`
            : '';

        const userMsg = {
            id: Date.now(),
            role: 'user',
            content: (textToSend || 'Analyze the attached file(s)') + fileBadgeText,
            created_at: new Date().toISOString()
        };

        setMessages((prev) => [...prev, userMsg]);
        if (customText === null) {
            setInputPrompt('');
            setAttachedFiles([]);
        }
        setLoading(true);

        try {
            let payload;
            if (filesToSend.length > 0) {
                const fd = new FormData();
                fd.append('message', textToSend);
                fd.append('conversation_id', String(currentConversationId || 0));
                filesToSend.forEach((file) => fd.append('attachments[]', file));
                payload = fd;
            } else {
                payload = {
                    message: textToSend,
                    conversation_id: currentConversationId
                };
            }

            const res = await apiClient.post('/settings/ai/chat', payload);

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
                            <select
                                value={activeProvider}
                                disabled={switchingModel}
                                onChange={(e) => handleQuickSwitch(e.target.value)}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    fontWeight: 800,
                                    fontSize: '12px',
                                    color: '#312e81',
                                    cursor: 'pointer',
                                    outline: 'none'
                                }}
                                title="Switch AI Provider"
                            >
                                {Object.entries(AI_PROVIDER_MODELS).map(([pid, info]) => (
                                    <option key={pid} value={pid}>
                                        {info.label}{providerConfigs[pid]?.has_api_key ? ' ✓' : ''}
                                    </option>
                                ))}
                            </select>
                            <span className={styles.modelDivider}>/</span>
                            <select
                                value={activeModel}
                                disabled={switchingModel}
                                onChange={(e) => handleQuickSwitch(activeProvider, e.target.value)}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    color: '#4f46e5',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    maxWidth: '185px'
                                }}
                                title="Switch Model Version"
                            >
                                {(AI_PROVIDER_MODELS[activeProvider]?.models || [activeModel]).map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                                {activeModel && !(AI_PROVIDER_MODELS[activeProvider]?.models || []).includes(activeModel) && (
                                    <option value={activeModel}>{activeModel}</option>
                                )}
                            </select>
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
                                                    dangerouslySetInnerHTML={{ __html: renderAIMarkdown(msg.content) }}
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
                    {attachedFiles.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                            {attachedFiles.map((file, idx) => (
                                <div
                                    key={`${file.name}-${idx}`}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        background: '#eef2ff',
                                        border: '1px solid #c7d2fe',
                                        color: '#3730a3',
                                        fontSize: '12px',
                                        fontWeight: 600
                                    }}
                                >
                                    <BiFile size={14} />
                                    <span>{file.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachedFile(idx)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5', display: 'flex', padding: 0 }}
                                        title="Remove file"
                                    >
                                        <BiX size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className={styles.inputWrapper}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.csv,.txt,.json,.md,.xml,.tsv"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading}
                            title="Attach PDF, Image, CSV, or Scope Document"
                            style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                width: '36px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#475569',
                                cursor: 'pointer',
                                flexShrink: 0
                            }}
                        >
                            <BiPaperclip size={18} />
                        </button>
                        <textarea
                            ref={textareaRef}
                            value={inputPrompt}
                            onChange={(e) => setInputPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask AI anything, export PDF/Excel reports, generate visuals, or attach a PDF/image... (Enter to send)"
                            rows={1}
                            className={styles.textarea}
                        />
                        <button
                            type="button"
                            onClick={() => handleSendMessage()}
                            disabled={(!inputPrompt.trim() && attachedFiles.length === 0) || loading}
                            className={styles.sendBtn}
                        >
                            {loading ? <BiLoaderAlt className="spin" /> : <BiSend />}
                        </button>
                    </div>

                    <div className={styles.inputFooter}>
                        <span>🔒 Tools active: Fuzzy ERP Search, PDF Reports, Excel (.xlsx) Exports, Image Gen & Multimodal Files. Delete blocked.</span>
                        <span>Shift + Enter for new line</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIChatPage;

