import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BiShieldQuarter,
    BiSave,
    BiRefresh,
    BiKey,
    BiColumns,
    BiCheckSquare,
    BiCheck,
    BiX
} from 'react-icons/bi';
import apiClient from '../../api/client';
import Select from '../../components/ui/Select/Select';
import { useToast } from '../../components/ui/Toast';
import { usePageActions } from '../../context/PageActionContext';

const RolePermissionsMatrix = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { setActions, setCustomBreadcrumbs } = usePageActions();

    const [roles, setRoles] = useState([]);
    const [permissionsData, setPermissionsData] = useState({ all: [], grouped: {} });
    const [selectedRoleId, setSelectedRoleId] = useState(null);
    const [selectedPerms, setSelectedPerms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rolesRes, permsRes] = await Promise.all([
                apiClient.get('/roles'),
                apiClient.get('/permissions')
            ]);

            if (rolesRes.success && rolesRes.data) {
                const roleList = rolesRes.data || [];
                setRoles(roleList);
                if (roleList.length > 0 && !selectedRoleId) {
                    setSelectedRoleId(roleList[0].id);
                    setSelectedPerms(roleList[0].permissions ? roleList[0].permissions.map(p => p.id) : []);
                }
            }

            if (permsRes.success && permsRes.data) {
                setPermissionsData(permsRes.data);
            }
        } catch (err) {
            toast.error('Failed to load matrix data', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        setCustomBreadcrumbs([
            { label: 'Access Control', to: '/roles' },
            { label: 'Role Permissions Matrix' }
        ]);

        return () => {
            setCustomBreadcrumbs(null);
            setActions(null);
        };
    }, []);

    // When changing selected role
    const handleSelectRole = (roleId) => {
        setSelectedRoleId(roleId);
        const r = roles.find(x => x.id === Number(roleId));
        if (r && r.permissions) {
            setSelectedPerms(r.permissions.map(p => p.id));
        } else {
            setSelectedPerms([]);
        }
    };

    const togglePermission = (permId) => {
        setSelectedPerms(prev => {
            if (prev.includes(permId)) {
                return prev.filter(id => id !== permId);
            } else {
                return [...prev, permId];
            }
        });
    };

    const toggleModuleAll = (moduleKey, permIds) => {
        const allSelected = permIds.every(id => selectedPerms.includes(id));
        if (allSelected) {
            setSelectedPerms(prev => prev.filter(id => !permIds.includes(id)));
        } else {
            setSelectedPerms(prev => Array.from(new Set([...prev, ...permIds])));
        }
    };

    const handleSaveMatrix = async () => {
        if (!selectedRoleId) return;
        setSaving(true);
        try {
            const targetRole = roles.find(r => r.id === Number(selectedRoleId));
            if (!targetRole) return;

            await apiClient.put(`/roles/${selectedRoleId}`, {
                name: targetRole.name,
                slug: targetRole.slug,
                description: targetRole.description,
                permissions: selectedPerms
            });

            toast.success('Matrix Synchronized', `Saved ${selectedPerms.length} permissions for "${targetRole.name}".`);
            await loadData();
        } catch (err) {
            toast.error('Save Failed', err.message);
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        setActions(
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                    type="button"
                    onClick={handleSaveMatrix}
                    disabled={saving}
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
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                        boxShadow: '0 1px 2px rgba(79, 70, 229, 0.2)'
                    }}
                >
                    <BiSave size={16} /> {saving ? 'Saving...' : 'Save Matrix Permissions'}
                </button>
                <button
                    type="button"
                    onClick={loadData}
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
                    title="Reload Matrix"
                >
                    <BiRefresh size={18} />
                </button>
            </div>
        );
    }, [handleSaveMatrix, loadData, saving, setActions]);

    const activeRole = roles.find(r => r.id === Number(selectedRoleId));

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
                        <BiCheckSquare size={20} />
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

            {/* Role Switcher Toolbar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px 20px',
                gap: '16px',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                        Configuring Role:
                    </span>
                    <div style={{ width: '260px' }}>
                        <Select
                            searchable={true}
                            showSearch={true}
                            options={roles.map(r => ({ value: r.id, label: r.name }))}
                            value={selectedRoleId}
                            onChange={(val) => handleSelectRole(val)}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                        Granted: <strong style={{ color: '#4f46e5' }}>{selectedPerms.length}</strong> / {permissionsData.all?.length || 0} permissions
                    </span>
                    <button
                        type="button"
                        onClick={handleSaveMatrix}
                        disabled={saving}
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
                            cursor: saving ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <BiSave size={16} /> Save Changes
                    </button>
                </div>
            </div>

            {/* Matrix Grouped by Module */}
            {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                    Loading permissions matrix...
                </div>
            ) : Object.keys(permissionsData.grouped || {}).length === 0 ? (
                <div style={{
                    background: '#ffffff',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    padding: '60px',
                    textAlign: 'center',
                    color: '#64748b'
                }}>
                    <BiKey size={40} color="#cbd5e1" style={{ marginBottom: '10px' }} />
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#334155' }}>No permissions registered in system</div>
                    <p style={{ fontSize: '13px', marginTop: '4px' }}>Please go to "Permissions Directory" and add permissions first.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {Object.entries(permissionsData.grouped).map(([moduleKey, modulePerms]) => {
                        const moduleIds = modulePerms.map(p => p.id);
                        const allSelected = moduleIds.length > 0 && moduleIds.every(id => selectedPerms.includes(id));
                        const someSelected = moduleIds.some(id => selectedPerms.includes(id));

                        return (
                            <div
                                key={moduleKey}
                                style={{
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    overflow: 'hidden'
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '12px 18px',
                                    background: '#f8fafc',
                                    borderBottom: '1px solid #e2e8f0'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            ref={input => {
                                                if (input) {
                                                    input.indeterminate = !allSelected && someSelected;
                                                }
                                            }}
                                            onChange={() => toggleModuleAll(moduleKey, moduleIds)}
                                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                        />
                                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase' }}>
                                            {moduleKey} Module
                                        </h4>
                                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                                            ({modulePerms.filter(p => selectedPerms.includes(p.id)).length} / {modulePerms.length} enabled)
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => toggleModuleAll(moduleKey, moduleIds)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            color: '#4f46e5',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {allSelected ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>

                                <div style={{
                                    padding: '16px 18px',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                    gap: '12px'
                                }}>
                                    {modulePerms.map(perm => {
                                        const isChecked = selectedPerms.includes(perm.id);
                                        return (
                                            <div
                                                key={perm.id}
                                                onClick={() => togglePermission(perm.id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '10px',
                                                    padding: '10px 12px',
                                                    borderRadius: '6px',
                                                    border: `1px solid ${isChecked ? '#c7d2fe' : '#e2e8f0'}`,
                                                    background: isChecked ? '#eef2ff' : '#ffffff',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {}}
                                                    style={{ cursor: 'pointer', marginTop: '2px' }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 600, color: isChecked ? '#3730a3' : '#1e293b' }}>
                                                        {perm.name || perm.label}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                                                        {perm.slug}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default RolePermissionsMatrix;

