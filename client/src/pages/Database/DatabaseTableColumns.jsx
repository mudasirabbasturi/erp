import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    BiTable,
    BiArrowBack,
    BiPlus,
    BiEdit,
    BiTrash,
    BiRefresh,
    BiKey,
    BiLockAlt,
    BiCheckCircle,
    BiX,
    BiServer
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useToast } from '../../components/ui/Toast';
import { AgGridTable } from '../../components/Datatable/AgGridTable';
import Select from '../../components/ui/Select/Select';
import styles from './DatabaseTables.module.css';

const DATA_TYPES = [
    { type: 'VARCHAR', defaultLength: '255', hasLength: true, desc: 'Variable length string' },
    { type: 'TEXT', defaultLength: '', hasLength: false, desc: 'Long string up to 64KB' },
    { type: 'LONGTEXT', defaultLength: '', hasLength: false, desc: 'Large text data' },
    { type: 'INT', defaultLength: '11', hasLength: true, desc: 'Standard integer' },
    { type: 'BIGINT', defaultLength: '20', hasLength: true, desc: 'Large integer (IDs)' },
    { type: 'TINYINT', defaultLength: '1', hasLength: true, desc: 'Boolean / tiny flag (0 or 1)' },
    { type: 'DECIMAL', defaultLength: '10,2', hasLength: true, desc: 'Exact monetary / numeric' },
    { type: 'ENUM', defaultLength: '', hasLength: false, isEnum: true, desc: 'Predefined list of options' },
    { type: 'DATE', defaultLength: '', hasLength: false, desc: 'Date (YYYY-MM-DD)' },
    { type: 'DATETIME', defaultLength: '', hasLength: false, desc: 'Date & Time' },
    { type: 'TIMESTAMP', defaultLength: '', hasLength: false, desc: 'Auto timestamp' }
];

const DATA_TYPE_OPTIONS = DATA_TYPES.map(d => ({
    value: d.type,
    label: `${d.type} - ${d.desc}`
}));

const NULLABLE_OPTIONS = [
    { value: 1, label: 'YES (Allow NULL)' },
    { value: 0, label: 'NO (NOT NULL)' }
];

