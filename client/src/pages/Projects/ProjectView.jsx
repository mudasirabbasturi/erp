import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    BiArrowBack,
    BiFolder,
    BiBuilding,
    BiMapPin,
    BiCalendarAlt,
    BiWallet,
    BiTrendingDown,
    BiTargetLock,
    BiLineChart,
    BiEdit,
    BiHistory,
    BiLinkExternal,
    BiFile,
    BiErrorCircle,
    BiCheckCircle,
    BiTable,
    BiLock,
    BiUser,
    BiAward,
    BiTimeFive,
    BiPhone,
    BiEnvelope,
    BiNote,
    BiFileBlank,
    BiShieldQuarter,
    BiFolderOpen,
    BiBriefcase,
    BiCrown,
    BiTask,
    BiCheck,
    BiHighlight,
    BiSpreadsheet,
    BiTag,
    BiShield,
    BiChevronDown,
    BiChevronRight,
    BiStar,
    BiInfoCircle,
    BiPlusCircle,
    BiBlock,
    BiSave,
    BiX,
    BiTrash,
    BiLoaderAlt
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import ActivityLogViewer from '../../components/ActivityLogs/ActivityLogViewer';
import Modal from '../../components/ui/Modal/Modal';
import RichTextEditor, { RichContentView } from '../../components/ui/RichTextEditor';
import ProjectFieldEditModal from '../../components/Projects/ProjectFieldEditModal';
import styles from './ProjectView.module.css';

const CORE_FIELDS = [
    'id', 'project_title', 'project_address', 'client_id', 'project_pricing',
    'project_area', 'project_construction_type', 'project_line_items_pricing',
    'project_floor_number', 'project_main_scope', 'project_scope_details',
    'project_template', 'project_init_link', 'project_final_link',
    'project_admin_notes', 'project_estimator_notes',
    'project_total_budget', 'project_deduction_amount', 'project_due_date',
    'project_points', 'project_progress_status', 'project_source',
    'project_preview_status', 'is_project_late', 'created_at', 'updated_at', 'deleted_at'
];

const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'Takeoff On Progress':
            return styles.statusTakeoff;
        case 'Pricing On Progress':
            return styles.statusPricing;
        case 'Completed':
        case 'Deliver':
            return styles.statusCompleted;
        case 'Revision':
            return styles.statusRevision;
        case 'Hold':
        case 'Cancelled':
            return styles.statusHold;
        default:
            return styles.statusHold;
    }
};

const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || amount === '' || isNaN(amount)) {
        return null;
    }
    return Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

/* ==========================================================================
   Modern Refined N/A State Components (From User Design)
   ========================================================================== */

// 1. Pure Badge (Minimal, Inline)
const NaBadge = ({ text = 'N/A' }) => (
    <span className={styles.naBadge}>
        <BiBlock />
        <span>{text}</span>
    </span>
);

// 2. Floating Pill (Soft gradient, Standalone)
const NaPill = ({ text = 'N/A' }) => (
    <span className={styles.naPill}>
        <BiInfoCircle />
        <span>{text}</span>
    </span>
);

// 3. Ghost Text (With elegant dash)
const NaText = ({ text = 'N/A' }) => (
    <span className={styles.naText}>
        <span className={styles.dashLine}></span>
        <span>{text}</span>
    </span>
);

// 4. Input-Alike Field (Disabled state look)
const NaField = ({ text = 'N/A', icon = <BiInfoCircle /> }) => (
    <div className={styles.naField}>
        {icon}
        <span>{text}</span>
    </div>
);

// 5. Dashed Placeholder (Large Area)
const NaDashed = ({ text = 'N/A', icon = <BiFolderOpen /> }) => (
    <div className={styles.naDashed}>
        {icon}
        <span>{text}</span>
    </div>
);

// 6. Section Level Empty State Block
const NaBlock = ({ title = 'N/A', text = 'Information has not been added yet.', icon = <BiFolder /> }) => (
    <div className={styles.naBlock}>
        {icon}
        <div className={styles.naBlockTitle}>{title}</div>
        <div className={styles.naBlockText}>{text}</div>
    </div>
);

