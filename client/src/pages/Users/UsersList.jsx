import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BiPlus,
    BiRefresh,
    BiUser,
    BiShow,
    BiEdit,
    BiTrash,
    BiImage,
    BiShieldQuarter
} from 'react-icons/bi';
import apiClient from '../../api/client';
import AgGridTable from '../../components/Datatable/AgGridTable';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import { getMediaUrl } from '../../utils/media';

const UsersList = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { setActions } = usePageActions();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [columnConfigs, setColumnConfigs] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const [usersRes, rolesRes, colsRes] = await Promise.all([
                apiClient.get('/users', { per_page: 250 }),
                apiClient.get('/roles'),
                apiClient.get('/columns/config/users')
            ]);
            if (usersRes.success) setUsers(usersRes.data || []);
            if (rolesRes.success) setRoles(rolesRes.data || []);
            if (colsRes.success && colsRes.data) setColumnConfigs(colsRes.data);
        } catch (err) {
            console.error('Failed to load users:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    // Ensure breadcrumbs action area is clean
    useEffect(() => {
        setActions(null);
        return () => {
            setActions(null);
        };
    }, [setActions]);

    // Delete User
    const handleDeleteUser = async (user) => {
        if (user.is_super_admin === 1) {
            toast.warning('System Protected', 'Super Admin account is permanently immune and cannot be deleted.');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete user "${user.username}" (${user.full_name || 'Staff'})?`)) return;

        try {
            await apiClient.delete(`/users/${user.id}`);
            toast.success('User Deleted', `User "${user.username}" (${user.full_name || 'Staff'}) has been deleted.`);
            loadUsers();
        } catch (err) {
            toast.error('Deletion Failed', err.message);
        }
    };

    // Role palette colors
    const getRoleColor = (roleName, isSuper) => {
        if (isSuper) return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
        const name = (roleName || '').toLowerCase();
        if (name.includes('estimator')) return { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' };
        if (name.includes('project') || name.includes('manager')) return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
        if (name.includes('sales') || name.includes('bid')) return { bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8' };
        if (name.includes('account') || name.includes('finance')) return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
        return { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0' };
    };

    const columnDefs = useMemo(() => {
        // Pinned Left: Employee ID
        const defs = [
            {
                field: 'employee_id',
                headerName: 'Employee ID',
                width: 140,
                pinned: 'left',
                cellStyle: { fontWeight: 700, color: '#4f46e5', letterSpacing: '0.3px' },
                valueGetter: (params) => {
                    const id = params.data?.id;
                    if (!id) return '';
                    return `IMP#${String(id).padStart(4, '0')}`;
                }
            }
        ];

        // Determine visible columns from active column configurations
        const visibleConfigs = (columnConfigs.length > 0)
            ? columnConfigs.filter(c => c.is_list_visible === 1)
            : [
                { column_name: 'full_name', label: 'Staff Member' },
                { column_name: 'username', label: 'Username' },
                { column_name: 'email', label: 'Email Address' },
                { column_name: 'role_id', label: 'Assigned Roles' },
                { column_name: 'status', label: 'Status' }
            ];

        visibleConfigs.forEach(col => {
            const field = col.column_name;
            const header = col.label || field;

            if (field === 'full_name') {
                defs.push({
                    field: 'full_name',
                    headerName: header,
                    flex: 2,
                    minWidth: 190,
                    cellStyle: { fontWeight: 600, color: '#0f172a' },
                    cellRenderer: (p) => {
                        const name = p.value || p.data?.username || 'User';
                        const initial = name.charAt(0).toUpperCase();
                        const avatarPath = p.data?.avatar_file_path;
                        const avatarUrl = avatarPath ? getMediaUrl(avatarPath) : null;
                        return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%' }}>
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt={name}
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            border: '1px solid #cbd5e1'
                                        }}
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: '#4f46e5',
                                        color: '#fff',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {initial}
                                    </div>
                                )}
                                <span>{name}</span>
                            </div>
                        );
                    }
                });
            } else if (field === 'username') {
                defs.push({
                    field: 'username',
                    headerName: header,
                    width: 140,
                    cellStyle: { color: '#4f46e5', fontWeight: 600 }
                });
            } else if (field === 'email') {
                defs.push({
                    field: 'email',
                    headerName: header,
                    flex: 2,
                    minWidth: 190,
                });
            } else if (field === 'role_id' || field === 'roles' || field === 'role_names') {
                defs.push({
                    field: 'role_names',
                    headerName: header,
                    width: 210,
                    cellRenderer: (p) => {
                        const isSuper = p.data?.is_super_admin === 1;
                        if (isSuper) {
                            return (
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: '#fef3c7',
                                    border: '1px solid #fde68a',
                                    borderRadius: '6px',
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: '#92400e',
                                    textTransform: 'uppercase',
                                }}>
                                    <BiShieldQuarter size={14} /> SUPER ADMIN
                                </span>
                            );
                        }

                        const userRoles = p.data?.roles || [];
                        if (userRoles.length === 0) {
                            return (
                                <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                                    {p.data?.role_name || 'Staff'}
                                </span>
                            );
                        }

                        return (
                            <div>
                                {userRoles.map((r) => {
                                    const c = getRoleColor(r.name, false);
                                    return (
                                        <span
                                            key={r.id}
                                            style={{
                                                background: c.bg,
                                                border: `1px solid ${c.border}`,
                                                borderRadius: '4px',
                                                padding: '6px 8px',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                color: c.text
                                            }}
                                        >
                                            {r.name}
                                        </span>
                                    );
                                })}
                            </div>
                        );
                    }
                });
            } else if (field === 'status') {
                defs.push({
                    field: 'status',
                    headerName: header,
                    width: 110,
                    cellRenderer: (p) => (
                        <span style={{
                            color: p.value === 'active' ? '#059669' : '#dc2626',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            fontSize: '11px'
                        }}>
                            ● {p.value}
                        </span>
                    )
                });
            } else if (field === 'password' || field === 'password_hash') {
                defs.push({
                    field: 'password_hash',
                    headerName: header,
                    width: 140,
                    editable: false,
                    filter: false,
                    cellRenderer: () => "🔐🔐🔐🔐",
                });
            } else if (field === 'created_at' || field === 'updated_at') {
                defs.push({
                    field,
                    headerName: header,
                    width: 140,
                    valueGetter: (params) => {
                        const val = params.data?.[field];
                        return val ? val.slice(0, 10) : '';
                    }
                });
            } else {
                defs.push({
                    field,
                    headerName: header,
                    minWidth: 140,
                    cellRenderer: (p) => {
                        const val = p.value;
                        if (val === null || val === undefined || val === '') {
                            return <span style={{ color: '#cbd5e1' }}>—</span>;
                        }
                        return String(val);
                    }
                });
            }
        });

        // Pinned Right: Actions Column
        defs.push({
            headerName: 'Actions',
            width: 300,
            pinned: 'right',
            cellRenderer: (p) => {
                if (!p.data) return null;
                const isSuper = p.data.is_super_admin === 1;
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '100%' }}>
                        <button
                            type="button"
                            onClick={() => navigate(`/users/view/${p.data.id}`)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <BiShow size={14} /> View
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/users/edit/${p.data.id}`)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <BiEdit size={14} /> Edit
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/users/${p.data.id}/media`)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                color: '#475569',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <BiImage size={14} /> Media
                        </button>
                        {!isSuper && (
                            <button
                                type="button"
                                onClick={() => handleDeleteUser(p.data)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    color: '#dc2626',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                <BiTrash size={14} /> Delete
                            </button>
                        )}
                    </div>
                );
            }
        });

        return defs;
    }, [columnConfigs, navigate, handleDeleteUser]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* AgGrid Interactive Table */}
            <div style={{ flex: 1, minHeight: '560px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <AgGridTable
                    rowData={users}
                    columnDefs={columnDefs}
                    loading={loading}
                    enableExport={true}
                    enableSearch={true}
                    rowHeight={48}
                    headerHeight={44}
                    extraHeaderActions={
                        <>
                            <button
                                type="button"
                                onClick={() => navigate('/users/create')}
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
                                <BiPlus size={16} /> Add Staff User
                            </button>

                            <button
                                type="button"
                                onClick={loadUsers}
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
                                title="Reload"
                            >
                                <BiRefresh size={18} />
                            </button>
                        </>
                    }
                    gridOptions={{
                        rowSelection: undefined,
                        pagination: false,
                        paginationPageSize: 10,
                    }}
                />
            </div>
        </div>
    );
};

export default UsersList;
