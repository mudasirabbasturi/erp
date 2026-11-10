import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BiBot,
    BiCheck,
    BiLock,
    BiShieldQuarter,
    BiSave,
    BiMessageSquareDots,
    BiKey,
    BiSliderAlt,
    BiCheckCircle,
    BiErrorCircle,
    BiLoaderAlt,
    BiRadioCircleMarked,
    BiRadioCircle,
    BiShow,
    BiHide
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import styles from './AISettings.module.css';

const PROVIDER_METADATA = [
    {
        id: 'gemini',
        name: 'Google Gemini',
        logoClass: styles.logoGemini,
        badge: 'Gemini 1.5 / 2.0',
        desc: 'Advanced multimodal reasoning, large context windows, fast inference.',
        defaultModel: 'gemini-1.5-pro',
        models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash']
    },
    {
        id: 'claude',
        name: 'Anthropic Claude',
        logoClass: styles.logoClaude,
        badge: 'Claude 3.5 Sonnet',
        desc: 'High precision code analysis, nuanced context handling, executive reports.',
        defaultModel: 'claude-3-5-sonnet-20241022',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']
    },
    {
        id: 'chatgpt',
        name: 'OpenAI ChatGPT',
        logoClass: styles.logoChatgpt,
        badge: 'GPT-4o / GPT-4',
        desc: 'Flagship general reasoning, function calling, deep tabular data analysis.',
        defaultModel: 'gpt-4o',
        models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'gpt-4-turbo']
    },
    {
        id: 'deepseek',
        name: 'DeepSeek AI',
        logoClass: styles.logoDeepseek,
        badge: 'DeepSeek Chat / R1',
        desc: 'Ultra cost-effective reasoning, deep mathematical calculation, logic flows.',
        defaultModel: 'deepseek-chat',
        models: ['deepseek-chat', 'deepseek-reasoner']
    },
    {
        id: 'groq',
        name: 'Groq / Grok (Ultra-Fast)',
        logoClass: styles.logoGroq,
        badge: 'Instant Inference (Free)',
        desc: 'World fastest Llama & GPT-OSS engine with free tier and instant responses.',
        defaultModel: 'openai/gpt-oss-120b',
        models: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'allam-2-7b']
    }
];

const DEFAULT_PROVIDER_CONFIGS = {
    gemini: { enabled: true, api_key: '', model: 'gemini-1.5-pro', temperature: 0.7, max_tokens: 4096 },
    claude: { enabled: true, api_key: '', model: 'claude-3-5-sonnet-20241022', temperature: 0.7, max_tokens: 4096 },
    chatgpt: { enabled: true, api_key: '', model: 'gpt-4o', temperature: 0.7, max_tokens: 4096 },
    deepseek: { enabled: true, api_key: '', model: 'deepseek-chat', temperature: 0.7, max_tokens: 4096 },
    groq: { enabled: true, api_key: '', model: 'openai/gpt-oss-120b', temperature: 0.7, max_tokens: 4096 }
};

