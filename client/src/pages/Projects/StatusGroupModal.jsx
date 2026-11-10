import React, { useState, useEffect } from 'react';
import {
    BiPlus,
    BiEdit,
    BiTrash,
    BiCheck,
    BiX,
    BiLayer,
    BiFolderPlus
} from 'react-icons/bi';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal/Modal';
import InputText from '../../components/ui/InputText/InputText';
import { useToast } from '../../components/ui/Toast';

const PRESET_COLORS = [
    '#4f46e5', // Indigo
    '#0284c7', // Sky Blue
    '#059669', // Emerald
    '#d97706', // Amber
    '#dc2626', // Red
    '#7c3aed', // Purple
    '#0f766e', // Teal
    '#e11d48', // Rose
    '#475569', // Slate
];

const StatusGroupModal = ({ isOpen, onClose, enumStatuses = [], onGroupsUpdated }) => {
    const toast = useToast();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form fields
    const [groupName, setGroupName] = useState('');
    const [groupSlug, setGroupSlug] = useState('');
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [includeLate, setIncludeLate] = useState(false);
    const [color, setColor] = useState('#4f46e5');

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/status-groups?entity=projects');
            if (res.success && res.data) {
                setGroups(res.data);
            }
        } catch (err) {
            toast.error('Load Error', err.message || 'Failed to load status groups');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchGroups();
            setIsFormOpen(false);
            setEditingGroup(null);
        }
    }, [isOpen]);

    const handleOpenCreate = () => {
        setEditingGroup(null);
        setGroupName('');
        setGroupSlug('');
        setSelectedStatuses([]);
        setIncludeLate(false);
        setColor(PRESET_COLORS[0]);
        setIsFormOpen(true);
    };

    const handleOpenEdit = (group) => {
        setEditingGroup(group);
        setGroupName(group.group_name);
        setGroupSlug(group.group_slug);
        const parsed = JSON.parse(group.statuses || '[]');
        setSelectedStatuses(Array.isArray(parsed) ? parsed : []);
        const conds = JSON.parse(group.filter_conditions || '{}');
        setIncludeLate(!!conds?.is_late);
        setColor(group.color || '#4f46e5');
        setIsFormOpen(true);
    };

    const handleNameChange = (val) => {
        setGroupName(val);
        if (!editingGroup) {
            // Auto generate slug
            const s = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            setGroupSlug(s);
        }
    };

    const toggleStatus = (st) => {
        setSelectedStatuses((prev) =>
            prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
        );
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!groupName.trim()) {
            toast.error('Validation Error', 'Group name is required');
            return;
        }
        if (!groupSlug.trim()) {
            toast.error('Validation Error', 'Group slug is required');
            return;
        }
        if (selectedStatuses.length === 0 && !includeLate) {
            toast.error('Validation Error', 'Please select at least one status or check Include Late Projects');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                entity: 'projects',
                group_name: groupName.trim(),
                group_slug: groupSlug.trim(),
                statuses: selectedStatuses,
                filter_conditions: includeLate ? { is_late: 1 } : null,
                color,
                sort_order: editingGroup ? editingGroup.sort_order : groups.length + 1
            };

            if (editingGroup) {
                await apiClient.put(`/status-groups/${editingGroup.id}`, payload);
                toast.success('Updated', `Status group "${groupName}" updated.`);
            } else {
                await apiClient.post('/status-groups', payload);
                toast.success('Created', `Status group "${groupName}" created.`);
            }

            setIsFormOpen(false);
            setEditingGroup(null);
            fetchGroups();
            if (onGroupsUpdated) onGroupsUpdated();
        } catch (err) {
            toast.error('Save Failed', err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (group) => {
        if (group.is_system === 1) {
            toast.warning('System Protected', 'Default system groups cannot be deleted.');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete status group "${group.group_name}"?`)) {
            return;
        }

        try {
            await apiClient.delete(`/status-groups/${group.id}`);
            toast.success('Deleted', `Status group "${group.group_name}" deleted.`);
            fetchGroups();
            if (onGroupsUpdated) onGroupsUpdated();
        } catch (err) {
            toast.error('Delete Failed', err.message);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Custom Status Groups & Categorization"
            size="large"
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#334155',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                            Configured Project Status Groups
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                            Status groups combine multiple progress statuses into high-level categories for quick filtering and routing.
                        </div>
                    </div>
                    {!isFormOpen && (
                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#4f46e5',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <BiPlus size={16} /> Add Status Group
                        </button>
                    )}
                </div>

                {/* Form to Add or Edit Group */}
                {isFormOpen && (
                    <form
                        onSubmit={handleSave}
                        style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                                {editingGroup ? `Edit Status Group: ${editingGroup.group_name}` : 'Create New Status Group'}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsFormOpen(false)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                            >
                                <BiX size={18} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                    Group Name *
                                </label>
                                <InputText
                                    value={groupName}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    placeholder="e.g. Current Projects"
                                    required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                    URL Slug *
                                </label>
                                <InputText
                                    value={groupSlug}
                                    onChange={(e) => setGroupSlug(e.target.value)}
                                    placeholder="e.g. current-projects"
                                    disabled={editingGroup?.is_system === 1}
                                    required
                                />
                            </div>
                        </div>

                        {/* Color Selector */}
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Accent Theme Color
                            </label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {PRESET_COLORS.map((c) => (
                                    <div
                                        key={c}
                                        onClick={() => setColor(c)}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: c,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: color === c ? '2px solid #0f172a' : '2px solid transparent',
                                            transform: color === c ? 'scale(1.15)' : 'none',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {color === c && <BiCheck color="#ffffff" size={14} />}
                                    </div>
                                ))}
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                                    title="Choose custom color"
                                />
                            </div>
                        </div>

                        {/* Status Selection Checkboxes */}
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Included Dynamic Progress Statuses:
                            </label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                gap: '8px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '10px'
                            }}>
                                {enumStatuses.map((st) => {
                                    const isChecked = selectedStatuses.includes(st) || selectedStatuses.includes('*');
                                    return (
                                        <label
                                            key={st}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontSize: '12px',
                                                color: '#334155',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleStatus(st)}
                                                style={{ accentColor: '#4f46e5', width: '15px', height: '15px' }}
                                            />
                                            <span>{st}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Extra Filter Condition */}
                        <div>
                            <label style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#334155',
                                cursor: 'pointer'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={includeLate}
                                    onChange={(e) => setIncludeLate(e.target.checked)}
                                    style={{ accentColor: '#dc2626', width: '15px', height: '15px' }}
                                />
                                <span>Filter by Late Projects condition (<code>is_project_late = 1</code>)</span>
                            </label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                            <button
                                type="button"
                                onClick={() => setIsFormOpen(false)}
                                style={{
                                    padding: '6px 14px',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                style={{
                                    padding: '6px 16px',
                                    background: '#4f46e5',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                {saving ? 'Saving...' : editingGroup ? 'Update Group' : 'Save Group'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Groups List Table */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Group Name</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Route Slug</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Included Statuses</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Projects</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groups.map((grp) => {
                                const stList = JSON.parse(grp.statuses || '[]');
                                const conds = JSON.parse(grp.filter_conditions || '{}');
                                return (
                                    <tr key={grp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '10px 14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{
                                                    width: '10px',
                                                    height: '10px',
                                                    borderRadius: '50%',
                                                    background: grp.color || '#4f46e5'
                                                }} />
                                                <span style={{ fontWeight: 600, color: '#0f172a' }}>{grp.group_name}</span>
                                                {grp.is_system === 1 && (
                                                    <span style={{
                                                        fontSize: '10px',
                                                        fontWeight: 700,
                                                        background: '#e2e8f0',
                                                        color: '#475569',
                                                        padding: '1px 6px',
                                                        borderRadius: '4px'
                                                    }}>
                                                        System
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'monospace' }}>
                                            /projects/group/{grp.group_slug}
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {stList.includes('*') ? (
                                                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>
                                                        All Statuses
                                                    </span>
                                                ) : (
                                                    stList.map((s) => (
                                                        <span
                                                            key={s}
                                                            style={{
                                                                fontSize: '11px',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                background: '#f1f5f9',
                                                                color: '#334155'
                                                            }}
                                                        >
                                                            {s}
                                                        </span>
                                                    ))
                                                )}
                                                {conds?.is_late && (
                                                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>
                                                        + Late Projects
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                                            {grp.count ?? 0}
                                        </td>
                                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEdit(grp)}
                                                    style={{
                                                        border: '1px solid #cbd5e1',
                                                        background: '#ffffff',
                                                        borderRadius: '4px',
                                                        padding: '4px 8px',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '11px',
                                                        color: '#475569'
                                                    }}
                                                    title="Edit Group"
                                                >
                                                    <BiEdit size={14} /> Edit
                                                </button>
                                                {grp.is_system !== 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(grp)}
                                                        style={{
                                                            border: '1px solid #fecaca',
                                                            background: '#fef2f2',
                                                            borderRadius: '4px',
                                                            padding: '4px 8px',
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '11px',
                                                            color: '#dc2626'
                                                        }}
                                                        title="Delete Group"
                                                    >
                                                        <BiTrash size={14} /> Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
};

export default StatusGroupModal;

