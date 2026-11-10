import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BiBot,
    BiUser,
    BiSend,
    BiCog,
    BiShieldQuarter,
    BiLoaderAlt,
    BiX,
    BiCopy,
    BiCheck,
    BiFolder,
    BiCalendar,
    BiLinkExternal
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useToast } from '../ui/Toast';
import styles from './AIAssistantModal.module.css';

// Basic safe markdown parser for tables, pre/code, bold, and links
const renderMarkdown = (text) => {
    if (!text) return '';
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:#1e293b; color:#f8fafc; padding:10px 12px; border-radius:6px; overflow-x:auto; font-size:12px; margin:8px 0;"><code>$1</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9; color:#e11d48; padding:2px 5px; border-radius:4px; font-size:11.5px;">$1</code>');
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3 style="font-size:14px; font-weight:800; margin:10px 0 4px; color:#0f172a;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="font-size:15px; font-weight:800; margin:12px 0 6px; color:#0f172a;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="font-size:16px; font-weight:800; margin:14px 0 8px; color:#0f172a;">$1</h1>');

    // Markdown tables
    if (html.includes('|')) {
        const lines = html.split('\n');
        let inTable = false;
        let tableHtml = '<table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:12px;">';
        const newLines = [];

        for (let line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
                if (!inTable) {
                    inTable = true;
                    tableHtml += '<thead><tr>' + cells.map((c) => `<th style="background:#f1f5f9; padding:6px 8px; border:1px solid #e2e8f0; font-weight:700;">${c}</th>`).join('') + '</tr></thead><tbody>';
                } else if (trimmed.includes('---')) {
                    continue;
                } else {
                    tableHtml += '<tr>' + cells.map((c) => `<td style="padding:6px 8px; border:1px solid #e2e8f0; background:#fff;">${c}</td>`).join('') + '</tr>';
                }
            } else {
                if (inTable) {
                    inTable = false;
                    tableHtml += '</tbody></table>';
                    newLines.push(tableHtml);
                    tableHtml = '<table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:12px;">';
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

const AIAssistantModal = ({ isOpen, onClose, project }) => {
    const navigate = useNavigate();
    const toast = useToast();

    const [messages, setMessages] = useState([]);
    const [inputPrompt, setInputPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeProvider, setActiveProvider] = useState('groq');
    const [activeModel, setActiveModel] = useState('openai/gpt-oss-120b');
    const [conversationId, setConversationId] = useState(0);
    const [copiedIdx, setCopiedIdx] = useState(null);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Load active AI provider settings
    useEffect(() => {
        if (!isOpen) return;

        const fetchSettings = async () => {
            try {
                const res = await apiClient.get('/settings');
                if (res.success && res.data) {
                    const prov = res.data.ai_active_provider || 'groq';
                    setActiveProvider(prov);
                    const pConfig = res.data[`ai_provider_${prov}`];
                    if (pConfig && pConfig.model) {
                        setActiveModel(pConfig.model);
                    }
                }
            } catch (err) {
                console.error('Failed to load AI settings in modal:', err);
            }
        };

        fetchSettings();
    }, [isOpen]);

    // Handle ESC key to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && onClose) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, loading, isOpen]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    // Reset messages when project changes
    useEffect(() => {
        if (project) {
            setMessages([]);
            setConversationId(0);
        }
    }, [project?.id]);

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
                conversation_id: conversationId,
                project_id: project?.id || 0
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
                if (res.data.conversation_id && res.data.conversation_id !== conversationId) {
                    setConversationId(res.data.conversation_id);
                }
            } else {
                toast.error('AI Error', res.message || 'No response generated');
            }
        } catch (err) {
            toast.error('Request Failed', err.message || 'AI request failed');
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

    if (!isOpen) return null;

    const projectTitle = project?.project_title || (project?.id ? `Project #${project.id}` : 'Workspace');
    const projectDueDate = project?.project_due_date ? String(project.project_due_date).slice(0, 10) : null;

    const quickPrompts = [
        { title: '📋 Scope & Notes', prompt: `Summarize the main scope, scope details, and estimator notes for project "${projectTitle}".` },
        { title: '👥 Team & Points', prompt: `Who is working on project "${projectTitle}" and what are their assigned roles and points?` },
        { title: '✏️ Update Status', prompt: `Update status to Completed` },
        { title: '➕ Create Project', prompt: `Create a new project with title (Next Phase for ${projectTitle})` },
        { title: '✉️ Client Email Draft', prompt: `Draft a professional, courteous client status update email for project "${projectTitle}".` },
        { title: '⚠️ Due Date & Risks', prompt: `Analyze the deadline and delivery progress for project "${projectTitle}". Are there any delay flags or blockers?` }
    ];

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.modalHeader}>
                    <div className={styles.headerLeft}>
                        <div className={styles.assistantIcon}>
                            <BiBot />
                        </div>
                        <div className={styles.headerTitleGroup}>
                            <div className={styles.headerTitle}>
                                <span>AI Project Assistant</span>
                                {project && (
                                    <span className={styles.projectBadge} title={projectTitle}>
                                        #{project.id} {projectTitle}
                                    </span>
                                )}
                            </div>
                            <div className={styles.badgesRow}>
                                <div className={styles.modelBadge}>
                                    <span className={styles.modelDot}></span>
                                    <span className={styles.providerName}>{activeProvider}</span>
                                    <span className={styles.modelDivider}>/</span>
                                    <span className={styles.modelName}>{activeModel}</span>
                                </div>
                                <span className={styles.guardrailTag} title="Safety Policy: Permanent Data Deletion is blocked">
                                    <BiShieldQuarter size={13} /> Delete Blocked (Safe Mode)
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.headerRight}>
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                navigate('/settings/ai-models');
                            }}
                            className={styles.iconBtn}
                            title="AI Model & Provider Settings"
                            aria-label="Model Settings"
                        >
                            <BiCog size={17} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className={styles.closeBtn}
                            title="Close AI Assistant"
                            aria-label="Close"
                        >
                            <BiX size={20} />
                        </button>
                    </div>
                </div>

                {/* Quick Project Context Bar */}
                {project && (
                    <div className={styles.contextBar}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <div className={styles.contextItem}>
                                <span>Status:</span>
                                <span className={styles.statusPill}>
                                    {project.project_progress_status || 'Pending'}
                                </span>
                            </div>
                            {projectDueDate && (
                                <div className={styles.contextItem}>
                                    <BiCalendar size={13} color="#64748b" />
                                    <span>Due: <strong>{projectDueDate}</strong></span>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {project.project_init_link && (
                                <a
                                    href={project.project_init_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.linkPill}
                                    title="Open Initial Drawings"
                                >
                                    Initial Link <BiLinkExternal size={10} />
                                </a>
                            )}
                            {project.project_final_link && (
                                <a
                                    href={project.project_final_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.linkPill}
                                    style={{ color: '#059669', background: '#ecfdf5', borderColor: '#a7f3d0' }}
                                    title="Open Final Deliverable"
                                >
                                    Final Link <BiLinkExternal size={10} />
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* Message Thread */}
                <div className={styles.messagesContainer}>
                    {messages.length === 0 ? (
                        <div className={styles.emptyView}>
                            <div className={styles.assistantIcon} style={{ width: '48px', height: '48px', fontSize: '24px' }}>
                                <BiBot />
                            </div>
                            <div className={styles.emptyTitle}>
                                How can I assist with this project?
                            </div>
                            <div className={styles.emptySubtitle}>
                                I have live database access to project #{project?.id || 'this project'}, including scopes, estimator notes, assigned clients, and team member points.
                            </div>

                            <div className={styles.promptGrid}>
                                {quickPrompts.map((qp, idx) => (
                                    <div
                                        key={idx}
                                        className={styles.promptCard}
                                        onClick={() => handleSendMessage(qp.prompt)}
                                    >
                                        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '3px' }}>
                                            {qp.title}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                            "{qp.prompt.slice(0, 75)}..."
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
                                    className={`${styles.messageRow} ${isUser ? styles.userRow : styles.aiRow}`}
                                >
                                    <div className={`${styles.avatar} ${isUser ? styles.userAvatar : styles.aiAvatar}`}>
                                        {isUser ? <BiUser /> : <BiBot />}
                                    </div>
                                    <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.aiBubble}`}>
                                        {isUser ? (
                                            msg.content
                                        ) : (
                                            <div>
                                                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
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
                        <div className={`${styles.messageRow} ${styles.aiRow}`}>
                            <div className={`${styles.avatar} ${styles.aiAvatar}`}>
                                <BiBot />
                            </div>
                            <div className={styles.typingIndicator}>
                                <span className={styles.dotPulse}></span>
                                <span className={styles.dotPulse}></span>
                                <span className={styles.dotPulse}></span>
                                <span style={{ marginLeft: '4px' }}>Analyzing project data...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Bottom Input Area */}
                <div className={styles.inputArea}>
                    <div className={styles.inputWrapper}>
                        <textarea
                            ref={textareaRef}
                            value={inputPrompt}
                            onChange={(e) => setInputPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={`Ask about #${project?.id || 'project'} scope, estimator notes, clients, team... (Enter to send)`}
                            rows={1}
                            className={styles.textarea}
                        />
                        <button
                            type="button"
                            onClick={() => handleSendMessage()}
                            disabled={!inputPrompt.trim() || loading}
                            className={styles.sendBtn}
                            title="Send message"
                        >
                            {loading ? <BiLoaderAlt className="spin" size={15} /> : <BiSend size={15} />}
                        </button>
                    </div>

                    <div className={styles.inputFooter}>
                        <span>🔒 AI operates with live read access under strict safety rules. Data deletion is blocked.</span>
                        <span>Shift + Enter for new line</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIAssistantModal;

