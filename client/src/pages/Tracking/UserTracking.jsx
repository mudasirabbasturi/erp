import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { usePageActions } from "../../context/PageActionContext";
import { useToast } from "../../components/ui/Toast";
import { AgGridTable } from "../../components/Datatable/AgGridTable";
import {
    BiLineChart,
    BiImage,
    BiCamera,
    BiCog,
    BiRefresh,
    BiLoaderAlt,
    BiX,
    BiCheck,
    BiTrash,
    BiTimeFive,
    BiCalendar,
    BiBoltCircle
} from "react-icons/bi";
import styles from "./UserTracking.module.css";

const UserTracking = () => {
    const navigate = useNavigate();
    const { setCustomBreadcrumbs } = usePageActions();
    const toast = useToast();

    const [users, setUsers] = useState([]);
    const [selectedStatus, setSelectedStatus] = useState("active");
    const [loading, setLoading] = useState(false);

    // Screenshot Modal state
    const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [screenshots, setScreenshots] = useState([]);
    const [screenshotLoading, setScreenshotLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [deleting, setDeleting] = useState(false);

    // Screenshot Date Filters: from = yesterday, to = today
    const [screenshotFrom, setScreenshotFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
    });
    const [screenshotTo, setScreenshotTo] = useState(() => {
        return new Date().toISOString().slice(0, 10);
    });

    // Activity Modal Date Filters: from = yesterday, to = today
    const [activityFrom, setActivityFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
    });
    const [activityTo, setActivityTo] = useState(() => {
        return new Date().toISOString().slice(0, 10);
    });

    // Global Settings
    const [screenshotInterval, setScreenshotInterval] = useState(120);
    const [apiBaseUrl, setApiBaseUrl] = useState("http://127.0.0.1:8000");
    const [syncInterval, setSyncInterval] = useState(120);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [adminPassword, setAdminPassword] = useState("bidwinners12");
    const [allowedIPs, setAllowedIPs] = useState([]);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [ipInput, setIpInput] = useState("");

    // Activity state
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [activityStats, setActivityStats] = useState(null);
    const [activityLoading, setActivityLoading] = useState(false);
    const [takingScreenshotId, setTakingScreenshotId] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);

    // Lock body scroll when any modal or lightbox is open
    useEffect(() => {
        const anyModalOpen = isScreenshotModalOpen || isActivityModalOpen || isSettingsModalOpen || isPreviewVisible;
        if (anyModalOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isScreenshotModalOpen, isActivityModalOpen, isSettingsModalOpen, isPreviewVisible]);
    // Screenshot pagination
    const [screenshotsPage, setScreenshotsPage] = useState(1);
    const [hasMoreScreenshots, setHasMoreScreenshots] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    const fetchUsers = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const response = await apiClient.get(`/track/users?status=${selectedStatus}`);
            const list = response.data || response;
            if (Array.isArray(list)) {
                setUsers(list);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
            if (showLoading) {
                toast.error("Error", "Failed to refresh users list");
            }
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [selectedStatus, toast]);

    const fetchSettings = useCallback(async () => {
        try {
            const resp = await apiClient.get("/track/settings");
            if (resp) {
                setScreenshotInterval(resp.tracker_screenshot_interval || 120);
                setApiBaseUrl(resp.tracker_api_url || "http://127.0.0.1:8000");
                setSyncInterval(resp.tracker_sync_interval || 120);
                setAdminPassword(resp.tracker_admin_password || "bidwinners12");
                setAllowedIPs(resp.tracker_allowed_ips || []);
            }
        } catch (error) {
            console.error("Error fetching tracker settings:", error);
        }
    }, []);

    useEffect(() => {
        setCustomBreadcrumbs([
            { label: "User Activity" }
        ]);
        fetchUsers();
        fetchSettings();
    }, [fetchUsers, fetchSettings, setCustomBreadcrumbs]);

    const saveSettings = async (e) => {
        e.preventDefault();
        setIsSavingSettings(true);
        try {
            await apiClient.post("/track/settings/update", {
                tracker_screenshot_interval: screenshotInterval,
                tracker_api_url: apiBaseUrl,
                tracker_sync_interval: syncInterval,
                tracker_admin_password: adminPassword,
                tracker_allowed_ips: allowedIPs
            });
            toast.success("Settings Updated", "Global tracker settings saved successfully.");
            setIsSettingsModalOpen(false);
        } catch (error) {
            toast.error("Update Failed", "Could not save tracker settings");
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleStatusFilterChange = (val) => {
        setSelectedStatus(val);
    };

    const fetchScreenshots = useCallback(async (userId, start, end) => {
        setScreenshotLoading(true);
        setScreenshotsPage(1);
        setSelectedIds([]);
        try {
            const url = `/track/screenshots?user_id=${userId}&start_date=${start || ''}&end_date=${end || ''}&page=1&per_page=24`;
            const response = await apiClient.get(url);
            setScreenshots(response.data || []);
            setHasMoreScreenshots(Boolean(response.has_more));
        } catch (error) {
            console.error("Error fetching screenshots:", error);
            toast.error("Error", "Failed to fetch screenshots");
        } finally {
            setScreenshotLoading(false);
        }
    }, [toast]);

    const loadMoreScreenshots = async () => {
        if (!selectedUser || !hasMoreScreenshots || isFetchingMore) return;
        setIsFetchingMore(true);
        const nextPage = screenshotsPage + 1;
        try {
            const url = `/track/screenshots?user_id=${selectedUser.id}&start_date=${screenshotFrom || ''}&end_date=${screenshotTo || ''}&page=${nextPage}&per_page=24`;
            const response = await apiClient.get(url);
            setScreenshots((prev) => [...prev, ...(response.data || [])]);
            setHasMoreScreenshots(Boolean(response.has_more));
            setScreenshotsPage(nextPage);
        } catch (error) {
            console.error("Error loading more screenshots:", error);
        } finally {
            setIsFetchingMore(false);
        }
    };

    const openScreenshotModal = (user) => {
        setSelectedUser(user);
        setIsScreenshotModalOpen(true);
        fetchScreenshots(user.id, screenshotFrom, screenshotTo);
    };

    const deleteSelectedScreenshots = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Delete ${selectedIds.length} screenshot(s)?`)) return;
        setDeleting(true);
        try {
            await apiClient.post("/track/screenshots/delete", { ids: selectedIds });
            toast.success("Success", "Screenshots deleted successfully");
            setSelectedIds([]);
            fetchScreenshots(selectedUser.id, screenshotFrom, screenshotTo);
        } catch (error) {
            console.error("Error deleting screenshots:", error);
            toast.error("Error", "Failed to delete screenshots");
        } finally {
            setDeleting(false);
        }
    };

    const triggerScreenshot = async (user) => {
        setTakingScreenshotId(user.id);
        try {
            const statusRes = await apiClient.get(`/track/active-status/${user.id}`);
            if (!statusRes.active) {
                toast.error("User is Offline", `${user.name} has disconnected or shut down. Cannot capture screen.`);
                setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_online: false } : u)));
                setTakingScreenshotId(null);
                return;
            }

            let lastScreenshotId = null;
            try {
                const prevRes = await apiClient.get(`/track/screenshots?user_id=${user.id}&per_page=1`);
                if (prevRes.data && prevRes.data.length > 0) {
                    lastScreenshotId = prevRes.data[0].id;
                }
            } catch (e) { }

            toast.info("Capture Requested", `Sent capture signal to ${user.name}'s computer. Please wait...`);
            await apiClient.post("/track/screenshot/trigger", { user_id: user.id });

            let found = false;
            for (let i = 0; i < 5; i++) {
                await new Promise((resolve) => setTimeout(resolve, 1500));
                try {
                    const response = await apiClient.get(`/track/screenshots?user_id=${user.id}&per_page=1`);
                    const latest = response.data && response.data.length > 0 ? response.data[0] : null;
                    if (latest && latest.id !== lastScreenshotId) {
                        found = true;
                        setTakingScreenshotId(null);
                        setPreviewImage(latest.url || latest.thumbnail_url);
                        setIsPreviewVisible(true);
                        toast.success("Screenshot Uploaded", "Successfully retrieved new desktop screenshot.");
                        break;
                    }
                } catch (e) { }
            }

            if (!found) {
                toast.warning("Upload Delayed", "Screenshot taking longer than expected. It will appear shortly.");
            }
        } catch (error) {
            console.error("Error triggering screenshot:", error);
            toast.error("Error", "Failed to request screenshot");
        } finally {
            setTakingScreenshotId(null);
        }
    };

    // Toggle Permission (WFH)
    const togglePermission = async (user, granted) => {
        try {
            await apiClient.post("/track/toggle-permission", {
                user_id: user.id,
                is_permission_granted: granted ? 1 : 0,
                wfh_allowed: granted ? 1 : 0
            });
            toast.success("Permission Updated", `WFH Tracking for ${user.name} set to ${granted ? "ALLOWED" : "OFFICE ONLY"}`);
            setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_permission_granted: granted, wfh_allowed: granted } : u)));
        } catch (error) {
            toast.error("Error", error.message || "Failed to update tracking permission");
        }
    };

    // Toggle Logout Restriction
    const toggleLogoutRestriction = async (user, restricted) => {
        try {
            await apiClient.post("/track/toggle-logout-restriction", {
                user_id: user.id,
                logout_restriction: restricted ? 1 : 0
            });
            toast.success("Security Updated", `Logout restriction for ${user.name} set to ${restricted ? "PROTECTED" : "FREE"}`);
            setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, logout_restriction: restricted } : u)));
        } catch (error) {
            toast.error("Error", error.message || "Failed to update logout restriction");
        }
    };

    const fetchActivityStats = useCallback(async (userId, start, end) => {
        setActivityLoading(true);
        try {
            const url = `/track/activity/stats?user_id=${userId}&start_date=${start || ''}&end_date=${end || ''}`;
            const response = await apiClient.get(url);
            setActivityStats(response.data || response);
        } catch (error) {
            console.error("Error fetching activity stats:", error);
            toast.error("Error", "Failed to fetch activity statistics");
        } finally {
            setActivityLoading(false);
        }
    }, [toast]);

    const openActivityModal = (user) => {
        setSelectedUser(user);
        setIsActivityModalOpen(true);
        fetchActivityStats(user.id, activityFrom, activityTo);
    };

    const formatDuration = (mins) => {
        if (!mins || mins === 0) return "0m";
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    // 6 Columns Styled cleanly like Projects List
    const columnDefs = useMemo(() => [
        {
            headerName: "User Name",
            field: "name",
            flex: 2,
            minWidth: 190,
            cellRenderer: (params) => (
                <div style={{ display: "flex", alignItems: "center", height: "100%", gap: "10px" }}>
                    <div style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        backgroundColor: "#e0e7ff",
                        color: "#4f46e5",
                        fontSize: "13px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}>
                        {params.value ? params.value.charAt(0).toUpperCase() : "?"}
                    </div>
                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{params.value}</span>
                </div>
            )
        },
        {
            headerName: "Status",
            field: "is_online",
            flex: 1,
            minWidth: 120,
            cellRenderer: (params) => (
                <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                    {params.value ? (
                        <button
                            type="button"
                            className={styles.statusBtnRunning}
                        >
                            <span className={styles.statusDotGreen}></span>
                            RUNNING
                        </button>
                    ) : (
                        <button
                            type="button"
                            className={styles.statusBtnOffline}
                        >
                            <span className={styles.statusDotGray}></span>
                            OFFLINE
                        </button>
                    )}
                </div>
            )
        },
        {
            headerName: "Email",
            field: "email",
            flex: 2,
            minWidth: 200,
            cellRenderer: (params) => (
                <span style={{ color: "#475569", fontSize: "13px" }}>{params.value}</span>
            )
        },
        {
            headerName: "WFH Tracking",
            field: "is_permission_granted",
            flex: 1.5,
            minWidth: 160,
            cellRenderer: (params) => {
                const granted = Boolean(params.data?.is_permission_granted || params.data?.wfh_allowed);
                return (
                    <div style={{ display: "flex", alignItems: "center", height: "100%", gap: "8px" }}>
                        <label className={styles.switch}>
                            <input
                                type="checkbox"
                                checked={granted}
                                onChange={(e) => togglePermission(params.data, e.target.checked)}
                            />
                            <span className={styles.slider}></span>
                        </label>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: granted ? "#4f46e5" : "#64748b" }}>
                            {granted ? "ALLOWED" : "OFFICE ONLY"}
                        </span>
                    </div>
                );
            }
        },
        {
            headerName: "Logout Protection",
            field: "logout_restriction",
            flex: 1.5,
            minWidth: 160,
            cellRenderer: (params) => {
                const restricted = params.value !== undefined ? Boolean(params.value) : true;
                return (
                    <div style={{ display: "flex", alignItems: "center", height: "100%", gap: "8px" }}>
                        <label className={styles.switch}>
                            <input
                                type="checkbox"
                                checked={restricted}
                                onChange={(e) => toggleLogoutRestriction(params.data, e.target.checked)}
                            />
                            <span className={styles.slider}></span>
                        </label>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: restricted ? "#dc2626" : "#059669" }}>
                            {restricted ? "PROTECTED" : "FREE"}
                        </span>
                    </div>
                );
            }
        },
        {
            headerName: "Action",
            field: "id",
            minWidth: 240,
            pinned: "right",
            sortable: false,
            filter: false,
            cellRenderer: (params) => {
                const u = params.data;
                const isCapturing = takingScreenshotId === u.id;
                return (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", height: "100%" }}>
                        <button
                            type="button"
                            title="View Screenshots"
                            onClick={() => openScreenshotModal(u)}
                            className={styles.actionBtnPrimary}
                        >
                            <BiImage style={{ fontSize: "15px" }} />
                        </button>
                        <button
                            type="button"
                            title="View Activity"
                            onClick={() => openActivityModal(u)}
                            className={styles.actionBtnInfo}
                        >
                            <BiLineChart style={{ fontSize: "15px" }} />
                        </button>
                        <button
                            type="button"
                            title={u.is_online ? "Trigger Remote Screenshot" : "User is Offline"}
                            onClick={() => triggerScreenshot(u)}
                            disabled={isCapturing || !u.is_online}
                            className={styles.actionBtnWarning}
                        >
                            <BiCamera style={{ fontSize: "15px" }} />
                            {isCapturing ? "Capturing..." : u.is_online ? "Capture" : "Offline"}
                        </button>
                    </div>
                );
            }
        }
    ], [takingScreenshotId]);

    return (
        <div className={styles.trackingContainer}>
            {/* Top Bar Header with Segmented Buttons */}
            <div className={styles.headerCard}>
                <div className={styles.headerInfo}>
                    <div className={styles.headerIcon}>
                        <BiLineChart />
                    </div>
                    <div>
                        <h1 className={styles.headerTitle}>User Tracking</h1>
                        <p className={styles.headerSubtitle}>
                            Monitor staff productivity, desktop screenshots, keystrokes, and security restrictions.
                        </p>
                    </div>
                </div>

                <div className={styles.headerActions}>
                    {/* Status Filter Segmented Switcher */}
                    <div className={styles.viewSwitcher}>
                        <button
                            type="button"
                            className={`${styles.viewBtn} ${selectedStatus === 'active' ? styles.viewBtnActive : ''}`}
                            onClick={() => handleStatusFilterChange('active')}
                        >
                            Active Users
                        </button>
                        <button
                            type="button"
                            className={`${styles.viewBtn} ${selectedStatus === 'inactive' ? styles.viewBtnActive : ''}`}
                            onClick={() => handleStatusFilterChange('inactive')}
                        >
                            Inactive Users
                        </button>
                        <button
                            type="button"
                            className={`${styles.viewBtn} ${selectedStatus === 'all' ? styles.viewBtnActive : ''}`}
                            onClick={() => handleStatusFilterChange('all')}
                        >
                            All Users
                        </button>
                    </div>

                    <Link to="/tracking/instant-monitor" className={styles.btnSecondary} style={{ textDecoration: 'none' }}>
                        <BiBoltCircle style={{ color: '#0284c7' }} /> Instant Monitor
                    </Link>

                    <button
                        type="button"
                        onClick={() => setIsSettingsModalOpen(true)}
                        className={styles.btnSecondary}
                    >
                        <BiCog /> Global Settings
                    </button>

                    <button
                        type="button"
                        onClick={() => fetchUsers(true)}
                        disabled={loading}
                        className={styles.btnPrimary}
                    >
                        {loading ? <BiLoaderAlt className={styles.spinner} /> : <BiRefresh />}
                        Refresh
                    </button>
                </div>
            </div>

            {/* AgGrid User Table */}
            <div className={styles.tableCard}>
                <AgGridTable
                    rowData={users}
                    columnDefs={columnDefs}
                    loading={loading}
                    height="580px"
                    enableSearch={true}
                    enableExport={true}
                    enableSidebar={false}
                    enableFloatingFilter={false}
                />
            </div>

            {/* Screenshots Gallery Modal */}
            {isScreenshotModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderLeft}>
                                <h2 className={styles.modalTitle}>
                                    {selectedUser?.name}
                                </h2>
                                {screenshots.length > 0 && (
                                    <div style={{ display: "flex", gap: "6px" }}>
                                        <button
                                            type="button"
                                            className={styles.btnSecondary}
                                            style={{ padding: "4px 10px", fontSize: "11.5px" }}
                                            onClick={() => {
                                                if (selectedIds.length === screenshots.length) {
                                                    setSelectedIds([]);
                                                } else {
                                                    setSelectedIds(screenshots.map((s) => s.id));
                                                }
                                            }}
                                        >
                                            {selectedIds.length === screenshots.length ? "Deselect All" : "Select All"}
                                        </button>
                                        {selectedIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={deleteSelectedScreenshots}
                                                disabled={deleting}
                                                className={styles.btnDanger}
                                                style={{ padding: "4px 10px", fontSize: "11.5px" }}
                                            >
                                                <BiTrash /> Delete ({selectedIds.length})
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className={styles.modalHeaderRight}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>From:</span>
                                    <input
                                        type="date"
                                        value={screenshotFrom}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setScreenshotFrom(val);
                                            if (selectedUser) {
                                                fetchScreenshots(selectedUser.id, val, screenshotTo);
                                            }
                                        }}
                                        className={styles.dateInput}
                                    />
                                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>To:</span>
                                    <input
                                        type="date"
                                        value={screenshotTo}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setScreenshotTo(val);
                                            if (selectedUser) {
                                                fetchScreenshots(selectedUser.id, screenshotFrom, val);
                                            }
                                        }}
                                        className={styles.dateInput}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => triggerScreenshot(selectedUser)}
                                    disabled={!selectedUser?.is_online}
                                    className={styles.btnPrimary}
                                    style={{ padding: "6px 12px" }}
                                >
                                    <BiCamera /> Take Screenshot
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsScreenshotModalOpen(false)}
                                    className={styles.btnClose}
                                    title="Close"
                                >
                                    <BiX />
                                </button>
                            </div>
                        </div>

                        <div className={styles.modalBody}>
                            {screenshotLoading ? (
                                <div style={{ textAlign: "center", padding: "60px" }}>
                                    <BiLoaderAlt className={styles.spinner} style={{ fontSize: "36px", color: "#4f46e5" }} />
                                    <p style={{ marginTop: "12px", color: "#64748b" }}>Loading screenshots...</p>
                                </div>
                            ) : screenshots.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
                                    <BiImage style={{ fontSize: "48px", color: "#cbd5e1", marginBottom: "12px" }} />
                                    <p>No screenshots found for this date range.</p>
                                </div>
                            ) : (
                                <div className={styles.screenshotGrid}>
                                    {screenshots.map((s) => {
                                        const isSelected = selectedIds.includes(s.id);
                                        const timeStr = new Date(s.time || s.screenshot_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                                        return (
                                            <div
                                                key={s.id}
                                                className={`${styles.screenshotCard} ${isSelected ? styles.screenshotSelected : ""}`}
                                                onClick={() => {
                                                    setPreviewImage(s.url || s.thumbnail_url);
                                                    setIsPreviewVisible(true);
                                                }}
                                            >
                                                <div
                                                    className={styles.screenshotCheck}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedIds((prev) =>
                                                            isSelected ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                                                        );
                                                    }}
                                                >
                                                    <input type="checkbox" checked={isSelected} readOnly />
                                                </div>
                                                <img
                                                    src={s.thumbnail_url || s.url}
                                                    alt={`Screenshot at ${timeStr}`}
                                                    loading="lazy"
                                                    className={styles.screenshotImg}
                                                />
                                                <div className={styles.screenshotMeta}>
                                                    <BiTimeFive style={{ fontSize: "13px" }} />
                                                    <span>{timeStr}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {hasMoreScreenshots && (
                                <div style={{ textAlign: "center", marginTop: "20px" }}>
                                    <button
                                        type="button"
                                        onClick={loadMoreScreenshots}
                                        disabled={isFetchingMore}
                                        className={styles.btnSecondary}
                                    >
                                        {isFetchingMore ? <BiLoaderAlt className={styles.spinner} /> : "Load More Screenshots"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Activity Modal with From - To Dates */}
            {isActivityModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderLeft}>
                                <h2 className={styles.modalTitle}>{selectedUser?.name}</h2>
                            </div>
                            <div className={styles.modalHeaderRight}>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>From:</span>
                                    <input
                                        type="date"
                                        value={activityFrom}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setActivityFrom(val);
                                            if (selectedUser) {
                                                fetchActivityStats(selectedUser.id, val, activityTo);
                                            }
                                        }}
                                        className={styles.dateInput}
                                    />
                                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>To:</span>
                                    <input
                                        type="date"
                                        value={activityTo}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setActivityTo(val);
                                            if (selectedUser) {
                                                fetchActivityStats(selectedUser.id, activityFrom, val);
                                            }
                                        }}
                                        className={styles.dateInput}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsActivityModalOpen(false)}
                                    className={styles.btnClose}
                                    title="Close"
                                >
                                    <BiX />
                                </button>
                            </div>
                        </div>

                        <div className={styles.modalBody}>
                            {activityLoading ? (
                                <div style={{ textAlign: "center", padding: "60px" }}>
                                    <BiLoaderAlt className={styles.spinner} style={{ fontSize: "36px", color: "#4f46e5" }} />
                                    <p style={{ marginTop: "12px", color: "#64748b" }}>Loading activity statistics...</p>
                                </div>
                            ) : activityStats ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                    {/* 2-Column Row: v5 Stats Left + Pulse Chart Right */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "16px" }}>
                                        {/* Left 4 Cards */}
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                            <div className={`${styles.v5CardStat} ${styles.v5CardStatBgPurple}`}>
                                                <div className={styles.v5StatTitle}>TOTAL ACTIVE TIME</div>
                                                <div className={styles.v5StatValue}>
                                                    {Math.floor(activityStats.total_minutes / 60)}h {activityStats.total_minutes % 60}m
                                                </div>
                                            </div>
                                            <div className={`${styles.v5CardStat} ${styles.v5CardStatBgEmerald}`}>
                                                <div className={styles.v5StatTitle}>TOTAL MOUSE CLICKS</div>
                                                <div className={styles.v5StatValue}>
                                                    {(activityStats.total_clicks || 0).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className={`${styles.v5CardStat} ${styles.v5CardStatBgAmber}`}>
                                                <div className={styles.v5StatTitle}>KEYBOARD STROKES</div>
                                                <div className={styles.v5StatValue}>
                                                    {(activityStats.total_keystrokes || 0).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className={`${styles.v5CardStat} ${styles.v5CardStatBgDark}`}>
                                                <div className={styles.v5StatTitle}>TOTAL IDLE TIME</div>
                                                <div className={styles.v5StatValue}>
                                                    {formatDuration(activityStats.total_idle_minutes)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Pulse Chart */}
                                        <div className={styles.pulseCard}>
                                            <div className={styles.pulseHeader}>
                                                <div className={styles.pulseTitle}>
                                                    <BiLineChart style={{ color: "#2563eb", fontSize: "18px" }} />
                                                    24-Hour Productivity Pulse
                                                </div>
                                                <span className={styles.pulseBadge}>
                                                    <span className={styles.pulseBadgeDot}></span>
                                                    Real-time
                                                </span>
                                            </div>

                                            <div className={styles.pulseChartWrapper}>
                                                {(() => {
                                                    const rawTimeline = activityStats.timeline || [];
                                                    const dataPoints = Array.from({ length: 24 }).map((_, i) => {
                                                        const key = String(i).padStart(2, "0");
                                                        const item = Array.isArray(rawTimeline)
                                                            ? rawTimeline.find((t) => t.hour?.startsWith(key))
                                                            : rawTimeline[key];
                                                        return item ? (Number(item.clicks || 0) + Number(item.keystrokes || item.keys || 0)) : 0;
                                                    });
                                                    const maxVal = Math.max(...dataPoints, 10);
                                                    const width = 500;
                                                    const height = 160;
                                                    const padX = 20;
                                                    const padY = 15;
                                                    const innerW = width - padX * 2;
                                                    const innerH = height - padY * 2;

                                                    const coords = dataPoints.map((val, idx) => {
                                                        const x = padX + (idx / 23) * innerW;
                                                        const y = padY + innerH - (val / maxVal) * innerH;
                                                        return { x, y, val, hour: String(idx).padStart(2, "0") };
                                                    });

                                                    const pathD = coords.reduce((acc, pt, i) => {
                                                        return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
                                                    }, "");

                                                    const areaD = `${pathD} L ${coords[coords.length - 1].x} ${padY + innerH} L ${coords[0].x} ${padY + innerH} Z`;

                                                    return (
                                                        <svg viewBox={`0 0 ${width} ${height + 25}`} style={{ width: "100%", height: "100%", overflow: "visible" }}>
                                                            <defs>
                                                                <linearGradient id="chartGradModal" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="0%" stopColor="#1890ff" stopOpacity="0.35" />
                                                                    <stop offset="100%" stopColor="#1890ff" stopOpacity="0.0" />
                                                                </linearGradient>
                                                            </defs>
                                                            {/* Grid Lines */}
                                                            {[0, 0.5, 1].map((pct, gIdx) => {
                                                                const yPos = padY + innerH * pct;
                                                                return (
                                                                    <line
                                                                        key={gIdx}
                                                                        x1={padX}
                                                                        y1={yPos}
                                                                        x2={width - padX}
                                                                        y2={yPos}
                                                                        stroke="#f1f5f9"
                                                                        strokeDasharray="3 3"
                                                                    />
                                                                );
                                                            })}
                                                            <path d={areaD} fill="url(#chartGradModal)" />
                                                            <path d={pathD} fill="none" stroke="#1890ff" strokeWidth="2.5" />
                                                            {coords.map((pt, pIdx) => (
                                                                <g key={pIdx}>
                                                                    {pt.val > 0 && (
                                                                        <circle cx={pt.x} cy={pt.y} r="3" fill="#1890ff" stroke="#ffffff" strokeWidth="1.5" />
                                                                    )}
                                                                    {pIdx % 3 === 0 && (
                                                                        <text
                                                                            x={pt.x}
                                                                            y={height + 15}
                                                                            fontSize="10"
                                                                            fill="#94a3b8"
                                                                            textAnchor="middle"
                                                                        >
                                                                            {pt.hour}
                                                                        </text>
                                                                    )}
                                                                </g>
                                                            ))}
                                                        </svg>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info Banner */}
                                    <div className={styles.activityInfoBanner}>
                                        <BiLineChart style={{ fontSize: "18px", flexShrink: 0 }} />
                                        <span>
                                            <b>Activity Level:</b> Intensity score based on interactions per minute.
                                            &nbsp;&nbsp;|&nbsp;&nbsp;
                                            <b>Idle Time:</b> No mouse/keyboard movement detected for 5+ minutes.
                                        </span>
                                    </div>

                                    {/* Application Usage Table */}
                                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", overflow: "hidden" }}>
                                        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                                                <BiLineChart style={{ color: "#2563eb" }} /> Application Usage Analytics
                                            </h3>
                                            <span style={{ fontSize: "12px", color: "#64748b" }}>
                                                Total Apps: <b>{activityStats.app_usage?.length || 0}</b>
                                            </span>
                                        </div>

                                        <div style={{ maxHeight: "360px", overflowY: "auto" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                                                <thead style={{ background: "#f8fafc", position: "sticky", top: 0, zIndex: 1 }}>
                                                    <tr>
                                                        <th style={{ textAlign: "left", padding: "12px 18px", color: "#475569", fontWeight: 700 }}>Application / Detail</th>
                                                        <th style={{ textAlign: "right", padding: "12px 18px", color: "#475569", fontWeight: 700 }}>Duration</th>
                                                        <th style={{ textAlign: "right", padding: "12px 18px", color: "#475569", fontWeight: 700 }}>Idle</th>
                                                        <th style={{ textAlign: "right", padding: "12px 18px", color: "#475569", fontWeight: 700 }}>Clicks</th>
                                                        <th style={{ textAlign: "right", padding: "12px 18px", color: "#475569", fontWeight: 700 }}>Keys</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(activityStats.app_usage || []).map((app, idx) => (
                                                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                            <td style={{ padding: "10px 18px" }}>
                                                                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{app.title || app.app}</div>
                                                                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{app.app}</div>
                                                            </td>
                                                            <td style={{ textAlign: "right", padding: "10px 18px" }}>
                                                                <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>
                                                                    {app.minutes} mins
                                                                </span>
                                                            </td>
                                                            <td style={{ textAlign: "right", padding: "10px 18px" }}>
                                                                <span style={{ background: app.idle > 0 ? "#fff7ed" : "#f1f5f9", color: app.idle > 0 ? "#c2410c" : "#64748b", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>
                                                                    {formatDuration(app.idle)}
                                                                </span>
                                                            </td>
                                                            <td style={{ textAlign: "right", padding: "10px 18px", color: "#059669", fontWeight: 600 }}>
                                                                {(app.clicks || 0).toLocaleString()}
                                                            </td>
                                                            <td style={{ textAlign: "right", padding: "10px 18px", color: "#4f46e5", fontWeight: 600 }}>
                                                                {(app.keystrokes || 0).toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p style={{ textAlign: "center", color: "#64748b", padding: "40px" }}>No activity logs recorded for this period.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Global Settings Modal with Styled Save Button */}
            {isSettingsModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContainer} style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
                        <form onSubmit={saveSettings}>
                            <div className={styles.modalHeader}>
                                <div>
                                    <h2 className={styles.modalTitle}>Global Tracker Settings</h2>
                                    <p className={styles.modalSubtitle}>Configure desktop client capture intervals, security and IP rules</p>
                                </div>
                                <button type="button" onClick={() => setIsSettingsModalOpen(false)} className={styles.btnClose}>
                                    <BiX />
                                </button>
                            </div>

                            <div className={styles.modalBody} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Screenshot Interval (seconds)</label>
                                    <input
                                        type="number"
                                        min="10"
                                        value={screenshotInterval}
                                        onChange={(e) => setScreenshotInterval(Number(e.target.value))}
                                        className={styles.formInput}
                                        required
                                    />
                                    <span className={styles.formHelp}>How often employee desktop screenshots are taken (default 120s / 2 mins).</span>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Sync Heartbeat Interval (seconds)</label>
                                    <input
                                        type="number"
                                        min="5"
                                        value={syncInterval}
                                        onChange={(e) => setSyncInterval(Number(e.target.value))}
                                        className={styles.formInput}
                                        required
                                    />
                                    <span className={styles.formHelp}>How frequently desktop agent syncs live clicks & active windows (default 120s).</span>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Tracker Admin Exit Password</label>
                                    <input
                                        type="text"
                                        value={adminPassword}
                                        onChange={(e) => setAdminPassword(e.target.value)}
                                        className={styles.formInput}
                                        required
                                    />
                                    <span className={styles.formHelp}>Password required for employees to close or exit the desktop tracker app.</span>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Allowed Office Public IPs</label>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <input
                                            type="text"
                                            placeholder="e.g. 139.135.32.54"
                                            value={ipInput}
                                            onChange={(e) => setIpInput(e.target.value)}
                                            className={styles.formInput}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (ipInput.trim() && !allowedIPs.includes(ipInput.trim())) {
                                                    setAllowedIPs([...allowedIPs, ipInput.trim()]);
                                                    setIpInput("");
                                                }
                                            }}
                                            className={styles.btnSecondary}
                                        >
                                            Add IP
                                        </button>
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                                        {allowedIPs.map((ip) => (
                                            <span key={ip} className={styles.ipBadge}>
                                                {ip}
                                                <BiX
                                                    style={{ cursor: "pointer" }}
                                                    onClick={() => setAllowedIPs(allowedIPs.filter((i) => i !== ip))}
                                                />
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <button type="button" onClick={() => setIsSettingsModalOpen(false)} className={styles.btnSecondary}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSavingSettings} className={styles.btnPrimary}>
                                    {isSavingSettings ? <BiLoaderAlt className={styles.spinner} /> : <BiCheck />}
                                    Save Settings
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Lightbox Preview */}
            {isPreviewVisible && previewImage && (
                <div className={styles.lightboxOverlay} onClick={() => setIsPreviewVisible(false)}>
                    <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setIsPreviewVisible(false)} className={styles.lightboxClose}>
                            <BiX />
                        </button>
                        <img src={previewImage} alt="Fullscreen Preview" className={styles.lightboxImg} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserTracking;
