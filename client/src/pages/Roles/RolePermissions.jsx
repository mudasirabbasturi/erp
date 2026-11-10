import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';
import {
    BiShieldQuarter,
    BiArrowBack,
    BiSave,
    BiChevronDown,
    BiChevronRight,
    BiCheckDouble,
    BiColumns,
    BiLockAlt,
    BiCheck,
    BiRefresh
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useToast } from '../../components/ui/Toast';

const DEFAULT_USER_COLUMNS = [
    { column_name: 'username', label: 'Username' },
    { column_name: 'email', label: 'Email Address' },
    { column_name: 'password', label: 'Password' },
    { column_name: 'status', label: 'Account Status' },
    { column_name: 'full_name', label: 'Full Name' },
    { column_name: 'phone', label: 'Phone Number' },
    { column_name: 'dob', label: 'Date of Birth' },
    { column_name: 'gender', label: 'Gender' },
    { column_name: 'hiring_date', label: 'Hiring Date' },
    { column_name: 'joining_date', label: 'Joining Date' },
    { column_name: 'leaving_date', label: 'Leaving Date' },
    { column_name: 'notes', label: 'Staff Notes' }
];

const RolePermissions = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [role, setRole] = useState(null);
    const [allPermissions, setAllPermissions] = useState([]);
    const [columnsByModel, setColumnsByModel] = useState({ users: DEFAULT_USER_COLUMNS });
    const [assignedPermIds, setAssignedPermIds] = useState(new Set());
    const [fieldPerms, setFieldPerms] = useState({});
    const [collapsedModules, setCollapsedModules] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [rolesRes, permsRes] = await Promise.all([
                apiClient.get('/roles'),
                apiClient.get('/permissions')
            ]);

            const loadedRoles = rolesRes.data || [];
            const targetRole = loadedRoles.find(r => String(r.id) === String(id));

            if (!targetRole) {
                toast.error('Not Found', `Role ID #${id} not found.`);
                navigate('/roles');
                return;
            }

            setRole(targetRole);

            let loadedPerms = [];
            let loadedCols = { users: DEFAULT_USER_COLUMNS };

            if (permsRes.data) {
                if (Array.isArray(permsRes.data)) {
                    loadedPerms = permsRes.data;
                } else {
                    loadedPerms = permsRes.data.all || [];
                    if (permsRes.data.columns_by_model) {
                        loadedCols = permsRes.data.columns_by_model;
                    }
                }
            }

            setAllPermissions(loadedPerms);
            setColumnsByModel(loadedCols);

            // Default all modules to collapsed
            const initCollapsed = {};
            loadedPerms.forEach(p => {
                const mod = p.module || 'general';
                initCollapsed[mod] = true;
            });
            Object.keys(loadedCols).forEach(mod => {
                initCollapsed[mod] = true;
            });
            setCollapsedModules(initCollapsed);

            // Action permissions
            const pIds = new Set((targetRole.permissions || []).map(p => p.id));
            setAssignedPermIds(pIds);

            // Column permissions
            const fMap = {};
            (targetRole.field_permissions || []).forEach(fp => {
                const key = `${fp.entity}:${fp.field_name}`;
                fMap[key] = {
                    can_view: fp.can_view === 1,
                    can_add: fp.can_add === 1,
                    can_edit: fp.can_edit === 1
                };
            });

            // Initialize missing columns with default false
            Object.entries(loadedCols).forEach(([entity, cols]) => {
                (cols || []).forEach(col => {
                    const key = `${entity}:${col.column_name}`;
                    if (!fMap[key]) {
                        fMap[key] = { can_view: false, can_add: false, can_edit: false };
                    }
                });
            });

            setFieldPerms(fMap);
        } catch (err) {
            toast.error('Load Error', err.message || 'Failed to load permissions');
        } finally {
            setLoading(false);
        }
    }, [id, navigate, toast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Group permissions & columns by module
    const groupedPermissions = useMemo(() => {
        const groups = {};

        allPermissions.forEach(p => {
            const mod = p.module || 'general';
            if (!groups[mod]) {
                groups[mod] = { module: mod, actions: [], columns: [] };
            }
            groups[mod].actions.push(p);
        });

        Object.entries(columnsByModel).forEach(([mod, cols]) => {
            if (!groups[mod]) {
                groups[mod] = { module: mod, actions: [], columns: [] };
            }
            groups[mod].columns = cols || [];
        });

        return groups;
    }, [allPermissions, columnsByModel]);

    const toggleCollapse = (moduleKey) => {
        setCollapsedModules(prev => ({
            ...prev,
            [moduleKey]: !prev[moduleKey]
        }));
    };

    const handleSetAllCollapse = (collapsed) => {
        const next = {};
        Object.keys(groupedPermissions).forEach(k => {
            next[k] = collapsed;
        });
        setCollapsedModules(next);
    };

    // Toggle single action permission
    const handleTogglePerm = (permId) => {
        if (!role) return;
        setAssignedPermIds(prev => {
            const next = new Set(prev);
            if (next.has(permId)) {
                next.delete(permId);
            } else {
                next.add(permId);
            }
            return next;
        });
    };

    // Check All / Uncheck All for an individual module (both actions & columns)
    const handleToggleModule = (moduleKey, moduleGroup, shouldCheck) => {
        if (!role) return;

        // 1. Actions
        setAssignedPermIds(prev => {
            const next = new Set(prev);
            moduleGroup.actions.forEach(a => {
                if (shouldCheck) next.add(a.id);
                else next.delete(a.id);
            });
            return next;
        });

        // 2. Columns
        setFieldPerms(prev => {
            const next = { ...prev };
            moduleGroup.columns.forEach(c => {
                next[`${moduleKey}:${c.column_name}`] = {
                    can_view: shouldCheck,
                    can_add: shouldCheck,
                    can_edit: shouldCheck
                };
            });
            return next;
        });
    };

    // Check All / Uncheck All across ALL modules
    const handleToggleAllPermissions = (shouldCheck) => {
        if (shouldCheck) {
            const allIds = new Set(allPermissions.map(p => p.id));
            setAssignedPermIds(allIds);

            const allCols = {};
            Object.entries(columnsByModel).forEach(([entity, cols]) => {
                (cols || []).forEach(f => {
                    allCols[`${entity}:${f.column_name}`] = { can_view: true, can_add: true, can_edit: true };
                });
            });
            setFieldPerms(allCols);
        } else {
            setAssignedPermIds(new Set());
            const clearedCols = {};
            Object.entries(columnsByModel).forEach(([entity, cols]) => {
                (cols || []).forEach(f => {
                    clearedCols[`${entity}:${f.column_name}`] = { can_view: false, can_add: false, can_edit: false };
                });
            });
            setFieldPerms(clearedCols);
        }
    };

    // Column permission toggle (can_view / can_add / can_edit)
    const handleToggleColumn = (entity, fieldName, type) => {
        const key = `${entity}:${fieldName}`;
        setFieldPerms(prev => {
            const current = prev[key] || { can_view: false, can_add: false, can_edit: false };
            const nextVal = !current[type];
            const updated = { ...current, [type]: nextVal };

            if ((type === 'can_edit' || type === 'can_add') && nextVal) {
                updated.can_view = true;
            }
            if (type === 'can_view' && !nextVal) {
                updated.can_add = false;
                updated.can_edit = false;
            }

            return { ...prev, [key]: updated };
        });
    };

    // Save all permissions and column-level rules to backend
    const handleSavePermissions = async () => {
        if (!role) return;

        setSaving(true);
        try {
            const formattedColRules = [];
            Object.entries(columnsByModel).forEach(([entity, cols]) => {
                (cols || []).forEach(f => {
                    const key = `${entity}:${f.column_name}`;
                    const perm = fieldPerms[key] || { can_view: false, can_add: false, can_edit: false };
                    formattedColRules.push({
                        entity,
                        field_name: f.column_name,
                        can_view: perm.can_view ? 1 : 0,
                        can_add: perm.can_add ? 1 : 0,
                        can_edit: perm.can_edit ? 1 : 0
                    });
                });
            });

            await apiClient.put(`/roles/${role.id}`, {
                name: role.name,
                description: role.description,
                permissions: Array.from(assignedPermIds),
                field_permissions: formattedColRules
            });

            toast.success('Permissions Saved', `Permissions and column rules saved for "${role.name}".`);
            loadData();
        } catch (err) {
            toast.error('Save Failed', err.message || 'Failed to save permissions');
        } finally {
            setSaving(false);
        }
    };

    // Calculate overall checked stats
    const totalActions = allPermissions.length;
    const totalCols = Object.values(columnsByModel).reduce((sum, cols) => sum + (cols || []).length, 0);
    const checkedActions = assignedPermIds.size;
    const checkedCols = Object.values(fieldPerms).filter(p => p.can_view || p.can_add || p.can_edit).length;

    const isSuperAdminRole = role?.is_system === 1 && (role?.name?.toLowerCase().includes('super') || role?.slug === 'super-admin');

    if (loading) {
        return (
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
                <div>Loading role security configuration...</div>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            minWidth: 0,
            maxWidth: '100%',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            {/* Header Navigation Bar */}
            <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <button
                        type="button"
                        onClick={() => navigate('/roles')}
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
                        <BiArrowBack size={16} /> Roles List
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                                Role Permissions: <span style={{ color: '#4f46e5' }}>{role?.name}</span>
                            </h1>
                            {isSuperAdminRole && (
                                <span style={{
                                    background: '#fef3c7',
                                    border: '1px solid #fde68a',
                                    color: '#92400e',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 700
                                }}>
                                    SYSTEM IMMUNE (SUPER ADMIN)
                                </span>
                            )}
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                            {role?.description || 'Route action permissions and column-level security unified by module.'}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        type="button"
                        onClick={loadData}
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
                        onClick={handleSavePermissions}
                        disabled={saving}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#4f46e5',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '9px 18px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(79, 70, 229, 0.2)'
                        }}
                    >
                        <BiSave size={16} /> {saving ? 'Saving Changes...' : 'Save Permissions'}
                    </button>
                </div>
            </div>

            {/* Quick Action Controls Banner */}
            <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        type="button"
                        onClick={() => handleSetAllCollapse(true)}
                        style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#475569',
                            cursor: 'pointer'
                        }}
                    >
                        Collapse All Modules
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSetAllCollapse(false)}
                        style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#475569',
                            cursor: 'pointer'
                        }}
                    >
                        Expand All Modules
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        type="button"
                        onClick={() => handleToggleAllPermissions(true)}
                        style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#1d4ed8',
                            cursor: 'pointer'
                        }}
                    >
                        <BiCheckDouble size={14} style={{ marginRight: '4px' }} /> Check All Over Entire Role
                    </button>
                    <button
                        type="button"
                        onClick={() => handleToggleAllPermissions(false)}
                        style={{
                            background: '#fff1f2',
                            border: '1px solid #fecdd3',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#be123c',
                            cursor: 'pointer'
                        }}
                    >
                        Uncheck All
                    </button>
                </div>
            </div>

            {/* Permissions Accordion Container with SimpleBar Standalone Scroll */}
            <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                <SimpleBar style={{ maxHeight: 'calc(100vh - 280px)' }}>
                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {Object.entries(groupedPermissions).map(([moduleKey, group]) => {
                            const isCollapsed = !!collapsedModules[moduleKey];
                            const modLabel = moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1).replace(/[-_]/g, ' ');

                            const modActionCount = group.actions.length;
                            const modColCount = group.columns.length;

                            const checkedActionsInMod = group.actions.filter(a => assignedPermIds.has(a.id)).length;
                            const checkedColsInMod = group.columns.filter(c => {
                                const p = fieldPerms[`${moduleKey}:${c.column_name}`];
                                return p && (p.can_view || p.can_add || p.can_edit);
                            }).length;

                            const allModChecked = (modActionCount > 0 || modColCount > 0) &&
                                checkedActionsInMod === modActionCount &&
                                checkedColsInMod === modColCount;

                            return (
                                <div
                                    key={moduleKey}
                                    style={{
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        background: '#ffffff'
                                    }}
                                >
                                    {/* Module Collapsible Header */}
                                    <div
                                        onClick={() => toggleCollapse(moduleKey)}
                                        style={{
                                            padding: '12px 18px',
                                            background: '#f8fafc',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0',
                                            userSelect: 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
                                                {isCollapsed ? <BiChevronRight size={20} /> : <BiChevronDown size={20} />}
                                            </span>
                                            <div>
                                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                                                    {modLabel} Module
                                                </span>
                                                <span style={{
                                                    marginLeft: '10px',
                                                    fontSize: '11px',
                                                    background: '#e2e8f0',
                                                    color: '#475569',
                                                    padding: '2px 8px',
                                                    borderRadius: '10px',
                                                    fontWeight: 600
                                                }}>
                                                    {modActionCount} Actions • {modColCount} Columns
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                                            <span style={{ fontSize: '12px', color: '#64748b', marginRight: '6px' }}>
                                                {checkedActionsInMod + checkedColsInMod} / {modActionCount + modColCount} Active
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleModule(moduleKey, group, !allModChecked)}
                                                style={{
                                                    background: allModChecked ? '#fee2e2' : '#e0e7ff',
                                                    border: `1px solid ${allModChecked ? '#fca5a5' : '#c7d2fe'}`,
                                                    borderRadius: '6px',
                                                    padding: '4px 10px',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    color: allModChecked ? '#b91c1c' : '#4338ca',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {allModChecked ? 'Uncheck Module' : 'Check All in Module'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Module Body (Visible when Expanded) */}
                                    {!isCollapsed && (
                                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {/* 1. Route Action Permissions */}
                                            {group.actions.length > 0 && (
                                                <div>
                                                    <div style={{
                                                        fontSize: '12px',
                                                        fontWeight: 700,
                                                        color: '#475569',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        marginBottom: '10px'
                                                    }}>
                                                        Route Actions & Feature Operations
                                                    </div>
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                                        gap: '8px'
                                                    }}>
                                                        {group.actions.map(action => {
                                                            const isChecked = assignedPermIds.has(action.id);
                                                            return (
                                                                <label
                                                                    key={action.id}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '10px',
                                                                        padding: '8px 12px',
                                                                        background: isChecked ? '#f0fdf4' : '#ffffff',
                                                                        border: `1px solid ${isChecked ? '#bbf7d0' : '#e2e8f0'}`,
                                                                        borderRadius: '6px',
                                                                        cursor: 'pointer',
                                                                        fontSize: '13px',
                                                                        color: isChecked ? '#15803d' : '#334155',
                                                                        fontWeight: isChecked ? 600 : 500,
                                                                        transition: 'all 0.15s ease'
                                                                    }}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => handleTogglePerm(action.id)}
                                                                        style={{ accentColor: '#16a34a', width: '16px', height: '16px', cursor: 'pointer' }}
                                                                    />
                                                                    <div style={{ flex: 1 }}>
                                                                        <div>{action.name}</div>
                                                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                                            {action.slug}
                                                                        </div>
                                                                    </div>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* 2. Column-Level Field Permissions */}
                                            {group.columns.length > 0 && (
                                                <div style={{ marginTop: group.actions.length > 0 ? '8px' : 0 }}>
                                                    <div style={{
                                                        fontSize: '12px',
                                                        fontWeight: 700,
                                                        color: '#475569',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        marginBottom: '10px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}>
                                                        <BiColumns size={16} /> Column-Level Access & Field Security ({group.columns.length} Fields)
                                                    </div>
                                                    <div style={{
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '6px',
                                                        overflowX: 'auto',
                                                        maxWidth: '100%'
                                                    }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                            <thead>
                                                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', width: '34%' }}>
                                                                        Field / Column
                                                                    </th>
                                                                    <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 600, color: '#475569', width: '22%' }}>
                                                                        Can View Column
                                                                    </th>
                                                                    <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 600, color: '#475569', width: '22%' }}>
                                                                        Can Add Column
                                                                    </th>
                                                                    <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 600, color: '#475569', width: '22%' }}>
                                                                        Can Edit Column
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {group.columns.map(col => {
                                                                    const key = `${moduleKey}:${col.column_name}`;
                                                                    const perm = fieldPerms[key] || { can_view: false, can_add: false, can_edit: false };

                                                                    return (
                                                                        <tr key={col.column_name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                            <td style={{ padding: '8px 14px' }}>
                                                                                <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                                                                    {col.label || col.column_name}
                                                                                </div>
                                                                                <div style={{ fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#64748b' }}>
                                                                                    {col.column_name}
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={perm.can_view}
                                                                                    onChange={() => handleToggleColumn(moduleKey, col.column_name, 'can_view')}
                                                                                    style={{ accentColor: '#4f46e5', width: '16px', height: '16px', cursor: 'pointer' }}
                                                                                />
                                                                            </td>
                                                                            <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={perm.can_add}
                                                                                    onChange={() => handleToggleColumn(moduleKey, col.column_name, 'can_add')}
                                                                                    style={{ accentColor: '#10b981', width: '16px', height: '16px', cursor: 'pointer' }}
                                                                                    title="Can Add Column"
                                                                                />
                                                                            </td>
                                                                            <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={perm.can_edit}
                                                                                    onChange={() => handleToggleColumn(moduleKey, col.column_name, 'can_edit')}
                                                                                    style={{ accentColor: '#4f46e5', width: '16px', height: '16px', cursor: 'pointer' }}
                                                                                    title="Can Edit Column"
                                                                                />
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </SimpleBar>
            </div>
        </div>
    );
};

export default RolePermissions;

