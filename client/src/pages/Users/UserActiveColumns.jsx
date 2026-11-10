import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    BiSave,
    BiRefresh,
    BiTable
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useToast } from '../../components/ui/Toast';
import { AgGridTable } from '../../components/Datatable/AgGridTable';
import styles from './UserActiveColumns.module.css';

const CheckboxHeaderComponent = ({ displayName, checked, indeterminate, onToggle }) => {
    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onToggle();
            }}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                cursor: 'pointer',
                userSelect: 'none'
            }}
            title={`Click to check/uncheck all for ${displayName}`}
        >
            <span style={{ fontWeight: 700, fontSize: '12px', color: '#334155' }}>{displayName}</span>
            <input
                type="checkbox"
                checked={checked}
                ref={(el) => {
                    if (el) el.indeterminate = indeterminate;
                }}
                onChange={() => { }}
                style={{
                    width: '16px',
                    height: '16px',
                    accentColor: '#4f46e5',
                    cursor: 'pointer',
                    pointerEvents: 'none'
                }}
            />
        </div>
    );
};

const UserActiveColumns = () => {
    const toast = useToast();
    const [columns, setColumns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/columns/config/users');
            if (res.success && res.data) {
                setColumns(res.data);
            } else {
                toast.error('Load Error', res.message || 'Failed to load column configurations');
            }
        } catch (err) {
            toast.error('Load Error', err.message || 'Failed to load column configurations');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    // Single row toggle
    const handleToggle = useCallback((columnName, field) => {
        setColumns((prev) =>
            prev.map((col) => {
                if (col.column_name === columnName) {
                    const nextVal = col[field] === 1 ? 0 : 1;
                    // If deactivating column, also uncheck list and view visibility
                    if (field === 'is_active' && nextVal === 0) {
                        return { ...col, is_active: 0, is_list_visible: 0, is_view_visible: 0 };
                    }
                    // If activating list or view visibility, ensure is_active is 1
                    if ((field === 'is_list_visible' || field === 'is_view_visible') && nextVal === 1) {
                        return { ...col, [field]: 1, is_active: 1 };
                    }
                    return { ...col, [field]: nextVal };
                }
                return col;
            })
        );
    }, []);

    // Column header toggle all for specific field
    const handleToggleColumnAll = useCallback((field, check) => {
        setColumns((prev) =>
            prev.map((col) => {
                if (field === 'is_active') {
                    if (check) {
                        return { ...col, is_active: 1 };
                    } else {
                        return { ...col, is_active: 0, is_list_visible: 0, is_view_visible: 0 };
                    }
                } else if (field === 'is_list_visible') {
                    if (check) {
                        return { ...col, is_list_visible: 1, is_active: 1 };
                    } else {
                        return { ...col, is_list_visible: 0 };
                    }
                } else if (field === 'is_view_visible') {
                    if (check) {
                        return { ...col, is_view_visible: 1, is_active: 1 };
                    } else {
                        return { ...col, is_view_visible: 0 };
                    }
                }
                return col;
            })
        );
    }, []);

    // Global Enable All / Disable All
    const handleSelectAllGlobal = useCallback((enableAll) => {
        setColumns((prev) =>
            prev.map((col) => ({
                ...col,
                is_active: enableAll ? 1 : 0,
                is_list_visible: enableAll ? 1 : 0,
                is_view_visible: enableAll ? 1 : 0
            }))
        );
    }, []);

    // Save changes to backend
    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await apiClient.post('/columns/config/users', { columns });
            if (res.success) {
                toast.success('Configuration Saved', 'Active columns & visibility settings saved! Database queries optimized.');
            } else {
                toast.error('Save Failed', res.message || 'Failed to save configuration');
            }
        } catch (err) {
            toast.error('Save Failed', err.message);
        } finally {
            setSaving(false);
        }
    };

    // Header checkbox states for each toggle column
    const totalCount = columns.length;
    const activeCount = columns.filter((c) => c.is_active === 1).length;
    const activeAllChecked = totalCount > 0 && activeCount === totalCount;
    const activeIndeterminate = activeCount > 0 && activeCount < totalCount;

    const listCount = columns.filter((c) => c.is_list_visible === 1).length;
    const listAllChecked = totalCount > 0 && listCount === totalCount;
    const listIndeterminate = listCount > 0 && listCount < totalCount;

    const viewCount = columns.filter((c) => c.is_view_visible === 1).length;
    const viewAllChecked = totalCount > 0 && viewCount === totalCount;
    const viewIndeterminate = viewCount > 0 && viewCount < totalCount;

    // AG Grid column definitions
    const columnDefs = useMemo(() => {
        return [
            {
                field: 'column_name',
                headerName: 'Column Name (DB)',
                flex: 2,
                minWidth: 180,
                pinned: 'left',
                cellRenderer: (p) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%' }}>
                        <span style={{ color: '#6366f1' }}>
                            <BiTable size={15} />
                        </span>
                        <span style={{
                            fontFamily: 'Consolas, Monaco, monospace',
                            fontWeight: 700,
                            color: '#0f172a',
                            fontSize: '13px'
                        }}>
                            {p.value}
                        </span>
                    </div>
                )
            },
            {
                field: 'label',
                headerName: 'Display Label',
                flex: 2,
                minWidth: 200,
                cellRenderer: (p) => (
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                        {p.value || p.data?.column_name}
                    </span>
                )
            },
            {
                field: 'is_active',
                headerName: 'Active (Fetch in SQL)',
                width: 210,
                sortable: false,
                filter: false,
                headerComponent: () => (
                    <CheckboxHeaderComponent
                        displayName="Active (Fetch in SQL)"
                        checked={activeAllChecked}
                        indeterminate={activeIndeterminate}
                        onToggle={() => handleToggleColumnAll('is_active', !activeAllChecked)}
                    />
                ),
                cellRenderer: (p) => {
                    const val = p.value === 1;
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <input
                                type="checkbox"
                                checked={val}
                                onChange={() => handleToggle(p.data?.column_name, 'is_active')}
                                style={{ width: '17px', height: '17px', accentColor: '#4f46e5', cursor: 'pointer' }}
                            />
                        </div>
                    );
                }
            },
            {
                field: 'is_list_visible',
                headerName: 'List View Visible',
                width: 190,
                sortable: false,
                filter: false,
                headerComponent: () => (
                    <CheckboxHeaderComponent
                        displayName="List View Visible"
                        checked={listAllChecked}
                        indeterminate={listIndeterminate}
                        onToggle={() => handleToggleColumnAll('is_list_visible', !listAllChecked)}
                    />
                ),
                cellRenderer: (p) => {
                    const val = p.value === 1;
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <input
                                type="checkbox"
                                checked={val}
                                onChange={() => handleToggle(p.data?.column_name, 'is_list_visible')}
                                style={{ width: '17px', height: '17px', accentColor: '#4f46e5', cursor: 'pointer' }}
                            />
                        </div>
                    );
                }
            },
            {
                field: 'is_view_visible',
                headerName: 'Profile View Visible',
                width: 190,
                sortable: false,
                filter: false,
                headerComponent: () => (
                    <CheckboxHeaderComponent
                        displayName="Profile View Visible"
                        checked={viewAllChecked}
                        indeterminate={viewIndeterminate}
                        onToggle={() => handleToggleColumnAll('is_view_visible', !viewAllChecked)}
                    />
                ),
                cellRenderer: (p) => {
                    const val = p.value === 1;
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <input
                                type="checkbox"
                                checked={val}
                                onChange={() => handleToggle(p.data?.column_name, 'is_view_visible')}
                                style={{ width: '17px', height: '17px', accentColor: '#4f46e5', cursor: 'pointer' }}
                            />
                        </div>
                    );
                }
            }
        ];
    }, [
        handleToggle,
        handleToggleColumnAll,
        activeAllChecked,
        activeIndeterminate,
        listAllChecked,
        listIndeterminate,
        viewAllChecked,
        viewIndeterminate
    ]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* AG Grid Table for Active Columns */}
            <AgGridTable
                rowData={columns}
                columnDefs={columnDefs}
                loading={loading}
                height="calc(100vh - 160px)"
                quickFilter={true}
                exportButtons={true}
                extraHeaderActions={
                    <>
                        <button
                            type="button"
                            className={styles.quickBtn}
                            onClick={() => handleSelectAllGlobal(true)}
                        >
                            Enable All
                        </button>
                        <button
                            type="button"
                            className={styles.quickBtn}
                            onClick={() => handleSelectAllGlobal(false)}
                        >
                            Disable All
                        </button>
                        <button
                            type="button"
                            className={styles.btnPrimary}
                            onClick={handleSave}
                            disabled={saving}
                            style={{ padding: '6px 14px', fontSize: '12px' }}
                        >
                            <BiSave size={16} /> {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                        <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={fetchConfig}
                            disabled={loading || saving}
                            title="Reload"
                            style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <BiRefresh size={18} />
                        </button>
                    </>
                }
            />
        </div>
    );
};

export default UserActiveColumns;
