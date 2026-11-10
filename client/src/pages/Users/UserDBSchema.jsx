import React, { useState, useEffect } from 'react';
import {
    BiServer,
    BiPlus,
    BiEdit,
    BiRefresh,
    BiSearch,
    BiKey,
    BiTable,
    BiX,
    BiCheckCircle
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useToast } from '../../components/ui/Toast';
import Select from '../../components/ui/Select/Select';
import styles from './UserDBSchema.module.css';

const DATA_TYPES = [
    'VARCHAR(255)',
    'VARCHAR(100)',
    'VARCHAR(500)',
    'TEXT',
    'LONGTEXT',
    'INT(11)',
    'BIGINT(20) UNSIGNED',
    'TINYINT(1)',
    'DECIMAL(10,2)',
    'DATE',
    'DATETIME',
    'TIMESTAMP'
];

const UserDBSchema = () => {
    const toast = useToast();
    const [columns, setColumns] = useState([]);
    const [allTables, setAllTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTableTab, setSelectedTableTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Add Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [addForm, setAddForm] = useState({
        table: 'user_profiles',
        column_name: '',
        comment: '',
        data_type: 'VARCHAR(255)',
        is_nullable: true,
        default_value: '',
        foreign_table: '',
        foreign_column: '',
        on_delete_action: 'SET NULL'
    });

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        table: '',
        column_name: '',
        comment: '',
        data_type: 'VARCHAR(255)',
        is_nullable: true,
        default_value: ''
    });

    const [submitting, setSubmitting] = useState(false);

    const showNotification = (message, type = 'info') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast.info(message);
    };

    const fetchSchema = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/schema/users');
            if (res.success && res.data) {
                setColumns(res.data.columns || []);
                setAllTables(res.data.all_tables || []);
            }
        } catch (err) {
            showNotification(err.message || 'Failed to load user DB schema', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchema();
    }, []);

    // Filter columns
    const filteredColumns = columns.filter((col) => {
        const matchesTab =
            selectedTableTab === 'all' || col.table === selectedTableTab;
        const matchesSearch =
            col.field.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (col.comment && col.comment.toLowerCase().includes(searchQuery.toLowerCase())) ||
            col.type.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesSearch;
    });

    const handleOpenAdd = () => {
        setAddForm({
            table: 'user_profiles',
            column_name: '',
            comment: '',
            data_type: 'VARCHAR(255)',
            is_nullable: true,
            default_value: '',
            foreign_table: '',
            foreign_column: '',
            on_delete_action: 'SET NULL'
        });
        setShowAddModal(true);
    };

    const handleOpenEdit = (col) => {
        setEditForm({
            table: col.table,
            column_name: col.field,
            comment: col.comment || '',
            data_type: col.type.toUpperCase(),
            is_nullable: col.null,
            default_value: col.default !== null ? String(col.default) : ''
        });
        setShowEditModal(true);
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        if (!addForm.column_name || !addForm.comment) {
            showNotification('Column Name and Label/Comment are required.', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const res = await apiClient.post('/schema/users/columns', addForm);
            if (res.success) {
                showNotification(`Column '${addForm.column_name}' added successfully to ${addForm.table}!`, 'success');
                setShowAddModal(false);
                fetchSchema();
            } else {
                showNotification(res.message || 'Failed to add column', 'error');
            }
        } catch (err) {
            showNotification(err.message || 'Failed to add column', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editForm.comment) {
            showNotification('Label/Comment is required.', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const res = await apiClient.put('/schema/users/columns', editForm);
            if (res.success) {
                showNotification(`Column '${editForm.column_name}' updated successfully!`, 'success');
                setShowEditModal(false);
                fetchSchema();
            } else {
                showNotification(res.message || 'Failed to update column', 'error');
            }
        } catch (err) {
            showNotification(err.message || 'Failed to update column', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.container}>

            {/* Header */}
            <div className={styles.headerCard}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>
                        <BiServer style={{ color: '#4f46e5' }} /> User Database Schema Manager
                    </h1>
                    <p className={styles.subtitle}>
                        Manage live database columns, human-readable labels, and types for <code>users</code> and <code>user_profiles</code>.
                    </p>
                </div>
                <div className={styles.actions}>
                    <button className={styles.btnSecondary} onClick={fetchSchema} disabled={loading}>
                        <BiRefresh /> Refresh
                    </button>
                    <button className={styles.btnPrimary} onClick={handleOpenAdd}>
                        <BiPlus /> Add Column
                    </button>
                </div>
            </div>

            {/* Control Bar */}
            <div className={styles.controlsBar}>
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${selectedTableTab === 'all' ? styles.activeTab : ''}`}
                        onClick={() => setSelectedTableTab('all')}
                    >
                        All Columns ({columns.length})
                    </button>
                    <button
                        className={`${styles.tab} ${selectedTableTab === 'users' ? styles.activeTab : ''}`}
                        onClick={() => setSelectedTableTab('users')}
                    >
                        users Table ({columns.filter(c => c.table === 'users').length})
                    </button>
                    <button
                        className={`${styles.tab} ${selectedTableTab === 'user_profiles' ? styles.activeTab : ''}`}
                        onClick={() => setSelectedTableTab('user_profiles')}
                    >
                        user_profiles Table ({columns.filter(c => c.table === 'user_profiles').length})
                    </button>
                </div>

                <div className={styles.searchBox}>
                    <BiSearch style={{ color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Search column, label, or type..."
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Schema Table */}
            <div className={styles.tableContainer}>
                <table className={styles.schemaTable}>
                    <thead>
                        <tr>
                            <th>Table</th>
                            <th>Field / Column</th>
                            <th>Label (Comment)</th>
                            <th>Data Type</th>
                            <th>Nullable</th>
                            <th>Default</th>
                            <th>Key / Foreign Key</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="8" className={styles.emptyState}>
                                    Loading live database schema...
                                </td>
                            </tr>
                        ) : filteredColumns.length === 0 ? (
                            <tr>
                                <td colSpan="8" className={styles.emptyState}>
                                    No database columns match your filter.
                                </td>
                            </tr>
                        ) : (
                            filteredColumns.map((col, idx) => (
                                <tr key={`${col.table}-${col.field}-${idx}`}>
                                    <td>
                                        <span className={col.table === 'users' ? styles.badgeTable : styles.badgeTableProfile}>
                                            {col.table}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={styles.fieldCode}>{col.field}</span>
                                        {col.is_system && <span className={styles.systemBadge} style={{ marginLeft: 6 }}>System</span>}
                                    </td>
                                    <td>
                                        <strong>{col.comment || col.field}</strong>
                                    </td>
                                    <td>
                                        <span className={styles.typeCode}>{col.type}</span>
                                    </td>
                                    <td>
                                        {col.null ? (
                                            <span style={{ color: '#10b981', fontWeight: 600 }}>YES</span>
                                        ) : (
                                            <span style={{ color: '#ef4444', fontWeight: 600 }}>NO</span>
                                        )}
                                    </td>
                                    <td style={{ color: col.default !== null ? '#0f172a' : '#94a3b8', fontStyle: col.default === null ? 'italic' : 'normal' }}>
                                        {col.default !== null ? String(col.default) : 'NULL'}
                                    </td>
                                    <td>
                                        {col.foreign_key ? (
                                            <span className={styles.fkBadge}>
                                                <BiKey /> {col.foreign_key}
                                            </span>
                                        ) : col.key ? (
                                            <span style={{ fontSize: 11, fontWeight: 600, color: '#6366f1' }}>{col.key}</span>
                                        ) : (
                                            <span style={{ color: '#cbd5e1' }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {!col.is_system ? (
                                            <button
                                                className={styles.btnEdit}
                                                onClick={() => handleOpenEdit(col)}
                                                title="Edit column label and properties"
                                            >
                                                <BiEdit /> Edit
                                            </button>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: 12 }}>Protected</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Column Modal */}
            {showAddModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>Add New Column</h2>
                            <button className={styles.closeBtn} onClick={() => setShowAddModal(false)}>
                                <BiX />
                            </button>
                        </div>
                        <form onSubmit={handleAddSubmit}>
                            <div className={styles.modalBody}>
                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Target Table *</label>
                                        <Select
                                            options={[
                                                { value: 'user_profiles', label: 'user_profiles (Recommended for Custom Fields)' },
                                                { value: 'users', label: 'users (Core Account)' }
                                            ]}
                                            value={addForm.table}
                                            onChange={(val) => setAddForm({ ...addForm, table: val })}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Data Type *</label>
                                        <Select
                                            searchable={true}
                                            showSearch={true}
                                            options={DATA_TYPES.map(dt => ({ value: dt, label: dt }))}
                                            value={addForm.data_type}
                                            onChange={(val) => setAddForm({ ...addForm, data_type: val })}
                                        />
                                    </div>
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Column Name (DB field) *</label>
                                        <input
                                            type="text"
                                            className={styles.formInput}
                                            placeholder="e.g. passport_number"
                                            value={addForm.column_name}
                                            onChange={(e) => setAddForm({ ...addForm, column_name: e.target.value })}
                                            required
                                        />
                                        <span className={styles.helperText}>Lowercase letters, numbers, and underscores only.</span>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Label / Comment *</label>
                                        <input
                                            type="text"
                                            className={styles.formInput}
                                            placeholder="e.g. Passport Number"
                                            value={addForm.comment}
                                            onChange={(e) => setAddForm({ ...addForm, comment: e.target.value })}
                                            required
                                        />
                                        <span className={styles.helperText}>Display label used across UI and permissions.</span>
                                    </div>
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Default Value</label>
                                        <input
                                            type="text"
                                            className={styles.formInput}
                                            placeholder="Leave blank for none / NULL"
                                            value={addForm.default_value}
                                            onChange={(e) => setAddForm({ ...addForm, default_value: e.target.value })}
                                        />
                                    </div>
                                    <div className={styles.formGroup} style={{ justifyContent: 'center' }}>
                                        <label className={styles.checkboxLabel} style={{ marginTop: 22 }}>
                                            <input
                                                type="checkbox"
                                                checked={addForm.is_nullable}
                                                onChange={(e) => setAddForm({ ...addForm, is_nullable: e.target.checked })}
                                            />
                                            Allow NULL values
                                        </label>
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
                                    {submitting ? 'Adding...' : 'Add Column'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Column Modal */}
            {showEditModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>Edit Column Properties</h2>
                            <button className={styles.closeBtn} onClick={() => setShowEditModal(false)}>
                                <BiX />
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit}>
                            <div className={styles.modalBody}>
                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Table</label>
                                        <input
                                            type="text"
                                            className={`${styles.formInput} ${styles.readOnlyField}`}
                                            value={editForm.table}
                                            readOnly
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Column Field</label>
                                        <input
                                            type="text"
                                            className={`${styles.formInput} ${styles.readOnlyField}`}
                                            value={editForm.column_name}
                                            readOnly
                                        />
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Label / Comment *</label>
                                    <input
                                        type="text"
                                        className={styles.formInput}
                                        value={editForm.comment}
                                        onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                                        required
                                    />
                                    <span className={styles.helperText}>Human-readable name used across forms and permissions.</span>
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Data Type</label>
                                        <Select
                                            searchable={true}
                                            showSearch={true}
                                            options={DATA_TYPES.map(dt => ({ value: dt, label: dt }))}
                                            value={editForm.data_type}
                                            onChange={(val) => setEditForm({ ...editForm, data_type: val })}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Default Value</label>
                                        <input
                                            type="text"
                                            className={styles.formInput}
                                            value={editForm.default_value}
                                            onChange={(e) => setEditForm({ ...editForm, default_value: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={editForm.is_nullable}
                                            onChange={(e) => setEditForm({ ...editForm, is_nullable: e.target.checked })}
                                        />
                                        Allow NULL values
                                    </label>
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
                                    {submitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserDBSchema;

