import React, { useState, useEffect } from 'react';
import {
    BiCloud,
    BiCheckCircle,
    BiXCircle,
    BiSave,
    BiRefresh,
    BiFolder,
    BiKey,
    BiShieldQuarter,
    BiLoaderAlt
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import styles from './GoogleDriveSettings.module.css';

const GoogleDriveSettings = () => {
    const { setCustomBreadcrumbs } = usePageActions();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);

    const [folderId, setFolderId] = useState('1FuuCUVEv-jNQfufj-8g4IkSO0RP6s1XX');
    const [serviceAccountEmail, setServiceAccountEmail] = useState('');
    const [credentialsPath, setCredentialsPath] = useState('');
    const [testResult, setTestResult] = useState(null);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/settings/google-drive');
            if (res.success && res.data) {
                setFolderId(res.data.folder_id || '');
                setServiceAccountEmail(res.data.service_account_email || '');
                setCredentialsPath(res.data.credentials_path || '');
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to load Google Drive settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setCustomBreadcrumbs([
            { label: 'Settings' },
            { label: 'Google Drive Configuration' }
        ]);
        loadSettings();
    }, [setCustomBreadcrumbs]);

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await apiClient.post('/settings/google-drive/test', {
                folder_id: folderId
            });
            setTestResult(res);
            if (res.success) {
                toast.success('Connection Successful', res.message || 'Connected to Google Drive successfully.');
            } else {
                toast.error('Connection Failed', res.message || 'Failed to connect to Google Drive.');
            }
        } catch (err) {
            setTestResult({
                success: false,
                message: err.message || 'Connection test failed.'
            });
            toast.error('Error', err.message || 'Google Drive test failed.');
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await apiClient.post('/settings/google-drive/update', {
                folder_id: folderId
            });
            toast.success('Saved', 'Google Drive configuration updated successfully.');
        } catch (err) {
            toast.error('Error', err.message || 'Failed to save configuration.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerCard}>
                <div className={styles.headerInfo}>
                    <div className={styles.headerIcon}>
                        <BiCloud />
                    </div>
                    <div>
                        <h1 className={styles.headerTitle}>Google Drive Cloud Storage</h1>
                        <p className={styles.headerSubtitle}>
                            Configure service account authorization and designated Google Drive storage for automated desktop screenshots.
                        </p>
                    </div>
                </div>
            </div>

            <div className={styles.contentGrid}>
                {/* Form Card */}
                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Storage & Authentication Details</h2>
                    <form onSubmit={handleSave} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                                <BiFolder className={styles.labelIcon} /> Google Drive Folder ID
                            </label>
                            <input
                                type="text"
                                value={folderId}
                                onChange={(e) => setFolderId(e.target.value)}
                                placeholder="e.g. 1FuuCUVEv-jNQfufj-8g4IkSO0RP6s1XX"
                                className={styles.input}
                                required
                            />
                            <span className={styles.hint}>
                                The destination folder ID extracted from your Google Drive URL.
                            </span>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                                <BiKey className={styles.labelIcon} /> Connected Service Account
                            </label>
                            <input
                                type="text"
                                value={serviceAccountEmail}
                                readOnly
                                className={`${styles.input} ${styles.readOnlyInput}`}
                            />
                            <span className={styles.hint}>
                                Ensure this service account has been added as an <strong>Editor</strong> to your Google Drive folder.
                            </span>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                                <BiShieldQuarter className={styles.labelIcon} /> Credentials Key Path
                            </label>
                            <input
                                type="text"
                                value={credentialsPath}
                                readOnly
                                className={`${styles.input} ${styles.readOnlyInput}`}
                            />
                        </div>

                        <div className={styles.actionRow}>
                            <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={testing || !folderId}
                                className={styles.btnSecondary}
                            >
                                {testing ? <BiLoaderAlt className={styles.spinner} /> : <BiRefresh />}
                                Test Drive Connection
                            </button>

                            <button
                                type="submit"
                                disabled={saving}
                                className={styles.btnPrimary}
                            >
                                {saving ? <BiLoaderAlt className={styles.spinner} /> : <BiSave />}
                                Save Settings
                            </button>
                        </div>
                    </form>
                </div>

                {/* Connection Status Card */}
                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Integration Diagnostic</h2>
                    {testResult ? (
                        <div className={testResult.success ? styles.alertSuccess : styles.alertError}>
                            <div className={styles.alertIconWrap}>
                                {testResult.success ? <BiCheckCircle /> : <BiXCircle />}
                            </div>
                            <div>
                                <h3 className={styles.alertTitle}>
                                    {testResult.success ? 'Authentication Verified' : 'Connection Notice'}
                                </h3>
                                <p className={styles.alertText}>{testResult.message}</p>
                                {testResult.data && testResult.data.folder_name && (
                                    <div className={styles.folderMeta}>
                                        <strong>Folder Name:</strong> {testResult.data.folder_name} <br />
                                        <strong>Can Add Files:</strong> {testResult.data.can_add_files ? 'Yes' : 'No'}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className={styles.emptyNotice}>
                            <BiCloud style={{ fontSize: '36px', color: '#cbd5e1' }} />
                            <p>Click <strong>"Test Drive Connection"</strong> to verify server-to-Google authorization and write permissions.</p>
                        </div>
                    )}

                    <div className={styles.infoBox}>
                        <h4 className={styles.infoTitle}>Folder Sharing Requirement</h4>
                        <ol className={styles.stepList}>
                            <li>Open Google Drive and locate folder <code>erp_screen_shots</code>.</li>
                            <li>Click <strong>Share</strong> and paste the Service Account email.</li>
                            <li>Select <strong>Editor</strong> permission and click <strong>Share</strong>.</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoogleDriveSettings;

