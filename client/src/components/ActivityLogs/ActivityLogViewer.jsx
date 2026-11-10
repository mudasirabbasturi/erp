import React, { useState, useEffect, useCallback } from 'react';
import {
    BiHistory,
    BiRefresh,
    BiSearch,
    BiUser,
    BiCalendar,
    BiCheckCircle,
    BiTrash,
    BiUpload,
    BiMove,
    BiEdit
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { Modal } from '../ui';

const ActivityLogViewer = ({
    open,
    onClose,
    module = 'media',
    recordId = null,
    title = 'Activity & Audit Trail'
}) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [expandedLogId, setExpandedLogId] = useState(null);

    const fetchLogs = useCallback(async () => {
        if (!open) return;
        setLoading(true);
        try {
            const params = { per_page: 50 };
            if (module && module !== 'all') params.module = module;
            if (recordId) params.record_id = recordId;
            if (actionFilter !== 'all') params.action = actionFilter;
            if (search) params.search = search;

            const res = await apiClient.get('/activity-logs', params);
            if (res.success) {
                setLogs(res.data || []);
            }
        } catch (err) {
            console.error('Failed to load activity logs:', err);
        } finally {
            setLoading(false);
        }
    }, [open, module, recordId, actionFilter, search]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const getActionBadge = (action) => {
        switch (action) {
            case 'uploaded':
            case 'created':
                return {
                    bg: '#ecfdf5',
                    color: '#059669',
                    border: '#a7f3d0',
                    icon: <BiUpload size={13} />,
                    label: action.toUpperCase()
                };
            case 'updated':
                return {
                    bg: '#eff6ff',
                    color: '#2563eb',
                    border: '#bfdbfe',
                    icon: <BiEdit size={13} />,
                    label: 'UPDATED'
                };
            case 'moved':
                return {
                    bg: '#fef3c7',
                    color: '#d97706',
                    border: '#fde68a',
                    icon: <BiMove size={13} />,
                    label: 'MOVED'
                };
            case 'deleted':
                return {
                    bg: '#fef2f2',
                    color: '#dc2626',
                    border: '#fecaca',
                    icon: <BiTrash size={13} />,
                    label: 'DELETED'
                };
            default:
                return {
                    bg: '#f1f5f9',
                    color: '#475569',
                    border: '#cbd5e1',
                    icon: <BiCheckCircle size={13} />,
                    label: action.toUpperCase()
                };
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BiHistory size={20} color="#4f46e5" />
                    <span>{title}</span>
                </div>
            }
            size="large"
            width="780px"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '72vh' }}>
                {/* Search & Action Filters */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #e2e8f0'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        width: '260px'
                    }}>
                        <BiSearch size={15} color="#64748b" style={{ marginRight: '6px' }} />
                        <input
                            type="text"
                            placeholder="Search log descriptions..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {['all', 'uploaded', 'moved', 'updated', 'deleted'].map((act) => (
                            <button
                                key={act}
                                onClick={() => setActionFilter(act)}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '14px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    border: '1px solid',
                                    borderColor: actionFilter === act ? '#4f46e5' : '#cbd5e1',
                                    background: actionFilter === act ? '#4f46e5' : '#ffffff',
                                    color: actionFilter === act ? '#ffffff' : '#475569',
                                    cursor: 'pointer',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {act}
                            </button>
                        ))}

                        <button
                            onClick={fetchLogs}
                            style={{
                                padding: '5px 10px',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                color: '#475569'
                            }}
                            title="Refresh logs"
                        >
                            <BiRefresh size={16} />
                        </button>
                    </div>
                </div>

                {/* Logs List */}
                <div style={{
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    paddingRight: '4px'
                }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '14px' }}>
                            Loading audit history...
                        </div>
                    ) : logs.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px dashed #cbd5e1',
                            color: '#64748b'
                        }}>
                            <BiHistory size={32} color="#cbd5e1" style={{ marginBottom: '6px' }} />
                            <p style={{ margin: 0, fontSize: '13px' }}>No recorded activities found for this criteria.</p>
                        </div>
                    ) : (
                        logs.map((log) => {
                            const badge = getActionBadge(log.action);
                            const isExpanded = expandedLogId === log.id;
                            const hasValues = log.old_values || log.new_values;

                            return (
                                <div
                                    key={log.id}
                                    style={{
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        padding: '12px 14px',
                                        background: '#ffffff',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                        fontSize: '13px'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                background: badge.bg,
                                                color: badge.color,
                                                border: `1px solid ${badge.border}`,
                                                borderRadius: '4px',
                                                padding: '2px 7px',
                                                fontSize: '11px',
                                                fontWeight: 700
                                            }}>
                                                {badge.icon} {badge.label}
                                            </span>
                                            <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                                {log.record_title || `Record #${log.record_id || log.id}`}
                                            </span>
                                        </div>

                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                            {log.created_at}
                                        </span>
                                    </div>

                                    {log.description && (
                                        <p style={{ margin: '2px 0 4px', color: '#334155', fontSize: '12.5px', lineHeight: 1.4 }}>
                                            {log.description}
                                        </p>
                                    )}

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: '11.5px',
                                        color: '#64748b',
                                        borderTop: '1px solid #f8fafc',
                                        paddingTop: '6px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <BiUser size={13} color="#4f46e5" />
                                                <strong>{log.full_name || log.username || 'System User'}</strong>
                                                {log.username && log.full_name && ` (@${log.username})`}
                                            </span>
                                            {log.ip_address && (
                                                <span style={{ color: '#94a3b8' }}>IP: {log.ip_address}</span>
                                            )}
                                        </div>

                                        {hasValues && (
                                            <button
                                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#4f46e5',
                                                    cursor: 'pointer',
                                                    fontSize: '11.5px',
                                                    fontWeight: 600,
                                                    padding: 0
                                                }}
                                            >
                                                {isExpanded ? 'Hide Details' : 'View Changes'}
                                            </button>
                                        )}
                                    </div>

                                    {isExpanded && hasValues && (
                                        <div style={{
                                            background: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '6px',
                                            padding: '8px 10px',
                                            marginTop: '6px',
                                            fontSize: '11.5px',
                                            fontFamily: 'monospace'
                                        }}>
                                            {log.old_values && (
                                                <div style={{ marginBottom: '6px' }}>
                                                    <strong style={{ color: '#dc2626' }}>Before:</strong>
                                                    <pre style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap', color: '#64748b' }}>
                                                        {JSON.stringify(log.old_values, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                            {log.new_values && (
                                                <div>
                                                    <strong style={{ color: '#059669' }}>After / Changed:</strong>
                                                    <pre style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap', color: '#334155' }}>
                                                        {JSON.stringify(log.new_values, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ActivityLogViewer;

