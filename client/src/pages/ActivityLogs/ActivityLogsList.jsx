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
                field: 'description',
                headerName: 'Event Description',
                flex: 2,
                minWidth: 260,
                cellRenderer: (p) => (
                    <span style={{ color: '#334155', fontSize: '12.5px' }} title={p.value}>
                        {p.value}
                    </span>
                )
            },
            {
                field: 'ip_address',
                headerName: 'IP Address',
                width: 130,
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
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: 600,
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
    }, [handleViewDetails]);

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

            {/* Details Modal */}
            {selectedLog && (
                <Modal
                    open={detailsModalOpen}
                    onClose={() => setDetailsModalOpen(false)}
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BiInfoCircle size={20} color="#4f46e5" />
                            <span>Audit Diff Details #{selectedLog.id}</span>
                        </div>
                    }
                    size="large"
                    width="700px"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                            <div><strong>Event:</strong> {selectedLog.description}</div>
                            <div style={{ marginTop: '4px', color: '#64748b' }}>
                                Performed by <strong>{selectedLog.full_name || selectedLog.username}</strong> on {selectedLog.created_at} (IP: {selectedLog.ip_address || 'N/A'})
                            </div>
                        </div>

                        {selectedLog.old_values && (
                            <div>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626' }}>
                                    Previous State (Before):
                                </span>
                                <pre style={{
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    borderRadius: '6px',
                                    padding: '10px 12px',
                                    fontSize: '12px',
                                    color: '#991b1b',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {typeof selectedLog.old_values === 'object'
                                        ? JSON.stringify(selectedLog.old_values, null, 2)
                                        : selectedLog.old_values}
                                </pre>
                            </div>
                        )}

                        {selectedLog.new_values && (
                            <div>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>
                                    New State (After / Updated):
                                </span>
                                <pre style={{
                                    background: '#ecfdf5',
                                    border: '1px solid #a7f3d0',
                                    borderRadius: '6px',
                                    padding: '10px 12px',
                                    fontSize: '12px',
                                    color: '#065f46',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {typeof selectedLog.new_values === 'object'
                                        ? JSON.stringify(selectedLog.new_values, null, 2)
                                        : selectedLog.new_values}
                                </pre>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ActivityLogsList;

