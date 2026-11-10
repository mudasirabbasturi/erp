import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BiServer,
    BiRefresh,
    BiTable,
    BiChevronRight,
    BiArrowToRight
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useToast } from '../../components/ui/Toast';
import { AgGridTable } from '../../components/Datatable/AgGridTable';
import styles from './DatabaseTables.module.css';

const DatabaseTables = () => {
    const navigate = useNavigate();
    const toast = useToast();

    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTables = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/schema/tables');
            if (res.success && res.data) {
                setTables(res.data || []);
            } else {
                toast.error('Error', res.message || 'Failed to fetch database tables');
            }
        } catch (err) {
            toast.error('Load Error', err.message || 'Failed to fetch database tables');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchTables();
    }, [fetchTables]);

    const handleInspectTable = useCallback((tableName) => {
        if (!tableName) return;
        navigate(`/database/tables/${tableName}`);
    }, [navigate]);

    // AG Grid columns configuration for Database Tables
    const columnDefs = useMemo(() => {
        return [
            {
                field: 'table_name',
                headerName: 'Database Table',
                flex: 2,
                minWidth: 180,
                pinned: 'left',
                cellRenderer: (p) => (
                    <div
                        onClick={() => handleInspectTable(p.value)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            height: '100%',
                            cursor: 'pointer'
                        }}
                        title={`Click to inspect columns of table '${p.value}'`}
                    >
                        <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '26px',
                            height: '26px',
                            background: '#eff6ff',
                            border: '1px solid #dbeafe',
                            borderRadius: '6px',
                            color: '#2563eb'
                        }}>
                            <BiTable size={15} />
                        </span>
                        <span style={{
                            fontFamily: 'Consolas, Monaco, monospace',
                            fontWeight: 700,
                            color: '#1d4ed8',
                            fontSize: '13px'
                        }}>
                            {p.value}
                        </span>
                    </div>
                )
            },
            {
                field: 'label',
                headerName: 'Display Label / Description',
                flex: 2,
                minWidth: 200,
                cellRenderer: (p) => (
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                        {p.value || p.data?.table_name}
                    </span>
                )
            },
            {
                field: 'columns_count',
                headerName: 'Total Columns',
                width: 140,
                cellRenderer: (p) => (
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: '#eef2ff',
                        color: '#4338ca',
                        border: '1px solid #c7d2fe',
                        borderRadius: '12px',
                        padding: '2px 10px',
                        fontSize: '11px',
                        fontWeight: 700
                    }}>
                        {p.value} Columns
                    </span>
                )
            },
            {
                field: 'rows',
                headerName: 'Records (Approx)',
                width: 140,
                cellRenderer: (p) => (
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: '#f8fafc',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '2px 10px',
                        fontSize: '11px',
                        fontWeight: 600
                    }}>
                        {Number(p.value || 0).toLocaleString()} Rows
                    </span>
                )
            },
            {
                field: 'engine',
                headerName: 'Storage Engine',
                width: 130,
                cellRenderer: (p) => (
                    <span style={{
                        background: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        fontWeight: 600
                    }}>
                        {p.value || 'InnoDB'}
                    </span>
                )
            },
            {
                field: 'collation',
                headerName: 'Collation',
                width: 170,
                cellRenderer: (p) => (
                    <span style={{
                        fontFamily: 'Consolas, monospace',
                        fontSize: '11px',
                        color: '#64748b'
                    }}>
                        {p.value}
                    </span>
                )
            },
            {
                headerName: 'Action',
                width: 150,
                pinned: 'right',
                sortable: false,
                filter: false,
                cellRenderer: (p) => (
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        <button
                            type="button"
                            onClick={() => handleInspectTable(p.data?.table_name)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: '#4f46e5',
                                border: '1px solid #4338ca',
                                borderRadius: '6px',
                                padding: '5px 12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#ffffff',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            title={`Inspect and manage columns of ${p.data?.table_name}`}
                        >
                            <span>Manage Columns</span>
                            <BiChevronRight size={14} />
                        </button>
                    </div>
                )
            }
        ];
    }, [handleInspectTable]);

    return (
        <div className={styles.container}>
            {/* Header Card */}
            <div className={styles.headerCard}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>
                        <BiServer style={{ color: '#4f46e5' }} /> Database Tables
                    </h1>
                    <p className={styles.subtitle}>
                        Overview of all database business tables. Click any table or choose "Manage Columns" to inspect its schema and add custom columns.
                    </p>
                </div>
                <div className={styles.actions}>
                    <button
                        className={styles.btnSecondary}
                        onClick={fetchTables}
                        disabled={loading}
                    >
                        <BiRefresh /> Refresh Tables
                    </button>
                </div>
            </div>

            {/* Dedicated AG Grid Table listing all tables */}
            <AgGridTable
                title="Database_Tables"
                rowData={tables}
                columnDefs={columnDefs}
                loading={loading}
                height="calc(100vh - 220px)"
                quickFilter={true}
                exportButtons={true}
                onRowClicked={(event) => {
                    if (event.data?.table_name) {
                        handleInspectTable(event.data.table_name);
                    }
                }}
            />
        </div>
    );
};

export default DatabaseTables;
