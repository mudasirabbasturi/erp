import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { BiShieldQuarter, BiPlus, BiRefresh, BiEdit, BiTrash, BiCheck, BiLock, BiColumns, BiKey } from 'react-icons/bi';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal/Modal';
import InputText from '../../components/ui/InputText/InputText';

const RolesPermissions = () => {
    const location = useLocation();
    const [roles, setRoles] = useState([]);
    const [permissionsData, setPermissionsData] = useState({ all: [], grouped: {} });
    const [loading, setLoading] = useState(true);

    // Active tab determined by route or internal state
    const [activeTab, setActiveTab] = useState(() => {
        if (location.pathname.includes('/columns')) return 'columns';
        if (location.pathname.includes('/permissions')) return 'permissions';
        return 'roles';
    });

    useEffect(() => {
        if (location.pathname.includes('/columns')) setActiveTab('columns');
        else if (location.pathname.includes('/permissions')) setActiveTab('permissions');
        else setActiveTab('roles');
    }, [location.pathname]);

    // Modals
    const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
    const [isCreatePermOpen, setIsCreatePermOpen] = useState(false);
    const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);

    // Form states
    const [roleForm, setRoleForm] = useState({ name: '', slug: '', description: '' });
    const [permForm, setPermForm] = useState({ name: '', slug: '', module: 'projects', action: 'view', label: '', description: '' });

    // Matrix & Column Security State
    const [matrixRoleId, setMatrixRoleId] = useState(null);
    const [matrixSelectedPerms, setMatrixSelectedPerms] = useState([]);
    const [columnRules, setColumnRules] = useState([
        { entity: 'project', field_name: 'budget_total', label: 'Budget Total ($)', can_view: 1, can_edit: 0 },
        { entity: 'project', field_name: 'deduction_amount', label: 'Deduction Amount ($)', can_view: 1, can_edit: 0 },
        { entity: 'project', field_name: 'project_points', label: 'Project Points', can_view: 1, can_edit: 1 },
        { entity: 'project', field_name: 'project_private_notes', label: 'Private Internal Notes', can_view: 0, can_edit: 0 },
        { entity: 'user', field_name: 'bank_accounts', label: 'User Bank Account / IBAN', can_view: 0, can_edit: 0 },
        { entity: 'user', field_name: 'salary_or_payroll', label: 'User Payroll & Salary', can_view: 0, can_edit: 0 },
    ]);
    const [columnRoleId, setColumnRoleId] = useState(null);
    const [saveStatus, setSaveStatus] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [rolesRes, permsRes] = await Promise.all([
                apiClient.get('/roles'),
                apiClient.get('/permissions')
            ]);
            if (rolesRes.success) {
                setRoles(rolesRes.data);
                if (rolesRes.data.length > 0) {
                    if (!matrixRoleId) {
                        const nonSuper = rolesRes.data.find(r => r.slug !== 'super-admin') || rolesRes.data[0];
                        setMatrixRoleId(nonSuper.id);
                        setMatrixSelectedPerms((nonSuper.permissions || []).map(p => p.id));
                        setColumnRoleId(nonSuper.id);
                    }
                }
            }
            if (permsRes.success) {
                setPermissionsData(permsRes.data);
            }
        } catch (err) {
            console.error('Failed to load roles and permissions:', err);
        } finally {
            setLoading(false);
        }
    }, [matrixRoleId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Switch selected role for matrix
    const handleSelectMatrixRole = (role) => {
        setMatrixRoleId(role.id);
        const assignedIds = (role.permissions || []).map(p => p.id);
        setMatrixSelectedPerms(assignedIds);
    };

    // Toggle single permission in matrix
    const togglePermission = (permId) => {
        setMatrixSelectedPerms(prev =>
            prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
        );
    };

    // Save permissions assigned to role
    const handleSaveRolePermissions = async () => {
        if (!matrixRoleId) return;
        setSaveStatus('Saving permissions...');
        try {
            const currentRole = roles.find(r => r.id === matrixRoleId);
            await apiClient.put(`/roles/${matrixRoleId}`, {
                name: currentRole.name,
                description: currentRole.description,
                permissions: matrixSelectedPerms
            });
            setSaveStatus('Permissions updated successfully!');
            setTimeout(() => setSaveStatus(''), 3000);
            loadData();
        } catch (err) {
            alert(err.message || 'Failed to save permissions');
            setSaveStatus('');
        }
    };

    // Create Role
    const handleCreateRole = async (e) => {
        e.preventDefault();
        try {
            await apiClient.post('/roles', {
                name: roleForm.name,
                slug: roleForm.slug || roleForm.name.toLowerCase().replace(/\s+/g, '-'),
                description: roleForm.description,
            });
            setIsCreateRoleOpen(false);
            setRoleForm({ name: '', slug: '', description: '' });
            loadData();
        } catch (err) {
            alert(err.message || 'Failed to create role');
        }
    };

    // Update Role Info
    const handleUpdateRole = async (e) => {
        e.preventDefault();
        if (!selectedRole) return;
        try {
            await apiClient.put(`/roles/${selectedRole.id}`, {
                name: roleForm.name,
                description: roleForm.description,
            });
            setIsEditRoleOpen(false);
            setSelectedRole(null);
            loadData();
        } catch (err) {
            alert(err.message || 'Failed to update role');
        }
    };

    // Delete Role
    const handleDeleteRole = async (role) => {
        if (role.is_system === 1) {
            alert('System roles cannot be deleted.');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete role "${role.name}"?`)) return;

        try {
            await apiClient.delete(`/roles/${role.id}`);
            loadData();
        } catch (err) {
            alert(err.message || 'Failed to delete role');
        }
    };

    // Create Permission
    const handleCreatePermission = async (e) => {
        e.preventDefault();
        try {
            await apiClient.post('/permissions', {
                name: permForm.name,
                slug: permForm.slug || `${permForm.module}.${permForm.action}`,
                module: permForm.module,
                action: permForm.action,
                label: permForm.label || permForm.name,
                description: permForm.description,
            });
            setIsCreatePermOpen(false);
            setPermForm({ name: '', slug: '', module: 'projects', action: 'view', label: '', description: '' });
            loadData();
        } catch (err) {
            alert(err.message || 'Failed to create permission');
        }
    };

    // Save Field/Column Level Permissions
    const handleSaveColumnPermissions = async () => {
        if (!columnRoleId) return;
        setSaveStatus('Saving column-level rules...');
        try {
            await apiClient.post('/roles/field-permissions', {
                role_id: columnRoleId,
                permissions: columnRules.map(r => ({
                    entity: r.entity,
                    field_name: r.field_name,
                    can_view: r.can_view,
                    can_edit: r.can_edit,
                }))
            });
            setSaveStatus('Column security rules saved!');
            setTimeout(() => setSaveStatus(''), 3000);
            loadData();
        } catch (err) {
            alert(err.message || 'Failed to save column permissions');
            setSaveStatus('');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header / Submenu Tabs */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '12px',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={() => setActiveTab('roles')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: activeTab === 'roles' ? '#4f46e5' : '#f1f5f9',
                            color: activeTab === 'roles' ? '#ffffff' : '#475569',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <BiShieldQuarter size={16} /> All Roles ({roles.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('permissions')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: activeTab === 'permissions' ? '#4f46e5' : '#f1f5f9',
                            color: activeTab === 'permissions' ? '#ffffff' : '#475569',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <BiKey size={16} /> Permissions Directory ({permissionsData.all.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('matrix')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: activeTab === 'matrix' ? '#4f46e5' : '#f1f5f9',
                            color: activeTab === 'matrix' ? '#ffffff' : '#475569',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <BiLock size={16} /> Role Permissions Matrix
                    </button>
                    <button
                        onClick={() => setActiveTab('columns')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: activeTab === 'columns' ? '#4f46e5' : '#f1f5f9',
                            color: activeTab === 'columns' ? '#ffffff' : '#475569',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <BiColumns size={16} /> Column-Level Security
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={loadData}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: '#475569',
                            cursor: 'pointer'
                        }}
                    >
                        <BiRefresh size={16} /> Refresh
                    </button>
                    <button
                        onClick={() => setIsCreatePermOpen(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#0f172a',
                            cursor: 'pointer'
                        }}
                    >
                        <BiPlus size={16} /> + Add Permission
                    </button>
                    <button
                        onClick={() => {
                            setRoleForm({ name: '', slug: '', description: '' });
                            setIsCreateRoleOpen(true);
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
                            cursor: 'pointer'
                        }}
                    >
                        <BiPlus size={16} /> + Add Role
                    </button>
                </div>
            </div>

            {/* TAB 1: ALL ROLES DIRECTORY */}
            {activeTab === 'roles' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {roles.map((role) => {
                        const isSuper = role.slug === 'super-admin';
                        return (
                            <div
                                key={role.id}
                                style={{
                                    background: '#ffffff',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    padding: '20px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    position: 'relative'
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                                            {role.name}
                                        </h3>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            background: isSuper ? '#fef3c7' : '#e0e7ff',
                                            color: isSuper ? '#b45309' : '#3730a3'
                                        }}>
                                            {isSuper ? 'SUPER ADMIN (IMMUNE)' : `ID: ${role.id}`}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginBottom: '10px' }}>
                                        slug: {role.slug}
                                    </div>
                                    <p style={{ fontSize: '13px', color: '#475569', minHeight: '36px', lineHeight: '1.4' }}>
                                        {role.description || 'Standard role assigned to company team members.'}
                                    </p>
                                </div>

                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                                        <span>Assigned Users: <strong>{role.user_count || 0}</strong></span>
                                        <span>Permissions: <strong>{isSuper ? 'ALL (Unrestricted)' : (role.permissions?.length || 0)}</strong></span>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => {
                                                handleSelectMatrixRole(role);
                                                setActiveTab('matrix');
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '6px 10px',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                background: '#f8fafc',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                color: '#334155',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Configure Perms
                                        </button>
                                        {!isSuper && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setSelectedRole(role);
                                                        setRoleForm({ name: role.name, slug: role.slug, description: role.description || '' });
                                                        setIsEditRoleOpen(true);
                                                    }}
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #cbd5e1',
                                                        background: '#ffffff',
                                                        color: '#475569',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="Edit Role Name"
                                                >
                                                    <BiEdit size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRole(role)}
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #fecaca',
                                                        background: '#fef2f2',
                                                        color: '#dc2626',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="Delete Role"
                                                >
                                                    <BiTrash size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* TAB 2: PERMISSIONS DIRECTORY */}
            {activeTab === 'permissions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {Object.entries(permissionsData.grouped).map(([moduleName, perms]) => (
                        <div key={moduleName} style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    📁 {moduleName} Module ({perms.length} actions)
                                </h4>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                                {perms.map((p) => (
                                    <div key={p.id} style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '10px', background: '#f8fafc' }}>
                                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>{p.label || p.name}</div>
                                        <div style={{ fontSize: '11px', color: '#4f46e5', fontFamily: 'monospace' }}>{p.slug}</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{p.description || `Action: ${p.action}`}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* TAB 3: ROLE PERMISSIONS MATRIX */}
            {activeTab === 'matrix' && (
                <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px' }}>
                    {/* Role selector panel */}
                    <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#334155', marginBottom: '12px' }}>Select Role to Edit</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {roles.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => handleSelectMatrixRole(r)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: matrixRoleId === r.id ? '1px solid #4f46e5' : '1px solid transparent',
                                        background: matrixRoleId === r.id ? '#e0e7ff' : '#f8fafc',
                                        color: matrixRoleId === r.id ? '#3730a3' : '#1e293b',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    <span>{r.name}</span>
                                    {matrixRoleId === r.id && <BiCheck size={18} color="#4f46e5" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Permissions Checkbox Grid */}
                    <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                    Permissions for: <span style={{ color: '#4f46e5' }}>{roles.find(r => r.id === matrixRoleId)?.name}</span>
                                </h3>
                                <p style={{ fontSize: '12px', color: '#64748b' }}>Check or uncheck the specific capabilities allowed for this role.</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {saveStatus && <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>{saveStatus}</span>}
                                <button
                                    onClick={handleSaveRolePermissions}
                                    style={{
                                        background: '#4f46e5',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '8px 16px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Save Role Permissions
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {Object.entries(permissionsData.grouped).map(([moduleName, perms]) => (
                                <div key={moduleName} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#334155', textTransform: 'uppercase' }}>
                                            {moduleName}
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const moduleIds = perms.map(p => p.id);
                                                    setMatrixSelectedPerms(prev => Array.from(new Set([...prev, ...moduleIds])));
                                                }}
                                                style={{ border: 'none', background: 'none', color: '#4f46e5', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Select All
                                            </button>
                                            <span style={{ color: '#cbd5e1' }}>|</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const moduleIds = perms.map(p => p.id);
                                                    setMatrixSelectedPerms(prev => prev.filter(id => !moduleIds.includes(id)));
                                                }}
                                                style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                                        {perms.map(p => {
                                            const isChecked = matrixSelectedPerms.includes(p.id);
                                            return (
                                                <label
                                                    key={p.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: '8px',
                                                        padding: '8px 10px',
                                                        borderRadius: '6px',
                                                        border: isChecked ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
                                                        background: isChecked ? '#eef2ff' : '#ffffff',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => togglePermission(p.id)}
                                                        style={{ marginTop: '2px', cursor: 'pointer' }}
                                                    />
                                                    <div>
                                                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{p.label || p.name}</div>
                                                        <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>{p.slug}</div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: COLUMN-LEVEL SECURITY */}
            {activeTab === 'columns' && (
                <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Column-Level Data Masking & Field Security</h3>
                            <p style={{ fontSize: '12px', color: '#64748b' }}>Configure which columns are masked or editable for each role at the database response level.</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <select
                                value={columnRoleId || ''}
                                onChange={(e) => setColumnRoleId(Number(e.target.value))}
                                style={{ height: '36px', padding: '0 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                            >
                                {roles.filter(r => r.slug !== 'super-admin').map(r => (
                                    <option key={r.id} value={r.id}>Role: {r.name}</option>
                                ))}
                            </select>
                            {saveStatus && <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>{saveStatus}</span>}
                            <button
                                onClick={handleSaveColumnPermissions}
                                style={{
                                    background: '#4f46e5',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Save Column Rules
                            </button>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                <th style={{ padding: '10px 14px' }}>Entity</th>
                                <th style={{ padding: '10px 14px' }}>Field / Column Name</th>
                                <th style={{ padding: '10px 14px' }}>Label</th>
                                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Can View (Unmask)</th>
                                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Can Edit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {columnRules.map((rule, idx) => (
                                <tr key={rule.field_name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#334155' }}>{rule.entity.toUpperCase()}</td>
                                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#4f46e5' }}>{rule.field_name}</td>
                                    <td style={{ padding: '12px 14px', color: '#1e293b' }}>{rule.label}</td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={rule.can_view === 1}
                                            onChange={(e) => {
                                                const checked = e.target.checked ? 1 : 0;
                                                setColumnRules(prev => prev.map((r, i) => i === idx ? { ...r, can_view: checked } : r));
                                            }}
                                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                        />
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={rule.can_edit === 1}
                                            onChange={(e) => {
                                                const checked = e.target.checked ? 1 : 0;
                                                setColumnRules(prev => prev.map((r, i) => i === idx ? { ...r, can_edit: checked } : r));
                                            }}
                                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL: CREATE ROLE */}
            <Modal
                isOpen={isCreateRoleOpen}
                onClose={() => setIsCreateRoleOpen(false)}
                title="Create New Role"
                size="small"
            >
                <form onSubmit={handleCreateRole} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Role Name *</label>
                        <InputText
                            placeholder="e.g. Lead Senior Estimator"
                            value={roleForm.name}
                            onChange={(val) => setRoleForm(p => ({ ...p, name: val, slug: val.toLowerCase().replace(/[^a-z0-9]/g, '-') }))}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Role Slug *</label>
                        <InputText
                            placeholder="e.g. senior-estimator"
                            value={roleForm.slug}
                            onChange={(val) => setRoleForm(p => ({ ...p, slug: val }))}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Description</label>
                        <textarea
                            value={roleForm.description}
                            onChange={(e) => setRoleForm(p => ({ ...p, description: e.target.value }))}
                            placeholder="Role responsibilities and scope"
                            rows={3}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" onClick={() => setIsCreateRoleOpen(false)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}>Cancel</button>
                        <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 600 }}>Create Role</button>
                    </div>
                </form>
            </Modal>

            {/* MODAL: EDIT ROLE */}
            <Modal
                isOpen={isEditRoleOpen}
                onClose={() => setIsEditRoleOpen(false)}
                title={`Edit Role: ${selectedRole?.name}`}
                size="small"
            >
                <form onSubmit={handleUpdateRole} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Role Name *</label>
                        <InputText
                            value={roleForm.name}
                            onChange={(val) => setRoleForm(p => ({ ...p, name: val }))}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Description</label>
                        <textarea
                            value={roleForm.description}
                            onChange={(e) => setRoleForm(p => ({ ...p, description: e.target.value }))}
                            rows={3}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" onClick={() => setIsEditRoleOpen(false)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}>Cancel</button>
                        <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 600 }}>Save Changes</button>
                    </div>
                </form>
            </Modal>

            {/* MODAL: CREATE PERMISSION */}
            <Modal
                isOpen={isCreatePermOpen}
                onClose={() => setIsCreatePermOpen(false)}
                title="Create New System Permission"
                size="small"
            >
                <form onSubmit={handleCreatePermission} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Permission Label *</label>
                        <InputText
                            placeholder="e.g. Export Financial Audit"
                            value={permForm.name}
                            onChange={(val) => setPermForm(p => ({ ...p, name: val, label: val }))}
                            required
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Module *</label>
                            <select
                                value={permForm.module}
                                onChange={(e) => setPermForm(p => ({ ...p, module: e.target.value }))}
                                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '13px' }}
                            >
                                <option value="projects">Projects</option>
                                <option value="users">Users</option>
                                <option value="clients">Clients</option>
                                <option value="media">Media</option>
                                <option value="ai">AI Subsystem</option>
                                <option value="settings">Settings</option>
                                <option value="menus">Menus</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Action *</label>
                            <select
                                value={permForm.action}
                                onChange={(e) => setPermForm(p => ({ ...p, action: e.target.value }))}
                                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '13px' }}
                            >
                                <option value="view">View</option>
                                <option value="create">Create</option>
                                <option value="update">Update</option>
                                <option value="delete">Delete</option>
                                <option value="manage">Manage</option>
                                <option value="export">Export</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Permission Slug *</label>
                        <InputText
                            placeholder="e.g. projects.export_audit"
                            value={permForm.slug}
                            onChange={(val) => setPermForm(p => ({ ...p, slug: val }))}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" onClick={() => setIsCreatePermOpen(false)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}>Cancel</button>
                        <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 600 }}>Create Permission</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default RolesPermissions;

