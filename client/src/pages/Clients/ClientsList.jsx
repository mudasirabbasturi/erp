import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BiPlus,
    BiRefresh,
    BiShow,
    BiEdit,
    BiTrash,
    BiBriefcase,
    BiColumns,
    BiBuilding,
    BiPhone,
    BiEnvelope,
    BiMapPin
} from 'react-icons/bi';
import apiClient from '../../api/client';
import AgGridTable from '../../components/Datatable/AgGridTable';
import Select from '../../components/ui/Select/Select';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import styles from './Clients.module.css';

const CLIENT_TYPE_FILTER_OPTIONS = [
    { value: 'all', label: 'All Client Types' },
    { value: 'normal', label: 'Normal Clients' },
    { value: 'admin', label: 'Admin Clients' }
];

const ClientsList = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { setActions } = usePageActions();

    const [clients, setClients] = useState([]);
    const [columnConfigs, setColumnConfigs] = useState([]);
    const [clientTypeFilter, setClientTypeFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    const loadClients = useCallback(async () => {
        setLoading(true);
        try {
            const params = { per_page: 500 };
            if (clientTypeFilter && clientTypeFilter !== 'all') {
                params.client_type = clientTypeFilter;
            }

            const [clientsRes, colsRes] = await Promise.all([
                apiClient.get('/clients', params),
                apiClient.get('/columns/config/clients')
            ]);

            if (clientsRes.success) {
                setClients(clientsRes.data || []);
            }
            if (colsRes.success && colsRes.data) {
                setColumnConfigs(colsRes.data);
            }
        } catch (err) {
            toast.error('Load Error', err.message || 'Failed to load client records');
        } finally {
            setLoading(false);
        }
    }, [clientTypeFilter, toast]);

    useEffect(() => {
        loadClients();
    }, [loadClients]);

    // Ensure breadcrumbs action area is clean
    useEffect(() => {
        setActions(null);
        return () => {
            setActions(null);
        };
    }, [setActions]);

    // Delete Client
    const handleDeleteClient = async (client) => {
        if (!window.confirm(`Are you sure you want to delete client "${client.name}" (${client.title || 'Client #' + client.id})?`)) return;

        try {
            const res = await apiClient.delete(`/clients/${client.id}`);
            if (res.success) {
                toast.success('Client Deleted', `Client "${client.name}" has been deleted.`);
                loadClients();
            } else {
                toast.error('Delete Failed', res.message || 'Failed to delete client');
            }
        } catch (err) {
            toast.error('Delete Failed', err.message);
        }
    };

    // Dynamically build AG Grid columns from column configs
    const columnDefs = useMemo(() => {
        const defs = [];

        // Fixed Left: Client ID & Code
        defs.push({
            field: 'id',
            headerName: 'ID',
            width: 75,
            pinned: 'left',
            cellRenderer: (p) => (
                <span style={{ fontWeight: 700, color: '#64748b', fontSize: '12px' }}>
                    #{p.value}
                </span>
            )
        });

        // Visible column configs ordered
        const visibleCols = columnConfigs.length > 0
            ? columnConfigs.filter(c => c.is_active === 1 && c.is_list_visible === 1)
            : [
                { column_name: 'title', label: 'Code' },
                { column_name: 'name', label: 'Client Name' },
                { column_name: 'client_type', label: 'Type' },
                { column_name: 'phone', label: 'Phone' },
                { column_name: 'email', label: 'Email' },
                { column_name: 'city', label: 'City' },
                { column_name: 'state', label: 'State' },
                { column_name: 'country', label: 'Country' },
                { column_name: 'created_at', label: 'Created At' }
            ];

        visibleCols.forEach(cfg => {
            const field = cfg.column_name;
            const header = cfg.label || cfg.column_name;

            if (field === 'id') return;

            if (field === 'title') {
                defs.push({
                    field: 'title',
                    headerName: header,
                    width: 140,
                    cellRenderer: (p) => (
                        <span style={{
                            fontFamily: 'Consolas, Monaco, monospace',
                            fontWeight: 700,
                            color: '#4338ca',
                            background: '#eef2ff',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid #c7d2fe',
                            fontSize: '12px'
                        }}>
                            {p.value || '—'}
                        </span>
                    )
                });
            } else if (field === 'name') {
                defs.push({
                    field: 'name',
                    headerName: header,
                    minWidth: 200,
                    flex: 2,
                    cellRenderer: (p) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%' }}>
                            <span style={{ color: '#4f46e5' }}>
                                <BiBuilding size={16} />
                            </span>
                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                                {p.value}
                            </span>
                        </div>
                    )
                });
            } else if (field === 'client_type') {
                defs.push({
                    field: 'client_type',
                    headerName: header,
                    width: 130,
                    cellRenderer: (p) => {
                        const val = (p.value || 'normal').toLowerCase();
                        let badgeClass = styles.badgeOther;
                        if (val === 'normal') badgeClass = styles.badgeNormal;
                        if (val === 'admin') badgeClass = styles.badgeAdmin;
                        return (
                            <span className={badgeClass}>
                                {p.value || 'normal'}
                            </span>
                        );
                    }
                });
            } else if (field === 'email') {
                defs.push({
                    field: 'email',
                    headerName: header,
                    minWidth: 190,
                    cellRenderer: (p) => (
                        p.value ? (
                            <a
                                href={`mailto:${p.value}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#4f46e5', textDecoration: 'none', fontWeight: 500 }}
                            >
                                <BiEnvelope size={14} /> {p.value}
                            </a>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>
                    )
                });
            } else if (field === 'phone') {
                defs.push({
                    field: 'phone',
                    headerName: header,
                    width: 160,
                    cellRenderer: (p) => (
                        p.value ? (
                            <a
                                href={`tel:${p.value}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#0f172a', textDecoration: 'none', fontWeight: 600 }}
                            >
                                <BiPhone size={14} style={{ color: '#10b981' }} /> {p.value}
                            </a>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>
                    )
                });
            } else if (field === 'city' || field === 'state' || field === 'country') {
                defs.push({
                    field,
                    headerName: header,
                    width: 130,
                    cellRenderer: (p) => (
                        p.value ? (
                            <span style={{ color: '#334155', fontWeight: 500 }}>
                                {p.value}
                            </span>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>
                    )
                });
            } else if (field === 'address') {
                defs.push({
                    field: 'address',
                    headerName: header,
                    minWidth: 200,
                    flex: 2,
                    cellRenderer: (p) => (
                        p.value ? (
                            <span style={{ color: '#475569', fontSize: '12px' }} title={p.value}>
                                {p.value}
                            </span>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>
                    )
                });
            } else if (field === 'notes') {
                defs.push({
                    field: 'notes',
                    headerName: header,
                    minWidth: 200,
                    cellRenderer: (p) => {
                        if (!p.value) return <span style={{ color: '#cbd5e1' }}>—</span>;
                        // Strip HTML tags for clean preview in grid
                        const text = p.value.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
                        return (
                            <span style={{ color: '#64748b', fontSize: '12px', fontStyle: 'italic' }} title={text}>
                                {text.length > 50 ? `${text.slice(0, 50)}...` : text}
                            </span>
                        );
                    }
                });
            } else if (field === 'created_at' || field === 'updated_at') {
                defs.push({
                    field,
                    headerName: header,
                    width: 140,
                    valueGetter: (params) => {
                        const val = params.data?.[field];
                        return val ? val.slice(0, 10) : '';
                    }
                });
            } else {
                // Any custom column added from DB schema
                defs.push({
                    field,
                    headerName: header,
                    minWidth: 140,
                    cellRenderer: (p) => {
                        const val = p.value;
                        if (val === null || val === undefined || val === '') {
                            return <span style={{ color: '#cbd5e1' }}>—</span>;
                        }
                        return String(val);
                    }
                });
            }
        });

        // Pinned Right: Actions
        defs.push({
            headerName: 'Actions',
            width: 220,
            pinned: 'right',
            cellRenderer: (p) => {
                if (!p.data) return null;
                const client = p.data;
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '100%' }}>
                        <button
                            type="button"
                            onClick={() => navigate(`/clients/view/${client.id}`)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                            title="View Client Details"
                        >
                            <BiShow size={14} /> View
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/clients/edit/${client.id}`)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                            title="Edit Client"
                        >
                            <BiEdit size={14} /> Edit
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDeleteClient(client)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                            title="Delete Client"
                        >
                            <BiTrash size={14} /> Delete
                        </button>
                    </div>
                );
            }
        });

        return defs;
    }, [columnConfigs, navigate]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
            {/* Filter Toolbar */}
            <div className={styles.filterBar}>
                <div className={styles.filterLeft}>
                    <div className={styles.filterItem}>
                        <span>Client Type:</span>
                        <div className={styles.typeSelectWrapper}>
                            <Select
                                options={CLIENT_TYPE_FILTER_OPTIONS}
                                value={clientTypeFilter}
                                onChange={(val) => setClientTypeFilter(val)}
                            />
                        </div>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>|</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                        Total: {clients.length} Clients
                    </span>
                </div>
            </div>

            {/* AG Grid Table Container */}
            <div style={{
                flex: 1,
                minHeight: '560px',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
            }}>
                <AgGridTable
                    rowData={clients}
                    columnDefs={columnDefs}
                    loading={loading}
                    enableExport={true}
                    enableSearch={true}
                    rowHeight={48}
                    headerHeight={44}
                    height="calc(100vh - 210px)"
                    extraHeaderActions={
                        <>
                            <button
                                type="button"
                                onClick={() => navigate('/clients/create')}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: '#4f46e5',
                                    border: '1px solid #4338ca',
                                    borderRadius: '6px',
                                    padding: '6px 14px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(79, 70, 229, 0.2)'
                                }}
                            >
                                <BiPlus size={16} /> Add Client
                            </button>

                            <button
                                type="button"
                                onClick={loadClients}
                                style={{
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    padding: '6px 10px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#475569'
                                }}
                                title="Reload"
                            >
                                <BiRefresh size={18} />
                            </button>
                        </>
                    }
                />
            </div>
        </div>
    );
};

export default ClientsList;

