import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import Select from '../../components/ui/Select/Select';
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
    BiRefresh,
    BiLoaderAlt
} from 'react-icons/bi';
import styles from './MyActivity.module.css';

const formatDuration = (mins) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const MyActivity = () => {
    const { userId } = useParams();
    const navigate = useNavigate();

    const [selectedUserId, setSelectedUserId] = useState(userId || '3');
    const [usersList, setUsersList] = useState([]);
    
    // Default fromDate = yesterday, toDate = today
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
    });
    const [toDate, setToDate] = useState(() => {
        return new Date().toISOString().slice(0, 10);
    });

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);

    // Fetch users list from database for our custom Select component
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await apiClient.get('/track/users?status=all');
                const list = res.data || res || [];
                if (Array.isArray(list)) {
                    setUsersList(list);
                }
            } catch (err) {
                console.error('Failed to load users for activity switcher', err);
            }
        };
        fetchUsers();
    }, []);

    // Sync state if url param changes
    useEffect(() => {
        if (userId && String(userId) !== String(selectedUserId)) {
            setSelectedUserId(String(userId));
        }
    }, [userId]);

    const userOptions = useMemo(() => {
        return usersList.map((u) => ({
            value: String(u.id),
            label: u.name || u.full_name || u.username
        }));
    }, [usersList]);

    const currentUser = useMemo(() => {
        return usersList.find((u) => String(u.id) === String(selectedUserId));
    }, [usersList, selectedUserId]);

    const fetchStats = useCallback(async () => {
        if (!selectedUserId) return;
        setLoading(true);
        try {
            const res = await apiClient.get('/track/activity/stats', {
                user_id: selectedUserId,
                start_date: fromDate,
                end_date: toDate
            });
            const data = res.data || res;
            setStats(data);
        } catch (err) {
            console.error('Failed to fetch activity stats', err);
        } finally {
            setLoading(false);
        }
    }, [selectedUserId, fromDate, toDate]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleUserSelect = (val) => {
        setSelectedUserId(val);
        navigate(`/tracking/activity/${val}`);
    };

    return (
        <div className={styles.activityContainer}>
            {/* Header / Filter Toolbar */}
            <div className={styles.headerCard}>
                <div className={styles.userProfile}>
                    <button
                        onClick={() => navigate('/tracking/users')}
                        className={styles.dateQuickBtn}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Back to User Activity"
                    >
                        <BiArrowBack size={16} /> Back
                    </button>
                    <div className={styles.userAvatar}>
                        {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : <BiUser />}
                    </div>
                    <div className={styles.userInfo}>
                        <h2>{currentUser?.name || 'Staff Activity'}</h2>
                        <p>{currentUser?.email || 'Activity Timeline & Metrics'}</p>
                    </div>
                </div>

                <div className={styles.controlsGroup} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Dedicated Professional Select Component showing User Names */}
                    <div style={{ minWidth: '220px' }}>
                        <Select
                            value={String(selectedUserId)}
                            onChange={handleUserSelect}
                            options={userOptions}
                            placeholder="Select User"
                            searchable={true}
                            size="medium"
                        />
                    </div>

                    {/* From Date - To Date (Auto-triggers on change) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>From:</span>
                        <input
                            type="date"
                            className={styles.dateInput}
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>To:</span>
                        <input
                            type="date"
                            className={styles.dateInput}
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={fetchStats}
                        className={styles.dateQuickBtn}
                        title="Refresh"
                    >
                        {loading ? <BiLoaderAlt className={styles.spinner} /> : <BiRefresh size={18} />}
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '80px' }}>
                    <BiLoaderAlt className={styles.spinner} style={{ fontSize: '40px', color: '#2563eb' }} />
                    <p style={{ marginTop: '12px', color: '#64748b' }}>Loading activity logs...</p>
                </div>
            ) : stats ? (
                <>
                    {/* v5 Style Ribbon: 4 Colored Gradient Stat Cards */}
                    <div className={styles.statsGrid}>
                        <div className={`${styles.v5CardStat} ${styles.v5CardStatBgPurple}`}>
                            <div className={styles.v5StatTitle}>TOTAL ACTIVE TIME</div>
                            <div className={styles.v5StatValue}>
                                {Math.floor(stats.total_minutes / 60)}h {stats.total_minutes % 60}m
                            </div>
                            <div className={styles.v5StatSub}>
                                Logged window interactions
                            </div>
                        </div>

                        <div className={`${styles.v5CardStat} ${styles.v5CardStatBgEmerald}`}>
                            <div className={styles.v5StatTitle}>TOTAL MOUSE CLICKS</div>
                            <div className={styles.v5StatValue}>
                                {(stats.total_clicks || 0).toLocaleString()}
                            </div>
                            <div className={styles.v5StatSub}>
                                Active rate: <strong>{stats.activity_rate}%</strong>
                            </div>
                        </div>

                        <div className={`${styles.v5CardStat} ${styles.v5CardStatBgAmber}`}>
                            <div className={styles.v5StatTitle}>KEYBOARD STROKES</div>
                            <div className={styles.v5StatValue}>
                                {(stats.total_keystrokes || 0).toLocaleString()}
                            </div>
                            <div className={styles.v5StatSub}>
                                Keyboard activity count
                            </div>
                        </div>

                        <div className={`${styles.v5CardStat} ${styles.v5CardStatBgDark}`}>
                            <div className={styles.v5StatTitle}>TOTAL IDLE TIME</div>
                            <div className={styles.v5StatValue}>
                                {formatDuration(stats.total_idle_minutes)}
                            </div>
                            <div className={styles.v5StatSub}>
                                Inactivity threshold 5m
                            </div>
                        </div>
                    </div>

                    {/* 24-Hour Productivity Pulse SVG Chart */}
                    <div className={styles.pulseSection}>
                        <div className={styles.pulseHeader}>
                            <div className={styles.pulseTitle}>
                                <BiPulse style={{ color: '#2563eb', fontSize: '20px' }} />
                                24-Hour Productivity Pulse
                            </div>
                            <span className={styles.pulseBadge}>
                                <span className={styles.pulseBadgeDot}></span>
                                Real-time
                            </span>
                        </div>

                        <div className={styles.pulseChartWrapper}>
                            {(() => {
                                const rawTimeline = stats.timeline || [];
                                const dataPoints = Array.from({ length: 24 }).map((_, i) => {
                                    const key = String(i).padStart(2, '0');
                                    const item = Array.isArray(rawTimeline)
                                        ? rawTimeline.find((t) => t.hour?.startsWith(key))
                                        : rawTimeline[key];
                                    return item ? (Number(item.clicks || 0) + Number(item.keystrokes || item.keys || 0)) : 0;
                                });
                                const maxVal = Math.max(...dataPoints, 10);
                                const width = 1000;
                                const height = 190;
                                const padX = 30;
                                const padY = 20;
                                const innerW = width - padX * 2;
                                const innerH = height - padY * 2;

                                const coords = dataPoints.map((val, idx) => {
                                    const x = padX + (idx / 23) * innerW;
                                    const y = padY + innerH - (val / maxVal) * innerH;
                                    return { x, y, val, hour: String(idx).padStart(2, '0') };
                                });

                                const pathD = coords.reduce((acc, pt, i) => {
                                    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
                                }, '');

                                const areaD = `${pathD} L ${coords[coords.length - 1].x} ${padY + innerH} L ${coords[0].x} ${padY + innerH} Z`;

                                return (
                                    <svg viewBox={`0 0 ${width} ${height + 30}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                        <defs>
                                            <linearGradient id="chartGradMyActivity" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#1890ff" stopOpacity="0.3" />
                                                <stop offset="100%" stopColor="#1890ff" stopOpacity="0.0" />
                                            </linearGradient>
                                        </defs>
                                        {/* Horizontal grid lines */}
                                        {[0, 0.25, 0.5, 0.75, 1].map((pct, gIdx) => {
                                            const yPos = padY + innerH * pct;
                                            return (
                                                <line
                                                    key={gIdx}
                                                    x1={padX}
                                                    y1={yPos}
                                                    x2={width - padX}
                                                    y2={yPos}
                                                    stroke="#f1f5f9"
                                                    strokeDasharray="4 4"
                                                />
                                            );
                                        })}
                                        <path d={areaD} fill="url(#chartGradMyActivity)" />
                                        <path d={pathD} fill="none" stroke="#1890ff" strokeWidth="3" />
                                        {coords.map((pt, pIdx) => (
                                            <g key={pIdx}>
                                                {pt.val > 0 && (
                                                    <circle cx={pt.x} cy={pt.y} r="4" fill="#1890ff" stroke="#ffffff" strokeWidth="2" />
                                                )}
                                                <text
                                                    x={pt.x}
                                                    y={height + 18}
                                                    fontSize="11"
                                                    fontWeight="600"
                                                    fill="#94a3b8"
                                                    textAnchor="middle"
                                                >
                                                    {pt.hour}
                                                </text>
                                            </g>
                                        ))}
                                    </svg>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Understanding Activity Info Banner */}
                    <div className={styles.activityInfoBanner}>
                        <BiPulse style={{ fontSize: '20px', flexShrink: 0 }} />
                        <div>
                            <b>Activity Level:</b> Intensity score based on interactions per minute.
                            &nbsp;&nbsp;|&nbsp;&nbsp;
                            <b>Idle Time:</b> Time when no mouse/keyboard movement is detected for 5+ minutes.
                        </div>
                    </div>

                    {/* App Usage and Windows Analytics Card */}
                    <div className={styles.analyticsCard}>
                        <div className={styles.analyticsHeader}>
                            <h3 className={styles.analyticsTitle}>
                                <BiDesktop style={{ color: '#2563eb', fontSize: '18px' }} /> Top Applications & Active Windows
                            </h3>
                            <span className={styles.analyticsCount}>
                                Total Apps Tracked: <b>{stats.app_usage?.length || 0}</b>
                            </span>
                        </div>

                        <div className={styles.tableWrapper}>
                            {stats.app_usage && stats.app_usage.length > 0 ? (
                                <table className={styles.dataTable}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', minWidth: '320px' }}>Application / Window Title</th>
                                            <th style={{ textAlign: 'center', width: '130px' }}>Duration</th>
                                            <th style={{ textAlign: 'center', width: '180px' }}>Activity Level</th>
                                            <th style={{ textAlign: 'center', width: '110px' }}>Idle</th>
                                            <th style={{ textAlign: 'right', width: '100px' }}>Clicks</th>
                                            <th style={{ textAlign: 'right', width: '100px' }}>Keys</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.app_usage.map((app, idx) => {
                                            const totalActions = (app.clicks || 0) + (app.keystrokes || 0);
                                            const pct = Math.min(100, Math.round((totalActions / 100) * 100));
                                            const fillColor = pct > 70 ? '#10b981' : pct > 30 ? '#3b82f6' : '#f59e0b';
                                            return (
                                                <tr key={idx}>
                                                    <td>
                                                        <div className={styles.appDetailCell}>
                                                            <div className={styles.appIconBox}>
                                                                <BiDesktop />
                                                            </div>
                                                            <div>
                                                                <div className={styles.appTitleText}>{app.title || app.app}</div>
                                                                <div className={styles.appSubText}>{app.app}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className={styles.durationPill}>
                                                            {app.minutes} mins
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
                                                            <div className={styles.activityProgressBar}>
                                                                <div
                                                                    className={styles.activityProgressFill}
                                                                    style={{ width: `${pct}%`, backgroundColor: fillColor }}
                                                                ></div>
                                                            </div>
                                                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, minWidth: '28px' }}>
                                                                {pct}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className={`${styles.idlePill} ${app.idle > 0 ? styles.idlePillActive : ''}`}>
                                                            {formatDuration(app.idle)}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: '#059669', fontWeight: 700 }}>
                                                        {(app.clicks || 0).toLocaleString()}
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: '#4f46e5', fontWeight: 700 }}>
                                                        {(app.keystrokes || 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                                    <p style={{ margin: 0, fontSize: '13.5px' }}>No application activity recorded for the selected date range.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                    <p>No activity logs recorded for this period.</p>
                </div>
            )}
        </div>
    );
};

export default MyActivity;
