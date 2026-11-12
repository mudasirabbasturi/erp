import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../api/client";
import { usePageActions } from "../../context/PageActionContext";
import {
    BiBoltCircle,
    BiArrowBack,
    BiRefresh,
    BiTimeFive,
    BiLoaderAlt,
    BiX,
    BiImage
} from "react-icons/bi";
import styles from "./UserTracking.module.css";

const LastScreenshots = () => {
    const { setCustomBreadcrumbs } = usePageActions();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncInterval, setSyncInterval] = useState(10);
    const [previewImage, setPreviewImage] = useState(null);

    const fetchData = async () => {
        try {
            const response = await apiClient.get("/track/screenshots/latest-all");
            setData(response || []);
        } catch (error) {
            console.error("Error fetching latest screenshots:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchInterval = async () => {
        try {
            const resp = await apiClient.get("/track/settings");
            if (resp && resp.tracker_sync_interval) {
                // Use tracker_sync_interval matching v5 behavior
                const interval = Math.max(5, resp.tracker_sync_interval);
                setSyncInterval(interval);
            }
        } catch (e) {}
    };

    // Lock body scroll when preview image is open
    useEffect(() => {
        if (previewImage) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [previewImage]);

    useEffect(() => {
        setCustomBreadcrumbs([
            { label: "User Activity", to: "/tracking/users" },
            { label: "Instant Monitor" }
        ]);
        fetchData();
        fetchInterval();
    }, [setCustomBreadcrumbs]);

    // Live Auto-Refresh matching v5 exact behavior (auto-refreshing every N seconds)
    useEffect(() => {
        const timer = setInterval(() => {
            fetchData();
        }, syncInterval * 1000);

        return () => clearInterval(timer);
    }, [syncInterval]);

    return (
        <div className={styles.trackingContainer}>
            <div className={styles.headerCard}>
                <div className={styles.headerInfo}>
                    <div className={styles.headerIcon}>
                        <BiBoltCircle />
                    </div>
                    <div>
                        <h1 className={styles.headerTitle}>Instant Monitor</h1>
                        <p className={styles.headerSubtitle}>
                            Screenshots reflect instantly across all active company desktops.
                        </p>
                    </div>
                </div>

                <div className={styles.headerActions}>
                    <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "#eff6ff",
                        color: "#4f46e5",
                        borderRadius: "20px",
                        padding: "6px 14px",
                        fontSize: "12px",
                        fontWeight: 700,
                        border: "1px solid #c7d2fe"
                    }}>
                        Auto-refreshing every {syncInterval}s
                    </span>

                    <button
                        type="button"
                        onClick={fetchData}
                        className={styles.btnPrimary}
                    >
                        {loading ? <BiLoaderAlt className={styles.spinner} /> : <BiRefresh />}
                        Refresh Now
                    </button>

                    <Link to="/tracking/users" className={styles.btnSecondary} style={{ textDecoration: "none" }}>
                        <BiArrowBack /> Back to Users
                    </Link>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: "center", padding: "80px" }}>
                    <BiLoaderAlt className={styles.spinner} style={{ fontSize: "40px", color: "#4f46e5" }} />
                    <p style={{ marginTop: "12px", color: "#64748b" }}>Loading live desktop views...</p>
                </div>
            ) : data.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px", color: "#64748b", background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                    <BiImage style={{ fontSize: "48px", color: "#cbd5e1", marginBottom: "12px" }} />
                    <p>No active staff desktops found.</p>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
                    {data.map((item) => (
                        <div
                            key={item.user_id}
                            style={{
                                background: "#ffffff",
                                borderRadius: "12px",
                                border: "1px solid #e2e8f0",
                                overflow: "hidden",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                                display: "flex",
                                flexDirection: "column"
                            }}
                        >
                            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <div style={{
                                        width: "28px",
                                        height: "28px",
                                        borderRadius: "50%",
                                        backgroundColor: "#e0e7ff",
                                        color: "#4f46e5",
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}>
                                        {item.name ? item.name.charAt(0).toUpperCase() : "?"}
                                    </div>
                                    <span style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>{item.name}</span>
                                </div>

                                {item.is_online ? (
                                    <span style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        backgroundColor: "#ecfdf5",
                                        color: "#059669",
                                        borderRadius: "20px",
                                        padding: "2px 8px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        border: "1px solid #a7f3d0"
                                    }}>
                                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981" }}></span>
                                        RUNNING
                                    </span>
                                ) : (
                                    <span style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        backgroundColor: "#f1f5f9",
                                        color: "#64748b",
                                        borderRadius: "20px",
                                        padding: "2px 8px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        border: "1px solid #cbd5e1"
                                    }}>
                                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#94a3b8" }}></span>
                                        OFFLINE
                                    </span>
                                )}
                            </div>

                            <div
                                style={{ height: "180px", background: "#f8fafc", cursor: item.screenshot ? "pointer" : "default", position: "relative" }}
                                onClick={() => item.screenshot && setPreviewImage(item.screenshot.url || item.screenshot.file_path)}
                            >
                                {item.screenshot ? (
                                    <img
                                        src={item.screenshot.thumbnail_url || item.screenshot.url || item.screenshot.file_path}
                                        alt={item.name}
                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    />
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#94a3b8" }}>
                                        <BiImage style={{ fontSize: "36px", marginBottom: "6px" }} />
                                        <span style={{ fontSize: "12px" }}>No screenshot available</span>
                                    </div>
                                )}
                            </div>

                            <div style={{ padding: "10px 14px", background: "#ffffff", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", color: "#64748b" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                    <BiTimeFive />
                                    {item.screenshot?.screenshot_time
                                        ? new Date(item.screenshot.screenshot_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                        : "Never"}
                                </span>
                                <Link to={`/tracking/activity/${item.user_id}`} style={{ color: "#4f46e5", fontWeight: 700, textDecoration: "none" }}>
                                    View Activity →
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox Preview */}
            {previewImage && (
                <div className={styles.lightboxOverlay} onClick={() => setPreviewImage(null)}>
                    <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setPreviewImage(null)} className={styles.lightboxClose}>
                            <BiX />
                        </button>
                        <img src={previewImage} alt="Fullscreen Preview" className={styles.lightboxImg} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default LastScreenshots;
