import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import {
    BiTimeFive,
    BiMouse,
    BiSolidKeyboard,
    BiPulse,
    BiCalendar,
    BiDesktop,
    BiArrowBack,
    BiUser,
    BiBarChartAlt2,
    BiRefresh
} from 'react-icons/bi';
import styles from './MyActivity.module.css';

const MyActivity = () => {
    const { userId } = useParams();
    const navigate = useNavigate();

    const [selectedUserId, setSelectedUserId] = useState(userId || '1');
    const [usersList, setUsersList] = useState([]);
    const [selectedDate, setSelectedDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);

    // Fetch users for selector
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await apiClient.get('/users');
                if (res?.data) {
                    setUsersList(res.data);
                }
            } catch (err) {
                console.error('Failed to load users for activity switcher', err);
            }
        };
        fetchUsers();
    }, []);

    // Sync state if url param changes
    useEffect(() => {
        if (userId && userId !== selectedUserId) {
            setSelectedUserId(userId);
        }
    }, [userId]);

    const fetchStats = useCallback(async () => {
        if (!selectedUserId) return;
        setLoading(true);
        try {
            const res = await apiClient.get('/tracking/activity/stats', {
                user_id: selectedUserId,
                date: selectedDate
            });
            if (res?.success) {
                setStats(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch activity stats', err);
        } finally {
            setLoading(false);
        }
    }, [selectedUserId, selectedDate]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleUserChange = (e) => {
        const newId = e.target.value;
        setSelectedUserId(newId);
        navigate(`/tracking/activity/${newId}`);
    };

    const handleQuickDate = (type) => {
        const d = new Date();
        if (type === 'yesterday') {
            d.setDate(d.getDate() - 1);
        }
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    const isYesterday = (() => {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return selectedDate === y.toISOString().split('T')[0];
    })();

    return (
        <div className={styles.activityContainer}>
            {/* Header / Filter Toolbar */}
            <div className={styles.headerCard}>
                <div className={styles.userProfile}>
                    <button
                        onClick={() => navigate('/tracking/users')}
                        className={styles.dateQuickBtn}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Back to Team Tracking"
                    >
                        <BiArrowBack size={16} /> Team
                    </button>
                    <div className={styles.userAvatar}>
                        {stats?.user?.name ? stats.user.name.charAt(0).toUpperCase() : <BiUser />}
                    </div>
                    <div className={styles.userInfo}>
                        <h2>{stats?.user?.name || 'Staff Activity'}</h2>
                        <p>{stats?.user?.email || 'Activity Timeline & Metrics'}</p>
                    </div>
                </div>

                <div className={styles.controlsGroup}>
                    {usersList.length > 0 && (
                        <select
                            className={styles.userSelect}
                            value={selectedUserId}
                            onChange={handleUserChange}
                        >
                            {usersList.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name} ({u.email})
                                </option>
                            ))}
                        </select>
                    )}

                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            type="button"
                            className={`${styles.dateQuickBtn} ${isToday ? styles.dateQuickBtnActive : ''}`}
                            onClick={() => handleQuickDate('today')}
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            className={`${styles.dateQuickBtn} ${isYesterday ? styles.dateQuickBtnActive : ''}`}
                            onClick={() => handleQuickDate('yesterday')}
                        >
                            Yesterday
                        </button>
                    </div>

                    <input
                        type="date"
                        className={styles.dateInput}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />

                    <button
                        type="button"
                        onClick={fetchStats}
                        className={styles.dateQuickBtn}
                        title="Refresh"
                    >
                        <BiRefresh size={18} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className={styles.loadingBox}>
                    <BiPulse size={36} style={{ color: '#3b82f6', animation: 'spin 1.5s linear infinite' }} />
                    <span>Loading activity metrics...</span>
                </div>
            ) : (
                <>
                    {/* Top Stats Overview */}
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statIconWrap} style={{ background: '#eff6ff', color: '#3b82f6' }}>
                                <BiTimeFive />
                            </div>
                            <div className={styles.statInfo}>
                                <span className={styles.statLabel}>Total Tracked Time</span>
                                <span className={styles.statValue}>
                                    {stats?.formatted_total_time || '0h 0m'}
                                </span>
                                <span className={styles.statSub}>Total work logged today</span>
                            </div>
                        </div>

                        <div className={styles.statCard}>
                            <div className={styles.statIconWrap} style={{ background: '#ecfdf5', color: '#10b981' }}>
                                <BiPulse />
                            </div>
                            <div className={styles.statInfo}>
                                <span className={styles.statLabel}>Activity Rate</span>
                                <span className={styles.statValue}>
                                    {stats?.activity_rate ?? 0}%
                                </span>
                                <span className={styles.statSub}>Overall productivity score</span>
                            </div>
                        </div>

                        <div className={styles.statCard}>
                            <div className={styles.statIconWrap} style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
                                <BiSolidKeyboard />
                            </div>
                            <div className={styles.statInfo}>
                                <span className={styles.statLabel}>Keystrokes</span>
                                <span className={styles.statValue}>
                                    {(stats?.total_keystrokes || 0).toLocaleString()}
                                </span>
                                <span className={styles.statSub}>Total typing interactions</span>
                            </div>
                        </div>

                        <div className={styles.statCard}>
                            <div className={styles.statIconWrap} style={{ background: '#fffbeb', color: '#f59e0b' }}>
                                <BiMouse />
                            </div>
                            <div className={styles.statInfo}>
                                <span className={styles.statLabel}>Mouse Clicks</span>
                                <span className={styles.statValue}>
                                    {(stats?.total_clicks || 0).toLocaleString()}
                                </span>
                                <span className={styles.statSub}>Total mouse clicks logged</span>
                            </div>
                        </div>
                    </div>

                    {/* 24-Hour Timeline Visualizer */}
                    <div className={styles.sectionCard}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <BiBarChartAlt2 size={20} color="#3b82f6" />
                                <span>24-Hour Activity Timeline</span>
                            </div>
                            <div className={styles.timelineLegend}>
                                <span>
                                    <span className={styles.legendDot} style={{ background: '#10b981' }}></span>
                                    High (&gt;65%)
                                </span>
                                <span>
                                    <span className={styles.legendDot} style={{ background: '#3b82f6' }}></span>
                                    Normal (30-65%)
                                </span>
                                <span>
                                    <span className={styles.legendDot} style={{ background: '#f59e0b' }}></span>
                                    Light (&lt;30%)
                                </span>
                            </div>
                        </div>

                        <div className={styles.timelineContainer}>
                            {(stats?.hourly_timeline || []).map((hourData) => {
                                const maxSecsInHour = 3600;
                                const heightPercent = Math.min(100, Math.round((hourData.total_seconds / maxSecsInHour) * 100));
                                
                                let fillClass = styles.hourBarFillMed;
                                if (hourData.activity_rate >= 65) {
                                    fillClass = styles.hourBarFillHigh;
                                } else if (hourData.activity_rate < 30 && hourData.total_seconds > 0) {
                                    fillClass = styles.hourBarFillLow;
                                }

                                return (
                                    <div key={hourData.hour} className={styles.timelineHourBlock}>
                                        <div className={styles.hourBarTrack}>
                                            <div
                                                className={`${styles.hourBarFill} ${fillClass}`}
                                                style={{ height: `${heightPercent}%` }}
                                            />
                                        </div>
                                        <span className={styles.hourLabel}>{hourData.formatted_hour}</span>

                                        {/* Hover Tooltip */}
                                        <div className={styles.hourTooltip}>
                                            <strong>{hourData.formatted_hour} - {String(hourData.hour + 1).padStart(2, '0')}:00</strong>
                                            <div>Tracked: {hourData.formatted_time}</div>
                                            <div>Activity: {hourData.activity_rate}%</div>
                                            <div>Keystrokes: {hourData.keystrokes}</div>
                                            <div>Clicks: {hourData.clicks}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Top Applications & Window Titles */}
                    <div className={styles.sectionCard}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <BiDesktop size={20} color="#6366f1" />
                                <span>Application & Tool Usage</span>
                            </div>
                            <span style={{ fontSize: '13px', color: '#64748b' }}>
                                Total {(stats?.app_usage || []).length} applications tracked
                            </span>
                        </div>

                        {(!stats?.app_usage || stats.app_usage.length === 0) ? (
                            <div className={styles.emptyState}>
                                <BiDesktop className={styles.emptyIcon} />
                                <h4>No application activities found</h4>
                                <p>No tracker activity logs recorded for {selectedDate}.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className={styles.appTable}>
                                    <thead>
                                        <tr>
                                            <th>Application / Window</th>
                                            <th>Time Spent</th>
                                            <th>% of Day</th>
                                            <th>Activity Rate</th>
                                            <th>Keystrokes</th>
                                            <th>Clicks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.app_usage.map((app, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <div className={styles.appNameCell}>
                                                        <div className={styles.appIconPill}>
                                                            <BiDesktop />
                                                        </div>
                                                        <span>{app.app_name}</span>
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{app.formatted_time}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div className={styles.percentTrack}>
                                                            <div
                                                                className={styles.percentFill}
                                                                style={{ width: `${app.percentage}%` }}
                                                            />
                                                        </div>
                                                        <span style={{ fontSize: '12px', color: '#64748b', minWidth: '32px' }}>
                                                            {app.percentage}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        background: '#eff6ff',
                                                        color: '#2563eb'
                                                    }}>
                                                        {Math.round(((app.clicks + app.keystrokes) / Math.max(1, app.total_seconds / 60)) * 10)}%
                                                    </span>
                                                </td>
                                                <td>{(app.keystrokes || 0).toLocaleString()}</td>
                                                <td>{(app.clicks || 0).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default MyActivity;