const AISettings = () => {
    const navigate = useNavigate();
    const { setCustomBreadcrumbs } = usePageActions();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    // Active Provider state
    const [activeProvider, setActiveProvider] = useState('groq');

    // Provider Configurations map
    const [providersConfig, setProvidersConfig] = useState(DEFAULT_PROVIDER_CONFIGS);

    // Guardrail Permissions
    const [guardrails, setGuardrails] = useState({
        read: true,
        add: true,
        edit: true,
        delete: false // Permanently locked false
    });

    // Show/Hide API key visibility
    const [showKey, setShowKey] = useState(false);

    const loadSettings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/settings');
            if (res.success && res.data) {
                const s = res.data;
                if (s.ai_active_provider) {
                    setActiveProvider(s.ai_active_provider);
                }

                const nextConfigs = {};
                Object.keys(DEFAULT_PROVIDER_CONFIGS).forEach((pid) => {
                    nextConfigs[pid] = s[`ai_provider_${pid}`]
                        ? { ...DEFAULT_PROVIDER_CONFIGS[pid], ...s[`ai_provider_${pid}`] }
                        : { ...DEFAULT_PROVIDER_CONFIGS[pid] };
                });

                setProvidersConfig(nextConfigs);

                setGuardrails({
                    read: s.ai_guardrail_read !== undefined ? Boolean(s.ai_guardrail_read) : true,
                    add: s.ai_guardrail_add !== undefined ? Boolean(s.ai_guardrail_add) : true,
                    edit: s.ai_guardrail_edit !== undefined ? Boolean(s.ai_guardrail_edit) : true,
                    delete: false // Always enforced false
                });
            }
        } catch (err) {
            toast.error('Settings Error', err.message || 'Failed to load AI settings');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        setCustomBreadcrumbs([
            { label: 'Settings', to: '/settings/general' },
            { label: 'AI Models & Guardrails' }
        ]);
        loadSettings();
    }, [loadSettings, setCustomBreadcrumbs]);

    const handleProviderChange = (field, val) => {
        setProvidersConfig((prev) => {
            const current = prev[activeProvider] || DEFAULT_PROVIDER_CONFIGS[activeProvider] || {};
            return {
                ...prev,
                [activeProvider]: {
                    ...current,
                    [field]: val
                }
            };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ai_active_provider: activeProvider,
                ai_guardrail_read: guardrails.read ? '1' : '0',
                ai_guardrail_add: guardrails.add ? '1' : '0',
                ai_guardrail_edit: guardrails.edit ? '1' : '0',
                ai_guardrail_delete: '0' // Strictly enforced
            };

            Object.keys(providersConfig).forEach((pid) => {
                payload[`ai_provider_${pid}`] = providersConfig[pid];
            });

            const res = await apiClient.post('/settings', payload);
            if (res.success) {
                toast.success('Settings Saved', 'AI Model configurations and guardrails updated successfully');
                loadSettings();
            } else {
                toast.error('Save Failed', res.message || 'Unable to update settings');
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        try {
            const currentConf = providersConfig[activeProvider] || {};
            const res = await apiClient.post('/settings/ai/test', {
                provider: activeProvider,
                api_key: currentConf.api_key || '',
                model: currentConf.model || ''
            });

            if (res.success) {
                toast.success('Connection Successful', res.message || `Connected to ${activeProvider.toUpperCase()}!`);
            } else {
                toast.error('Connection Failed', res.message || `Could not connect to ${activeProvider}`);
            }
        } catch (err) {
            toast.error('Test Error', err.message || 'Connection test failed');
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
                <BiLoaderAlt size={36} className="spin" style={{ marginBottom: '12px', color: '#4f46e5' }} />
                <div style={{ fontSize: '15px', fontWeight: 600 }}>Loading AI Model configurations...</div>
            </div>
        );
    }

    const currentProviderData = PROVIDER_METADATA.find((p) => p.id === activeProvider) || PROVIDER_METADATA[0];
    const currentConf = providersConfig[activeProvider] || {};

    return (
        <div className={styles.settingsContainer}>
            {/* Header Card */}
            <div className={styles.headerCard}>
                <div className={styles.headerInfo}>
                    <div className={styles.headerIcon}>
                        <BiBot />
                    </div>
                    <div>
                        <h1 className={styles.headerTitle}>AI Models & Guardrails Configuration</h1>
                        <div className={styles.headerSubtitle}>
                            Manage active LLM provider, API credentials, and enforce strict operation security boundaries.
                        </div>
                    </div>
                </div>

                <div className={styles.headerActions}>
                    <button
                        type="button"
                        onClick={() => navigate('/ai-assistant')}
                        className={styles.btnSecondary}
                    >
                        <BiMessageSquareDots size={16} /> Open AI Assistant
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className={styles.btnPrimary}
                    >
                        {saving ? <BiLoaderAlt className="spin" size={16} /> : <BiSave size={16} />}
                        Save Settings
                    </button>
                </div>
            </div>

            {/* Provider Switch Cards */}
            <div>
                <div className={styles.sectionTitle}>
                    <BiRadioCircleMarked size={16} /> Choose Active AI Provider (Toggle Live Model)
                </div>
                <div className={styles.providerGrid}>
                    {PROVIDER_METADATA.map((p) => {
                        const isActive = activeProvider === p.id;
                        return (
                            <div
                                key={p.id}
                                className={`${styles.providerCard} ${isActive ? styles.providerCardActive : ''}`}
                                onClick={() => setActiveProvider(p.id)}
                            >
                                <div className={styles.providerCardTop}>
                                    <div className={styles.providerBrand}>
                                        <div className={`${styles.providerLogo} ${p.logoClass}`}>
                                            {p.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className={styles.providerName}>{p.name}</div>
                                            <span className={styles.providerMeta}>{p.badge}</span>
                                        </div>
                                    </div>
                                    {isActive ? (
                                        <span className={styles.activeBadge}>
                                            <BiCheckCircle /> Active
                                        </span>
                                    ) : (
                                        <div className={styles.inactiveRadio}></div>
                                    )}
                                </div>
                                <div className={styles.providerDesc}>{p.desc}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Active Provider Configuration Card */}
            <div className={styles.configCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BiKey size={20} style={{ color: '#4f46e5' }} />
                        <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                            {currentProviderData.name} Credentials & Parameters
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testing}
                        className={styles.btnSecondary}
                        style={{ padding: '6px 14px', fontSize: '12px' }}
                    >
                        {testing ? <BiLoaderAlt className="spin" size={14} /> : <BiCheck size={14} />}
                        Test Connection
                    </button>
                </div>

                <div className={styles.formGrid}>
                    {/* API Key */}
                    <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                        <label className={styles.label}>
                            <span>API Secret Key</span>
                            {currentConf.api_key_masked && !currentConf.api_key && (
                                <span style={{ color: '#059669', fontSize: '11px', fontWeight: 600 }}>
                                    ✓ Key Configured ({currentConf.api_key_masked})
                                </span>
                            )}
                        </label>
                        <div className={styles.inputWrap}>
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={currentConf.api_key || ''}
                                onChange={(e) => handleProviderChange('api_key', e.target.value)}
                                placeholder={currentConf.api_key_masked || `Enter ${currentProviderData.name} API Key...`}
                                className={styles.input}
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className={styles.inputBtn}
                            >
                                {showKey ? <BiHide /> : <BiShow />} {showKey ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    {/* Model Selector */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Model Version</label>
                        <select
                            value={currentConf.model || currentProviderData.defaultModel}
                            onChange={(e) => handleProviderChange('model', e.target.value)}
                            className={styles.input}
                        >
                            {currentProviderData.models.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Temperature */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            <span>Temperature (Creativity: {currentConf.temperature ?? 0.7})</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={currentConf.temperature ?? 0.7}
                            onChange={(e) => handleProviderChange('temperature', parseFloat(e.target.value))}
                            style={{ accentColor: '#4f46e5', marginTop: '10px' }}
                        />
                    </div>
                </div>
            </div>

            {/* AI Operation Boundary & Security Guardrails Box */}
            <div className={styles.guardrailsCard}>
                <div className={styles.guardrailHeader}>
                    <BiShieldQuarter />
                    <div>
                        <h3 className={styles.guardrailTitle}>AI Operation Security Boundaries & Permission Control</h3>
                        <div className={styles.guardrailSub}>
                            Explicitly toggle what the AI model is allowed to do in the ERP database. Permanent safeguards protect against data deletion.
                        </div>
                    </div>
                </div>

                <div className={styles.boundaryGrid}>
                    {/* Read */}
                    <div
                        className={`${styles.boundaryItem} ${guardrails.read ? styles.boundaryItemActive : ''}`}
                        onClick={() => setGuardrails((prev) => ({ ...prev, read: !prev.read }))}
                    >
                        <div className={`${styles.boundaryCheckbox} ${guardrails.read ? styles.boundaryCheckboxChecked : ''}`}>
                            {guardrails.read && <BiCheck />}
                        </div>
                        <div className={styles.boundaryLabel}>
                            <div className={styles.boundaryLabelTitle}>
                                <span>Read & Query Data</span>
                            </div>
                            <div className={styles.boundaryLabelDesc}>
                                Search projects, lookup client contacts, calculate team points, analyze tracker metrics.
                            </div>
                        </div>
                    </div>

                    {/* Add / Create */}
                    <div
                        className={`${styles.boundaryItem} ${guardrails.add ? styles.boundaryItemActive : ''}`}
                        onClick={() => setGuardrails((prev) => ({ ...prev, add: !prev.add }))}
                    >
                        <div className={`${styles.boundaryCheckbox} ${guardrails.add ? styles.boundaryCheckboxChecked : ''}`}>
                            {guardrails.add && <BiCheck />}
                        </div>
                        <div className={styles.boundaryLabel}>
                            <div className={styles.boundaryLabelTitle}>
                                <span>Add & Create Records</span>
                            </div>
                            <div className={styles.boundaryLabelDesc}>
                                Allow AI to draft new projects, create task entries, or add client notes from conversations.
                            </div>
                        </div>
                    </div>

                    {/* Edit / Update */}
                    <div
                        className={`${styles.boundaryItem} ${guardrails.edit ? styles.boundaryItemActive : ''}`}
                        onClick={() => setGuardrails((prev) => ({ ...prev, edit: !prev.edit }))}
                    >
                        <div className={`${styles.boundaryCheckbox} ${guardrails.edit ? styles.boundaryCheckboxChecked : ''}`}>
                            {guardrails.edit && <BiCheck />}
                        </div>
                        <div className={styles.boundaryLabel}>
                            <div className={styles.boundaryLabelTitle}>
                                <span>Edit & Update Records</span>
                            </div>
                            <div className={styles.boundaryLabelDesc}>
                                Allow AI to update project progress statuses, assign members, or edit specifications.
                            </div>
                        </div>
                    </div>

                    {/* Delete — Permanently Blocked */}
                    <div className={`${styles.boundaryItem} ${styles.boundaryItemDisabled}`}>
                        <div className={`${styles.boundaryCheckbox} ${styles.boundaryCheckboxBlocked}`}>
                            <BiLock />
                        </div>
                        <div className={styles.boundaryLabel}>
                            <div className={styles.boundaryLabelTitle}>
                                <span>Delete / Purge Data</span>
                                <span className={styles.blockedBadge}>Permanently Blocked</span>
                            </div>
                            <div className={styles.boundaryLabelDesc} style={{ color: '#b91c1c' }}>
                                AI is strictly forbidden from executing DELETE, DROP, or TRUNCATE operations to protect database integrity.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AISettings;

