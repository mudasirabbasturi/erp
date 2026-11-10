import React, { useState, useEffect, useCallback } from 'react';
import {
    BiCog,
    BiSave,
    BiBroadcast,
    BiWorld,
    BiCheckCircle,
    BiLoaderAlt
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import styles from './AISettings.module.css';

const GeneralSettings = () => {
    const { setCustomBreadcrumbs } = usePageActions();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [general, setGeneral] = useState({
        site_title: 'Enterprise Resources Planning',
        site_logo: '',
        pusher_app_id: '',
        pusher_key: '',
        pusher_secret: '',
        pusher_cluster: 'mt1'
    });

    const loadSettings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/settings');
            if (res.success && res.data) {
                const s = res.data;
                setGeneral({
                    site_title: s.site_title || 'Enterprise Resources Planning',
                    site_logo: s.site_logo || '',
                    pusher_app_id: s.pusher_app_id || '',
                    pusher_key: s.pusher_key || '',
                    pusher_secret: s.pusher_secret || '',
                    pusher_cluster: s.pusher_cluster || 'mt1'
                });
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to load general settings');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        setCustomBreadcrumbs([
            { label: 'Settings', to: '/settings/general' },
            { label: 'General & Sockets' }
        ]);
        loadSettings();
    }, [loadSettings, setCustomBreadcrumbs]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await apiClient.post('/settings', general);
            if (res.success) {
                toast.success('Success', 'General & Pusher settings saved');
            } else {
                toast.error('Save Error', res.message || 'Failed to save');
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to update settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
                <BiLoaderAlt size={36} className="spin" style={{ color: '#4f46e5', marginBottom: '12px' }} />
                <div style={{ fontSize: '15px', fontWeight: 600 }}>Loading system settings...</div>
            </div>
        );
    }

    return (
        <div className={styles.settingsContainer}>
            <div className={styles.headerCard}>
                <div className={styles.headerInfo}>
                    <div className={styles.headerIcon} style={{ background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)' }}>
                        <BiCog />
                    </div>
                    <div>
                        <h1 className={styles.headerTitle}>System & Socket Settings</h1>
                        <div className={styles.headerSubtitle}>
                            Configure branding, platform title, and real-time Pusher WebSockets.
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className={styles.btnPrimary}
                >
                    {saving ? <BiLoaderAlt className="spin" size={16} /> : <BiSave size={16} />}
                    Save Settings
                </button>
            </div>

            {/* General Settings Card */}
            <div className={styles.configCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                    <BiWorld size={20} style={{ color: '#3b82f6' }} />
                    <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Site Branding & Identity</h2>
                </div>

                <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Application Title</label>
                        <input
                            type="text"
                            value={general.site_title}
                            onChange={(e) => setGeneral({ ...general, site_title: e.target.value })}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Logo URL / Path</label>
                        <input
                            type="text"
                            value={general.site_logo}
                            onChange={(e) => setGeneral({ ...general, site_logo: e.target.value })}
                            placeholder="/logo.png or https://..."
                            className={styles.input}
                        />
                    </div>
                </div>
            </div>

            {/* Pusher Sockets Card */}
            <div className={styles.configCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                    <BiBroadcast size={20} style={{ color: '#8b5cf6' }} />
                    <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Pusher WebSockets & Real-Time Sync</h2>
                </div>

                <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Pusher App ID</label>
                        <input
                            type="text"
                            value={general.pusher_app_id}
                            onChange={(e) => setGeneral({ ...general, pusher_app_id: e.target.value })}
                            placeholder="e.g. 1928374"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Pusher Key</label>
                        <input
                            type="text"
                            value={general.pusher_key}
                            onChange={(e) => setGeneral({ ...general, pusher_key: e.target.value })}
                            placeholder="e.g. 4a12bc98fe76d54"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Pusher Secret</label>
                        <input
                            type="password"
                            value={general.pusher_secret}
                            onChange={(e) => setGeneral({ ...general, pusher_secret: e.target.value })}
                            placeholder="••••••••••••"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Pusher Cluster</label>
                        <input
                            type="text"
                            value={general.pusher_cluster}
                            onChange={(e) => setGeneral({ ...general, pusher_cluster: e.target.value })}
                            placeholder="e.g. mt1, eu, ap2"
                            className={styles.input}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeneralSettings;

