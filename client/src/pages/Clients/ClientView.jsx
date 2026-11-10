import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    BiArrowBack,
    BiBriefcase,
    BiBuilding,
    BiPhone,
    BiEnvelope,
    BiMapPin,
    BiEdit,
    BiHistory,
    BiNote,
    BiCalendar,
    BiTable
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import ActivityLogViewer from '../../components/ActivityLogs/ActivityLogViewer';
import styles from './Clients.module.css';

const CORE_FIELDS = [
    'id', 'title', 'name', 'client_type', 'email', 'phone',
    'address', 'city', 'state', 'country', 'notes',
    'created_at', 'updated_at', 'deleted_at'
];

const ClientView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { setCustomBreadcrumbs } = usePageActions();
    const toast = useToast();

    const [client, setClient] = useState(null);
    const [columnConfigs, setColumnConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activityOpen, setActivityOpen] = useState(false);

    useEffect(() => {
        const fetchClient = async () => {
            setLoading(true);
            try {
                const [clientRes, colsRes] = await Promise.all([
                    apiClient.get(`/clients/${id}`),
                    apiClient.get('/columns/config/clients')
                ]);

                if (clientRes.success && clientRes.data) {
                    setClient(clientRes.data);
                    setCustomBreadcrumbs([
                        { label: 'Clients', to: '/clients' },
                        { label: clientRes.data.name || `Client #${id}` }
                    ]);
                } else {
                    toast.error('Client Error', clientRes.message || 'Client record not found');
                    navigate('/clients');
                }

                if (colsRes.success && colsRes.data) {
                    setColumnConfigs(colsRes.data);
                }
            } catch (err) {
                toast.error('Error', err.message || 'Failed to load client details');
            } finally {
                setLoading(false);
            }
        };

        fetchClient();
    }, [id, navigate, toast, setCustomBreadcrumbs]);

    if (loading) {
        return (
            <div className={styles.container}>
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                    Loading client details...
                </div>
            </div>
        );
    }

    if (!client) return null;

    // Filter dynamic custom fields that are view-visible
    const dynamicConfigs = columnConfigs.filter(
        (cfg) => !CORE_FIELDS.includes(cfg.column_name) && cfg.is_active === 1 && cfg.is_view_visible === 1
    );

    const clientType = (client.client_type || 'normal').toLowerCase();
    const badgeClass = clientType === 'admin' ? styles.badgeAdmin : styles.badgeNormal;

    return (
        <div className={styles.container}>
            {/* Header Card */}
            <div className={styles.headerCard}>
                <div className={styles.headerLeft}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={() => navigate('/clients')}
                            className={styles.btnSecondary}
                            style={{ padding: '6px 10px' }}
                            title="Back to All Clients"
                        >
                            <BiArrowBack size={16} /> All Clients
                        </button>
                        <h1 className={styles.title}>
                            <BiBriefcase style={{ color: '#4f46e5' }} /> {client.name}
                        </h1>
                        {client.title && (
                            <span style={{
                                fontFamily: 'Consolas, monospace',
                                fontWeight: 700,
                                background: '#eef2ff',
                                color: '#4338ca',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                border: '1px solid #c7d2fe'
                            }}>
                                {client.title}
                            </span>
                        )}
                        <span className={badgeClass}>
                            {client.client_type || 'normal'}
                        </span>
                    </div>
                    <p className={styles.subtitle} style={{ marginLeft: '115px' }}>
                        Client Record #{client.id} • Registered on {client.created_at ? client.created_at.slice(0, 10) : '—'}
                    </p>
                </div>
                <div className={styles.actions}>
                    <button
                        type="button"
                        onClick={() => setActivityOpen(true)}
                        className={styles.btnSecondary}
                    >
                        <BiHistory /> Activity History
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/clients/edit/${client.id}`)}
                        className={styles.btnPrimary}
                    >
                        <BiEdit /> Edit Client
                    </button>
                </div>
            </div>

            {/* Layout Grid: Left Profile Card, Right Details */}
            <div className={styles.detailGrid}>
                {/* Left Card: Essential Contact & Location */}
                <div className={styles.detailCard}>
                    <h3 className={styles.sectionTitle}>
                        <BiBuilding style={{ color: '#4f46e5' }} /> Contact Summary
                    </h3>

                    <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Email</span>
                        <div className={styles.detailValue}>
                            {client.email ? (
                                <a
                                    href={`mailto:${client.email}`}
                                    style={{ color: '#4f46e5', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
                                >
                                    <BiEnvelope size={15} /> {client.email}
                                </a>
                            ) : (
                                <span style={{ color: '#94a3b8' }}>— Not provided —</span>
                            )}
                        </div>
                    </div>

                    <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Phone</span>
                        <div className={styles.detailValue}>
                            {client.phone ? (
                                <a
                                    href={`tel:${client.phone}`}
                                    style={{ color: '#0f172a', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
                                >
                                    <BiPhone size={15} style={{ color: '#10b981' }} /> {client.phone}
                                </a>
                            ) : (
                                <span style={{ color: '#94a3b8' }}>— Not provided —</span>
                            )}
                        </div>
                    </div>

                    <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Location</span>
                        <div className={styles.detailValue} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                            <BiMapPin size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                            <span>
                                {[client.city, client.state, client.country].filter(Boolean).join(', ') || '— Not provided —'}
                            </span>
                        </div>
                    </div>

                    {client.address && (
                        <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>Full Address</span>
                            <div className={styles.detailValue} style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>
                                {client.address}
                            </div>
                        </div>
                    )}

                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>Created Date</span>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                                {client.created_at || '—'}
                            </span>
                        </div>
                        <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>Last Updated</span>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                                {client.updated_at || '—'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Card: Dynamic Custom Fields & Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Custom Dynamic Fields */}
                    {dynamicConfigs.length > 0 && (
                        <div className={styles.detailCard}>
                            <h3 className={styles.sectionTitle}>
                                <BiTable style={{ color: '#6366f1' }} /> Custom Database Attributes
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginTop: '6px' }}>
                                {dynamicConfigs.map((cfg) => {
                                    const val = client[cfg.column_name];
                                    return (
                                        <div key={cfg.column_name} className={styles.detailItem}>
                                            <span className={styles.detailLabel}>{cfg.label || cfg.column_name}</span>
                                            <div className={styles.detailValue}>
                                                {val !== null && val !== undefined && val !== '' ? (
                                                    String(val)
                                                ) : (
                                                    <span style={{ color: '#cbd5e1' }}>—</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Notes & Remarks Card */}
                    <div className={styles.detailCard}>
                        <h3 className={styles.sectionTitle}>
                            <BiNote style={{ color: '#8b5cf6' }} /> Notes & Internal Information
                        </h3>
                        {client.notes ? (
                            <div
                                style={{
                                    fontSize: '13px',
                                    color: '#334155',
                                    lineHeight: 1.6,
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    overflowX: 'auto'
                                }}
                                dangerouslySetInnerHTML={{ __html: client.notes }}
                            />
                        ) : (
                            <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '13px', padding: '10px 0' }}>
                                No notes or remarks recorded for this client.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Central Audit / Activity History Modal */}
            {activityOpen && (
                <ActivityLogViewer
                    subjectType="clients"
                    subjectId={client.id}
                    title={`Activity History for Client: ${client.name}`}
                    isOpen={activityOpen}
                    onClose={() => setActivityOpen(false)}
                />
            )}
        </div>
    );
};

export default ClientView;