const ProjectView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, isSuperAdmin, hasPermission, canViewColumn } = useAuth();
    const { setCustomBreadcrumbs } = usePageActions();
    const toast = useToast();

    const [project, setProject] = useState(null);
    const [columnConfigs, setColumnConfigs] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activityOpen, setActivityOpen] = useState(false);

    // Financial section collapsed by default (User Request)
    const [financialExpanded, setFinancialExpanded] = useState(false);

    // Interactive Client Expand/Collapse state
    const [expandedClients, setExpandedClients] = useState({});

    // Dynamic Lookups for select fields (status, construction type, source, etc.)
    const [lookups, setLookups] = useState({
        project_progress_status: [
            'Planned',
            'Pending',
            'Takeoff On Progress',
            'Pricing On Progress',
            'Completed',
            'Hold',
            'Revision',
            'Cancelled',
            'Deliver'
        ],
        project_construction_type: ['commercial', 'residential'],
        project_source: ['InSource', 'OutSource'],
        project_preview_status: ['active', 'draft']
    });

    // Quick Edit Modal state for Project fields (kept for backward compatibility)
    const [editModal, setEditModal] = useState({
        open: false,
        title: '',
        subtitle: '',
        fields: [],
        values: {}
    });

    // Standalone Reusable Single-Column / Single-Field Edit Modal state
    const INITIAL_SINGLE_FIELD_MODAL = {
        isOpen: false,
        fieldName: '',
        fieldLabel: '',
        fieldType: 'text',
        initialValue: '',
        options: [],
        step: 'any',
        placeholder: '',
        helperText: ''
    };
    const [singleFieldModal, setSingleFieldModal] = useState(INITIAL_SINGLE_FIELD_MODAL);

    // Real-Time Team Points Modal state
    const [teamPointsModalOpen, setTeamPointsModalOpen] = useState(false);
    const [memberPointsMap, setMemberPointsMap] = useState({});
    const [teamPointsSaving, setTeamPointsSaving] = useState(false);

    // Add More Clients to Project Modal state
    const [addClientModalOpen, setAddClientModalOpen] = useState(false);
    const [clientFilterType, setClientFilterType] = useState('all');
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [allClientsList, setAllClientsList] = useState([]);
    const [loadingClients, setLoadingClients] = useState(false);
    const [assigningClientId, setAssigningClientId] = useState(null);

    // Client Edit Modal state
    const [clientModal, setClientModal] = useState({
        open: false,
        client: null,
        formData: {
            name: '',
            title: '',
            client_type: 'normal',
            email: '',
            phone: '',
            address: '',
            city: '',
            state: '',
            country: '',
            notes: ''
        }
    });

    const [modalSaving, setModalSaving] = useState(false);

    const canEdit = isSuperAdmin || hasPermission('projects.edit');
    const canEditClient = isSuperAdmin || hasPermission('clients.edit');

    const toggleClientExpand = (clientId) => {
        setExpandedClients((prev) => ({
            ...prev,
            [clientId]: !prev[clientId]
        }));
    };

    // Open Standalone Single Column Edit Modal
    const openSingleFieldModal = (fieldName, fieldLabel, fieldType = 'text', options = [], step = 'any', placeholder = '', helperText = '') => {
        let currentVal = project?.[fieldName] ?? '';
        setSingleFieldModal({
            isOpen: true,
            fieldName,
            fieldLabel,
            fieldType,
            initialValue: currentVal,
            options,
            step,
            placeholder,
            helperText
        });
    };

    // Open Real-time Team Points Modal
    const openTeamPointsModal = () => {
        const initialMap = {};
        const members = Array.isArray(project?.project_team_members)
            ? project.project_team_members
            : Array.isArray(project?.team_members)
            ? project.team_members
            : [];

        members.forEach((m) => {
            initialMap[m.id] = Number(m.points_gain || 0);
        });
        setMemberPointsMap(initialMap);
        setTeamPointsModalOpen(true);
    };

    // Calculate real-time allocated and remaining points for modal header
    const modalAllocatedPoints = useMemo(() => {
        return Object.values(memberPointsMap).reduce((acc, pts) => acc + (Number(pts) || 0), 0);
    }, [memberPointsMap]);

    const modalRemainingPoints = useMemo(() => {
        const total = Number(project?.project_points || 0);
        return total - modalAllocatedPoints;
    }, [project?.project_points, modalAllocatedPoints]);

    // Save Bulk Team Points
    const handleSaveTeamPoints = async (e) => {
        if (e) e.preventDefault();
        setTeamPointsSaving(true);
        try {
            const membersPayload = Object.entries(memberPointsMap).map(([mId, pts]) => ({
                id: Number(mId),
                points_gain: Math.max(0, Number(pts) || 0)
            }));

            const res = await apiClient.put(`/projects/${id}/team/points`, { members: membersPayload });
            if (res.success) {
                toast.success('Team Points Updated', 'Team points allocation saved successfully.');
                setTeamPointsModalOpen(false);
                await fetchProjectData();
            } else {
                toast.error('Failed to Update Points', res.message || 'Could not update points.');
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to update team points');
        } finally {
            setTeamPointsSaving(false);
        }
    };

    // Open Add Client Modal
    const openAddClientModal = async () => {
        setAddClientModalOpen(true);
        setLoadingClients(true);
        try {
            const res = await apiClient.get('/clients', { per_page: 200 });
            if (res.success && res.data) {
                const list = Array.isArray(res.data) ? res.data : (res.data.items || []);
                setAllClientsList(list);
            }
        } catch (err) {
            console.error('Failed to load clients list:', err);
        } finally {
            setLoadingClients(false);
        }
    };

    // Assign Client to Project
    const handleAssignClient = async (clientToAssign) => {
        const clientId = Number(clientToAssign.id);
        const currentIds = (project?.clients || []).map((c) => Number(c.id));
        if (currentIds.includes(clientId)) {
            toast.warning('Already Assigned', `${clientToAssign.name || clientToAssign.title} is already assigned.`);
            return;
        }

        setAssigningClientId(clientId);
        try {
            const newIds = [...currentIds, clientId];
            const res = await apiClient.put(`/projects/${id}`, {
                client_ids: newIds,
                client_id: newIds[0]
            });
            if (res.success) {
                toast.success('Client Assigned', `${clientToAssign.name || clientToAssign.title} added to project.`);
                await fetchProjectData();
            } else {
                toast.error('Assignment Failed', res.message || 'Could not assign client.');
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to assign client');
        } finally {
            setAssigningClientId(null);
        }
    };

    // Remove Client from Project
    const handleRemoveClient = async (clientIdToRemove, clientName) => {
        if (!window.confirm(`Are you sure you want to remove '${clientName || 'this client'}' from this project?`)) {
            return;
        }
        const currentIds = (project?.clients || []).map((c) => Number(c.id));
        const newIds = currentIds.filter((cid) => cid !== Number(clientIdToRemove));
        try {
            const res = await apiClient.put(`/projects/${id}`, {
                client_ids: newIds,
                client_id: newIds.length > 0 ? newIds[0] : null
            });
            if (res.success) {
                toast.success('Client Removed', `${clientName || 'Client'} removed from project.`);
                await fetchProjectData();
            } else {
                toast.error('Removal Failed', res.message || 'Could not remove client.');
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to remove client');
        }
    };

    // Filter available clients in modal
    const filteredAvailableClients = useMemo(() => {
        return allClientsList.filter((c) => {
            if (clientFilterType === 'admin' && (c.client_type || '').toLowerCase() !== 'admin') return false;
            if (clientFilterType === 'normal' && (c.client_type || '').toLowerCase() === 'admin') return false;
            if (clientSearchTerm.trim()) {
                const term = clientSearchTerm.toLowerCase();
                const nameMatch = (c.name || '').toLowerCase().includes(term);
                const titleMatch = (c.title || c.company_name || '').toLowerCase().includes(term);
                const emailMatch = (c.email || '').toLowerCase().includes(term);
                return nameMatch || titleMatch || emailMatch;
            }
            return true;
        });
    }, [allClientsList, clientFilterType, clientSearchTerm]);

    const fetchProjectData = useCallback(async () => {
        try {
            const [projRes, colsRes, logsRes, lookupsRes] = await Promise.all([
                apiClient.get(`/projects/${id}`),
                apiClient.get('/columns/config/projects'),
                apiClient.get('/activity-logs', { module: 'projects', record_id: id, per_page: 3 }).catch(() => ({ data: [] })),
                apiClient.get('/projects/lookups').catch(() => null)
            ]);

            if (projRes.success && projRes.data) {
                setProject(projRes.data);
                setCustomBreadcrumbs([
                    { label: 'Projects', to: '/projects' },
                    { label: projRes.data.project_title || `Project #${id}` }
                ]);

                // Expand first client by default if exists
                if (Array.isArray(projRes.data.clients) && projRes.data.clients.length > 0) {
                    setExpandedClients({ [projRes.data.clients[0].id]: true });
                }
            } else {
                toast.error('Project Error', projRes.message || 'Project not found');
                navigate('/projects');
            }

            if (colsRes.success && colsRes.data) {
                setColumnConfigs(colsRes.data);
            }

            if (logsRes && logsRes.data) {
                setRecentLogs(Array.isArray(logsRes.data) ? logsRes.data.slice(0, 3) : []);
            }

            if (lookupsRes && lookupsRes.data) {
                setLookups((prev) => ({
                    ...prev,
                    ...lookupsRes.data
                }));
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to load project details');
        } finally {
            setLoading(false);
        }
    }, [id, navigate, toast, setCustomBreadcrumbs]);

    useEffect(() => {
        fetchProjectData();
    }, [fetchProjectData]);

    // Open Project Quick Edit Modal
    const openEditModal = (modalConfig) => {
        const initialValues = {};
        (modalConfig.fields || []).forEach((f) => {
            initialValues[f.name] = f.value !== undefined ? f.value : (project?.[f.name] ?? '');
        });
        setEditModal({
            open: true,
            title: modalConfig.title || 'Edit Project Field',
            subtitle: modalConfig.subtitle || `Update value for Project #${id}`,
            fields: modalConfig.fields || [],
            values: initialValues
        });
    };

    // Save Project Field changes
    const handleSaveProjectFields = async (e) => {
        if (e) e.preventDefault();
        setModalSaving(true);
        try {
            const res = await apiClient.put(`/projects/${id}`, editModal.values);
            if (res.success) {
                toast.success('Project Updated', 'Changes saved successfully');
                setEditModal((prev) => ({ ...prev, open: false }));
                await fetchProjectData();
            } else {
                toast.error('Update Failed', res.message || 'Failed to save changes');
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to update field');
        } finally {
            setModalSaving(false);
        }
    };

    // Open Client Edit Modal
    const openClientEditModal = (client) => {
        setClientModal({
            open: true,
            client,
            formData: {
                name: client.name || client.client_name || '',
                title: client.title || client.company_name || '',
                client_type: client.client_type || 'normal',
                email: client.email || '',
                phone: client.phone || '',
                address: client.address || '',
                city: client.city || '',
                state: client.state || '',
                country: client.country || '',
                notes: client.notes || ''
            }
        });
    };

    // Save Client changes
    const handleSaveClient = async (e) => {
        if (e) e.preventDefault();
        if (!clientModal.client?.id) return;
        setModalSaving(true);
        try {
            const res = await apiClient.put(`/clients/${clientModal.client.id}`, clientModal.formData);
            if (res.success) {
                toast.success(
                    'Client Updated',
                    `Client '${clientModal.formData.name || clientModal.formData.title}' updated successfully`
                );
                setClientModal((prev) => ({ ...prev, open: false }));
                await fetchProjectData();
            } else {
                toast.error('Update Failed', res.message || 'Failed to update client');
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to update client');
        } finally {
            setModalSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
                <BiFolder size={36} style={{ color: '#94a3b8', marginBottom: '12px' }} />
                <div style={{ fontSize: '15px', fontWeight: 600 }}>Loading project workspace...</div>
            </div>
        );
    }

    if (!project) return null;

    // Filter dynamic custom fields that are view-visible and permitted
    const dynamicConfigs = columnConfigs.filter(
        (cfg) => !CORE_FIELDS.includes(cfg.column_name) &&
            cfg.is_active === 1 &&
            cfg.is_view_visible === 1 &&
            canViewColumn('projects', cfg.column_name)
    );

    // Permission checks for sensitive sections
    const canViewBudget = canViewColumn('projects', 'project_total_budget');
    const canViewDeduction = canViewColumn('projects', 'project_deduction_amount');

    const totalBudgetRaw = project.project_total_budget !== null && project.project_total_budget !== undefined && project.project_total_budget !== ''
        ? Number(project.project_total_budget)
        : null;
    const deductionRaw = project.project_deduction_amount !== null && project.project_deduction_amount !== undefined && project.project_deduction_amount !== ''
        ? Number(project.project_deduction_amount)
        : 0;

    const totalBudgetFormatted = canViewBudget && totalBudgetRaw !== null ? formatCurrency(totalBudgetRaw) : null;
    const deductionFormatted = canViewDeduction ? formatCurrency(deductionRaw) : null;

    let netValueFormatted = null;
    let utilizationPct = 0;
    if (canViewBudget && totalBudgetRaw !== null && totalBudgetRaw > 0) {
        const net = Math.max(0, totalBudgetRaw - deductionRaw);
        netValueFormatted = formatCurrency(net);
        utilizationPct = Math.min(100, Math.round((deductionRaw / totalBudgetRaw) * 100));
    }

    const assignedClients = project.clients || [];
    const teamMembers = project.team_members || project.project_team_members || [];

    const estimatorNotesValue = project.project_estimator_notes || project.project_notes || '';
    const adminNotesValue = project.project_admin_notes || '';
    const hasAnyNotes = Boolean(estimatorNotesValue || adminNotesValue);

    const totalPts = Number(project.project_points || 0);
    const usedPts = Number(project.points_used || 0);
    const pointsPct = totalPts > 0 ? Math.min(100, Math.round((usedPts / totalPts) * 100)) : 0;



    return (
        <div className={styles.projectView}>
            {/* ========== 1. HEADER CARD ========== */}
            <div className={styles.headerCard}>
                {/* Row 1: Back Button, Title (Standalone Single Row), & Action Buttons */}
                <div className={styles.headerTopRow}>
                    <div className={styles.headerTitleGroup}>
                        <button
                            type="button"
                            onClick={() => navigate('/projects')}
                            className={styles.backBtn}
                            title="Back to Projects"
                        >
                            <BiArrowBack size={15} /> All Projects
                        </button>

                        <h1 className={styles.projectTitle}>
                            <BiFolder />
                            <span>{project.project_title || 'Untitled Project'}</span>
                            {canEdit && (
                                <button
                                    type="button"
                                    className={styles.titleEditBtn}
                                    onClick={() => openSingleFieldModal('project_title', 'Project Title', 'text')}
                                    title="Edit Project Title"
                                >
                                    <BiEdit size={14} />
                                </button>
                            )}
                        </h1>
                    </div>

                    <div className={styles.headerActions}>
                        <button
                            type="button"
                            onClick={() => setActivityOpen(true)}
                            className={styles.btnSecondary}
                        >
                            <BiHistory size={16} /> Activity Logs
                        </button>
                        {(isSuperAdmin || hasPermission('projects.edit')) && (
                            <button
                                type="button"
                                onClick={() => navigate(`/projects/edit/${project.id}`)}
                                className={styles.btnPrimary}
                            >
                                <BiEdit size={16} /> Edit Project
                            </button>
                        )}
                    </div>
                </div>

                {/* Row 2: Status, Late Flag, Edit Buttons & Metadata */}
                <div className={styles.headerMetaRow}>
                    {/* Status Badge + Edit Button */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`${styles.statusBadge} ${getStatusBadgeClass(project.project_progress_status)}`}>
                            {project.project_progress_status || 'Pending'}
                        </span>
                        {canEdit && (
                            <button
                                type="button"
                                className={styles.metaEditBtn}
                                onClick={() =>
                                    openSingleFieldModal(
                                        'project_progress_status',
                                        'Progress Status',
                                        'select',
                                        lookups.project_progress_status || [
                                            'Planned',
                                            'Pending',
                                            'Takeoff On Progress',
                                            'Pricing On Progress',
                                            'Completed',
                                            'Hold',
                                            'Revision',
                                            'Cancelled',
                                            'Deliver'
                                        ]
                                    )
                                }
                                title="Edit Project Status"
                            >
                                <BiEdit size={12} /> Edit Status
                            </button>
                        )}
                    </div>

                    {/* Late Flag Badge + Toggle Button */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {project.is_project_late === 1 ? (
                            <span className={styles.lateBadge}>
                                <BiErrorCircle size={13} /> LATE
                            </span>
                        ) : (
                            <span style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#10b981',
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                padding: '3px 10px',
                                borderRadius: '20px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <BiCheck size={14} /> ON TIME
                            </span>
                        )}
                        {canEdit && (
                            <button
                                type="button"
                                className={styles.metaEditBtn}
                                onClick={() => openSingleFieldModal('is_project_late', 'Late Delivery Flag', 'toggle')}
                                title="Toggle Late Delivery Flag"
                            >
                                <BiEdit size={12} /> Late Flag
                            </button>
                        )}
                    </div>

                    <div className={styles.dot}></div>

                    <div className={styles.subtitle} style={{ marginLeft: 0 }}>
                        <span>Project Record #{project.id}</span>
                        <span className={styles.dot}></span>
                        <span>Created on {project.created_at ? project.created_at.slice(0, 10) : <NaBadge text="N/A" />}</span>
                    </div>
                </div>
            </div>

            {/* ========== 2. FINANCIAL SUMMARY CARD (.finCard) — COLLAPSED BY DEFAULT ========== */}
            <div className={styles.finCard}>
                <div
                    className={styles.finHeaderTop}
                    onClick={() => setFinancialExpanded((prev) => !prev)}
                >
                    <div className={styles.finHeaderMain}>
                        <div className={styles.finIconBox}>
                            <BiLineChart />
                        </div>
                        <div>
                            <h2 className={styles.finTitle}>Financial Summary</h2>
                            <div className={styles.finSubtitle}>
                                {financialExpanded
                                    ? 'Overview of budget, deductions, and project value'
                                    : 'Click to expand financial metrics, deductions and budget utilization'}
                            </div>
                        </div>
                    </div>

                    <div className={styles.finHeaderRight}>
                        <div className={styles.finMetaBadges}>
                            <div className={styles.finBadgeDate}>
                                <BiCalendarAlt />
                                <span>
                                    {project.project_due_date
                                        ? `Due ${project.project_due_date.slice(0, 10)}`
                                        : 'No deadline'}
                                </span>
                            </div>
                            <div className={styles.finBadgeStatus}>
                                <BiCheckCircle />
                                <span>{project.project_progress_status || 'Hold'}</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            className={styles.finToggleBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                setFinancialExpanded((prev) => !prev);
                            }}
                        >
                            {financialExpanded ? <BiChevronDown size={18} /> : <BiChevronRight size={18} />}
                            <span>{financialExpanded ? 'Collapse' : 'Expand'}</span>
                        </button>
                    </div>
                </div>

                {/* Collapsible Financial Body */}
                {financialExpanded && (
                    <div className={styles.finExpandedContent}>
                        <div className={styles.finPanels}>
                            {/* Panel 1: Total Budget */}
                            <div className={`${styles.finPanel} ${styles.finPanelBudget}`}>
                                <div className={styles.finPanelIcon}>
                                    <BiWallet />
                                </div>
                                <span className={styles.finPanelLabel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Total Budget</span>
                                    {canEdit && canViewBudget && (
                                        <button
                                            type="button"
                                            className={styles.fieldTileEditBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openSingleFieldModal('project_total_budget', 'Total Budget ($)', 'number', [], '0.01');
                                            }}
                                            title="Edit Budget"
                                        >
                                            <BiEdit size={12} />
                                        </button>
                                    )}
                                </span>
                                <div className={styles.finPanelValue}>
                                    {!canViewBudget ? (
                                        <NaBadge text="Restricted" />
                                    ) : totalBudgetFormatted !== null ? (
                                        <>${totalBudgetFormatted}</>
                                    ) : (
                                        <NaBadge text="Not Set" />
                                    )}
                                </div>
                                <span className={styles.finPanelHint}>
                                    {!canViewBudget
                                        ? 'Permission required'
                                        : totalBudgetFormatted !== null
                                        ? 'Allocated project budget'
                                        : 'Not set yet'}
                                </span>
                            </div>

                            {/* Panel 2: Deduction */}
                            <div className={`${styles.finPanel} ${styles.finPanelDeduction}`}>
                                <div className={styles.finPanelIcon}>
                                    <BiTrendingDown />
                                </div>
                                <span className={styles.finPanelLabel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Deduction</span>
                                    {canEdit && canViewDeduction && (
                                        <button
                                            type="button"
                                            className={styles.fieldTileEditBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openSingleFieldModal('project_deduction_amount', 'Deduction Amount ($)', 'number', [], '0.01');
                                            }}
                                            title="Edit Deduction"
                                        >
                                            <BiEdit size={12} />
                                        </button>
                                    )}
                                </span>
                                <div className={styles.finPanelValue}>
                                    {!canViewDeduction ? (
                                        <NaBadge text="Restricted" />
                                    ) : deductionRaw > 0 ? (
                                        <>-${deductionFormatted}</>
                                    ) : (
                                        <>$0.00</>
                                    )}
                                </div>
                                <span className={styles.finPanelHint}>
                                    {!canViewDeduction
                                        ? 'Permission required'
                                        : deductionRaw > 0
                                        ? 'Total deductions applied'
                                        : 'No deductions'}
                                </span>
                            </div>

                            {/* Panel 3: Net Project Value */}
                            <div className={`${styles.finPanel} ${styles.finPanelNet}`}>
                                <div className={styles.finPanelIcon}>
                                    <BiTargetLock />
                                </div>
                                <span className={styles.finPanelLabel}>Net Project Value</span>
                                <div className={styles.finPanelValue}>
                                    {!canViewBudget ? (
                                        <NaBadge text="Restricted" />
                                    ) : netValueFormatted !== null ? (
                                        <>${netValueFormatted}</>
                                    ) : (
                                        <NaBadge text="Awaiting Budget" />
                                    )}
                                </div>
                                <span className={styles.finPanelHint}>
                                    {!canViewBudget
                                        ? 'Permission required'
                                        : netValueFormatted !== null
                                        ? 'Net contracted value'
                                        : 'Awaiting budget'}
                                </span>
                            </div>
                        </div>

                        {/* Donut Utilization Row */}
                        <div className={styles.finUtilizationRow}>
                            <span className={styles.finUtilLabel}>Budget Utilization</span>
                            <div className={styles.finUtilDonutWrap}>
                                <div
                                    className={styles.finUtilDonut}
                                    style={{
                                        background: `conic-gradient(#4f46e5 0% ${utilizationPct}%, #cbd5e1 ${utilizationPct}% 100%)`
                                    }}
                                >
                                    <div className={styles.finUtilDonutInner}>
                                        <span className={styles.finUtilPct}>{utilizationPct}%</span>
                                        <span className={styles.finUtilSub}>{utilizationPct}% utilized</span>
                                    </div>
                                </div>
                            </div>
                            <span className={styles.finUtilLabel} style={{ fontSize: '16px', color: '#475569' }}>
                                {utilizationPct}%
                            </span>
                        </div>

                        <div className={styles.finAlert}>
                            <BiInfoCircle />
                            <span>
                                {totalBudgetRaw === null || totalBudgetRaw === 0
                                    ? 'Set a total budget to see the net project value and utilization percentage.'
                                    : 'Financial figures are synchronized with approved project scope and client invoice deductions.'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* ========== 3. TWO COLUMN LAYOUT ========== */}
            <div className={styles.twoColLayout}>

                {/* ========== LEFT COLUMN ========== */}
                <div className={styles.column}>

                    {/* 1. Core Scope & Location */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderTitle}>
                                <BiFolder /> Project Scope & Location
                            </div>
                        </div>
                        <div className={styles.cardBody}>
                            {/* Project Address */}
                            <div className={styles.richTextBlock}>
                                <div className={styles.fieldTileHeader}>
                                    <span className={styles.fieldLabel}>
                                        <BiMapPin className={styles.headerIconAmber} /> Project Address
                                    </span>
                                    {canEdit && (
                                        <button
                                            type="button"
                                            className={styles.fieldEditBtn}
                                            onClick={() =>
                                                openSingleFieldModal('project_address', 'Project Address', 'richtext')
                                            }
                                            title="Edit Project Address"
                                        >
                                            <BiEdit size={13} />
                                        </button>
                                    )}
                                </div>
                                {project.project_address ? (
                                    <div className={styles.richTextContent}>
                                        <RichContentView html={project.project_address} />
                                    </div>
                                ) : (
                                    <NaDashed text="No project address specified" icon={<BiMapPin />} />
                                )}
                            </div>

                            {/* Main Scope */}
                            <div className={styles.richTextBlock}>
                                <div className={styles.fieldTileHeader}>
                                    <span className={styles.fieldLabel}>
                                        <BiFileBlank /> Main Scope
                                    </span>
                                    {canEdit && (
                                        <button
                                            type="button"
                                            className={styles.fieldEditBtn}
                                            onClick={() =>
                                                openSingleFieldModal('project_main_scope', 'Main Scope', 'richtext')
                                            }
                                            title="Edit Main Scope"
                                        >
                                            <BiEdit size={13} />
                                        </button>
                                    )}
                                </div>
                                {project.project_main_scope ? (
                                    <div className={styles.richTextContent}>
                                        <RichContentView html={project.project_main_scope} />
                                    </div>
                                ) : (
                                    <NaDashed text="No main scope description provided" icon={<BiFileBlank />} />
                                )}
                            </div>

                            {/* Scope Detail */}
                            <div className={styles.richTextBlock}>
                                <div className={styles.fieldTileHeader}>
                                    <span className={styles.fieldLabel}>
                                        <BiTask /> Scope Detail
                                    </span>
                                    {canEdit && (
                                        <button
                                            type="button"
                                            className={styles.fieldEditBtn}
                                            onClick={() =>
                                                openSingleFieldModal('project_scope_details', 'Scope Detail', 'richtext')
                                            }
                                            title="Edit Scope Detail"
                                        >
                                            <BiEdit size={13} />
                                        </button>
                                    )}
                                </div>
                                {project.project_scope_details ? (
                                    <div className={styles.richTextContent}>
                                        <RichContentView html={project.project_scope_details} />
                                    </div>
                                ) : (
                                    <NaDashed text="No scope details provided" icon={<BiTask />} />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. Notes & Remarks (Grouped directly after Scope & Location) */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderTitle}>
                                <BiNote className={styles.headerIconAmber} /> Notes & Remarks
                            </div>
                        </div>
                        <div className={styles.cardBody}>
                            {/* Admin Notes */}
                            <div className={styles.richTextBlock}>
                                <div className={styles.fieldTileHeader}>
                                    <span className={styles.fieldLabel}>
                                        <BiShield className={styles.headerIconAmber} /> Admin Notes
                                    </span>
                                    {canEdit && (
                                        <button
                                            type="button"
                                            className={styles.fieldEditBtn}
                                            onClick={() =>
                                                openSingleFieldModal('project_admin_notes', 'Admin Notes', 'richtext')
                                            }
                                            title="Edit Admin Notes"
                                        >
                                            <BiEdit size={13} />
                                        </button>
                                    )}
                                </div>
                                {adminNotesValue ? (
                                    <div className={styles.notesBox}>
                                        <RichContentView html={adminNotesValue} />
                                    </div>
                                ) : (
                                    <NaText text="No admin notes recorded" />
                                )}
                            </div>

                            {/* Estimator Notes */}
                            <div className={styles.richTextBlock}>
                                <div className={styles.fieldTileHeader}>
                                    <span className={styles.fieldLabel}>
                                        <BiNote className={styles.headerIconAmber} /> Estimator Notes
                                    </span>
                                    {canEdit && (
                                        <button
                                            type="button"
                                            className={styles.fieldEditBtn}
                                            onClick={() =>
                                                openSingleFieldModal('project_estimator_notes', 'Estimator Notes', 'richtext')
                                            }
                                            title="Edit Estimator Notes"
                                        >
                                            <BiEdit size={13} />
                                        </button>
                                    )}
                                </div>
                                {estimatorNotesValue ? (
                                    <div className={styles.notesBox}>
                                        <RichContentView html={estimatorNotesValue} />
                                    </div>
                                ) : (
                                    <NaText text="No estimator notes recorded" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 3. Specifications & Parameters */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderTitle}>
                                <BiFile /> Specifications & Parameters
                            </div>
                        </div>
                        <div className={styles.cardBody}>
                            <div className={styles.fieldGrid}>
                                <div className={styles.fieldTile}>
                                    <div className={styles.fieldTileHeader}>
                                        <span className={styles.fieldLabel}>
                                            <BiBriefcase /> Construction Type
                                        </span>
                                        {canEdit && (
                                            <button
                                                type="button"
                                                className={styles.fieldEditBtn}
                                                onClick={() =>
                                                    openSingleFieldModal(
                                                        'project_construction_type',
                                                        'Construction Type',
                                                        'select',
                                                        lookups.project_construction_type || ['commercial', 'residential']
                                                    )
                                                }
                                                title="Edit Construction Type"
                                            >
                                                <BiEdit size={13} />
                                            </button>
                                        )}
                                    </div>
                                    <span className={styles.fieldValue}>
                                        {project.project_construction_type ? (
                                            <span style={{ textTransform: 'capitalize' }}>
                                                {project.project_construction_type}
                                            </span>
                                        ) : (
                                            <NaBadge text="N/A" />
                                        )}
                                    </span>
                                </div>

                                <div className={styles.fieldTile}>
                                    <div className={styles.fieldTileHeader}>
                                        <span className={styles.fieldLabel}>
                                            <BiHighlight /> Area / SqFt
                                        </span>
                                        {canEdit && (
                                            <button
                                                type="button"
                                                className={styles.fieldEditBtn}
                                                onClick={() =>
                                                    openSingleFieldModal('project_area', 'Area / SqFt', 'text')
                                                }
                                                title="Edit Area / SqFt"
                                            >
                                                <BiEdit size={13} />
                                            </button>
                                        )}
                                    </div>
                                    <span className={styles.fieldValue}>
                                        {project.project_area || <NaBadge text="N/A" />}
                                    </span>
                                </div>

                                <div className={styles.fieldTile}>
                                    <div className={styles.fieldTileHeader}>
                                        <span className={styles.fieldLabel}>
                                            <BiTable /> Floor Number
                                        </span>
                                        {canEdit && (
                                            <button
                                                type="button"
                                                className={styles.fieldEditBtn}
                                                onClick={() =>
                                                    openSingleFieldModal('project_floor_number', 'Floor Number', 'text')
                                                }
                                                title="Edit Floor Number"
                                            >
                                                <BiEdit size={13} />
                                            </button>
                                        )}
                                    </div>
                                    <span className={styles.fieldValue}>
                                        {project.project_floor_number || <NaBadge text="N/A" />}
                                    </span>
                                </div>

                                <div className={styles.fieldTile}>
                                    <div className={styles.fieldTileHeader}>
                                        <span className={styles.fieldLabel}>
                                            <BiTag /> Template
                                        </span>
                                        {canEdit && (
                                            <button
                                                type="button"
                                                className={styles.fieldEditBtn}
                                                onClick={() =>
                                                    openSingleFieldModal('project_template', 'Template', 'text')
                                                }
                                                title="Edit Template"
                                            >
                                                <BiEdit size={13} />
                                            </button>
                                        )}
                                    </div>
                                    <span className={styles.fieldValue}>
                                        {project.project_template || <NaBadge text="N/A" />}
                                    </span>
                                </div>

                                <div className={styles.fieldTile}>
                                    <div className={styles.fieldTileHeader}>
                                        <span className={styles.fieldLabel}>
                                            <BiFolder /> Source
                                        </span>
                                        {canEdit && (
                                            <button
                                                type="button"
                                                className={styles.fieldEditBtn}
                                                onClick={() =>
                                                    openSingleFieldModal(
                                                        'project_source',
                                                        'Source',
                                                        'select',
                                                        lookups.project_source || ['InSource', 'OutSource']
                                                    )
                                                }
                                                title="Edit Source"
                                            >
                                                <BiEdit size={13} />
                                            </button>
                                        )}
                                    </div>
                                    <span className={styles.fieldValue}>
                                        {project.project_source || 'InSource'}
                                    </span>
                                </div>

                                <div className={styles.fieldTile}>
                                    <div className={styles.fieldTileHeader}>
                                        <span className={styles.fieldLabel}>
                                            <BiTag /> Pricing Mode
                                        </span>
                                        {canEdit && (
                                            <button
                                                type="button"
                                                className={styles.fieldEditBtn}
                                                onClick={() =>
                                                    openSingleFieldModal(
                                                        'project_pricing',
                                                        'Pricing Mode',
                                                        'select',
                                                        [
                                                            { value: 'Yes', label: 'Yes' },
                                                            { value: 'No', label: 'No' }
                                                        ]
                                                    )
                                                }
                                                title="Edit Pricing Mode"
                                            >
                                                <BiEdit size={13} />
                                            </button>
                                        )}
                                    </div>
                                    <span className={styles.fieldValue}>
                                        {project.project_pricing || <NaBadge text="N/A" />}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Drawings & Takeoff Deliverable Links */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderTitle}>
                                <BiLinkExternal className={styles.headerIconGreen} /> Drawings & Takeoff Deliverable Links
                            </div>
                        </div>
                        <div className={styles.cardBody}>
                            <div className={styles.linkRow}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {project.project_init_link ? (
                                        <a
                                            href={project.project_init_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.linkBtn}
                                        >
                                            <BiFolderOpen size={16} /> Open Initial Drawings Folder
                                            <BiLinkExternal size={12} style={{ opacity: 0.7 }} />
                                        </a>
                                    ) : (
                                        <div className={`${styles.linkBtn} ${styles.linkBtnMuted}`}>
                                            <BiBlock size={15} /> Initial Drawings <NaBadge text="N/A" />
                                        </div>
                                    )}
                                    {canEdit && (
                                        <button
                                            type="button"
                                            className={styles.fieldEditBtn}
                                            onClick={() =>
                                                openSingleFieldModal('project_init_link', 'Initial Takeoff Link / Folder', 'text', [], 'any', 'https://...')
                                            }
                                            title="Edit Initial Drawings Link"
                                        >
                                            <BiEdit size={13} />
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {project.project_final_link ? (
                                        <a
                                            href={project.project_final_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`${styles.linkBtn} ${styles.linkBtnGreen}`}
                                        >
                                            <BiCheckCircle size={16} /> Open Final Deliverable
                                            <BiLinkExternal size={12} style={{ opacity: 0.7 }} />
                                        </a>
                                    ) : (
                                        <div className={`${styles.linkBtn} ${styles.linkBtnMuted}`}>
                                            <BiFileBlank size={15} /> Final Deliverable <NaBadge text="N/A" />
                                        </div>
                                    )}
                                    {canEdit && (
                                        <button
                                            type="button"
                                            className={styles.fieldEditBtn}
                                            onClick={() =>
                                                openSingleFieldModal('project_final_link', 'Final Deliverable Link / Document', 'text', [], 'any', 'https://...')
                                            }
                                            title="Edit Final Deliverable Link"
                                        >
                                            <BiEdit size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. Custom Database Attributes */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderTitle}>
                                <BiTable /> Custom Database Attributes
                            </div>
                        </div>
                        <div className={styles.cardBody}>
                            {dynamicConfigs.length > 0 ? (
                                <div className={styles.fieldGrid}>
                                    {dynamicConfigs.map((cfg) => {
                                        const val = project[cfg.column_name];
                                        const hasVal = val !== null && val !== undefined && val !== '';
                                        return (
                                            <div key={cfg.column_name} className={styles.fieldTile}>
                                                <div className={styles.fieldTileHeader}>
                                                    <span className={styles.fieldLabel}>
                                                        <BiTag /> {cfg.label || cfg.column_name}
                                                    </span>
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            className={styles.fieldEditBtn}
                                                            onClick={() =>
                                                                openSingleFieldModal(
                                                                    cfg.column_name,
                                                                    cfg.label || cfg.column_name,
                                                                    cfg.data_type === 'number' ? 'number' : cfg.data_type === 'date' ? 'date' : 'text'
                                                                )
                                                            }
                                                            title={`Edit ${cfg.label || cfg.column_name}`}
                                                        >
                                                            <BiEdit size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                                <span className={styles.fieldValue}>
                                                    {hasVal ? String(val) : <NaBadge text="N/A" />}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}

                            <div className={styles.permissionPlaceholder}>
                                <BiLock />
                                <div>Additional custom fields are restricted or not configured.</div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* ========== RIGHT COLUMN ========== */}
                <div className={styles.column}>

                    {/* Assigned Clients with Accordion Toggles */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderTitle}>
                                <BiBuilding /> Assigned Clients
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={styles.teamCountBadge}>
                                    {assignedClients.length} {assignedClients.length === 1 ? 'client' : 'clients'}
                                </span>
                                {canEdit && (
                                    <button
                                        type="button"
                                        className={styles.btnAddClient}
                                        onClick={openAddClientModal}
                                        title="Add / Assign more clients to this project"
                                    >
                                        <BiPlusCircle size={14} /> Add Client
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className={styles.cardBody} style={{ padding: '14px', gap: '10px' }}>
                            {assignedClients.length > 0 ? (
                                <div className={styles.clientsList}>
                                    {assignedClients.map((client) => {
                                        const isAdminClient = (client.client_type || '').toLowerCase() === 'admin';
                                        const initials = getInitials(client.name || client.client_name);
                                        const clientName = client.name || client.client_name || `Client #${client.id}`;
                                        const clientTitle = client.title || client.company_name || 'No title / company';

                                        return (
                                            <div
                                                key={client.id}
                                                className={styles.clientCard}
                                                style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
                                            >
                                                {/* Client Top Header: Avatar, Name, Title, Type, Edit & Remove Actions */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div
                                                            className={`${styles.clientAvatar} ${
                                                                isAdminClient
                                                                    ? styles.clientAvatarAdmin
                                                                    : styles.clientAvatarNormal
                                                            }`}
                                                        >
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span className={styles.name} style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                                                                    {clientName}
                                                                </span>
                                                                <span
                                                                    className={`${styles.clientTypeBadge} ${
                                                                        isAdminClient
                                                                            ? styles.clientTypeBadgeAdmin
                                                                            : styles.clientTypeBadgeNormal
                                                                    }`}
                                                                >
                                                                    {isAdminClient ? (
                                                                        <>
                                                                            <BiCrown size={11} /> Admin
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <BiUser size={11} /> Normal
                                                                        </>
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                                                {clientTitle}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {canEditClient && (
                                                            <button
                                                                type="button"
                                                                className={styles.clientEditPill}
                                                                onClick={() => openClientEditModal(client)}
                                                                title="Edit Client Details (All columns)"
                                                            >
                                                                <BiEdit size={13} /> Edit
                                                            </button>
                                                        )}
                                                        {canEdit && (
                                                            <button
                                                                type="button"
                                                                style={{
                                                                    background: '#fee2e2',
                                                                    border: '1px solid #fecaca',
                                                                    color: '#dc2626',
                                                                    cursor: 'pointer',
                                                                    padding: '5px 8px',
                                                                    borderRadius: '6px',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    fontSize: '11.5px',
                                                                    fontWeight: 600,
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                                onClick={() => handleRemoveClient(client.id, clientName)}
                                                                title="Remove client from project"
                                                            >
                                                                <BiTrash size={13} /> Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Client Notes */}
                                                <div className={styles.clientNotesBlock} style={{ marginTop: '2px' }}>
                                                    <span className={styles.clientNotesLabel}>
                                                        <BiNote /> Client Notes
                                                    </span>
                                                    <div className={styles.clientNotesContent}>
                                                        {client.notes ? (
                                                            <RichContentView html={client.notes} />
                                                        ) : (
                                                            <NaText text="No notes recorded for this client" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <NaDashed text="No clients assigned to this project" icon={<BiBuilding />} />
                            )}
                        </div>
                    </div>



                    {/* Restricted Details / Access Control Notice */}
                    <div className={styles.card} style={{ border: '1px solid #eef3f9' }}>
                        <div className={styles.cardHeader} style={{ background: '#fafdff', color: '#5d738b' }}>
                            <div className={styles.cardHeaderTitle}>
                                <BiShieldQuarter style={{ color: '#a8bbd0' }} /> Restricted Details
                            </div>
                        </div>
                        <div className={styles.cardBody} style={{ padding: '18px' }}>
                            <div className={styles.permissionPlaceholder}>
                                <BiLock />
                                <div>
                                    <div style={{ fontWeight: 600, color: '#435b78', marginBottom: '4px' }}>
                                        Access-Controlled Data
                                    </div>
                                    <span style={{ fontSize: '12.5px', color: '#7d93ae' }}>
                                        {isSuperAdmin
                                            ? 'You have full SuperAdmin privileges across all fields, financials, and logs.'
                                            : 'Your role view is governed by permission policies. Financial metrics and confidential notes are strictly filtered.'}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.fieldGrid} style={{ marginTop: '16px' }}>
                                <div className={styles.fieldTile}>
                                    <span className={styles.fieldLabel}>Record Status</span>
                                    <span className={styles.fieldValue} style={{ color: '#1e3d5e' }}>
                                        {project.project_preview_status || 'Active'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity Log Preview */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderTitle}>
                                <BiTimeFive /> Recent Activity
                            </div>
                            <button
                                type="button"
                                onClick={() => setActivityOpen(true)}
                                className={styles.btnSecondary}
                                style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: '8px' }}
                            >
                                View All
                            </button>
                        </div>
                        <div className={styles.cardBody} style={{ padding: '16px 20px' }}>
                            {recentLogs.length > 0 ? (
                                <div className={styles.activityFeedList}>
                                    {recentLogs.map((log) => {
                                        const isCreated = log.action === 'created';
                                        return (
                                            <div key={log.id} className={styles.activityFeedItem}>
                                                <div
                                                    className={`${styles.activityFeedIcon} ${
                                                        isCreated ? styles.activityFeedIconGreen : styles.activityFeedIconBlue
                                                    }`}
                                                >
                                                    {isCreated ? <BiCheckCircle /> : <BiEdit />}
                                                </div>
                                                <div>
                                                    <div className={styles.activityFeedTitle}>
                                                        {log.description || `${log.action} on project`}
                                                    </div>
                                                    <div className={styles.activityFeedMeta}>
                                                        by {log.username || 'System'} · {log.created_at ? log.created_at.slice(0, 16) : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <NaDashed text="No recent activity recorded" icon={<BiHistory />} />
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* ==========================================================================
                 4. PROJECT TEAM SECTION — POWERED BY MODERN RESPONSIVE LIST
                 ========================================================================== */}
            <div className={styles.teamSection}>
                <div className={styles.teamSectionHeader}>
                    <div className={styles.teamSectionHeaderLeft}>
                        <BiUser /> Project Team
                        <span className={styles.teamCountBadge}>
                            {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'}
                        </span>
                    </div>

                    <div className={styles.teamSectionHeaderRight}>
                        <div className={styles.teamPointsSummary}>
                            <span>
                                <BiStar /> {totalPts.toFixed(1)} pts total
                            </span>
                            <span>
                                <BiCheckCircle style={{ color: '#10b981' }} /> {usedPts.toFixed(1)} pts allocated
                            </span>
                            <div className={styles.pointsBarWrap} title={`${pointsPct}% allocated`}>
                                <div className={styles.pointsBarFill} style={{ width: `${pointsPct}%` }}></div>
                            </div>
                        </div>

                        {canEdit && (
                            <button
                                type="button"
                                className={styles.btnEditPoints}
                                onClick={openTeamPointsModal}
                                title="Edit and Allocate Team Member Points"
                            >
                                <BiEdit size={14} /> Edit Team Points
                            </button>
                        )}
                    </div>
                </div>

                <div className={styles.teamListContainer}>
                    {teamMembers.length > 0 ? (
                        <div className={styles.teamList}>
                            {teamMembers.map((m, idx) => {
                                const displayName = m.name || m.full_name || m.username || 'Team Member';
                                const initials = getInitials(displayName);
                                const role = m.role_name || m.member_role || 'Estimator';
                                const pts = Number(m.points_gain || 0);
                                const steps = Array.isArray(m.steps) && m.steps.length > 0
                                    ? m.steps
                                    : ['Takeoff', 'Excel Sheet', 'Pricing'];
                                const doneCount = pts > 0 ? Math.min(steps.length, Math.ceil(steps.length * 0.6)) : 0;
                                const pct = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;
                                const isBusy = pts > 0;
                                const avatarClass =
                                    idx % 3 === 0
                                        ? styles.memberAvatarPrimary
                                        : idx % 3 === 1
                                        ? styles.memberAvatarAlt1
                                        : styles.memberAvatarAlt2;

                                return (
                                    <div key={m.id || idx} className={styles.teamListItem}>
                                        {/* Member Avatar & Role */}
                                        <div className={styles.teamMemberMain}>
                                            <div className={`${styles.teamMemberAvatar} ${avatarClass}`}>
                                                {m.avatar_url ? (
                                                    <img
                                                        src={m.avatar_url}
                                                        alt={displayName}
                                                        style={{ width: '100%', height: '100%', borderRadius: '10px' }}
                                                    />
                                                ) : (
                                                    initials
                                                )}
                                            </div>
                                            <div className={styles.teamMemberInfo}>
                                                <div className={styles.teamMemberName}>{displayName}</div>
                                                <div className={styles.teamMemberRole}>{role}</div>
                                            </div>
                                        </div>

                                        {/* Assigned Tasks / Steps */}
                                        <div className={styles.teamMemberSteps}>
                                            {steps.map((st, sIdx) => {
                                                const isDone = pts > 0 && sIdx <= doneCount - 1;
                                                return (
                                                    <span
                                                        key={sIdx}
                                                        className={`${styles.taskChip} ${
                                                            isDone
                                                                ? styles.taskChipComplete
                                                                : sIdx === doneCount
                                                                ? styles.taskChipProgress
                                                                : styles.taskChipPending
                                                        }`}
                                                    >
                                                        {isDone ? <BiCheck size={12} /> : <BiTask size={12} />} {st}
                                                    </span>
                                                );
                                            })}
                                        </div>

                                        {/* Progress Bar */}
                                        <div className={styles.teamMemberProgress}>
                                            <div className={styles.teamMemberProgressLabel}>
                                                <span style={{ color: '#64748b' }}>{doneCount}/{steps.length} done</span>
                                                <span style={{ color: '#4f46e5' }}>{pct}%</span>
                                            </div>
                                            <div className={styles.teamMemberProgressBar}>
                                                <div
                                                    className={styles.teamMemberProgressBarFill}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Points Gain & Status */}
                                        <div className={styles.teamMemberMeta}>
                                            <span className={styles.teamPointsBadge}>
                                                <BiStar size={13} /> +{pts.toFixed(1)} pts
                                            </span>
                                            <span
                                                className={`${styles.teamStatusBadge} ${
                                                    isBusy ? styles.teamStatusActive : styles.teamStatusIdle
                                                }`}
                                            >
                                                ● {isBusy ? 'In Progress' : 'Idle'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <NaBlock
                            title="No Team Members"
                            text="No team members have been assigned to this project yet."
                            icon={<BiUser size={36} />}
                        />
                    )}
                </div>
            </div>

            {/* Central Audit / Activity History Modal */}
            {activityOpen && (
                <ActivityLogViewer
                    open={activityOpen}
                    onClose={() => setActivityOpen(false)}
                    module="projects"
                    recordId={project.id}
                    title={`Activity History for Project: ${project.project_title}`}
                />
            )}

            {/* Quick Edit Project Field Modal */}
            {editModal.open && (
                <Modal
                    isOpen={editModal.open}
                    onClose={() => setEditModal((prev) => ({ ...prev, open: false }))}
                    title={editModal.title}
                    size={editModal.fields.some((f) => f.type === 'richtext') ? 'large' : 'medium'}
                >
                    <form onSubmit={handleSaveProjectFields} className={styles.modalBodyWrap}>
                        <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                            {editModal.subtitle}
                        </div>

                        {editModal.fields.map((f) => (
                            <div key={f.name} className={styles.modalFormGroup}>
                                <label className={styles.modalLabel}>
                                    {f.label}
                                    {f.required && <span style={{ color: '#ef4444' }}> *</span>}
                                </label>

                                {f.type === 'select' ? (
                                    <select
                                        className={styles.modalInput}
                                        value={editModal.values[f.name] ?? ''}
                                        onChange={(e) =>
                                            setEditModal((prev) => ({
                                                ...prev,
                                                values: { ...prev.values, [f.name]: e.target.value }
                                            }))
                                        }
                                        required={f.required}
                                    >
                                        <option value="">-- Select {f.label} --</option>
                                        {(f.options || []).map((opt) => {
                                            const val = typeof opt === 'object' ? opt.value : opt;
                                            const lbl = typeof opt === 'object' ? opt.label : opt;
                                            return (
                                                <option key={val} value={val}>
                                                    {lbl}
                                                </option>
                                            );
                                        })}
                                    </select>
                                ) : f.type === 'textarea' ? (
                                    <textarea
                                        className={styles.modalTextarea}
                                        rows={f.rows || 4}
                                        value={editModal.values[f.name] ?? ''}
                                        placeholder={f.placeholder || `Enter ${f.label}...`}
                                        onChange={(e) =>
                                            setEditModal((prev) => ({
                                                ...prev,
                                                values: { ...prev.values, [f.name]: e.target.value }
                                            }))
                                        }
                                        required={f.required}
                                    />
                                ) : f.type === 'richtext' ? (
                                    <RichTextEditor
                                        value={editModal.values[f.name] || ''}
                                        onChange={(val) =>
                                            setEditModal((prev) => ({
                                                ...prev,
                                                values: { ...prev.values, [f.name]: val }
                                            }))
                                        }
                                        placeholder={f.placeholder || `Enter ${f.label}...`}
                                        minHeight={150}
                                    />
                                ) : (
                                    <input
                                        type={f.type || 'text'}
                                        className={styles.modalInput}
                                        value={editModal.values[f.name] ?? ''}
                                        placeholder={f.placeholder || `Enter ${f.label}...`}
                                        step={f.step}
                                        onChange={(e) =>
                                            setEditModal((prev) => ({
                                                ...prev,
                                                values: { ...prev.values, [f.name]: e.target.value }
                                            }))
                                        }
                                        required={f.required}
                                    />
                                )}
                            </div>
                        ))}

                        <div className={styles.modalFooterActions}>
                            <button
                                type="button"
                                className={styles.modalCancelBtn}
                                onClick={() => setEditModal((prev) => ({ ...prev, open: false }))}
                                disabled={modalSaving}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className={styles.modalSaveBtn}
                                disabled={modalSaving}
                            >
                                {modalSaving ? <BiLoaderAlt className="spin" size={16} /> : <BiSave size={16} />}
                                Save Changes
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Edit Client Record Modal */}
            {clientModal.open && (
                <Modal
                    isOpen={clientModal.open}
                    onClose={() => setClientModal((prev) => ({ ...prev, open: false }))}
                    title={`Edit Client: ${clientModal.client?.name || clientModal.client?.title || `Client #${clientModal.client?.id}`}`}
                    size="large"
                >
                    <form onSubmit={handleSaveClient} className={styles.modalBodyWrap}>
                        <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                            Update client profile details for this project and the portal CRM.
                        </div>

                        <div className={styles.modalGrid2}>
                            <div className={styles.modalFormGroup}>
                                <label className={styles.modalLabel}>
                                    Client / Contact Name <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    className={styles.modalInput}
                                    value={clientModal.formData.name || ''}
                                    onChange={(e) =>
                                        setClientModal((prev) => ({
                                            ...prev,
                                            formData: { ...prev.formData, name: e.target.value }
                                        }))
                                    }
                                    placeholder="Full Contact Name"
                                />
                            </div>

                            <div className={styles.modalFormGroup}>
                                <label className={styles.modalLabel}>Company Name / Code</label>
                                <input
                                    type="text"
                                    className={styles.modalInput}
                                    value={clientModal.formData.title || ''}
                                    onChange={(e) =>
                                        setClientModal((prev) => ({
                                            ...prev,
                                            formData: { ...prev.formData, title: e.target.value }
                                        }))
                                    }
                                    placeholder="Company Name"
                                />
                            </div>
                        </div>

                        <div className={styles.modalGrid2}>
                            <div className={styles.modalFormGroup}>
                                <label className={styles.modalLabel}>Email Address</label>
                                <input
                                    type="email"
                                    className={styles.modalInput}
                                    value={clientModal.formData.email || ''}
                                    onChange={(e) =>
                                        setClientModal((prev) => ({
                                            ...prev,
                                            formData: { ...prev.formData, email: e.target.value }
                                        }))
                                    }
                                    placeholder="client@example.com"
                                />
                            </div>

                            <div className={styles.modalFormGroup}>
                                <label className={styles.modalLabel}>Phone Number</label>
                                <input
                                    type="tel"
                                    className={styles.modalInput}
                                    value={clientModal.formData.phone || ''}
                                    onChange={(e) =>
                                        setClientModal((prev) => ({
                                            ...prev,
                                            formData: { ...prev.formData, phone: e.target.value }
                                        }))
                                    }
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                        </div>

                        <div className={styles.modalGrid2}>
                            <div className={styles.modalFormGroup}>
                                <label className={styles.modalLabel}>Client Role Type</label>
                                <select
                                    className={styles.modalInput}
                                    value={clientModal.formData.client_type || 'normal'}
                                    onChange={(e) =>
                                        setClientModal((prev) => ({
                                            ...prev,
                                            formData: { ...prev.formData, client_type: e.target.value }
                                        }))
                                    }
                                >
                                    <option value="normal">Normal Client</option>
                                    <option value="admin">Admin Client</option>
                                </select>
                            </div>

                            <div className={styles.modalFormGroup}>
                                <label className={styles.modalLabel}>Street Address</label>
                                <input
                                    type="text"
                                    className={styles.modalInput}
                                    value={clientModal.formData.address || ''}
                                    onChange={(e) =>
                                        setClientModal((prev) => ({
                                            ...prev,
                                            formData: { ...prev.formData, address: e.target.value }
                                        }))
                                    }
                                    placeholder="Address line"
                                />
                            </div>
                        </div>

                        <div className={styles.modalGrid3}>
                            <div className={styles.modalFormGroup}>
                                <label className={styles.modalLabel}>City</label>
                                <input
                                    type="text"
                                    className={styles.modalInput}
                                    value={clientModal.formData.city || ''}
                                    onChange={(e) =>
                                        setClientModal((prev) => ({
                                            ...prev,
                                            formData: { ...prev.formData, city: e.target.value }
                                        }))
                                    }
                                    placeholder="City"
                                />
                            </div>

                            <div className={styles.modalFormGroup}>
                                <label className={styles.modalLabel}>State</label>
                                <input
                                    type="text"
                                    className={styles.modalInput}
                                    value={clientModal.formData.state || ''}
                                    onChange={(e) =>
                                        setClientModal((prev) => ({
                                            ...prev,
                                            formData: { ...prev.formData, state: e.target.value }
                                        }))
                                    }
                                    placeholder="State"
                                />
                            </div>

                            <div className={styles.modalFormGroup}>
                                <label className={styles.modalLabel}>Country</label>
                                <input
                                    type="text"
                                    className={styles.modalInput}
                                    value={clientModal.formData.country || ''}
                                    onChange={(e) =>
                                        setClientModal((prev) => ({
                                            ...prev,
                                            formData: { ...prev.formData, country: e.target.value }
                                        }))
                                    }
                                    placeholder="Country"
                                />
                            </div>
                        </div>

                        <div className={styles.modalFormGroup}>
                            <label className={styles.modalLabel}>Client Notes</label>
                            <RichTextEditor
                                value={clientModal.formData.notes || ''}
                                onChange={(val) =>
                                    setClientModal((prev) => ({
                                        ...prev,
                                        formData: { ...prev.formData, notes: val }
                                    }))
                                }
                                placeholder="Important client remarks, instructions..."
                                minHeight={110}
                            />
                        </div>

                        <div className={styles.modalFooterActions}>
                            <button
                                type="button"
                                className={styles.modalCancelBtn}
                                onClick={() => setClientModal((prev) => ({ ...prev, open: false }))}
                                disabled={modalSaving}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className={styles.modalSaveBtn}
                                disabled={modalSaving}
                            >
                                {modalSaving ? <BiLoaderAlt className="spin" size={16} /> : <BiSave size={16} />}
                                Save Client Changes
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Standalone Reusable Single-Column / Single-Field Edit Modal */}
            {singleFieldModal.isOpen && (
                <ProjectFieldEditModal
                    key={`modal_${id}_${singleFieldModal.fieldName}`}
                    isOpen={singleFieldModal.isOpen}
                    onClose={() => setSingleFieldModal(INITIAL_SINGLE_FIELD_MODAL)}
                    projectId={id}
                    projectTitle={project?.project_title}
                    fieldName={singleFieldModal.fieldName}
                    fieldLabel={singleFieldModal.fieldLabel}
                    fieldType={singleFieldModal.fieldType}
                    initialValue={singleFieldModal.initialValue}
                    options={singleFieldModal.options}
                    step={singleFieldModal.step}
                    placeholder={singleFieldModal.placeholder}
                    helperText={singleFieldModal.helperText}
                    onSuccess={async () => {
                        await fetchProjectData();
                    }}
                />
            )}

            {/* Real-time Team Points Allocation Modal */}
            {teamPointsModalOpen && (
                <Modal
                    isOpen={teamPointsModalOpen}
                    onClose={() => setTeamPointsModalOpen(false)}
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BiAward size={20} color="#4f46e5" />
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                    Edit Team Member Points
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                                    Allocate points across team members with real-time remaining points calculation
                                </div>
                            </div>
                        </div>
                    }
                    width="620px"
                >
                    <form onSubmit={handleSaveTeamPoints} style={{ padding: '6px 0' }}>
                        {/* Live Points Header Summary Box */}
                        <div style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '14px 18px',
                            marginBottom: '18px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                                        Total Project Points
                                    </div>
                                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                                        {Number(project?.project_points || 0).toFixed(1)} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>pts</span>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                                        Allocated Points
                                    </div>
                                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#4f46e5' }}>
                                        {modalAllocatedPoints.toFixed(1)} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>pts</span>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                                        Points Left
                                    </div>
                                    <div style={{
                                        fontSize: '20px',
                                        fontWeight: 800,
                                        color: modalRemainingPoints < 0 ? '#dc2626' : '#059669'
                                    }}>
                                        {modalRemainingPoints < 0 ? `-${Math.abs(modalRemainingPoints).toFixed(1)}` : modalRemainingPoints.toFixed(1)} <span style={{ fontSize: '13px', fontWeight: 500, color: modalRemainingPoints < 0 ? '#dc2626' : '#059669' }}>pts</span>
                                    </div>
                                </div>
                            </div>

                            {/* Live Progress Bar */}
                            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${Math.min(100, Math.max(0, (modalAllocatedPoints / Math.max(1, Number(project?.project_points || 1))) * 100))}%`,
                                        background: modalRemainingPoints < 0 ? '#ef4444' : 'linear-gradient(90deg, #4f46e5, #06b6d4)',
                                        transition: 'width 0.2s ease, background 0.2s ease'
                                    }}
                                />
                            </div>

                            {modalRemainingPoints < 0 && (
                                <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <BiErrorCircle /> Total allocated points exceeds project budget by {Math.abs(modalRemainingPoints).toFixed(1)} pts!
                                </div>
                            )}
                        </div>

                        {/* List of Members */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                            {teamMembers.map((m) => {
                                const displayName = m.name || m.full_name || m.username || `User #${m.user_id}`;
                                const initials = getInitials(displayName);
                                const currentPts = memberPointsMap[m.id] !== undefined ? memberPointsMap[m.id] : Number(m.points_gain || 0);

                                return (
                                    <div
                                        key={m.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            background: '#ffffff',
                                            border: '1px solid #e2e8f0'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '34px',
                                                height: '34px',
                                                borderRadius: '8px',
                                                background: '#e0e7ff',
                                                color: '#4338ca',
                                                fontWeight: 700,
                                                fontSize: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {m.avatar_url ? (
                                                    <img src={m.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '8px' }} />
                                                ) : initials}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                                                    {displayName}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                    {m.role_name || m.member_role || 'Estimator'}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>Points:</span>
                                            <input
                                                type="number"
                                                step="0.5"
                                                min="0"
                                                value={currentPts}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setMemberPointsMap((prev) => ({
                                                        ...prev,
                                                        [m.id]: val === '' ? 0 : Number(val)
                                                    }));
                                                }}
                                                style={{
                                                    width: '90px',
                                                    padding: '6px 10px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #cbd5e1',
                                                    fontSize: '13px',
                                                    fontWeight: 600,
                                                    textAlign: 'right',
                                                    color: '#0f172a',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '10px',
                            marginTop: '18px',
                            paddingTop: '14px',
                            borderTop: '1px solid #e2e8f0'
                        }}>
                            <button
                                type="button"
                                onClick={() => setTeamPointsModalOpen(false)}
                                disabled={teamPointsSaving}
                                className={styles.modalCancelBtn}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={teamPointsSaving}
                                className={styles.modalSaveBtn}
                            >
                                {teamPointsSaving ? <BiLoaderAlt className="spin" size={16} /> : <BiSave size={16} />}
                                Save Points Allocation
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Add / Assign More Clients to Project Modal */}
            {addClientModalOpen && (
                <Modal
                    isOpen={addClientModalOpen}
                    onClose={() => setAddClientModalOpen(false)}
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BiBuilding size={20} color="#4f46e5" />
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                    Assign Clients to Project
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                                    Filter by client status/type and assign to Project #{id}
                                </div>
                            </div>
                        </div>
                    }
                    width="680px"
                >
                    <div style={{ padding: '6px 0' }}>
                        {/* Status / Type Filter & Search Controls */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1', minWidth: '220px' }}>
                                <input
                                    type="text"
                                    placeholder="Search clients by name, company, or email..."
                                    value={clientSearchTerm}
                                    onChange={(e) => setClientSearchTerm(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '7px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '13px',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div style={{ width: '180px' }}>
                                <select
                                    value={clientFilterType}
                                    onChange={(e) => setClientFilterType(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '7px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '13px',
                                        background: '#ffffff',
                                        outline: 'none',
                                        fontWeight: 600,
                                        color: '#334155'
                                    }}
                                >
                                    <option value="all">All Clients</option>
                                    <option value="admin">Admin Clients</option>
                                    <option value="normal">Normal Clients</option>
                                </select>
                            </div>
                        </div>

                        {/* Client List */}
                        <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                            {loadingClients ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                    <BiLoaderAlt className="spin" size={24} style={{ color: '#4f46e5', marginBottom: '8px' }} />
                                    <div>Loading available clients...</div>
                                </div>
                            ) : filteredAvailableClients.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                    <BiBuilding size={32} style={{ marginBottom: '8px' }} />
                                    <div>No clients match the selected filter.</div>
                                </div>
                            ) : (
                                filteredAvailableClients.map((cl) => {
                                    const clientName = cl.name || cl.title || `Client #${cl.id}`;
                                    const initials = getInitials(clientName);
                                    const isAdmin = (cl.client_type || '').toLowerCase() === 'admin';
                                    const alreadyAssigned = (project?.clients || []).some((c) => c.id === cl.id);
                                    const isAssigning = assigningClientId === cl.id;

                                    return (
                                        <div
                                            key={cl.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '10px 14px',
                                                borderRadius: '8px',
                                                background: alreadyAssigned ? '#f8fafc' : '#ffffff',
                                                border: `1px solid ${alreadyAssigned ? '#e2e8f0' : '#cbd5e1'}`
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '34px',
                                                    height: '34px',
                                                    borderRadius: '8px',
                                                    background: isAdmin ? '#fef3c7' : '#e0e7ff',
                                                    color: isAdmin ? '#b45309' : '#4338ca',
                                                    fontWeight: 700,
                                                    fontSize: '12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {initials}
                                                </div>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                                                            {clientName}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            background: isAdmin ? '#fef3c7' : '#f1f5f9',
                                                            color: isAdmin ? '#b45309' : '#475569'
                                                        }}>
                                                            {isAdmin ? 'ADMIN' : 'NORMAL'}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                        {cl.title ? `${cl.title} · ` : ''}{cl.email || cl.phone || `ID #${cl.id}`}
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                {alreadyAssigned ? (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '12px',
                                                        fontWeight: 600,
                                                        color: '#059669',
                                                        background: '#ecfdf5',
                                                        border: '1px solid #a7f3d0',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px'
                                                    }}>
                                                        <BiCheck size={14} /> Assigned
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAssignClient(cl)}
                                                        disabled={isAssigning}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            background: '#4f46e5',
                                                            color: '#ffffff',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            padding: '5px 12px',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            cursor: isAssigning ? 'not-allowed' : 'pointer'
                                                        }}
                                                    >
                                                        {isAssigning ? <BiLoaderAlt className="spin" size={14} /> : <BiPlusCircle size={14} />}
                                                        Assign
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            marginTop: '16px',
                            paddingTop: '12px',
                            borderTop: '1px solid #e2e8f0'
                        }}>
                            <button
                                type="button"
                                onClick={() => setAddClientModalOpen(false)}
                                className={styles.modalCancelBtn}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ProjectView;
