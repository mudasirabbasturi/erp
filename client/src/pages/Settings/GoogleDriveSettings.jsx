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
    const [connectingOAuth, setConnectingOAuth] = useState(false);

    const [authMode, setAuthMode] = useState('oauth2');
    const [folderId, setFolderId] = useState('1FuuCUVEv-jNQfufj-8g4IkSO0RP6s1XX');
    const [oauthClientId, setOauthClientId] = useState('');
    const [oauthClientSecret, setOauthClientSecret] = useState('');
    const [hasOAuthSecret, setHasOAuthSecret] = useState(false);
    const [oauthConnected, setOauthConnected] = useState(false);
    const [oauthEmail, setOauthEmail] = useState('');
    const [serviceAccountEmail, setServiceAccountEmail] = useState('');
    const [credentialsPath, setCredentialsPath] = useState('');
    const [testResult, setTestResult] = useState(null);

    const redirectUri = `${window.location.origin}/api/settings/google-drive/oauth-callback`;

    const loadSettings = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/settings/google-drive');
            if (res.success && res.data) {
                setFolderId(res.data.folder_id || '');
                setAuthMode(res.data.auth_mode || 'service_account');
                setOauthClientId(res.data.oauth_client_id || '');
                setHasOAuthSecret(Boolean(res.data.has_oauth_client_secret));
                setOauthConnected(Boolean(res.data.oauth_connected));
                setOauthEmail(res.data.oauth_email || '');
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

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data?.type === 'GOOGLE_DRIVE_OAUTH_SUCCESS') {
                toast.success('Google Account Connected', `Connected as ${event.data.email || 'Google User'}`);
                setConnectingOAuth(false);
                loadSettings();
            } else if (event.data?.type === 'GOOGLE_DRIVE_OAUTH_ERROR') {
                toast.error('OAuth Failed', event.data.message || 'Google authorization failed.');
                setConnectingOAuth(false);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await apiClient.post('/settings/google-drive/test', {
                folder_id: folderId,
                auth_mode: authMode
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
                folder_id: folderId,
                auth_mode: authMode,
                oauth_client_id: oauthClientId,
                oauth_client_secret: oauthClientSecret
            });
            if (oauthClientSecret) {
                setHasOAuthSecret(true);
                setOauthClientSecret('');
            }
            toast.success('Saved', 'Google Drive configuration updated successfully.');
        } catch (err) {
            toast.error('Error', err.message || 'Failed to save configuration.');
        } finally {
            setSaving(false);
        }
    };

    const handleConnectGoogle = async () => {
        setConnectingOAuth(true);
        try {
            const res = await apiClient.post('/settings/google-drive/oauth-url', {
                redirect_uri: redirectUri,
                oauth_client_id: oauthClientId,
                oauth_client_secret: oauthClientSecret,
                folder_id: folderId
            });
            if (oauthClientSecret) {
                setHasOAuthSecret(true);
                setOauthClientSecret('');
            }
            if (res.success && res.data?.auth_url) {
                const width = 520;
                const height = 640;
                const left = window.screenX + (window.outerWidth - width) / 2;
                const top = window.screenY + (window.outerHeight - height) / 2;
                window.open(
                    res.data.auth_url,
                    'googleDriveOAuth',
                    `width=${width},height=${height},left=${left},top=${top}`
                );
            } else {
                toast.error('Error', res.message || 'Could not start Google OAuth.');
                setConnectingOAuth(false);
            }
        } catch (err) {
            toast.error('Error', err.message || 'Could not start Google OAuth.');
            setConnectingOAuth(false);
        }
    };

    const handleDisconnectOAuth = async () => {
        try {
            await apiClient.post('/settings/google-drive/disconnect-oauth');
            setOauthConnected(false);
            setOauthEmail('');
            toast.success('Disconnected', 'Google Drive OAuth account disconnected.');
        } catch (err) {
            toast.error('Error', err.message || 'Failed to disconnect.');
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
                                <BiShieldQuarter className={styles.labelIcon} /> Authentication Method
                            </label>
                            <select
                                value={authMode}
                                onChange={(e) => setAuthMode(e.target.value)}
                                className={styles.input}
                            >
                                <option value="oauth2">OAuth 2.0 — Personal Gmail / My Drive (Recommended)</option>
                                <option value="service_account">Service Account — Google Workspace Shared Drive</option>
                            </select>
                            <span className={styles.hint}>
                                {authMode === 'oauth2'
                                    ? 'Uploads using your own Google Account storage quota (works with standard @gmail.com folders).'
                                    : 'Requires a Google Workspace Shared Drive (personal @gmail.com folders are blocked by Google for Service Accounts).'}
                            </span>
                        </div>

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

                        {authMode === 'oauth2' ? (
                            <>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>
                                        <BiKey className={styles.labelIcon} /> OAuth 2.0 Client ID
                                    </label>
                                    <input
                                        type="text"
                                        value={oauthClientId}
                                        onChange={(e) => setOauthClientId(e.target.value)}
                                        placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                                        className={styles.input}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>
                                        <BiKey className={styles.labelIcon} /> OAuth 2.0 Client Secret
                                    </label>
                                    <input
                                        type="password"
                                        value={oauthClientSecret}
                                        onChange={(e) => setOauthClientSecret(e.target.value)}
                                        placeholder={hasOAuthSecret ? '•••••••••••••••• (Saved — enter only to replace)' : 'GOCSPX-xxxxxxxxxxxxxxxx'}
                                        className={styles.input}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>
                                        Authorized Redirect URI (Copy to Google Cloud)
                                    </label>
                                    <input
                                        type="text"
                                        value={redirectUri}
                                        readOnly
                                        onClick={(e) => e.target.select()}
                                        className={`${styles.input} ${styles.readOnlyInput}`}
                                    />
                                    <span className={styles.hint}>
                                        Add this exact URL under <strong>Authorized redirect URIs</strong> in your Google Cloud OAuth Client.
                                    </span>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '12px 14px',
                                    borderRadius: '8px',
                                    background: oauthConnected ? '#ecfdf5' : '#f8fafc',
                                    border: `1px solid ${oauthConnected ? '#a7f3d0' : '#e2e8f0'}`,
                                    marginBottom: '8px',
                                    gap: '12px',
                                    flexWrap: 'wrap'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '13px', color: oauthConnected ? '#065f46' : '#334155' }}>
                                            {oauthConnected ? `Connected as ${oauthEmail || 'Google Account'}` : 'Google Account Not Connected'}
                                        </div>
                                        <div style={{ fontSize: '12px', color: oauthConnected ? '#047857' : '#64748b' }}>
                                            {oauthConnected
                                                ? 'Refresh token is saved. Screenshots will upload to your Google Drive.'
                                                : 'Enter Client ID & Secret above, then click Connect Google Account.'}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={handleConnectGoogle}
                                            disabled={connectingOAuth || !oauthClientId || (!oauthClientSecret && !hasOAuthSecret)}
                                            className={styles.btnPrimary}
                                            style={{ padding: '8px 14px', fontSize: '13px' }}
                                        >
                                            {connectingOAuth ? <BiLoaderAlt className={styles.spinner} /> : <BiCloud />}
                                            {oauthConnected ? 'Reconnect Google' : 'Connect Google Account'}
                                        </button>
                                        {oauthConnected && (
                                            <button
                                                type="button"
                                                onClick={handleDisconnectOAuth}
                                                className={styles.btnSecondary}
                                                style={{ padding: '8px 12px', fontSize: '13px' }}
                                            >
                                                Disconnect
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
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
                                        Ensure this service account is a <strong>Content manager</strong> on your Google Workspace Shared Drive.
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
                            </>
                        )}

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
                            <p>Click <strong>"Test Drive Connection"</strong> to verify server-to-Google authorization and real file upload permissions.</p>
                        </div>
                    )}

                    <div className={styles.infoBox}>
                        <h4 className={styles.infoTitle}>
                            {authMode === 'oauth2' ? 'OAuth 2.0 Setup Guide' : 'Shared Drive Requirement'}
                        </h4>
                        {authMode === 'oauth2' ? (
                            <ol className={styles.stepList}>
                                <li>In Google Cloud Console (<code>project-erp-513911</code>), open <strong>APIs &amp; Services → Credentials</strong>.</li>
                                <li>Create an <strong>OAuth client ID</strong> (Application type: <strong>Web application</strong>).</li>
                                <li>Paste the <strong>Authorized Redirect URI</strong> shown on the left.</li>
                                <li>Paste your <strong>Client ID</strong> &amp; <strong>Client Secret</strong>, then click <strong>Connect Google Account</strong>.</li>
                            </ol>
                        ) : (
                            <ol className={styles.stepList}>
                                <li>Open Google Drive → <strong>Shared drives</strong> and create or select a Shared Drive.</li>
                                <li>Click <strong>Manage members</strong> and add the Service Account email as <strong>Content manager</strong>.</li>
                                <li>Paste the Shared Drive folder ID and click <strong>Test Drive Connection</strong>.</li>
                            </ol>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoogleDriveSettings;

