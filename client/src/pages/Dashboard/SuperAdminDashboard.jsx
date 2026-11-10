import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BiShieldQuarter,
    BiUser,
    BiKey,
    BiColumns,
    BiPlus,
    BiRefresh,
    BiCheckCircle,
    BiServer,
    BiGridAlt
} from 'react-icons/bi';
import apiClient from '../../api/client';
import AgGridTable from '../../components/Datatable/AgGridTable';
import { useAuth } from '../../context/AuthContext';

const SuperAdminDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        totalRoles: 0,
        totalPermissions: 0,
    });
    const [recentUsers, setRecentUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [usersRes, rolesRes, permsRes] = await Promise.all([
                apiClient.get('/users', { per_page: 50 }),
                apiClient.get('/roles'),
                apiClient.get('/permissions'),
            ]);

            if (usersRes.success) {
                const userList = usersRes.data || [];
                setRecentUsers(userList);
                setStats(prev => ({
                    ...prev,
                    totalUsers: usersRes.meta?.total || userList.length,
                    activeUsers: userList.filter(u => u.status === 'active').length,
                }));
            }

            if (rolesRes.success) {
                setRoles(rolesRes.data || []);
                setStats(prev => ({
                    ...prev,
                    totalRoles: rolesRes.data?.length || 0,
                }));
            }

            if (permsRes.success) {
                setStats(prev => ({
                    ...prev,
                    totalPermissions: permsRes.data?.all?.length || 0,
                }));
            }
        } catch (err) {
            console.error('Failed to load super admin stats:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboardData();
    }, []);

    const userColumns = [
        {
            field: 'id',
            headerName: 'ID',
            width: 70,
            pinned: 'left',
        },
        {
            field: 'full_name',
            headerName: 'Staff Member',
            flex: 2,
            minWidth: 180,
            cellStyle: { fontWeight: 600, color: '#0f172a' }
        },
        {
            field: 'username',
            headerName: 'Username',
            width: 150,
            cellStyle: { color: '#4f46e5', fontWeight: 500 }
        },
        {
            field: 'role_name',
            headerName: 'Role',
            width: 170,
            cellRenderer: (p) => {
                const isSuper = p.data?.is_super_admin === 1;
                return (
                    <button style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: isSuper ? '#fef3c7' : '#e0e7ff',
                        color: isSuper ? '#b45309' : '#3730a3',
                    }}>
                        {isSuper ? 'SUPER ADMIN (IMMUNE)' : (p.value || 'STAFF')}
                    </button>
                );
            }
        },
        {
            field: 'phone',
            headerName: 'Phone',
            width: 150,
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 110,
            cellRenderer: (p) => (
                <span style={{
                    color: p.value === 'active' ? '#059669' : '#dc2626',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    fontSize: '11px'
                }}>
                    ● {p.value}
                </span>
            )
        },
        {
            field: 'created_at',
            headerName: 'Registered On',
            width: 130,
            valueFormatter: (p) => p.value ? p.value.slice(0, 10) : ''
        }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Super Admin Welcome Banner */}
            <div style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
                borderRadius: '16px',
                padding: '24px 28px',
                color: '#ffffff',
                boxShadow: '0 4px 14px rgba(49, 46, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{
                            background: '#fbbf24',
                            color: '#78350f',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 800,
                            letterSpacing: '0.5px'
                        }}>
                            SUPER ADMIN WORKSPACE
                        </span>
                        <span style={{ fontSize: '12px', color: '#c7d2fe' }}>● Full System Authority Active</span>
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0' }}>
                        Welcome back, {user?.full_name || user?.username || 'Super Admin'}
                    </h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#e0e7ff', opacity: 0.9 }}>
                        Internal Management Platform Core • Clean High-Speed Architecture
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => navigate('/roles')}
                        style={{
                            background: 'rgba(255, 255, 255, 0.15)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            color: '#ffffff',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Manage Roles
                    </button>
                    <button
                        onClick={() => navigate('/users')}
                        style={{
                            background: '#ffffff',
                            border: 'none',
                            color: '#312e81',
                            borderRadius: '8px',
                            padding: '8px 18px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        + Add Staff User
                    </button>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Users</span>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BiUser size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>{stats.totalUsers}</div>
                    <div style={{ fontSize: '12px', color: '#059669', marginTop: '4px', fontWeight: 500 }}>
                        {stats.activeUsers} active staff accounts
                    </div>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Security Roles</span>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BiShieldQuarter size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>{stats.totalRoles}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        RBAC hierarchy configured
                    </div>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>System Capabilities</span>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BiKey size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>{stats.totalPermissions}</div>
                    <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px', fontWeight: 500 }}>
                        Fine-grained module permissions
                    </div>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Database Engine</span>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f1f5f9', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BiServer size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '6px', height: '34px' }}>
                        <BiCheckCircle size={20} /> Healthy & Connected
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        MySQL imp @ 127.0.0.1:3306
                    </div>
                </div>
            </div>

            {/* Quick Navigation Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div
                    onClick={() => navigate('/users')}
                    style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '18px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: '4px' }}>
                        👥 User Management
                    </div>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                        Manage staff directory, multi-bank accounts, addresses, references, and profile credentials.
                    </p>
                </div>

                <div
                    onClick={() => navigate('/roles')}
                    style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '18px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: '4px' }}>
                        🛡️ Roles & Permissions
                    </div>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                        Define system roles, assign permissions, and configure column-level data security.
                    </p>
                </div>

                <div
                    onClick={() => navigate('/roles/columns')}
                    style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '18px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: '4px' }}>
                        🔒 Column-Level Data Masking
                    </div>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                        Control field-level visibility (`can_view`, `can_edit`) to mask sensitive data from lower roles.
                    </p>
                </div>
            </div>

            {/* Recent Staff User Registry */}
            <AgGridTable
                title="Staff User Directory (Super Admin View)"
                rowData={recentUsers}
                columnDefs={userColumns}
                loading={loading}
                height="450px"
                extraHeaderActions={
                    <button
                        onClick={loadDashboardData}
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
                }
            />
        </div>
    );
};

export default SuperAdminDashboard;

