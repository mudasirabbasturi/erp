import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BiShieldQuarter,
    BiPlus,
    BiRefresh,
    BiTrash,
    BiKey,
    BiColumns,
    BiCheckSquare,
    BiSearch,
    BiCheckCircle
} from 'react-icons/bi';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal/Modal';
import InputText from '../../components/ui/InputText/InputText';
import Select from '../../components/ui/Select/Select';
import { useToast } from '../../components/ui/Toast';
import { usePageActions } from '../../context/PageActionContext';

const MODULE_OPTIONS = [
    { value: 'users', label: 'Users Module' },
    { value: 'roles', label: 'Roles & Permissions' },
    { value: 'menus', label: 'Navigation Menus' },
    { value: 'media', label: 'Media Library' },
    { value: 'projects', label: 'Projects & Tasks' },
    { value: 'clients', label: 'Clients & Accounts' },
    { value: 'finance', label: 'Finance & Invoicing' },
    { value: 'reports', label: 'Reports & Analytics' }
];

const ACTION_OPTIONS = [
    { value: 'view', label: 'View (Read)' },
    { value: 'create', label: 'Create (Insert)' },
    { value: 'update', label: 'Update (Edit)' },
    { value: 'delete', label: 'Delete (Remove)' },
    { value: 'export', label: 'Export (Download)' },
    { value: 'manage', label: 'Full Management (Admin)' }
];

