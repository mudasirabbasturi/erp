import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    BiRuler,
    BiPlus,
    BiSearch,
    BiFolder,
    BiDuplicate,
    BiTrash,
    BiFile,
    BiCalculator,
    BiDollar,
    BiLayer,
    BiCalendar
} from 'react-icons/bi';
import takeoffApi from './takeoffApi';
import apiClient from '../../api/client';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal/Modal';
import styles from './TakeoffSessionsList.module.css';

const TakeoffSessionsList = () => {
    const navigate = useNavigate();
    const { projectId } = useParams();
    const toast = useToast();
    const { setCustomBreadcrumbs } = usePageActions();

    const [sessions, setSessions] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedProject, setSelectedProject] = useState(projectId || '');
    const [selectedStatus, setSelectedStatus] = useState('');

    // Create session modal state
    const [createModal, setCreateModal] = useState({
        open: false,
        name: '',
        project_id: projectId || '',
        description: '',
        status: 'draft'
    });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        setCustomBreadcrumbs([
            { label: 'Construction Takeoff', to: '/takeoff' }
        ]);
    }, [setCustomBreadcrumbs]);

    // Load sessions
    const loadSessions = useCallback(async () => {
        try {
            setLoading(true);
            const params = {};
            if (selectedProject) params.project_id = selectedProject;
            if (selectedStatus) params.status = selectedStatus;
            if (search) params.search = search;

            const res = await takeoffApi.getSessions(params);
            if (res.success && Array.isArray(res.data)) {
                setSessions(res.data);
            }
        } catch (err) {
            toast.error('Load Error', err.message || 'Failed to load takeoff sessions');
        } finally {
            setLoading(false);
        }
    }, [selectedProject, selectedStatus, search, toast]);

    // Load projects for lookup dropdown
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await apiClient.get('/projects?per_page=100');
                if (res.success && res.data) {
                    setProjects(res.data.items || res.data || []);
                }
            } catch (err) {
                console.error('Failed to load projects list for takeoff:', err);
            }
        };
        fetchProjects();
    }, []);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    // Create session
    const handleCreateSession = async (e) => {
        e.preventDefault();
        if (!createModal.name.trim()) return;

        try {
            setCreating(true);
            const res = await takeoffApi.createSession({
                name: createModal.name.trim(),
                project_id: createModal.project_id || null,
                description: createModal.description.trim(),
                status: createModal.status
            });

            if (res.success && res.data) {
                toast.success('Session Created', res.data.name);
                setCreateModal({ open: false, name: '', project_id: '', description: '', status: 'draft' });
                // Immediately navigate to workspace for the new session
                navigate(`/takeoff/${res.data.id}`);
            } else {
                toast.error('Creation Failed', res.message || 'Failed to create takeoff session');
            }
        } catch (err) {
            toast.error('Creation Failed', err.message);
        } finally {
            setCreating(false);
        }
    };

    // Duplicate session
    const handleDuplicate = async (e, id) => {
        e.stopPropagation();
        try {
            const res = await takeoffApi.duplicateSession(id);
            if (res.success && res.data) {
                toast.success('Duplicated', 'Session cloned successfully');
                loadSessions();
            }
        } catch (err) {
            toast.error('Duplicate Failed', err.message);
        }
    };

    // Delete session
    const handleDelete = async (e, id, name) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete session "${name}"?`)) return;

        try {
            const res = await takeoffApi.deleteSession(id);
            if (res.success) {
                setSessions(prev => prev.filter(s => s.id !== id));
                toast.success('Deleted', 'Takeoff session deleted');
            }
        } catch (err) {
            toast.error('Delete Failed', err.message);
        }
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.headerTitles}>
                    <h1>
                        <BiRuler size={26} color="#4f46e5" />
                        Construction Takeoff & Estimations
                    </h1>
                    <p>
                        Upload architectural blueprints, measure linear/area/count/volume quantities, calibrate scales, and generate construction cost estimates.
                    </p>
                </div>

                <div className={styles.headerActions}>
                    <button
                        type="button"
                        onClick={() => setCreateModal(prev => ({ ...prev, open: true }))}
                        className={styles.createBtn}
                    >
                        <BiPlus size={18} /> New Takeoff Session
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className={styles.filterBar}>
                <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                    <BiSearch size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px' }} />
                    <input
                        type="text"
                        placeholder="Search takeoff sessions by title or description..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={styles.searchInput}
                        style={{ paddingLeft: '32px' }}
                    />
                </div>

                <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className={styles.filterSelect}
                >
                    <option value="">All Projects</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>
                            #{p.id} - {p.project_title}
                        </option>
                    ))}
                </select>

                <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className={styles.filterSelect}
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="final">Final</option>
                    <option value="archived">Archived</option>
                </select>
            </div>

            {/* Sessions Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                    <BiRuler className="spin" size={32} style={{ marginBottom: '10px', color: '#4f46e5' }} />
                    <div>Loading takeoff sessions...</div>
                </div>
            ) : sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <BiCalculator size={44} color="#94a3b8" style={{ marginBottom: '12px' }} />
                    <h3 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>No Takeoff Sessions Found</h3>
                    <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
                        Start a new takeoff session to upload blueprint drawings and calculate material quantities.
                    </p>
                    <button
                        type="button"
                        onClick={() => setCreateModal(prev => ({ ...prev, open: true }))}
                        className={styles.createBtn}
                    >
                        <BiPlus size={18} /> Create First Takeoff Session
                    </button>
                </div>
            ) : (
                <div className={styles.sessionsGrid}>
                    {sessions.map(s => {
                        const statusColors = {
                            draft: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
                            final: { bg: '#ecfdf5', border: '#a7f3d0', text: '#059669' },
                            archived: { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569' }
                        };
                        const sc = statusColors[s.status] || statusColors.draft;

                        return (
                            <div
                                key={s.id}
                                className={styles.sessionCard}
                                onClick={() => window.open(`/takeoff/${s.id}`, '_blank')}
                            >
                                <div>
                                    <div className={styles.cardTop}>
                                        <h3 className={styles.sessionName} title={s.name}>
                                            {s.name}
                                        </h3>
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            background: sc.bg,
                                            border: `1px solid ${sc.border}`,
                                            color: sc.text,
                                            textTransform: 'uppercase'
                                        }}>
                                            {s.status}
                                        </span>
                                    </div>

                                    {s.project_title && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#4f46e5', fontWeight: 600, marginBottom: '8px' }}>
                                            <BiFolder size={14} /> #{s.project_id} {s.project_title}
                                        </div>
                                    )}

                                    <p className={styles.sessionDesc}>
                                        {s.description || 'No description provided.'}
                                    </p>
                                </div>

                                <div>
                                    <div className={styles.statsRow}>
                                        <div className={styles.statItem}>
                                            <span>Drawings</span>
                                            <strong>{s.blueprints_count || 0}</strong>
                                        </div>
                                        <div className={styles.statItem}>
                                            <span>Takeoffs</span>
                                            <strong>{s.measurements_count || 0}</strong>
                                        </div>
                                        <div className={styles.statItem}>
                                            <span>Assemblies</span>
                                            <strong>{s.assemblies_count || 0}</strong>
                                        </div>
                                    </div>

                                    <div className={styles.cardFooter}>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <BiCalendar size={13} />
                                            {s.created_at ? String(s.created_at).slice(0, 10) : ''}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDuplicate(e, s.id)}
                                                className={styles.iconBtn}
                                                title="Duplicate Session"
                                            >
                                                <BiDuplicate size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDelete(e, s.id, s.name)}
                                                className={styles.iconBtn}
                                                style={{ color: '#ef4444' }}
                                                title="Delete Session"
                                            >
                                                <BiTrash size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(`/takeoff/${s.id}`, '_blank');
                                                }}
                                                className={styles.openBtn}
                                                title="Open Fullscreen Workspace in New Tab"
                                            >
                                                Launch Takeoff ↗
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Takeoff Session Modal */}
            {createModal.open && (
                <Modal
                    isOpen={createModal.open}
                    onClose={() => setCreateModal(prev => ({ ...prev, open: false }))}
                    title="📐 Create New Takeoff Session"
                >
                    <form onSubmit={handleCreateSession}>
                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                Session Name *
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Architectural & Structural Takeoff - Phase 1"
                                value={createModal.name}
                                onChange={(e) => setCreateModal(prev => ({ ...prev, name: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                    Link to ERP Project
                                </label>
                                <select
                                    value={createModal.project_id}
                                    onChange={(e) => setCreateModal(prev => ({ ...prev, project_id: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                                >
                                    <option value="">No Project (Standalone Workspace)</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>
                                            #{p.id} - {p.project_title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                    Status
                                </label>
                                <select
                                    value={createModal.status}
                                    onChange={(e) => setCreateModal(prev => ({ ...prev, status: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                                >
                                    <option value="draft">Draft</option>
                                    <option value="final">Final</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ marginBottom: '18px' }}>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                Description / Estimator Notes
                            </label>
                            <textarea
                                rows={3}
                                placeholder="Details about this takeoff session, scopes, drawing revisions, specifications..."
                                value={createModal.description}
                                onChange={(e) => setCreateModal(prev => ({ ...prev, description: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => setCreateModal(prev => ({ ...prev, open: false }))}
                                style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={creating}
                                style={{ padding: '8px 20px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer' }}
                            >
                                {creating ? 'Creating...' : 'Create & Launch Workspace'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default TakeoffSessionsList;
