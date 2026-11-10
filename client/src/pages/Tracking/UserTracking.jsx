import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BiLineChart,
    BiUser,
    BiTimeFive,
    BiPointer,
    BiCalendar,
    BiRefresh,
    BiLoaderAlt,
    BiCheckCircle,
    BiRadioCircle,
    BiArrowToRight
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import { AgGridTable } from '../../components/Datatable/AgGridTable';
import styles from './UserTracking.module.css';

const formatDuration = (mins) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) {
        return `${h}h ${m}m`;
    }
    return `${m}m`;
};

const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

const UserTracking = () => {
    const navigate = useNavigate();
    const { setCustomBreadcrumbs } = usePageActions();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        return d.toISOString().slice(0, 10);
    });

    const loadUsersTracking = useCallback(async (dateVal) => {
        setLoading(true);
        try {
            const targetDate = dateVal || selectedDate;
            const res = await apiClient.get(`/tracking/users?date=${targetDate}`);
            if (res.success && Array.isArray(res.data)) {
                setUsers(res.data);
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to load user tracking data');
        } finally {
            setLoading(false);
        }
    }, [selectedDate, toast]);

    useEffect(() => {
        setCustomBreadcrumbs([
            { label: 'User Tracking', to: '/tracking/users' },
            { label: 'Team Overview' }
        ]);
        loadUsersTracking();
    }, [setCustomBreadcrumbs, loadUsersTracking]);

    const handleDateChange = (e) => {
        const newDate = e.target.value;
        setSelectedDate(newDate);
        loadUsersTracking(newDate);
    };

    // Calculate aggregated metrics
    const totalUsers = users.length;
    const onlineCount = users.filter((u) => u.is_online).length;
    const totalMinutes = users.reduce((acc, u) => acc + (u.total_minutes || 0), 0);
    const totalClicks = users.reduce((acc, u) => acc + (u.total_clicks || 0), 0);
    const totalKeystrokes = users.reduce((acc, u) => acc + (u.total_keystrokes || 0), 0);

    // Unconditional AG-Grid column definitions
    const columnDefs = useMemo(() => {
        return [
            {
                headerName: 'Staff Member',
                field: 'full_name',
                minWidth: 220,
                flex: 1.2,
                cellRenderer: (p) => {
                    if (!p.data) return null;
                    const u = p.data;
                    const initials = getInitials(u.full_name || u.username);
                    return (
                        <div className={styles.userCell}>
                            <div className={styles.avatar}>
                                {u.avatar_url ? (
                                    <img src={u.avatar_url} alt={u.full_name} style={{ width: '100%', height: '100%', borderRadius: '8px' }} />
                                ) : (
                                    initials
                                )}
                            </div>
                            <div className={styles.userInfo}>
                                <span className={styles.userName}>{u.full_name}</span>
                                <span className={styles.userSub}>{u.email || u.username}</span>
                            </div>
                        </div>
                    );
                }
            },
            {
                headerName: 'Role',
                field: 'role_name',
                minWidth: 140,
                flex: 0.9,
                cellRenderer: (p) => <span style={{ fontWeight: 600, color: '#334155' }}>{p.value || 'Staff'}</span>
            },
            {
                headerName: 'Status',
                field: 'is_online',
                minWidth: 130,
                flex: 0.8,
                cellRenderer: (p) => {
                    const isOnline = Boolean(p.value);
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                            {isOnline ? (
                                <span className={styles.onlineBadge}>
                                    <span className={styles.pulseDot}></span> Online
                                </span>
                            ) : (
                                <span className={styles.offlineBadge}>
                                    <span className={styles.offlineDot}></span> Offline
                                </span>
                            )}
                        </div>
                    );
                }
            },
            {
                headerName: 'Tracked Time',
                field: 'total_minutes',
                minWidth: 130,
                flex: 0.9,
                cellRenderer: (p) => {
                    const mins = Number(p.value || 0);
                    return <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatDuration(mins)}</span>;
                }
            },
            {
                headerName: 'Clicks',
                field: 'total_clicks',
                minWidth: 110,
                flex: 0.8,
                cellRenderer: (p) => {
                    const clicks = Number(p.value || 0);
                    return <span style={{ color: '#059669', fontWeight: 600 }}>{clicks.toLocaleString()}</span>;
                }
            },
            {
                headerName: 'Keystrokes',
                field: 'total_keystrokes',
                minWidth: 120,
                flex: 0.8,
                cellRenderer: (p) => {
                    const keys = Number(p.value || 0);
                    return <span style={{ color: '#2563eb', fontWeight: 600 }}>{keys.toLocaleString()}</span>;
                }
            },
            {
                headerName: 'Idle Time',
                field: 'total_idle_minutes',
                minWidth: 110,
                flex: 0.8,
                cellRenderer: (p) => {
                    const idle = Number(p.value || 0);
                    return <span style={{ color: idle > 30 ? '#dc2626' : '#64748b', fontWeight: 600 }}>{formatDuration(idle)}</span>;
                }
            },
            {
                headerName: 'Activity Rate',
                field: 'total_minutes',
                minWidth: 150,
                flex: 1,
                cellRenderer: (p) => {
                    const total = Number(p.data?.total_minutes || 0);
                    const idle = Number(p.data?.total_idle_minutes || 0);
                    const active = Math.max(0, total - idle);
                    const rate = total > 0 ? Math.round((active / total) * 100) : 0;
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', justifyContent: 'center', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                                <span style={{ color: '#64748b' }}>Active</span>
                                <span style={{ color: '#2563eb' }}>{rate}%</span>
                            </div>
                            <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '20px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${rate}%`, background: 'linear-gradient(90deg, #2563eb, #3b82f6)', borderRadius: '20px' }}></div>
                            </div>
                        </div>
                    );
                }
            },
            {
                headerName: 'Actions',
                field: 'id',
                minWidth: 130,
                flex: 0.8,
                sortable: false,
                filter: false,
                cellRenderer: (p) => {
                    const uid = p.value;
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                            <button
                                type="button"
                                onClick={() => navigate(`/tracking/activity/${uid}?date=${selectedDate}`)}
                                className={styles.btnViewAction}
                            >
                                View Activity <BiArrowToRight />
                            </button>
                        </div>
                    );
                }
            }
        ];
    }, [navigate, selectedDate]);

    return (
        <div className={styles.trackingContainer}>
            {/* Header Card */}
            <div className={styles.headerCard}>
                <div className={styles.headerInfo}>
                    <div className={styles.headerIcon}>
                        <BiLineChart />
                    </div>
                    <div>
                        <h1 className={styles.headerTitle}>Team Activity Tracker & Heartbeat</h1>
                        <div className={styles.headerSubtitle}>
                            Monitor real-time active users, aggregate mouse/keyboard productivity, and daily engagement.
                        </div>
                    </div>
                </div>

                <div className={styles.headerActions}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BiCalendar size={18} style={{ color: '#64748b' }} />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={handleDateChange}
                            className={styles.datePickerInput}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => loadUsersTracking()}
                        className={styles.btnViewAction}
                        style={{ padding: '8px 14px' }}
                    >
                        <BiRefresh size={16} /> Refresh
                    </button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                    <div className={styles.metricTop}>
                        <span className={styles.metricLabel}>Active Online Now</span>
                        <div className={`${styles.metricIcon} ${styles.iconGreen}`}>
                            <BiCheckCircle />
                        </div>
                    </div>
                    <div className={styles.metricValue} style={{ color: '#059669' }}>
                        {onlineCount} <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 500 }}>/ {totalUsers}</span>
                    </div>
                    <span className={styles.metricSub}>Active in last 5 minutes</span>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricTop}>
                        <span className={styles.metricLabel}>Total Time Tracked</span>
                        <div className={`${styles.metricIcon} ${styles.iconBlue}`}>
                            <BiTimeFive />
                        </div>
                    </div>
                    <div className={styles.metricValue} style={{ color: '#2563eb' }}>
                        {formatDuration(totalMinutes)}
                    </div>
                    <span className={styles.metricSub}>Across all team members</span>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricTop}>
                        <span className={styles.metricLabel}>Mouse Clicks</span>
                        <div className={`${styles.metricIcon} ${styles.iconAmber}`}>
                            <BiPointer />
                        </div>
                    </div>
                    <div className={styles.metricValue}>
                        {totalClicks.toLocaleString()}
                    </div>
                    <span className={styles.metricSub}>Recorded clicks today</span>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricTop}>
                        <span className={styles.metricLabel}>Keystrokes</span>
                        <div className={`${styles.metricIcon} ${styles.iconPurple}`}>
                            <BiLineChart />
                        </div>
                    </div>
                    <div className={styles.metricValue}>
                        {totalKeystrokes.toLocaleString()}
                    </div>
                    <span className={styles.metricSub}>Recorded typing strokes</span>
                </div>
            </div>

            {/* AG Grid Table Card */}
            <div className={styles.gridCard}>
                <AgGridTable
                    rowData={users}
                    columnDefs={columnDefs}
                    loading={loading}
                    height="500px"
                    title="Staff Activity Roster"
                    quickFilter={true}
                    exportButtons={true}
                />
            </div>
        </div>
    );
};

export default UserTracking;

