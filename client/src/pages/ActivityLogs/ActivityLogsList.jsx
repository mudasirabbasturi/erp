import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    BiHistory,
    BiRefresh,
    BiFilterAlt,
    BiUser,
    BiCheckCircle,
    BiInfoCircle,
    BiSearch
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useToast } from '../../components/ui/Toast';
import { AgGridTable } from '../../components/Datatable/AgGridTable';
import { Modal, Select } from '../../components/ui';

const ActivityLogsList = () => {
    const toast = useToast();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [moduleFilter, setModuleFilter] = useState('all');
    const [actionFilter, setActionFilter] = useState('all');

    // Details modal
    const [selectedLog, setSelectedLog] = useState(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = { per_page: 500 };
            if (moduleFilter !== 'all') params.module = moduleFilter;
            if (actionFilter !== 'all') params.action = actionFilter;

            const res = await apiClient.get('/activity-logs', params);
            if (res.success && res.data) {
                setLogs(res.data || []);
            } else {
                toast.error(res.message || 'Failed to fetch activity logs');
            }
        } catch (err) {
            toast.error(err.message || 'Failed to fetch activity logs');
        } finally {
            setLoading(false);
        }
    }, [moduleFilter, actionFilter, toast]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleViewDetails = useCallback((log) => {
        setSelectedLog(log);
        setDetailsModalOpen(true);
    }, []);

    // Module badge colors
    const getModuleColor = (mod) => {
        switch (mod) {
            case 'media': return { bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe' };
            case 'folder': return { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
            case 'users': return { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
            case 'roles': return { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' };
            case 'database': return { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' };
            default: return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
        }
    };

    // Action badge colors
    const getActionColor = (act) => {
        switch (act) {
            case 'created':
            case 'uploaded':
                return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
            case 'updated':
                return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
            case 'moved':
                return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
            case 'deleted':
                return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
            default:
                return { bg: '#f8fafc', color: '#475569', border: '#cbd5e1' };
        }
    };

    // Helper to safely parse JSON string or object
    const parseValues = (val) => {
        if (!val) return null;
        if (typeof val === 'object') return val;
        try {
            return JSON.parse(val);
        } catch (e) {
            return { value: String(val) };
        }
    };

    // Strip HTML tags & decode common entities cleanly for table display
    const formatReadableVal = (val) => {
        if (val === null || val === undefined || val === '') return 'Empty';
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        if (Array.isArray(val)) return val.join(', ');
        if (typeof val === 'object') return JSON.stringify(val);
        const str = String(val)
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return str || 'Empty';
    };

    // Format field keys (e.g. project_final_link -> Project Final Link)
    const formatFieldName = (key) => {
        return key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase());
    };

    // Extract ONLY changed fields between old_values and new_values (ignoring timestamps)
    const getDiffPairs = useCallback((log) => {
        const oldObj = parseValues(log?.old_values);
        const newObj = parseValues(log?.new_values);

        const ignoredKeys = new Set(['updated_at', 'created_at', 'deleted_at']);
        const pairs = [];

        if (newObj && typeof newObj === 'object') {
            Object.keys(newObj).forEach((key) => {
                if (ignoredKeys.has(key)) return;
                const newVal = newObj[key];
                const oldVal = oldObj && Object.prototype.hasOwnProperty.call(oldObj, key) ? oldObj[key] : null;
                // Handle special keys like new_status when oldObj has old_status
                let resolvedOld = oldVal;
                if (key === 'new_status' && oldObj?.old_status !== undefined) {
                    resolvedOld = oldObj.old_status;
                }
                pairs.push({
                    key,
                    label: key === 'new_status' ? 'Status' : formatFieldName(key),
                    oldVal: formatReadableVal(resolvedOld),
                    newVal: formatReadableVal(newVal)
                });
            });
        } else if (oldObj && typeof oldObj === 'object') {
            Object.keys(oldObj).forEach((key) => {
                if (ignoredKeys.has(key)) return;
                pairs.push({
                    key,
                    label: formatFieldName(key),
                    oldVal: formatReadableVal(oldObj[key]),
                    newVal: 'Deleted / Removed'
                });
            });
        }

        return pairs;
    }, []);

    // Build chronological full field timeline across all fetched logs for a specific record (module + record_id)
    const getRecordFieldHistory = useCallback((targetLog) => {
        if (!targetLog) return [];
        const diffPairs = getDiffPairs(targetLog);
        if (diffPairs.length === 0) return [];

        // Gather all logs belonging to the same record sorted oldest -> newest
        const sameRecordLogs = logs
            .filter((l) => l.module === targetLog.module && String(l.record_id) === String(targetLog.record_id))
            .slice()
            .sort((a, b) => Number(a.id) - Number(b.id));

        return diffPairs.map((pair) => {
            const chain = [];
            const seenValues = new Set();

            const pushUnique = (val, logId, timestamp, actor) => {
                const clean = val || 'Empty';
                if (chain.length === 0 || chain[chain.length - 1].value !== clean) {
                    chain.push({
                        value: clean,
                        logId,
                        timestamp,
                        actor
                    });
                }
            };

            sameRecordLogs.forEach((l) => {
                const pairs = getDiffPairs(l);
                const match = pairs.find((p) => p.key === pair.key);
                if (match) {
                    if (chain.length === 0 && match.oldVal && match.oldVal !== 'Empty') {
                        pushUnique(match.oldVal, l.id, l.created_at, 'Initial / Previous');
                    }
                    pushUnique(match.newVal, l.id, l.created_at, l.full_name || l.username || 'System');
                }
            });

            // Fallback if log wasn't matched cleanly in sequence
            if (chain.length === 0) {
                if (pair.oldVal !== 'Empty') {
                    chain.push({ value: pair.oldVal, logId: targetLog.id, timestamp: targetLog.created_at, actor: 'Before' });
                }
                chain.push({ value: pair.newVal, logId: targetLog.id, timestamp: targetLog.created_at, actor: targetLog.full_name || targetLog.username });
            }

            return {
                field: pair.label,
                key: pair.key,
                chain
            };
        });
    }, [logs, getDiffPairs]);

    const columnDefs = useMemo(() => {
        return [
            {
                field: 'id',
                headerName: 'ID',
                width: 80,
                pinned: 'left',
                sort: 'desc'
            },
            {
                field: 'created_at',
                headerName: 'Timestamp',
                width: 170,
                pinned: 'left',
                cellRenderer: (p) => (
                    <span style={{ fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>
                        {p.value}
                    </span>
                )
            },
            {
                field: 'username',
                headerName: 'Performed By',
                width: 180,
                cellRenderer: (p) => {
                    const row = p.data;
                    const name = row?.full_name || row?.username || 'System';
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: '#e0e7ff',
                                color: '#4338ca',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700
                            }}>
                                {name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{name}</span>
                        </div>
                    );
                }
            },
            {
                field: 'module',
                headerName: 'Module',
                width: 120,
                cellRenderer: (p) => {
                    const style = getModuleColor(p.value);
                    return (
                        <span style={{
                            background: style.bg,
                            color: style.color,
                            border: `1px solid ${style.border}`,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase'
                        }}>
                            {p.value}
                        </span>
                    );
                }
            },
            {
                field: 'action',
                headerName: 'Action',
                width: 120,
                cellRenderer: (p) => {
                    const style = getActionColor(p.value);
                    return (
                        <span style={{
                            background: style.bg,
                            color: style.color,
                            border: `1px solid ${style.border}`,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase'
                        }}>
                            {p.value}
                        </span>
                    );
                }
            },
            {
                field: 'record_title',
                headerName: 'Target Item',
                width: 200,
                cellRenderer: (p) => (
                    <strong style={{ color: '#0f172a', fontSize: '12.5px' }}>
                        {p.value || '-'}
                    </strong>
                )
            },
            {
                headerName: 'Previous Value',
                minWidth: 200,
                flex: 1,
                cellRenderer: (p) => {
                    const pairs = getDiffPairs(p.data);
                    if (pairs.length === 0) return <span style={{ color: '#cbd5e1' }}>—</span>;
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px 0', lineHeight: 1.3 }}>
                            {pairs.slice(0, 2).map((item) => (
                                <div key={item.key} style={{ fontSize: '12px', color: '#dc2626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>{item.label}: </span>
                                    <span style={{ textDecoration: 'line-through', opacity: 0.85 }}>{item.oldVal}</span>
                                </div>
                            ))}
                            {pairs.length > 2 && (
                                <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>+{pairs.length - 2} more fields</span>
                            )}
                        </div>
                    );
                }
            },
            {
                headerName: 'Updated Value',
                minWidth: 200,
                flex: 1,
                cellRenderer: (p) => {
                    const pairs = getDiffPairs(p.data);
                    if (pairs.length === 0) return <span style={{ color: '#cbd5e1' }}>—</span>;
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px 0', lineHeight: 1.3 }}>
                            {pairs.slice(0, 2).map((item) => (
                                <div key={item.key} style={{ fontSize: '12px', color: '#059669', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>{item.label}: </span>
                                    <span>{item.newVal}</span>
                                </div>
                            ))}
                            {pairs.length > 2 && (
                                <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>+{pairs.length - 2} more fields</span>
                            )}
                        </div>
                    );
                }
            },
            {
                field: 'description',
                headerName: 'Event Description',
                flex: 1.5,
                minWidth: 220,
                cellRenderer: (p) => (
                    <span style={{ color: '#334155', fontSize: '12.5px' }} title={p.value}>
                        {p.value}
                    </span>
                )
            },
            {
                field: 'ip_address',
                headerName: 'IP Address',
                width: 120,
                cellRenderer: (p) => (
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {p.value || '-'}
                    </span>
                )
            },
            {
                headerName: 'Details',
                width: 110,
                pinned: 'right',
                cellRenderer: (p) => {
                    const hasValues = p.data?.old_values || p.data?.new_values;
                    return hasValues ? (
                        <button
                            onClick={() => handleViewDetails(p.data)}
                            style={{
                                background: '#eef2ff',
                                border: '1px solid #c7d2fe',
                                color: '#4338ca',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            View Diff
                        </button>
                    ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '11px' }}>-</span>
                    );
                }
            }
        ];
    }, [handleViewDetails, getDiffPairs]);

    const moduleOptions = [
        { value: 'all', label: 'All Modules' },
        { value: 'media', label: 'Media Files' },
        { value: 'folder', label: 'Folders' },
        { value: 'users', label: 'Staff Users' },
        { value: 'roles', label: 'Roles & Permissions' },
        { value: 'database', label: 'Database Schema' }
    ];

    const actionOptions = [
        { value: 'all', label: 'All Actions' },
        { value: 'created', label: 'Created' },
        { value: 'uploaded', label: 'Uploaded' },
        { value: 'updated', label: 'Updated' },
        { value: 'moved', label: 'Moved' },
        { value: 'deleted', label: 'Deleted' }
    ];

    return (
        <div style={{
            padding: '24px',
            fontFamily: 'var(--font-family, "Adobe Clean Regular", sans-serif)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
        }}>
            {/* Header Card */}
            <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div>
                    <h1 style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        color: '#0f172a',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <BiHistory size={24} color="#4f46e5" />
                        <span>System Audit & Activity Logs</span>
                    </h1>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
                        Centralized audit trail tracking who added, updated, moved, or deleted records across all system modules.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '180px' }}>
                        <Select
                            value={moduleFilter}
                            onChange={(val) => setModuleFilter(val)}
                            options={moduleOptions}
                            size="small"
                        />
                    </div>

                    <div style={{ width: '150px' }}>
                        <Select
                            value={actionFilter}
                            onChange={(val) => setActionFilter(val)}
                            options={actionOptions}
                            size="small"
                        />
                    </div>

                    <button
                        onClick={fetchLogs}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '7px 14px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#334155',
                            cursor: 'pointer'
                        }}
                        title="Refresh Logs"
                    >
                        <BiRefresh size={16} /> Refresh
                    </button>
                </div>
            </div>

            {/* AG Grid Container */}
            <div style={{ height: 'calc(100vh - 250px)', minHeight: '520px', background: '#ffffff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <AgGridTable
                    rowData={logs}
                    columnDefs={columnDefs}
                    loading={loading}
                    showQuickFilter={true}
                    showExportButtons={true}
                    rowSelection="single"
                    pagination={true}
                    paginationPageSize={25}
                    exportFilename="imp_activity_logs"
                />
            </div>

            {/* Clean Human-Readable Change Timeline Modal */}
            {selectedLog && (
                <Modal
                    open={detailsModalOpen}
                    onClose={() => setDetailsModalOpen(false)}
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BiInfoCircle size={20} color="#4f46e5" />
                            <span>
                                Change History {selectedLog.record_title ? `— ${selectedLog.record_title}` : `#${selectedLog.id}`}
                            </span>
                        </div>
                    }
                    size="large"
                    width="780px"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Event Summary Box */}
                        <div style={{
                            background: '#f8fafc',
                            padding: '14px 18px',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            fontSize: '13px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                        }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                {selectedLog.description}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '12px' }}>
                                Performed by <strong style={{ color: '#334155' }}>{selectedLog.full_name || selectedLog.username || 'System'}</strong>
                                {' • '} {selectedLog.created_at}
                                {selectedLog.ip_address ? ` • IP: ${selectedLog.ip_address}` : ''}
                            </div>
                        </div>

                        {/* Chronological Field History List (Strikethrough older revisions, clear latest value) */}
                        {(() => {
                            const historyList = getRecordFieldHistory(selectedLog);
                            if (historyList.length === 0) {
                                return (
                                    <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '13px' }}>
                                        No field-level changes recorded for this log entry.
                                    </div>
                                );
                            }

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    {historyList.map((item) => (
                                        <div
                                            key={item.key}
                                            style={{
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '10px',
                                                overflow: 'hidden',
                                                background: '#ffffff'
                                            }}
                                        >
                                            <div style={{
                                                background: '#f8fafc',
                                                padding: '10px 16px',
                                                borderBottom: '1px solid #e2e8f0',
                                                fontSize: '12.5px',
                                                fontWeight: 700,
                                                color: '#334155',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span>{item.field}</span>
                                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                                                    {item.chain.length} revision{item.chain.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>

                                            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {item.chain.map((rev, idx) => {
                                                    const isLatest = idx === item.chain.length - 1;
                                                    return (
                                                        <div
                                                            key={idx}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'flex-start',
                                                                justifyContent: 'space-between',
                                                                gap: '12px',
                                                                padding: '8px 12px',
                                                                borderRadius: '8px',
                                                                background: isLatest ? '#ecfdf5' : '#fef2f2',
                                                                border: `1px solid ${isLatest ? '#a7f3d0' : '#fecaca'}`
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                                                <div style={{
                                                                    fontSize: '13.5px',
                                                                    fontWeight: isLatest ? 700 : 500,
                                                                    color: isLatest ? '#065f46' : '#991b1b',
                                                                    textDecoration: isLatest ? 'none' : 'line-through',
                                                                    wordBreak: 'break-word'
                                                                }}>
                                                                    {rev.value}
                                                                </div>
                                                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                                    {rev.actor} {rev.timestamp ? `• ${rev.timestamp}` : ''}
                                                                </div>
                                                            </div>

                                                            <span style={{
                                                                fontSize: '10px',
                                                                fontWeight: 700,
                                                                textTransform: 'uppercase',
                                                                padding: '3px 8px',
                                                                borderRadius: '12px',
                                                                background: isLatest ? '#059669' : '#e2e8f0',
                                                                color: isLatest ? '#ffffff' : '#475569',
                                                                flexShrink: 0
                                                            }}>
                                                                {isLatest ? 'Latest' : `Old #${idx + 1}`}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ActivityLogsList;

