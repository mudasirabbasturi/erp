import React, { useState, useEffect, useRef } from 'react';
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
    BiCalendar,
    BiLinkExternal,
    BiPaperclip,
    BiFile
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useToast } from '../ui/Toast';
import { renderAIMarkdown } from '../../utils/aiMarkdown';
import styles from './AIAssistantModal.module.css';

const AIAssistantModal = ({ isOpen, onClose, project }) => {
    const navigate = useNavigate();
    const toast = useToast();

    const [messages, setMessages] = useState([]);
    const [inputPrompt, setInputPrompt] = useState('');
    const [attachedFiles, setAttachedFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeProvider, setActiveProvider] = useState('groq');
    const [activeModel, setActiveModel] = useState('llama-3.3-70b-versatile');
    const [conversationId, setConversationId] = useState(0);
    const [copiedIdx, setCopiedIdx] = useState(null);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

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

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setAttachedFiles((prev) => [...prev, ...files].slice(0, 5));
        e.target.value = '';
    };

    const removeAttachedFile = (idx) => {
        setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSendMessage = async (customText = null) => {
        const textToSend = (customText !== null ? customText : inputPrompt).trim();
        const filesToSend = customText !== null ? [] : attachedFiles;
        if ((!textToSend && filesToSend.length === 0) || loading) return;

        const fileBadge = filesToSend.length > 0
            ? `\n\n📎 Attached: ${filesToSend.map((f) => f.name).join(', ')}`
            : '';

        const userMsg = {
            id: Date.now(),
            role: 'user',
            content: (textToSend || 'Analyze the attached file(s)') + fileBadge,
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
                fd.append('conversation_id', String(conversationId || 0));
                fd.append('project_id', String(project?.id || 0));
                filesToSend.forEach((file) => fd.append('attachments[]', file));
                payload = fd;
            } else {
                payload = {
                    message: textToSend,
                    conversation_id: conversationId,
                    project_id: project?.id || 0
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
        { title: '📄 Export Project PDF', prompt: `Generate a downloadable PDF dossier report for project #${project?.id || ''} "${projectTitle}".` },
        { title: '👥 Team & Points', prompt: `Who is working on project "${projectTitle}" and what are their assigned roles and points?` },
        { title: '✏️ Update Status', prompt: `Update status of project #${project?.id || ''} to Completed` },
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
                                                <div dangerouslySetInnerHTML={{ __html: renderAIMarkdown(msg.content) }} />
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
                    {attachedFiles.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                            {attachedFiles.map((file, idx) => (
                                <div
                                    key={`${file.name}-${idx}`}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '3px 9px',
                                        borderRadius: '6px',
                                        background: '#eef2ff',
                                        border: '1px solid #c7d2fe',
                                        color: '#3730a3',
                                        fontSize: '11px',
                                        fontWeight: 600
                                    }}
                                >
                                    <BiFile size={13} />
                                    <span>{file.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachedFile(idx)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5', display: 'flex', padding: 0 }}
                                    >
                                        <BiX size={14} />
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
                            title="Attach PDF, Drawing Image, CSV, or Scope Document"
                            style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#475569',
                                cursor: 'pointer',
                                flexShrink: 0
                            }}
                        >
                            <BiPaperclip size={16} />
                        </button>
                        <textarea
                            ref={textareaRef}
                            value={inputPrompt}
                            onChange={(e) => setInputPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={`Ask about #${project?.id || 'project'} scope, export PDF/Excel, or attach a file...`}
                            rows={1}
                            className={styles.textarea}
                        />
                        <button
                            type="button"
                            onClick={() => handleSendMessage()}
                            disabled={(!inputPrompt.trim() && attachedFiles.length === 0) || loading}
                            className={styles.sendBtn}
                            title="Send message"
                        >
                            {loading ? <BiLoaderAlt className="spin" size={15} /> : <BiSend size={15} />}
                        </button>
                    </div>

                    <div className={styles.inputFooter}>
                        <span>🔒 AI operates with live read/export/edit tools under strict safety rules. Delete is blocked.</span>
                        <span>Shift + Enter for new line</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIAssistantModal;