const PermissionsDirectory = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { setActions, setCustomBreadcrumbs } = usePageActions();

    const [perms, setPerms] = useState([]);
    const [groupedPerms, setGroupedPerms] = useState({});
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedModule, setSelectedModule] = useState('all');

    const [form, setForm] = useState({
        name: '',
        slug: '',
        module: 'users',
        action: 'view',
        label: '',
        description: ''
    });

    const loadPermissions = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/permissions');
            if (res.success && res.data) {
                setPerms(res.data.all || []);
                setGroupedPerms(res.data.grouped || {});
            }
        } catch (err) {
            toast.error('Failed to load permissions', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPermissions();
        setCustomBreadcrumbs([
            { label: 'Access Control', to: '/roles' },
            { label: 'Permissions Directory' }
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
                        setForm({
                            name: '',
                            slug: '',
                            module: 'users',
                            action: 'view',
                            label: '',
                            description: ''
                        });
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
                    <BiPlus size={16} /> Add Permission
                </button>
                <button
                    type="button"
                    onClick={loadPermissions}
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
                    title="Reload Permissions"
                >
                    <BiRefresh size={18} />
                </button>
            </div>
        );
    }, [loadPermissions, setActions]);

    const handleCreatePermission = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.slug.trim() || !form.module || !form.action) {
            toast.warning('Validation Error', 'Permission name, slug, module, and action are required.');
            return;
        }

        try {
            await apiClient.post('/permissions', {
                ...form,
                label: form.label.trim() || form.name.trim()
            });
            toast.success('Permission Created', `Permission "${form.name}" has been registered successfully.`);
            setIsCreateOpen(false);
            setForm({
                name: '',
                slug: '',
                module: 'users',
                action: 'view',
                label: '',
                description: ''
            });
            loadPermissions();
        } catch (err) {
            toast.error('Creation Failed', err.message);
        }
    };

    const filteredPerms = perms.filter(p => {
        const matchesSearch = (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
            (p.label && p.label.toLowerCase().includes(search.toLowerCase())) ||
            (p.slug && p.slug.toLowerCase().includes(search.toLowerCase())) ||
            (p.module && p.module.toLowerCase().includes(search.toLowerCase()));
        const matchesModule = selectedModule === 'all' || p.module === selectedModule;
        return matchesSearch && matchesModule;
    });

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
                        <BiShieldQuarter size={20} color="#64748b" />
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>All Roles</span>
                    </div>
                </div>

                <div
                    onClick={() => navigate('/roles/permissions')}
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
                        <BiKey size={20} />
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>Permissions Directory ({perms.length})</span>
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

            {/* Filter Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                background: '#ffffff',
                padding: '14px 20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '400px', background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <BiSearch size={18} color="#94a3b8" />
                    <input
                        type="text"
                        placeholder="Search permissions by name, slug, or module..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px' }}
                    />
                </div>

                <div style={{ width: '220px' }}>
                    <Select
                        searchable={true}
                        showSearch={true}
                        options={[{ value: 'all', label: 'All Modules' }, ...MODULE_OPTIONS]}
                        value={selectedModule}
                        onChange={(val) => setSelectedModule(val)}
                    />
                </div>
            </div>

            {/* Permissions Table/Cards */}
            {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                    Loading permissions directory...
                </div>
            ) : filteredPerms.length === 0 ? (
                <div style={{
                    background: '#ffffff',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    padding: '60px',
                    textAlign: 'center',
                    color: '#64748b'
                }}>
                    <BiKey size={40} color="#cbd5e1" style={{ marginBottom: '10px' }} />
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#334155' }}>No permissions found</div>
                    <p style={{ fontSize: '13px', marginTop: '4px' }}>Add granular action permissions using the "Add Permission" button above.</p>
                </div>
            ) : (
                <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                                <th style={{ padding: '12px 18px', width: '80px' }}>ID</th>
                                <th style={{ padding: '12px 18px' }}>Permission Name & Label</th>
                                <th style={{ padding: '12px 18px', width: '160px' }}>Module</th>
                                <th style={{ padding: '12px 18px', width: '120px' }}>Action</th>
                                <th style={{ padding: '12px 18px' }}>Slug Key</th>
                                <th style={{ padding: '12px 18px' }}>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPerms.map((perm, idx) => (
                                <tr key={perm.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                    <td style={{ padding: '12px 18px', color: '#64748b', fontWeight: 600 }}>#{perm.id}</td>
                                    <td style={{ padding: '12px 18px', fontWeight: 600, color: '#0f172a' }}>
                                        {perm.name || perm.label}
                                    </td>
                                    <td style={{ padding: '12px 18px' }}>
                                        <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                                            {perm.module}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 18px' }}>
                                        <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                                            {perm.action}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 18px', color: '#4f46e5', fontFamily: 'monospace' }}>
                                        {perm.slug}
                                    </td>
                                    <td style={{ padding: '12px 18px', color: '#64748b' }}>
                                        {perm.description || 'Allows standard execution.'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Permission Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Add Granular System Permission"
            >
                <form onSubmit={handleCreatePermission}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Permission Name *
                            </label>
                            <InputText
                                placeholder="e.g. Export Users CSV"
                                value={form.name}
                                onChange={(val) => {
                                    const name = val;
                                    const autoSlug = `${form.module}.${form.action}.${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
                                    setForm(prev => ({ ...prev, name, label: name, slug: autoSlug }));
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                    Target Module *
                                </label>
                                <Select
                                    searchable={true}
                                    showSearch={true}
                                    options={MODULE_OPTIONS}
                                    value={form.module}
                                    onChange={(val) => {
                                        setForm(prev => {
                                            const autoSlug = `${val}.${prev.action}.${prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
                                            return { ...prev, module: val, slug: autoSlug };
                                        });
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                    Action Type *
                                </label>
                                <Select
                                    searchable={true}
                                    showSearch={true}
                                    options={ACTION_OPTIONS}
                                    value={form.action}
                                    onChange={(val) => {
                                        setForm(prev => {
                                            const autoSlug = `${prev.module}.${val}.${prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
                                            return { ...prev, action: val, slug: autoSlug };
                                        });
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Unique Permission Slug *
                            </label>
                            <InputText
                                placeholder="e.g. users.export.csv"
                                value={form.slug}
                                onChange={(val) => setForm(prev => ({ ...prev, slug: val }))}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Functional Description
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Describe what operations this permission grants..."
                                value={form.description}
                                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    padding: '10px 14px',
                                    fontSize: '13px',
                                    fontFamily: 'inherit',
                                    outline: 'none'
                                }}
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
                                Save Permission
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default PermissionsDirectory;

