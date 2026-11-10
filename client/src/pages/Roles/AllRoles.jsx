import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BiShieldQuarter,
    BiPlus,
    BiRefresh,
    BiEdit,
    BiTrash,
    BiUser,
    BiKey,
    BiColumns,
    BiCheckSquare
} from 'react-icons/bi';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal/Modal';
import InputText from '../../components/ui/InputText/InputText';
import { RichTextEditor, RichContentView } from '../../components/ui/RichTextEditor';
import { useToast } from '../../components/ui/Toast';
import { usePageActions } from '../../context/PageActionContext';

const AllRoles = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { setActions, setCustomBreadcrumbs } = usePageActions();

    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);
    const [form, setForm] = useState({ name: '', slug: '', description: '' });

    const loadRoles = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/roles');
            if (res.success) {
                setRoles(res.data || []);
            }
        } catch (err) {
            toast.error('Failed to load roles', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRoles();
        setCustomBreadcrumbs([
            { label: 'Access Control', to: '/roles' },
            { label: 'All Roles' }
        ]);

        return () => {
            setCustomBreadcrumbs(null);
            setActions(null);
        };
    }, []);

    useEffect(() => {
        setActions(
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                    type="button"
                    onClick={() => {
                        setForm({ name: '', slug: '', description: '' });
                        setIsCreateOpen(true);
                    }}
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
                    <BiPlus size={16} /> Add Role
                </button>
                <button
                    type="button"
                    onClick={loadRoles}
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
                    title="Reload Roles"
                >
                    <BiRefresh size={18} />
                </button>
            </div>
        );
    }, [loadRoles, setActions]);

    const handleCreateRole = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.slug.trim()) {
            toast.warning('Validation Error', 'Role Name and Slug are required.');
            return;
        }

        try {
            await apiClient.post('/roles', form);
            toast.success('Role Created', `Role "${form.name}" has been created successfully.`);
            setIsCreateOpen(false);
            setForm({ name: '', slug: '', description: '' });
            loadRoles();
        } catch (err) {
            toast.error('Creation Failed', err.message);
        }
    };

    const handleEditRole = (role) => {
        setSelectedRole(role);
        setForm({
            name: role.name,
            slug: role.slug,
            description: role.description || ''
        });
        setIsEditOpen(true);
    };

    const handleUpdateRole = async (e) => {
        e.preventDefault();
        if (!selectedRole) return;

        try {
            await apiClient.put(`/roles/${selectedRole.id}`, form);
            toast.success('Role Updated', `Role "${form.name}" has been updated.`);
            setIsEditOpen(false);
            setSelectedRole(null);
            loadRoles();
        } catch (err) {
            toast.error('Update Failed', err.message);
        }
    };

    const handleDeleteRole = async (role) => {
        if (role.is_system === 1) {
            toast.warning('System Protected', 'System role cannot be deleted.');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete role "${role.name}"?`)) return;

        try {
            await apiClient.delete(`/roles/${role.id}`);
            toast.success('Role Deleted', `Role "${role.name}" was removed.`);
            loadRoles();
        } catch (err) {
            toast.error('Deletion Failed', err.message);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Quick Navigation Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px'
            }}>
                <div
                    onClick={() => navigate('/roles')}
                    style={{
                        padding: '14px 18px',
                        background: '#4f46e5',
                        color: '#fff',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BiShieldQuarter size={20} />
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>All Roles ({roles.length})</span>
                    </div>
                </div>

                <div
                    onClick={() => navigate('/roles/permissions')}
                    style={{
                        padding: '14px 18px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        color: '#334155',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BiKey size={20} color="#64748b" />
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>Permissions Directory</span>
                    </div>
                </div>

                <div
                    onClick={() => navigate('/roles/matrix')}
                    style={{
                        padding: '14px 18px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        color: '#334155',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BiCheckSquare size={20} color="#64748b" />
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>Permissions Matrix</span>
                    </div>
                </div>

                <div
                    onClick={() => navigate('/roles/columns')}
                    style={{
                        padding: '14px 18px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        color: '#334155',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BiColumns size={20} color="#64748b" />
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>Column Security</span>
                    </div>
                </div>
            </div>

            {/* Roles Grid */}
            {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                    Loading defined roles...
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {roles.map(role => (
                        <div
                            key={role.id}
                            style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                padding: '20px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                            }}
                        >
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                        {role.name}
                                    </h3>
                                    {role.is_system === 1 ? (
                                        <span style={{ fontSize: '10px', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px' }}>
                                            SYSTEM
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: '10px', fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px' }}>
                                            CUSTOM
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                                    slug: <code style={{ background: '#f8fafc', padding: '2px 6px', borderRadius: '4px', color: '#4f46e5' }}>{role.slug}</code>
                                </div>
                                <div style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', minHeight: '36px' }}>
                                    <RichContentView html={role.description} fallback="Standard platform role permissions and privileges." />
                                </div>
                            </div>

                            <div style={{
                                borderTop: '1px solid #f1f5f9',
                                paddingTop: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <BiUser size={15} /> {role.user_count || 0} user(s) assigned
                                </span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleEditRole(role)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            background: '#f8fafc',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px',
                                            padding: '4px 10px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: '#334155',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <BiEdit size={14} /> Edit
                                    </button>
                                    {role.is_system !== 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteRole(role)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                border: '1px solid #fecaca',
                                                background: '#fef2f2',
                                                color: '#dc2626',
                                                cursor: 'pointer',
                                                fontSize: '11px',
                                                fontWeight: 600
                                            }}
                                        >
                                            <BiTrash size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Role Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Create New System Role"
            >
                <form onSubmit={handleCreateRole}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Role Name *
                            </label>
                            <InputText
                                placeholder="e.g. Lead Project Manager"
                                value={form.name}
                                onChange={(val) => {
                                    const name = val;
                                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                                    setForm(prev => ({ ...prev, name, slug }));
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Role Slug *
                            </label>
                            <InputText
                                placeholder="e.g. lead_project_manager"
                                value={form.slug}
                                onChange={(val) => setForm(prev => ({ ...prev, slug: val }))}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Description
                            </label>
                            <RichTextEditor
                                placeholder="Describe access responsibilities..."
                                value={form.description || ''}
                                onChange={(content) => setForm(prev => ({ ...prev, description: content }))}
                                minHeight={90}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setIsCreateOpen(false)}
                                style={{
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    padding: '7px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#475569',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                style={{
                                    background: '#4f46e5',
                                    border: '1px solid #4338ca',
                                    borderRadius: '6px',
                                    padding: '7px 18px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    cursor: 'pointer'
                                }}
                            >
                                Save Role
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Edit Role Modal */}
            <Modal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                title={`Edit Role: ${selectedRole?.name}`}
            >
                <form onSubmit={handleUpdateRole}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Role Name *
                            </label>
                            <InputText
                                placeholder="e.g. Lead Project Manager"
                                value={form.name}
                                onChange={(val) => setForm(prev => ({ ...prev, name: val }))}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Role Slug *
                            </label>
                            <InputText
                                placeholder="e.g. lead_project_manager"
                                value={form.slug}
                                onChange={(val) => setForm(prev => ({ ...prev, slug: val }))}
                                disabled={selectedRole?.is_system === 1}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Description
                            </label>
                            <RichTextEditor
                                placeholder="Describe access responsibilities..."
                                value={form.description || ''}
                                onChange={(content) => setForm(prev => ({ ...prev, description: content }))}
                                minHeight={90}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setIsEditOpen(false)}
                                style={{
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    padding: '7px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#475569',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                style={{
                                    background: '#4f46e5',
                                    border: '1px solid #4338ca',
                                    borderRadius: '6px',
                                    padding: '7px 18px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    cursor: 'pointer'
                                }}
                            >
                                Update Role
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default AllRoles;

