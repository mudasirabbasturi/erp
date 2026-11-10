import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BiShieldQuarter,
    BiPlus,
    BiEdit,
    BiTrash,
    BiRefresh,
    BiCheck,
    BiX,
    BiChevronRight,
    BiUser
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useToast } from '../../components/ui/Toast';

const Roles = () => {
    const navigate = useNavigate();
    const toast = useToast();

    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal state for Add / Edit Role
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [roleForm, setRoleForm] = useState({ id: null, name: '', description: '' });
    const [submitting, setSubmitting] = useState(false);

    const loadRoles = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/roles');
            if (res.success && res.data) {
                setRoles(res.data || []);
            } else {
                toast.error('Error', res.message || 'Failed to load roles');
            }
        } catch (err) {
            toast.error('Load Error', err.message || 'Failed to load roles');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadRoles();
    }, [loadRoles]);

    const handleOpenAddRole = () => {
        setRoleForm({ id: null, name: '', description: '' });
        setIsRoleModalOpen(true);
    };

    const handleOpenEditRole = (e, role) => {
        e.stopPropagation();
        setRoleForm({ id: role.id, name: role.name, description: role.description || '' });
        setIsRoleModalOpen(true);
    };

    const handleDeleteRole = async (e, role) => {
        e.stopPropagation();
        if (role.is_system === 1) {
            toast.warning('System Protected', 'System built-in roles cannot be deleted.');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete role "${role.name}"?`)) return;

        try {
            const res = await apiClient.delete(`/roles/${role.id}`);
            if (res.success) {
                toast.success('Role Deleted', `Role "${role.name}" has been deleted.`);
                loadRoles();
            } else {
                toast.error('Deletion Failed', res.message || 'Failed to delete role');
            }
        } catch (err) {
            toast.error('Deletion Failed', err.message);
        }
    };

    const handleSaveRole = async (e) => {
        e.preventDefault();
        if (!roleForm.name.trim()) {
            toast.warning('Validation Required', 'Role name is required.');
            return;
        }

        setSubmitting(true);
        try {
            if (roleForm.id) {
                const res = await apiClient.put(`/roles/${roleForm.id}`, {
                    name: roleForm.name,
                    description: roleForm.description
                });
                if (res.success) {
                    toast.success('Role Updated', `Role "${roleForm.name}" updated successfully.`);
                    setIsRoleModalOpen(false);
                    loadRoles();
                } else {
                    toast.error('Update Failed', res.message || 'Failed to update role');
                }
            } else {
                const slug = roleForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                const res = await apiClient.post('/roles', {
                    name: roleForm.name,
                    slug: slug || 'custom-role',
                    description: roleForm.description
                });
                if (res.success) {
                    toast.success('Role Created', `Role "${roleForm.name}" created successfully.`);
                    setIsRoleModalOpen(false);
                    loadRoles();
                } else {
                    toast.error('Creation Failed', res.message || 'Failed to create role');
                }
            }
        } catch (err) {
            toast.error('Save Failed', err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header Card */}
            <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div>
                    <h1 style={{
                        margin: 0,
                        fontSize: '20px',
                        fontWeight: 700,
                        color: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <BiShieldQuarter style={{ color: '#4f46e5' }} /> Roles & Access Control
                    </h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                        Manage security roles across the system. Click on any role to configure its action permissions and column-level access rules.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        type="button"
                        onClick={loadRoles}
                        disabled={loading}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#ffffff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '8px 14px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        <BiRefresh size={16} /> Refresh
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenAddRole}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#4f46e5',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '9px 16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(79, 70, 229, 0.2)'
                        }}
                    >
                        <BiPlus size={16} /> Add New Role
                    </button>
                </div>
            </div>

            {/* Roles Grid Display */}
            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        border: '3px solid #e2e8f0',
                        borderTopColor: '#4f46e5',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 12px'
                    }} />
                    <div>Loading system roles...</div>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            ) : roles.length === 0 ? (
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '40px',
                    textAlign: 'center',
                    color: '#64748b'
                }}>
                    No roles found. Click "Add New Role" to create one.
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '16px'
                }}>
                    {roles.map((r) => {
                        const isSuper = r.is_system === 1 && (r.name.toLowerCase().includes('super') || r.slug === 'super-admin');

                        return (
                            <div
                                key={r.id}
                                onClick={() => navigate(`/roles/${r.id}/permissions`)}
                                style={{
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    padding: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                                    position: 'relative'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = '#93c5fd';
                                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.08)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '8px',
                                                background: isSuper ? '#fef3c7' : '#eff6ff',
                                                color: isSuper ? '#d97706' : '#2563eb',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '18px'
                                            }}>
                                                <BiShieldQuarter />
                                            </div>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                                    {r.name}
                                                </h3>
                                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                    Slug: {r.slug || r.name.toLowerCase()}
                                                </span>
                                            </div>
                                        </div>

                                        {isSuper ? (
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: 700,
                                                background: '#fef3c7',
                                                border: '1px solid #fde68a',
                                                color: '#92400e',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                textTransform: 'uppercase'
                                            }}>
                                                SUPER ADMIN
                                            </span>
                                        ) : r.is_system === 1 ? (
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                background: '#f1f5f9',
                                                border: '1px solid #e2e8f0',
                                                color: '#64748b',
                                                padding: '2px 8px',
                                                borderRadius: '4px'
                                            }}>
                                                SYSTEM
                                            </span>
                                        ) : (
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                background: '#ecfdf5',
                                                border: '1px solid #a7f3d0',
                                                color: '#065f46',
                                                padding: '2px 8px',
                                                borderRadius: '4px'
                                            }}>
                                                CUSTOM
                                            </span>
                                        )}
                                    </div>

                                    <p style={{
                                        margin: '12px 0',
                                        fontSize: '13px',
                                        color: '#64748b',
                                        lineHeight: 1.5,
                                        minHeight: '38px'
                                    }}>
                                        {r.description || 'No description provided for this role.'}
                                    </p>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '12px',
                                        color: '#475569',
                                        background: '#f8fafc',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        marginBottom: '16px'
                                    }}>
                                        <BiUser size={14} color="#6366f1" />
                                        <span><strong>{r.user_count || 0}</strong> staff members assigned</span>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderTop: '1px solid #f1f5f9',
                                    paddingTop: '12px'
                                }}>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        {r.is_system !== 1 && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleOpenEditRole(e, r)}
                                                    style={{
                                                        background: '#ffffff',
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '6px',
                                                        padding: '4px 8px',
                                                        fontSize: '12px',
                                                        color: '#475569',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                    title="Edit Role Details"
                                                >
                                                    <BiEdit size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDeleteRole(e, r)}
                                                    style={{
                                                        background: '#ffffff',
                                                        border: '1px solid #fecdd3',
                                                        borderRadius: '6px',
                                                        padding: '4px 8px',
                                                        fontSize: '12px',
                                                        color: '#e11d48',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                    title="Delete Role"
                                                >
                                                    <BiTrash size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => navigate(`/roles/${r.id}/permissions`)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            background: '#4f46e5',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '6px 12px',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <span>Configure Permissions</span>
                                        <BiChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit Role Modal */}
            {isRoleModalOpen && (
                <div
                    onClick={() => setIsRoleModalOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(15, 23, 42, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        backdropFilter: 'blur(2px)'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#ffffff',
                            borderRadius: '12px',
                            width: '460px',
                            maxWidth: '95vw',
                            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                {roleForm.id ? 'Edit Role Details' : 'Create New System Role'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsRoleModalOpen(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94a3b8',
                                    fontSize: '20px',
                                    cursor: 'pointer'
                                }}
                            >
                                <BiX />
                            </button>
                        </div>
                        <form onSubmit={handleSaveRole}>
                            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                        Role Name *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Finance Officer, Lead Estimator"
                                        value={roleForm.name}
                                        onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                        Description
                                    </label>
                                    <textarea
                                        rows={3}
                                        placeholder="Briefly describe the responsibilities and access scope of this role..."
                                        value={roleForm.description}
                                        onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            outline: 'none',
                                            resize: 'vertical',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>
                            <div style={{
                                padding: '14px 20px',
                                borderTop: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '10px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setIsRoleModalOpen(false)}
                                    disabled={submitting}
                                    style={{
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        padding: '7px 14px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: '#334155',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        background: '#4f46e5',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '7px 16px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: '#ffffff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {submitting ? 'Saving...' : roleForm.id ? 'Save Role Changes' : 'Create Role'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Roles;