const DatabaseTableColumns = () => {
    const { tableName } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [columns, setColumns] = useState([]);
    const [loading, setLoading] = useState(true);

    // Add Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [addForm, setAddForm] = useState({
        column_name: '',
        comment: '',
        data_type: 'VARCHAR',
        length: '255',
        enum_options: [],
        is_nullable: 1,
        default_value: ''
    });
    const [addEnumOptionInput, setAddEnumOptionInput] = useState('');

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        column_name: '',
        comment: '',
        data_type: 'VARCHAR',
        length: '255',
        enum_options: [],
        is_nullable: 1,
        default_value: ''
    });
    const [editEnumOptionInput, setEditEnumOptionInput] = useState('');

    const [submitting, setSubmitting] = useState(false);

    // Fetch Columns for table
    const fetchColumns = useCallback(async () => {
        if (!tableName) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/schema/tables/${tableName}`);
            if (res.success && res.data) {
                setColumns(res.data.columns || []);
            } else {
                toast.error('Table Error', res.message || `Table ${tableName} not found`);
            }
        } catch (err) {
            toast.error('Schema Error', err.message || `Failed to fetch columns for ${tableName}`);
        } finally {
            setLoading(false);
        }
    }, [tableName, toast]);

    useEffect(() => {
        fetchColumns();
    }, [fetchColumns]);

    // Handle Data Type changes
    const handleAddTypeChange = (selectedType) => {
        const typeDef = DATA_TYPES.find(d => d.type === selectedType);
        setAddForm(prev => ({
            ...prev,
            data_type: selectedType,
            length: typeDef ? typeDef.defaultLength : '',
            enum_options: selectedType === 'ENUM' ? (prev.enum_options || []) : []
        }));
    };

    const handleEditTypeChange = (selectedType) => {
        const typeDef = DATA_TYPES.find(d => d.type === selectedType);
        setEditForm(prev => ({
            ...prev,
            data_type: selectedType,
            length: typeDef ? typeDef.defaultLength : '',
            enum_options: selectedType === 'ENUM' ? (prev.enum_options || []) : []
        }));
    };

    // Add modal ENUM helpers
    const handleAddAddEnumOption = () => {
        const trimmed = addEnumOptionInput.trim().replace(/^['"]+|['"]+$/g, '');
        if (!trimmed) return;
        if (addForm.enum_options.includes(trimmed)) {
            toast.warning('Duplicate Option', `Option "${trimmed}" is already added.`);
            return;
        }
        setAddForm(prev => ({
            ...prev,
            enum_options: [...prev.enum_options, trimmed]
        }));
        setAddEnumOptionInput('');
    };

    const handleRemoveAddEnumOption = (indexToRemove) => {
        setAddForm(prev => ({
            ...prev,
            enum_options: prev.enum_options.filter((_, idx) => idx !== indexToRemove)
        }));
    };

    // Edit modal ENUM helpers
    const handleAddEditEnumOption = () => {
        const trimmed = editEnumOptionInput.trim().replace(/^['"]+|['"]+$/g, '');
        if (!trimmed) return;
        if (editForm.enum_options.includes(trimmed)) {
            toast.warning('Duplicate Option', `Option "${trimmed}" is already added.`);
            return;
        }
        setEditForm(prev => ({
            ...prev,
            enum_options: [...prev.enum_options, trimmed]
        }));
        setEditEnumOptionInput('');
    };

    const handleRemoveEditEnumOption = (indexToRemove) => {
        setEditForm(prev => ({
            ...prev,
            enum_options: prev.enum_options.filter((_, idx) => idx !== indexToRemove)
        }));
    };

    const handleOpenAdd = () => {
        setAddForm({
            column_name: '',
            comment: '',
            data_type: 'VARCHAR',
            length: '255',
            enum_options: [],
            is_nullable: 1,
            default_value: ''
        });
        setAddEnumOptionInput('');
        setShowAddModal(true);
    };

    const handleOpenEdit = useCallback((col) => {
        const isEnum = col.base_type === 'ENUM';
        const typeDef = DATA_TYPES.find(d => d.type === col.base_type) || { type: isEnum ? 'ENUM' : 'VARCHAR', defaultLength: '255' };
        
        let parsedEnumOptions = col.enum_options || [];
        if ((!parsedEnumOptions || parsedEnumOptions.length === 0) && isEnum && col.length) {
            const matches = col.length.match(/'((?:[^'\\]|\\.)*)'/g);
            if (matches) {
                parsedEnumOptions = matches.map(m => m.replace(/^'|'$/g, '').replace(/\\'/g, "'"));
            } else {
                parsedEnumOptions = col.length.split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
            }
        }

        setEditForm({
            column_name: col.field,
            comment: col.comment || '',
            data_type: typeDef.type,
            length: col.length || typeDef.defaultLength,
            enum_options: parsedEnumOptions,
            is_nullable: col.null ? 1 : 0,
            default_value: col.default !== null && col.default !== undefined ? String(col.default) : ''
        });
        setEditEnumOptionInput('');
        setShowEditModal(true);
    }, []);

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        if (!addForm.column_name.trim() || !addForm.comment.trim()) {
            toast.warning('Validation Required', 'Column Name and Display Label/Comment are required.');
            return;
        }
        if (addForm.data_type === 'ENUM' && (!addForm.enum_options || addForm.enum_options.length === 0)) {
            toast.warning('ENUM Validation', 'Please add at least one ENUM option.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                ...addForm,
                is_nullable: addForm.is_nullable === 1,
                length: addForm.data_type === 'ENUM'
                    ? addForm.enum_options.map(o => `'${o}'`).join(',')
                    : addForm.length,
                enum_options: addForm.data_type === 'ENUM' ? addForm.enum_options : undefined
            };
            const res = await apiClient.post(`/schema/tables/${tableName}/columns`, payload);
            if (res.success) {
                toast.success('Column Added', `Column '${addForm.column_name}' successfully added to table '${tableName}'.`);
                setShowAddModal(false);
                fetchColumns();
            } else {
                toast.error('Add Failed', res.message || 'Failed to add column');
            }
        } catch (err) {
            toast.error('Add Failed', err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editForm.comment.trim()) {
            toast.warning('Validation Required', 'Display Label / Comment is required.');
            return;
        }
        if (editForm.data_type === 'ENUM' && (!editForm.enum_options || editForm.enum_options.length === 0)) {
            toast.warning('ENUM Validation', 'Please add at least one ENUM option.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                ...editForm,
                is_nullable: editForm.is_nullable === 1,
                length: editForm.data_type === 'ENUM'
                    ? editForm.enum_options.map(o => `'${o}'`).join(',')
                    : editForm.length,
                enum_options: editForm.data_type === 'ENUM' ? editForm.enum_options : undefined
            };
            const res = await apiClient.put(`/schema/tables/${tableName}/columns`, payload);
            if (res.success) {
                toast.success('Column Updated', `Column '${editForm.column_name}' updated successfully.`);
                setShowEditModal(false);
                fetchColumns();
            } else {
                toast.error('Update Failed', res.message || 'Failed to update column');
            }
        } catch (err) {
            toast.error('Update Failed', err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteColumn = useCallback(async (col) => {
        if (!col || !col.field) return;
        const confirmMsg = `Are you sure you want to delete column "${col.field}" (${col.comment || ''}) from table "${tableName}"?\n\nWARNING: All data stored in this column will be permanently deleted!`;
        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await apiClient.delete(`/schema/tables/${tableName}/columns/${col.field}`);
            if (res.success) {
                toast.success('Column Deleted', `Column "${col.field}" was deleted from table "${tableName}".`);
                fetchColumns();
            } else {
                toast.error('Delete Failed', res.message || 'Failed to delete column');
            }
        } catch (err) {
            toast.error('Delete Failed', err.message);
        }
    }, [tableName, toast, fetchColumns]);

    const currentAddTypeDef = DATA_TYPES.find(d => d.type === addForm.data_type) || { hasLength: false };
    const currentEditTypeDef = DATA_TYPES.find(d => d.type === editForm.data_type) || { hasLength: false };

    // AG Grid column definitions
    const columnDefs = useMemo(() => {
        return [
            {
                field: 'field',
                headerName: 'Column Name',
                width: 180,
                pinned: 'left',
                cellRenderer: (p) => {
                    const isPri = p.data?.key === 'PRI';
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '100%' }}>
                            {isPri ? (
                                <span title="Primary Key" style={{ color: '#d97706', display: 'flex', alignItems: 'center' }}>
                                    <BiKey size={15} />
                                </span>
                            ) : (
                                <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                                    <BiTable size={14} />
                                </span>
                            )}
                            <span style={{
                                fontFamily: 'Consolas, Monaco, monospace',
                                fontWeight: 700,
                                color: isPri ? '#b45309' : '#0f172a'
                            }}>
                                {p.value}
                            </span>
                        </div>
                    );
                }
            },
            {
                field: 'comment',
                headerName: 'Display Label / Comment',
                flex: 2,
                minWidth: 200,
                cellRenderer: (p) => (
                    <span style={{ fontWeight: 500, color: '#1e293b' }}>
                        {p.value || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>— No label —</span>}
                    </span>
                )
            },
            {
                field: 'type',
                headerName: 'Data Type',
                width: 170,
                cellRenderer: (p) => (
                    <span style={{
                        fontFamily: 'Consolas, Monaco, monospace',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: '#f1f5f9',
                        color: '#334155',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0'
                    }}>
                        {p.value ? p.value.toUpperCase() : ''}
                    </span>
                )
            },
            {
                field: 'null',
                headerName: 'Nullable',
                width: 110,
                cellRenderer: (p) => {
                    const isNull = p.value === true;
                    return isNull ? (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: '#ecfdf5',
                            color: '#065f46',
                            border: '1px solid #a7f3d0',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: 600
                        }}>
                            YES
                        </span>
                    ) : (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: '#f8fafc',
                            color: '#64748b',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: 600
                        }}>
                            NO
                        </span>
                    );
                }
            },
            {
                field: 'key',
                headerName: 'Key',
                width: 90,
                cellRenderer: (p) => {
                    if (!p.value) return <span style={{ color: '#94a3b8' }}>—</span>;
                    return (
                        <span style={{
                            background: p.value === 'PRI' ? '#fef3c7' : '#e0e7ff',
                            color: p.value === 'PRI' ? '#92400e' : '#3730a3',
                            border: `1px solid ${p.value === 'PRI' ? '#fde68a' : '#c7d2fe'}`,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700
                        }}>
                            {p.value}
                        </span>
                    );
                }
            },
            {
                field: 'default',
                headerName: 'Default Value',
                width: 130,
                cellRenderer: (p) => {
                    if (p.value === null || p.value === undefined) {
                        return <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>NULL</span>;
                    }
                    return (
                        <span style={{ fontFamily: 'Consolas, monospace', fontSize: '12px', color: '#334155' }}>
                            {String(p.value)}
                        </span>
                    );
                }
            },
            {
                field: 'is_system',
                headerName: 'Classification',
                width: 140,
                cellRenderer: (p) => {
                    const isSystem = p.data?.is_system === true || p.data?.is_internal === true;
                    return isSystem ? (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#f1f5f9',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: 600
                        }}>
                            <BiLockAlt size={12} /> Protected
                        </span>
                    ) : (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#eef2ff',
                            color: '#4338ca',
                            border: '1px solid #c7d2fe',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: 600
                        }}>
                            <BiCheckCircle size={12} /> Custom
                        </span>
                    );
                }
            },
            {
                headerName: 'Actions',
                width: 165,
                pinned: 'right',
                sortable: false,
                filter: false,
                cellRenderer: (p) => {
                    const isSystem = p.data?.is_system === true || p.data?.is_internal === true;
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '100%' }}>
                            <button
                                type="button"
                                onClick={() => handleOpenEdit(p.data)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '5px',
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#4f46e5',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                                title="Edit Column Attributes"
                            >
                                <BiEdit size={13} /> Edit
                            </button>
                            {!isSystem && (
                                <button
                                    type="button"
                                    onClick={() => handleDeleteColumn(p.data)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: '#fff1f2',
                                        border: '1px solid #fecdd3',
                                        borderRadius: '5px',
                                        padding: '3px 8px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: '#e11d48',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                    title="Delete Custom Column"
                                >
                                    <BiTrash size={13} /> Delete
                                </button>
                            )}
                        </div>
                    );
                }
            }
        ];
    }, [handleOpenEdit, handleDeleteColumn]);

    return (
        <div className={styles.container}>
            {/* Header Navigation Bar */}
            <div className={styles.headerCard}>
                <div className={styles.headerLeft}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={() => navigate('/database/tables')}
                            className={styles.btnSecondary}
                            style={{ padding: '6px 10px' }}
                            title="Back to Tables List"
                        >
                            <BiArrowBack size={16} /> Tables List
                        </button>
                        <h1 className={styles.title}>
                            <BiServer style={{ color: '#4f46e5' }} /> Table Schema: <span style={{ color: '#4f46e5', fontFamily: 'Consolas, monospace' }}>{tableName}</span>
                        </h1>
                    </div>
                    <p className={styles.subtitle} style={{ marginLeft: '120px' }}>
                        Displaying all {columns.length} columns in table '{tableName}'. Add custom attributes or update field labels. Column deletion is permanently restricted.
                    </p>
                </div>
                <div className={styles.actions}>
                    <button
                        className={styles.btnSecondary}
                        onClick={fetchColumns}
                        disabled={loading}
                    >
                        <BiRefresh /> Refresh
                    </button>
                    <button className={styles.btnPrimary} onClick={handleOpenAdd}>
                        <BiPlus /> Add New Column
                    </button>
                </div>
            </div>

            {/* Standalone AG Grid Table for Table Columns */}
            <AgGridTable
                title={`Table_${tableName}_Columns`}
                rowData={columns}
                columnDefs={columnDefs}
                loading={loading}
                height="calc(100vh - 250px)"
                quickFilter={true}
                exportButtons={true}
            />

            {/* Add Column Modal (Strictly Custom Select, No Native Select) */}
            {showAddModal && (
                <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>Add Custom Column to `{tableName}`</h3>
                            <button className={styles.closeBtn} onClick={() => setShowAddModal(false)}>
                                <BiX />
                            </button>
                        </div>
                        <form onSubmit={handleAddSubmit}>
                            <div className={styles.modalBody}>
                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Column Name (Database Field) *</label>
                                        <input
                                            type="text"
                                            className={styles.formInput}
                                            placeholder="e.g. passport_number, emergency_phone"
                                            value={addForm.column_name}
                                            onChange={(e) => setAddForm({ ...addForm, column_name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                                            required
                                        />
                                        <span className={styles.helperText}>Lowercase letters, numbers, and underscores only</span>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Display Label / Comment *</label>
                                        <input
                                            type="text"
                                            className={styles.formInput}
                                            placeholder="e.g. Passport Number"
                                            value={addForm.comment}
                                            onChange={(e) => setAddForm({ ...addForm, comment: e.target.value })}
                                            required
                                        />
                                        <span className={styles.helperText}>Human-readable label shown across the system</span>
                                    </div>
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Data Type *</label>
                                        <Select
                                            searchable={true}
                                            showSearch={true}
                                            options={DATA_TYPE_OPTIONS}
                                            value={addForm.data_type}
                                            onChange={handleAddTypeChange}
                                        />
                                    </div>
                                    {addForm.data_type !== 'ENUM' && (
                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>Length / Values</label>
                                            <input
                                                type="text"
                                                className={`${styles.formInput} ${!currentAddTypeDef.hasLength ? styles.readOnlyField : ''}`}
                                                placeholder={currentAddTypeDef.hasLength ? 'e.g. 255' : 'Not required for this type'}
                                                value={addForm.length}
                                                onChange={(e) => setAddForm({ ...addForm, length: e.target.value })}
                                                disabled={!currentAddTypeDef.hasLength}
                                            />
                                            <span className={styles.helperText}>
                                                {currentAddTypeDef.hasLength ? `Recommended default: ${currentAddTypeDef.defaultLength}` : 'Length is not applicable'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {addForm.data_type === 'ENUM' && (
                                    <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                                        <label className={styles.formLabel}>Allowed ENUM Options *</label>
                                        <div className={styles.enumContainer}>
                                            <div className={styles.enumTagList}>
                                                {(!addForm.enum_options || addForm.enum_options.length === 0) ? (
                                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                                        No options added yet. Type an option name below and click "+ Add Option".
                                                    </span>
                                                ) : (
                                                    addForm.enum_options.map((opt, idx) => (
                                                        <span key={idx} className={styles.enumTag}>
                                                            {opt}
                                                            <button
                                                                type="button"
                                                                className={styles.enumTagRemove}
                                                                onClick={() => handleRemoveAddEnumOption(idx)}
                                                                title="Remove option"
                                                            >
                                                                <BiX size={14} />
                                                            </button>
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                            <div className={styles.enumInputRow}>
                                                <input
                                                    type="text"
                                                    className={styles.enumAddInput}
                                                    placeholder="Type an option name (e.g. Active, Pending, VIP)..."
                                                    value={addEnumOptionInput}
                                                    onChange={(e) => setAddEnumOptionInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAddAddEnumOption();
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    className={styles.enumAddBtn}
                                                    onClick={handleAddAddEnumOption}
                                                >
                                                    <BiPlus size={14} /> Add Option
                                                </button>
                                            </div>
                                            <span className={styles.enumHelper}>
                                                Quotes and commas are injected in the background automatically. No manual syntax needed.
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Allow Null *</label>
                                        <Select
                                            options={NULLABLE_OPTIONS}
                                            value={addForm.is_nullable}
                                            onChange={(val) => setAddForm({ ...addForm, is_nullable: val })}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Default Value</label>
                                        {addForm.data_type === 'ENUM' && addForm.enum_options?.length > 0 ? (
                                            <Select
                                                options={[
                                                    { value: '', label: '— No Default (or NULL) —' },
                                                    ...addForm.enum_options.map(opt => ({ value: opt, label: opt }))
                                                ]}
                                                value={addForm.default_value}
                                                onChange={(val) => setAddForm({ ...addForm, default_value: val })}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                className={styles.formInput}
                                                placeholder="Leave empty for NULL"
                                                value={addForm.default_value}
                                                onChange={(e) => setAddForm({ ...addForm, default_value: e.target.value })}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className={styles.modalFooter}>
                                <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    onClick={() => setShowAddModal(false)}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                                    {submitting ? 'Creating Column...' : 'Add Column to Table'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Column Modal (Strictly Custom Select, No Native Select) */}
            {showEditModal && (
                <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>
                                Edit Column `{editForm.column_name}` in `{tableName}`
                            </h3>
                            <button className={styles.closeBtn} onClick={() => setShowEditModal(false)}>
                                <BiX />
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit}>
                            <div className={styles.modalBody}>
                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Column Name (Permanent)</label>
                                        <input
                                            type="text"
                                            className={`${styles.formInput} ${styles.readOnlyField}`}
                                            value={editForm.column_name}
                                            readOnly
                                            disabled
                                        />
                                        <span className={styles.helperText}>Field identifiers cannot be renamed directly</span>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Display Label / Comment *</label>
                                        <input
                                            type="text"
                                            className={styles.formInput}
                                            value={editForm.comment}
                                            onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                                            required
                                        />
                                        <span className={styles.helperText}>Label used in permissions, active columns, and forms</span>
                                    </div>
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Data Type</label>
                                        <Select
                                            searchable={true}
                                            showSearch={true}
                                            options={DATA_TYPE_OPTIONS}
                                            value={editForm.data_type}
                                            onChange={handleEditTypeChange}
                                        />
                                    </div>
                                    {editForm.data_type !== 'ENUM' && (
                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>Length / Values</label>
                                            <input
                                                type="text"
                                                className={`${styles.formInput} ${!currentEditTypeDef.hasLength ? styles.readOnlyField : ''}`}
                                                value={editForm.length}
                                                onChange={(e) => setEditForm({ ...editForm, length: e.target.value })}
                                                disabled={!currentEditTypeDef.hasLength}
                                            />
                                            <span className={styles.helperText}>
                                                {currentEditTypeDef.hasLength ? `Recommended default: ${currentEditTypeDef.defaultLength}` : 'Length is not applicable'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {editForm.data_type === 'ENUM' && (
                                    <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                                        <label className={styles.formLabel}>Allowed ENUM Options *</label>
                                        <div className={styles.enumContainer}>
                                            <div className={styles.enumTagList}>
                                                {(!editForm.enum_options || editForm.enum_options.length === 0) ? (
                                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                                        No options configured. Type an option name below and click "+ Add Option".
                                                    </span>
                                                ) : (
                                                    editForm.enum_options.map((opt, idx) => (
                                                        <span key={idx} className={styles.enumTag}>
                                                            {opt}
                                                            <button
                                                                type="button"
                                                                className={styles.enumTagRemove}
                                                                onClick={() => handleRemoveEditEnumOption(idx)}
                                                                title="Remove option"
                                                            >
                                                                <BiX size={14} />
                                                            </button>
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                            <div className={styles.enumInputRow}>
                                                <input
                                                    type="text"
                                                    className={styles.enumAddInput}
                                                    placeholder="Type an option name (e.g. Active, Inactive, Archived)..."
                                                    value={editEnumOptionInput}
                                                    onChange={(e) => setEditEnumOptionInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAddEditEnumOption();
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    className={styles.enumAddBtn}
                                                    onClick={handleAddEditEnumOption}
                                                >
                                                    <BiPlus size={14} /> Add Option
                                                </button>
                                            </div>
                                            <span className={styles.enumHelper}>
                                                Quotes and commas are injected in the background automatically. No manual syntax needed.
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Allow Null</label>
                                        <Select
                                            options={NULLABLE_OPTIONS}
                                            value={editForm.is_nullable}
                                            onChange={(val) => setEditForm({ ...editForm, is_nullable: val })}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Default Value</label>
                                        {editForm.data_type === 'ENUM' && editForm.enum_options?.length > 0 ? (
                                            <Select
                                                options={[
                                                    { value: '', label: '— No Default (or NULL) —' },
                                                    ...editForm.enum_options.map(opt => ({ value: opt, label: opt }))
                                                ]}
                                                value={editForm.default_value}
                                                onChange={(val) => setEditForm({ ...editForm, default_value: val })}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                className={styles.formInput}
                                                value={editForm.default_value}
                                                onChange={(e) => setEditForm({ ...editForm, default_value: e.target.value })}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className={styles.modalFooter}>
                                <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    onClick={() => setShowEditModal(false)}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                                    {submitting ? 'Saving Changes...' : 'Save Column Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatabaseTableColumns;

