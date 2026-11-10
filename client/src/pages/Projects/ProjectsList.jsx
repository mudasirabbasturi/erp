import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    BiPlus,
    BiRefresh,
    BiShow,
    BiEdit,
    BiTrash,
    BiColumns,
    BiFolder,
    BiErrorCircle,
    BiChevronLeft,
    BiChevronRight,
    BiCog,
    BiLayer,
    BiUser,
    BiUserPlus,
    BiUserCheck,
    BiLock,
    BiLockOpen,
    BiGroup,
    BiTrophy,
    BiCrown,
    BiCheckCircle,
    BiLinkExternal,
    BiAward,
    BiSave,
    BiLoaderAlt,
    BiBot,
    BiRuler
} from 'react-icons/bi';
import apiClient from '../../api/client';
import AgGridTable from '../../components/Datatable/AgGridTable';
import Modal from '../../components/ui/Modal/Modal';
import RichTextEditor, { stripHtml } from '../../components/ui/RichTextEditor';
import ProjectFieldEditModal from '../../components/Projects/ProjectFieldEditModal';
import AIAssistantModal from '../../components/AI/AIAssistantModal';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import ActivityLogViewer from '../../components/ActivityLogs/ActivityLogViewer';
import StatusGroupModal from './StatusGroupModal';
import JoinProjectModal from './JoinProjectModal';
import AddEditPointModal from './AddEditPointModal';
import { getMediaUrl } from '../../utils/media';
import styles from './Projects.module.css';

const slugify = (text) => (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

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
            return styles.statusPending;
    }
};

// Helper to get clients by type (admin, normal, etc.)
const getClientsByType = (data, type) => {
    if (!data) return [];
    let list = Array.isArray(data.clients) ? data.clients : [];
    if (list.length === 0 && data.client_name) {
        list = [{
            name: data.client_name,
            title: data.client_title || data.client_code || '',
            client_type: data.client_type || 'normal',
            notes: data.client_notes || ''
        }];
    }
    const targetType = (type || 'normal').toLowerCase().trim();
    return list.filter(c => (c.client_type || 'normal').toLowerCase().trim() === targetType);
};

const formatClientFieldByType = (data, type, field) => {
    const clients = getClientsByType(data, type);
    if (!clients || clients.length === 0) return '';
    return clients
        .map(c => {
            if (field === 'title') return (c.title || c.company_name || '').trim();
            if (field === 'name') return (c.name || c.client_name || '').trim();
            if (field === 'notes') return stripHtml(c.notes || '').trim();
            return '';
        })
        .filter(Boolean)
        .join(', ');
};

const CountdownTimer = React.memo(({ dueDateStr }) => {
    const calcTimeLeft = useCallback(() => {
        if (!dueDateStr) return null;
        const dueDate = new Date(dueDateStr);
        if (isNaN(dueDate.getTime())) return null;
        const now = new Date();
        const diffMs = dueDate.getTime() - now.getTime();
        if (diffMs <= 0) return [0, 0, 0, 0, true];

        const days = Math.floor(diffMs / 86400000);
        const hrs = Math.floor((diffMs % 86400000) / 3600000);
        const mins = Math.floor(((diffMs % 86400000) % 3600000) / 60000);
        const secs = Math.floor((((diffMs % 86400000) % 3600000) % 60000) / 1000);
        return [days, hrs, mins, secs, false];
    }, [dueDateStr]);

    const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft());

    useEffect(() => {
        setTimeLeft(calcTimeLeft());
        const timer = setInterval(() => {
            setTimeLeft(calcTimeLeft());
        }, 1000);
        return () => clearInterval(timer);
    }, [calcTimeLeft]);

    if (!timeLeft) {
        return <span style={{ color: '#cbd5e1' }}>—</span>;
    }

    const [days, hrs, mins, secs, expired] = timeLeft;

    const baseBtnStyle = {
        padding: '2px 5px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 700,
        fontFamily: 'Consolas, monospace',
        lineHeight: 1.2,
        cursor: 'default',
        borderWidth: '1px',
        borderStyle: 'solid',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '24px'
    };

    return (
        <div
            className={expired ? 'text-danger' : ''}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                height: '100%',
                color: expired ? '#dc2626' : undefined
            }}
            title={expired ? 'Project Due Date Expired' : `${days}d ${hrs}h ${mins}m ${secs}s remaining`}
        >
            <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                style={{
                    ...baseBtnStyle,
                    color: expired ? '#dc2626' : '#2563eb',
                    borderColor: expired ? '#fca5a5' : '#93c5fd',
                    background: expired ? '#fef2f2' : '#eff6ff'
                }}
            >
                {String(days).padStart(2, '0')}
            </button>
            <button
                type="button"
                className="btn btn-sm btn-outline-warning"
                style={{
                    ...baseBtnStyle,
                    color: expired ? '#dc2626' : '#d97706',
                    borderColor: expired ? '#fca5a5' : '#fcd34d',
                    background: expired ? '#fef2f2' : '#fffbeb'
                }}
            >
                {String(hrs).padStart(2, '0')}
            </button>
            <button
                type="button"
                className="btn btn-sm btn-outline-info"
                style={{
                    ...baseBtnStyle,
                    color: expired ? '#dc2626' : '#0891b2',
                    borderColor: expired ? '#fca5a5' : '#67e8f9',
                    background: expired ? '#fef2f2' : '#ecfeff'
                }}
            >
                {String(mins).padStart(2, '0')}
            </button>
            <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                style={{
                    ...baseBtnStyle,
                    color: '#dc2626',
                    borderColor: '#fca5a5',
                    background: '#fef2f2'
                }}
            >
                {String(secs).padStart(2, '0')}
            </button>
        </div>
    );
});

const ProjectsList = () => {
    const navigate = useNavigate();
    const { statusSlug, groupSlug } = useParams();
    const toast = useToast();
    const { setActions } = usePageActions();
    const { user: authUser } = useAuth();

    const isAdmin = Boolean(
        authUser?.is_super_admin === 1 ||
        authUser?.role_id === 1 ||
        authUser?.role_id === 2 ||
        authUser?.role_name?.toLowerCase().includes('admin') ||
        (authUser?.roles && authUser.roles.some(r => ['super-admin', 'admin', 'administrator'].includes(r.slug))) ||
        (authUser?.permissions && (authUser.permissions.includes('add_edit_score') || authUser.permissions.includes('update_score')))
    );

    const canEdit = Boolean(
        isAdmin ||
        authUser?.is_super_admin === 1 ||
        (authUser?.permissions && (authUser.permissions.includes('projects.edit') || authUser.permissions.includes('projects.update')))
    );

    const [projects, setProjects] = useState([]);
    const [columnConfigs, setColumnConfigs] = useState([]);
    const [statusSummary, setStatusSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activityProject, setActivityProject] = useState(null);
    const [activityOpen, setActivityOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

    // Standalone Reusable Single-Column / Single-Field Edit Modal state
    const INITIAL_SINGLE_FIELD_MODAL = {
        isOpen: false,
        projectId: null,
        projectTitle: '',
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

    // Client Edit Modal state for double-clicking client columns
    const [clientModal, setClientModal] = useState({
        open: false,
        client: null,
        formData: {
            title: '',
            name: '',
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
    const [clientModalSaving, setClientModalSaving] = useState(false);

    // Team Member Join / Edit Modal state
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [selectedProjectForJoin, setSelectedProjectForJoin] = useState(null);
    const [selectedMemberForEdit, setSelectedMemberForEdit] = useState(null);

    // Team Points Modal state (Admin only point drawer/modal)
    const [pointModalOpen, setPointModalOpen] = useState(false);
    const [selectedProjectForPoints, setSelectedProjectForPoints] = useState(null);
    const [selectedMemberForPoints, setSelectedMemberForPoints] = useState(null);

    // AI Assistant Project Modal state
    const [aiAssistantProject, setAiAssistantProject] = useState(null);

    // Horizontal scroll tracking for standalone status row
    const scrollTrackRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Dynamic enum statuses and groups from backend
    const dynamicEnumStatuses = useMemo(() => {
        return statusSummary?.enum_statuses || [];
    }, [statusSummary]);

    const dynamicStatusGroups = useMemo(() => {
        return statusSummary?.groups || [];
    }, [statusSummary]);

    // Dynamic enum types for clients (guarantees admin, normal first, then any extra dynamic enum types)
    const clientTypes = useMemo(() => {
        const typesSet = new Set(['admin', 'normal']);
        (projects || []).forEach(p => {
            const cls = p.clients || [];
            cls.forEach(c => {
                if (c.client_type) {
                    typesSet.add(c.client_type.toLowerCase().trim());
                }
            });
            if (p.client_type) {
                typesSet.add(p.client_type.toLowerCase().trim());
            }
        });
        const base = ['admin', 'normal'];
        const extras = Array.from(typesSet).filter(t => !base.includes(t)).sort();
        return [...base, ...extras];
    }, [projects]);

    // Determine active filter state from URL route parameters
    const activeFilter = useMemo(() => {
        if (groupSlug) {
            return { type: 'group', value: groupSlug };
        }
        if (statusSlug) {
            return { type: 'status', value: statusSlug };
        }
        return { type: 'group', value: 'all' };
    }, [groupSlug, statusSlug]);

    const loadProjects = useCallback(async () => {
        setLoading(true);
        try {
            const queryParams = { per_page: 500 };
            if (groupSlug && groupSlug !== 'all') {
                queryParams.group = groupSlug;
            } else if (statusSlug && statusSlug !== 'all') {
                queryParams.status = statusSlug;
            }

            const [projectsRes, colsRes, summaryRes] = await Promise.all([
                apiClient.get('/projects', queryParams),
                apiClient.get('/columns/config/projects'),
                apiClient.get('/projects/summary')
            ]);

            if (projectsRes.success) {
                setProjects(projectsRes.data || []);
            }

            if (colsRes.success && colsRes.data) {
                setColumnConfigs(colsRes.data);
            }

            if (summaryRes.success && summaryRes.data) {
                setStatusSummary(summaryRes.data);
            }
        } catch (err) {
            toast.error('Load Error', err.message || 'Failed to load projects');
        } finally {
            setLoading(false);
        }
    }, [groupSlug, statusSlug, toast]);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    // Ensure breadcrumbs action area is clean
    useEffect(() => {
        setActions(null);
        return () => {
            setActions(null);
        };
    }, [setActions]);

    // Check scroll state of the horizontal status track
    const checkScrollState = useCallback(() => {
        const el = scrollTrackRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, []);

    useEffect(() => {
        const el = scrollTrackRef.current;
        if (!el) return;
        checkScrollState();
        el.addEventListener('scroll', checkScrollState);
        window.addEventListener('resize', checkScrollState);
        return () => {
            el.removeEventListener('scroll', checkScrollState);
            window.removeEventListener('resize', checkScrollState);
        };
    }, [checkScrollState, dynamicEnumStatuses]);

    const handleScrollLeft = () => {
        if (scrollTrackRef.current) {
            scrollTrackRef.current.scrollBy({ left: -240, behavior: 'smooth' });
        }
    };

    const handleScrollRight = () => {
        if (scrollTrackRef.current) {
            scrollTrackRef.current.scrollBy({ left: 240, behavior: 'smooth' });
        }
    };

    // Route Navigation Handlers
    const handleSelectGroup = (slug) => {
        if (slug === 'all') {
            navigate('/projects');
        } else {
            navigate(`/projects/group/${slug}`);
        }
    };

    const handleSelectStatus = (st) => {
        const sSlug = slugify(st);
        if (activeFilter.type === 'status' && activeFilter.value === sSlug) {
            navigate('/projects');
        } else {
            navigate(`/projects/status/${sSlug}`);
        }
    };

    const handleSelectLate = () => {
        if (activeFilter.type === 'status' && activeFilter.value === 'late') {
            navigate('/projects');
        } else {
            navigate('/projects/status/late');
        }
    };

    // Delete Project
    const handleDeleteProject = useCallback(async (project) => {
        if (!window.confirm(`Are you sure you want to delete project "${project.project_title}" (#${project.id})?`)) return;

        try {
            const res = await apiClient.delete(`/projects/${project.id}`);
            if (res.success) {
                toast.success('Project Deleted', `Project "${project.project_title}" has been deleted.`);
                loadProjects();
            } else {
                toast.error('Delete Failed', res.message || 'Failed to delete project');
            }
        } catch (err) {
            toast.error('Delete Failed', err.message);
        }
    }, [loadProjects, toast]);

    const handleOpenActivity = useCallback((project) => {
        setActivityProject(project);
        setActivityOpen(true);
    }, []);

    // Team Member Join / Edit Handlers
    const handleOpenJoinTeam = useCallback((project, memberToEdit = null) => {
        setSelectedProjectForJoin(project);
        setSelectedMemberForEdit(memberToEdit);
        setIsJoinModalOpen(true);
    }, []);

    const handleLeaveTeam = useCallback(async (project, memberId) => {
        if (!window.confirm(`Are you sure you want to remove this member from project "${project.project_title}"?`)) return;
        try {
            const res = await apiClient.delete(`/projects/${project.id}/team/${memberId}`);
            if (res.success) {
                toast.success('Removed', res.message || 'Removed from team');
                loadProjects();
            } else {
                toast.error('Error', res.message || 'Failed to remove member');
            }
        } catch (err) {
            toast.error('Error', err.message);
        }
    }, [toast, loadProjects]);

    const handleOpenPoints = useCallback((project, memberId = null) => {
        setSelectedProjectForPoints(project);
        setSelectedMemberForPoints(memberId);
        setPointModalOpen(true);
    }, []);

    // Open Standalone Single Column Edit Modal
    const openSingleFieldModal = useCallback((project, fieldName, fieldLabel, fieldType = 'text', options = [], step = 'any', placeholder = '', helperText = '') => {
        let currentVal = project?.[fieldName] ?? '';
        setSingleFieldModal({
            isOpen: true,
            projectId: project?.id,
            projectTitle: project?.project_title || `Project #${project?.id}`,
            fieldName,
            fieldLabel: fieldLabel || fieldName,
            fieldType,
            initialValue: currentVal,
            options,
            step,
            placeholder,
            helperText
        });
    }, []);

    // Open Client Edit Modal
    const openClientEditModal = useCallback((client) => {
        if (!client) return;
        setClientModal({
            open: true,
            client,
            formData: {
                title: client.title || client.company_name || '',
                name: client.name || client.client_name || '',
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
    }, []);

    // Save Client changes
    const handleSaveClient = async (e) => {
        if (e) e.preventDefault();
        if (!clientModal.client?.id) return;
        setClientModalSaving(true);
        try {
            const res = await apiClient.put(`/clients/${clientModal.client.id}`, clientModal.formData);
            if (res.success) {
                toast.success(
                    'Client Updated',
                    `Client '${clientModal.formData.name || clientModal.formData.title}' updated successfully`
                );
                setClientModal((prev) => ({ ...prev, open: false }));
                await loadProjects();
            } else {
                toast.error('Update Failed', res.message || 'Failed to update client');
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to update client');
        } finally {
            setClientModalSaving(false);
        }
    };

    // Double-Click Cell Handler for Instant In-line / Single Column Editing
    const handleCellDoubleClicked = useCallback((event) => {
        const { data: project, colDef } = event;
        if (!project || !colDef) return;

        const field = colDef.field;
        const colId = colDef.colId || field;

        // Skip non-editable actions & countdown
        if (colId === 'project_countdown' || colDef.headerName === 'Actions') {
            return;
        }

        // 1. Team Members cell double-clicked: open join/update tasks modal
        if (field === 'team_members') {
            const members = project.project_team_members || project.team_members || [];
            const currentUserMember = project.current_user_member || members.find(m => (m.user?.id || m.user_id) === authUser?.id);
            handleOpenJoinTeam(project, currentUserMember);
            return;
        }

        // 2. Project Points cell double-clicked: open points allocation modal
        if (field === 'project_points') {
            if (isAdmin) {
                handleOpenPoints(project);
            } else {
                toast.warning('Admin Only', 'Only administrators can allocate project points.');
            }
            return;
        }

        // Check general edit permission for project & client fields
        if (!canEdit) {
            toast.warning('Permission Denied', 'You do not have permission to edit projects.');
            return;
        }

        // 3. Dynamic Client Columns (colId e.g. client_title_admin, client_name_normal, client_notes_admin)
        if (colId && colId.startsWith('client_')) {
            const parts = colId.split('_');
            const type = parts.slice(2).join('_') || 'normal';
            const matchedClients = getClientsByType(project, type);
            if (matchedClients.length > 0) {
                openClientEditModal(matchedClients[0]);
                return;
            } else {
                toast.info('No Client', `No '${type}' client is assigned to this project yet.`);
                return;
            }
        }

        // 4. Standard Project Columns
        if (field === 'project_title') {
            openSingleFieldModal(project, 'project_title', 'Project Title', 'text');
            return;
        }

        if (field === 'project_progress_status') {
            openSingleFieldModal(project, 'project_progress_status', 'Progress Status', 'select', dynamicEnumStatuses);
            return;
        }

        if (field === 'is_project_late') {
            openSingleFieldModal(project, 'is_project_late', 'Late Delivery Flag', 'toggle');
            return;
        }

        if (field === 'project_total_budget') {
            openSingleFieldModal(project, 'project_total_budget', 'Total Budget ($)', 'number', [], '0.01');
            return;
        }

        if (field === 'project_deduction_amount') {
            openSingleFieldModal(project, 'project_deduction_amount', 'Deduction Amount ($)', 'number', [], '0.01');
            return;
        }

        if (field === 'project_pricing' || field === 'pricing') {
            openSingleFieldModal(project, 'project_pricing', 'Pricing Mode', 'select', [
                { value: 'Yes', label: 'Yes' },
                { value: 'No', label: 'No' }
            ]);
            return;
        }

        if (field === 'project_construction_type') {
            openSingleFieldModal(project, 'project_construction_type', 'Construction Type', 'select', [
                { value: 'commercial', label: 'Commercial' },
                { value: 'residential', label: 'Residential' }
            ]);
            return;
        }

        if (field === 'project_source') {
            openSingleFieldModal(project, 'project_source', 'Source', 'select', [
                { value: 'InSource', label: 'InSource' },
                { value: 'OutSource', label: 'OutSource' }
            ]);
            return;
        }

        if (field === 'project_preview_status' || field === 'preview_status') {
            openSingleFieldModal(project, 'project_preview_status', 'Visibility', 'select', [
                { value: 'active', label: 'Active' },
                { value: 'draft', label: 'Draft' }
            ]);
            return;
        }

        if (field === 'project_due_date') {
            openSingleFieldModal(project, 'project_due_date', 'Due Date', 'date');
            return;
        }

        if (field === 'project_address') {
            openSingleFieldModal(project, 'project_address', 'Site Address', 'richtext');
            return;
        }

        if (field === 'project_init_link') {
            openSingleFieldModal(project, 'project_init_link', 'Initial Takeoff Link / Folder', 'text', [], 'any', 'https://...');
            return;
        }

        if (field === 'project_final_link') {
            openSingleFieldModal(project, 'project_final_link', 'Final Deliverable Link / Document', 'text', [], 'any', 'https://...');
            return;
        }

        if (field === 'project_main_scope') {
            openSingleFieldModal(project, 'project_main_scope', 'Main Scope', 'richtext');
            return;
        }

        if (field === 'project_scope_details') {
            openSingleFieldModal(project, 'project_scope_details', 'Scope Details', 'richtext');
            return;
        }

        if (field === 'project_estimator_notes' || field === 'project_notes') {
            openSingleFieldModal(project, 'project_estimator_notes', 'Estimator Notes', 'richtext');
            return;
        }

        if (field === 'project_admin_notes') {
            openSingleFieldModal(project, 'project_admin_notes', 'Admin Notes', 'richtext');
            return;
        }

        // 5. Any active dynamic/custom column
        if (field) {
            const cfg = (columnConfigs || []).find(c => c.column_name === field);
            const label = cfg?.label || colDef.headerName || field;
            let type = 'text';
            let options = [];

            if (['project_pricing', 'pricing'].includes(field)) {
                type = 'select';
                options = [
                    { value: 'Yes', label: 'Yes' },
                    { value: 'No', label: 'No' }
                ];
            } else if (['project_source', 'source'].includes(field)) {
                type = 'select';
                options = [
                    { value: 'InSource', label: 'InSource' },
                    { value: 'OutSource', label: 'OutSource' }
                ];
            } else if (['project_construction_type', 'construction_type'].includes(field)) {
                type = 'select';
                options = [
                    { value: 'commercial', label: 'Commercial' },
                    { value: 'residential', label: 'Residential' }
                ];
            } else if (cfg?.data_type === 'enum' || cfg?.data_type === 'select') {
                type = 'select';
                options = cfg.options || [];
            } else if (['decimal', 'numeric', 'int', 'integer', 'float', 'double'].includes(cfg?.data_type)) {
                type = 'number';
            } else if (['date', 'datetime', 'timestamp'].includes(cfg?.data_type)) {
                type = 'date';
            } else if (['text', 'longtext', 'mediumtext'].includes(cfg?.data_type) || field.includes('notes') || field.includes('scope') || field.includes('address')) {
                type = 'richtext';
            }

            openSingleFieldModal(project, field, label, type, options);
        }
    }, [canEdit, isAdmin, authUser, dynamicEnumStatuses, columnConfigs, handleOpenJoinTeam, handleOpenPoints, openSingleFieldModal, openClientEditModal, toast]);

    // Filter projects based on the active status pill or group filter
    const filteredProjects = useMemo(() => {
        if (activeFilter.type === 'status') {
            if (activeFilter.value === 'late') {
                return projects.filter(p => p.is_project_late === 1);
            }
            return projects.filter(p => {
                const s = slugify(p.project_progress_status);
                return s === activeFilter.value || p.project_progress_status === activeFilter.value;
            });
        }
        if (activeFilter.type === 'group' && activeFilter.value !== 'all') {
            const grp = dynamicStatusGroups.find(g => g.group_slug === activeFilter.value);
            if (grp) {
                const stList = JSON.parse(grp.statuses || '[]');
                const conds = JSON.parse(grp.filter_conditions || '{}');
                if (stList.includes('*')) return projects;
                return projects.filter(p => {
                    const matchStatus = stList.includes(p.project_progress_status);
                    const matchLate = conds?.is_late ? p.is_project_late === 1 : false;
                    return matchStatus || matchLate;
                });
            }
        }
        return projects;
    }, [projects, activeFilter, dynamicStatusGroups]);

    // Dynamically build AG Grid columns as clean flat list (no column groups, no detail views)
    const columnDefs = useMemo(() => {
        // Known mapped fields to avoid duplication in custom columns
        const mappedFields = new Set([
            'id', 'project_title', 'project_progress_status', 'is_project_late',
            'client_id', 'client_name', 'client_type', 'client_email', 'client_phone', 'client_city',
            'project_total_budget', 'project_deduction_amount', 'project_construction_type', 'project_source',
            'project_due_date', 'created_at', 'updated_at',
            'project_points', 'team_members',
            'project_address', 'project_init_link', 'project_final_link',
            'project_main_scope', 'project_scope_details', 'project_estimator_notes', 'project_admin_notes'
        ]);

        const defs = [
            {
                headerName: 'Team Members',
                field: 'team_members',
                minWidth: 200,
                flex: 1,
                valueGetter: (params) => {
                    const members = params.data?.project_team_members || params.data?.team_members || [];
                    return members
                        .map((m) => m.user?.name || m.name || m.username)
                        .filter(Boolean)
                        .join(", ");
                },
                cellRenderer: (p) => {
                    if (!p.data) return null;
                    const project = p.data;
                    const members = project.project_team_members || project.team_members || [];
                    const isJoined = project.is_joined || members.some(m => (m.user?.id || m.user_id) === authUser?.id);
                    const currentUserMember = project.current_user_member || members.find(m => (m.user?.id || m.user_id) === authUser?.id);
                    const names = p.value || members.map(m => m.user?.name || m.name || m.username).filter(Boolean).join(", ");

                    if (members.length === 0) {
                        return (
                            <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => handleOpenJoinTeam(project, null)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: '#eff6ff',
                                        border: '1px solid #bfdbfe',
                                        color: '#2563eb',
                                        padding: '3px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                    title="Join Project"
                                >
                                    <BiLock size={13} /> Join
                                </button>
                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => handleOpenPoints(project)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            background: '#fef3c7',
                                            border: '1px solid #fde68a',
                                            color: '#b45309',
                                            padding: '3px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                        title="Edit Team Member Points Allocation"
                                    >
                                        <BiAward size={12} /> Points
                                    </button>
                                )}
                                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>
                                    No one has joined
                                </span>
                            </div>
                        );
                    }

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', width: '100%', gap: '3px' }}>
                            {/* Action buttons and Avatar Group row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {/* Quick Join / Edit / Leave buttons */}
                                {isJoined ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenJoinTeam(project, currentUserMember)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                                background: '#e0e7ff',
                                                border: '1px solid #c7d2fe',
                                                color: '#4338ca',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                            title="Update Your Project Tasks & Status"
                                        >
                                            <BiLockOpen size={12} /> Update Tasks
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleLeaveTeam(project, currentUserMember?.id)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                background: '#fff1f2',
                                                border: '1px solid #fecdd3',
                                                color: '#e11d48',
                                                padding: '2px 5px',
                                                borderRadius: '4px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                            title="Leave / Delete from Joined Member"
                                        >
                                            <BiTrash size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleOpenJoinTeam(project, null)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            background: '#eff6ff',
                                            border: '1px solid #bfdbfe',
                                            color: '#2563eb',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                        title="Join Project"
                                    >
                                        <BiLock size={12} /> Join
                                    </button>
                                )}

                                {/* Edit Team Member Points Allocation Button */}
                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => handleOpenPoints(project)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            background: '#fef3c7',
                                            border: '1px solid #fde68a',
                                            color: '#b45309',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                        title="Edit Team Member Points Allocation"
                                    >
                                        <BiAward size={12} /> Points
                                    </button>
                                )}

                                {/* Avatars */}
                                <div style={{ display: 'flex', alignItems: 'center', marginLeft: '2px' }}>
                                    {members.slice(0, 4).map((m, idx) => {
                                        const avatarSrc = (m.avatar_url || m.avatar) ? getMediaUrl(m.avatar_url || m.avatar) : null;
                                        const mName = m.user?.name || m.name || m.username || 'Member';
                                        const stepsStr = Array.isArray(m.steps) ? m.steps.join(', ') : (m.steps || '');
                                        const pts = Number(m.points_gain || 0);

                                        return (
                                            <div
                                                key={m.id || idx}
                                                onClick={() => isAdmin && handleOpenPoints(project, m.id)}
                                                title={`${mName}${stepsStr ? ` (${stepsStr})` : ''} - ${pts} Points${isAdmin ? ' (Click to award/edit points)' : ''}`}
                                                style={{
                                                    width: '26px',
                                                    height: '26px',
                                                    borderRadius: '50%',
                                                    border: '2px solid #ffffff',
                                                    background: '#87d068',
                                                    color: '#ffffff',
                                                    fontSize: '10px',
                                                    fontWeight: 700,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginLeft: idx > 0 ? '-7px' : 0,
                                                    overflow: 'hidden',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                                    cursor: isAdmin ? 'pointer' : 'default',
                                                    transition: 'transform 0.15s ease'
                                                }}
                                            >
                                                {avatarSrc ? (
                                                    <img src={avatarSrc} alt={mName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    (mName[0] || 'U').toUpperCase()
                                                )}
                                            </div>
                                        );
                                    })}
                                    {members.length > 4 && (
                                        <div
                                            onClick={() => isAdmin && handleOpenPoints(project)}
                                            title={`${members.length - 4} more member(s)`}
                                            style={{
                                                width: '26px',
                                                height: '26px',
                                                borderRadius: '50%',
                                                border: '2px solid #ffffff',
                                                background: '#f1f5f9',
                                                color: '#475569',
                                                fontSize: '10px',
                                                fontWeight: 700,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginLeft: '-7px',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                                cursor: isAdmin ? 'pointer' : 'default'
                                            }}
                                        >
                                            +{members.length - 4}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Names row underneath */}
                            <div
                                title={names}
                                style={{
                                    fontSize: '11px',
                                    color: '#334155',
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '100%'
                                }}
                            >
                                {names}
                            </div>
                        </div>
                    );
                }
            },
            {
                field: 'project_title',
                headerName: 'Project Title',
                minWidth: 260,
                flex: 2,
                cellRenderer: (p) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%' }}>
                        <span style={{ color: '#4f46e5', display: 'flex', alignItems: 'center' }}>
                            <BiFolder size={16} />
                        </span>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                            {p.value || 'Untitled Project'}
                        </span>
                    </div>
                )
            },
            {
                field: 'project_main_scope',
                headerName: 'Main Scope',
                minWidth: 180,
                cellRenderer: (p) => p.value ? <span style={{ fontSize: '12px', color: '#334155' }}>{stripHtml(p.value)}</span> : <span style={{ color: '#cbd5e1' }}>—</span>
            },
            {
                field: 'project_scope_details',
                headerName: 'Scope Details',
                minWidth: 180,
                cellRenderer: (p) => p.value ? <span style={{ fontSize: '12px', color: '#334155' }}>{stripHtml(p.value)}</span> : <span style={{ color: '#cbd5e1' }}>—</span>
            },
            {
                field: 'project_address',
                headerName: 'Project Address',
                minWidth: 200,
                cellRenderer: (p) => p.value ? <span style={{ fontSize: '12px', color: '#334155' }}>{stripHtml(p.value)}</span> : <span style={{ color: '#cbd5e1' }}>—</span>
            },
            {
                field: 'is_project_late',
                headerName: 'Late Flag',
                width: 110,
                cellRenderer: (p) => (
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        {p.value === 1 ? (
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    color: '#dc2626',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    lineHeight: 1.2
                                }}
                            >
                                LATE
                            </span>
                        ) : (
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#ecfdf5',
                                    border: '1px solid #a7f3d0',
                                    color: '#047857',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    lineHeight: 1.2
                                }}
                            >
                                On Track
                            </span>
                        )}
                    </div>
                )
            },

            {
                field: 'project_points',
                headerName: 'Points ( Total/Used/Left)',
                minWidth: 100,
                filter: false,
                sortable: false,
                cellRenderer: (p) => {
                    const row = p.data || {};
                    const total = Number(row.project_points || 0);
                    const used = Number(row.points_used ?? 0);
                    const left = Number(row.points_left ?? Math.max(0, total - used));
                    const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                    return (
                        <div
                            onClick={() => isAdmin && handleOpenPoints(row)}
                            title={isAdmin ? "Click to award or adjust points" : undefined}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px',
                                fontSize: '11px',
                                lineHeight: '1.2',
                                justifyContent: 'center',
                                height: '100%',
                                cursor: isAdmin ? 'pointer' : 'default'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>T: {total}</span>
                                <span style={{ color: '#cbd5e1' }}>•</span>
                                <span style={{ fontWeight: 600, color: '#4f46e5' }}>U: {used}</span>
                                <span style={{ color: '#cbd5e1' }}>•</span>
                                <span style={{ fontWeight: 700, color: left > 0 ? '#10b981' : '#ef4444' }}>L: {left}</span>
                            </div>
                            <div style={{ height: '4px', width: '100%', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: used > total ? '#ef4444' : '#4f46e5' }} />
                            </div>
                        </div>
                    );
                }
            },

            // Dynamic Client Columns Split by Enum Type (Admin, Normal, etc.)
            ...clientTypes.flatMap(type => {
                const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
                return [
                    {
                        headerName: `Client Title (${typeLabel})`,
                        colId: `client_title_${type}`,
                        minWidth: 170,
                        valueGetter: (params) => formatClientFieldByType(params.data, type, 'title'),
                        cellRenderer: (p) => p.value ? (
                            <span style={{ color: '#334155', fontSize: '12px' }} title={p.value}>
                                {p.value}
                            </span>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>
                    },
                    {
                        headerName: `Client Name (${typeLabel})`,
                        colId: `client_name_${type}`,
                        minWidth: 170,
                        valueGetter: (params) => formatClientFieldByType(params.data, type, 'name'),
                        cellRenderer: (p) => p.value ? (
                            <span style={{ color: '#334155', fontSize: '12px', fontWeight: 600 }} title={p.value}>
                                {p.value}
                            </span>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>
                    },
                    {
                        headerName: `Client Notes (${typeLabel})`,
                        colId: `client_notes_${type}`,
                        minWidth: 200,
                        valueGetter: (params) => formatClientFieldByType(params.data, type, 'notes'),
                        cellRenderer: (p) => p.value ? (
                            <span style={{ color: '#475569', fontSize: '12px' }} title={p.value}>
                                {p.value}
                            </span>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>
                    }
                ];
            }),

            // 11. Total Budget
            {
                field: 'project_total_budget',
                headerName: 'Total Budget',
                width: 140,
                cellRenderer: (p) => (
                    p.value !== null && p.value !== undefined && p.value !== '' ? (
                        <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'Consolas, monospace' }}>
                            ${Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    ) : <span style={{ color: '#cbd5e1' }}>—</span>
                )
            },

            // 12. Deduction
            {
                field: 'project_deduction_amount',
                headerName: 'Deduction',
                width: 140,
                cellRenderer: (p) => (
                    p.value !== null && p.value !== undefined && p.value !== '' ? (
                        <span style={{ fontWeight: 700, color: '#dc2626', fontFamily: 'Consolas, monospace' }}>
                            -${Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    ) : <span style={{ color: '#cbd5e1' }}>—</span>
                )
            },

            // 13. Construction Type
            {
                field: 'project_construction_type',
                headerName: 'Construction Type',
                width: 150,
                cellRenderer: (p) => (
                    p.value ? (
                        <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#475569' }}>
                            {p.value}
                        </span>
                    ) : <span style={{ color: '#cbd5e1' }}>—</span>
                )
            },

            // 14. Source
            {
                field: 'project_source',
                headerName: 'Source',
                width: 130,
                cellRenderer: (p) => (
                    p.value ? (
                        <span style={{ fontWeight: 600, color: '#475569' }}>
                            {p.value}
                        </span>
                    ) : <span style={{ color: '#cbd5e1' }}>—</span>
                )
            },

            {
                field: 'project_estimator_notes',
                headerName: 'Estimator Notes',
                minWidth: 180,
                cellRenderer: (p) => {
                    const val = p.value || p.data?.project_notes;
                    return val ? <span style={{ fontSize: '12px', color: '#334155' }}>{stripHtml(val)}</span> : <span style={{ color: '#cbd5e1' }}>—</span>;
                }
            },

            // 24. Admin Notes
            {
                field: 'project_admin_notes',
                headerName: 'Admin Notes',
                minWidth: 180,
                cellRenderer: (p) => p.value ? <span style={{ fontSize: '12px', color: '#334155' }}>{stripHtml(p.value)}</span> : <span style={{ color: '#cbd5e1' }}>—</span>
            },
            {
                field: 'project_progress_status',
                headerName: 'Status',
                width: 170,
                pinned: "right",
                cellRenderer: (p) => (
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        <span
                            className={`${styles.statusBadge} ${getStatusBadgeClass(p.value)}`}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                lineHeight: 1.2
                            }}
                        >
                            {p.value || 'Pending'}
                        </span>
                    </div>
                )
            },
            {
                field: 'project_due_date',
                headerName: 'Due Date',
                width: 130,
                pinned: "right",
                cellRenderer: (p) => (
                    p.value ? (
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>
                            {p.value}
                        </span>
                    ) : <span style={{ color: '#cbd5e1' }}>—</span>
                )
            },

            {
                headerName: '| Days | Hrs | Min | Sec |',
                field: 'project_due_date',
                colId: 'project_countdown',
                filter: false,
                editable: false,
                sortable: false,
                width: 195,
                pinned: "right",
                cellRenderer: (props) => <CountdownTimer dueDateStr={props.value} />
            },
        ];

        // Any dynamic active column not mapped above goes into flat defs list
        const extraActiveCols = (columnConfigs || []).filter(c => c.is_active === 1 && c.is_list_visible === 1 && !mappedFields.has(c.column_name));
        extraActiveCols.forEach(cfg => {
            defs.push({
                field: cfg.column_name,
                headerName: cfg.label || cfg.column_name,
                minWidth: 150,
                cellRenderer: (p) => {
                    const val = p.value;
                    if (val === null || val === undefined || val === '') {
                        return <span style={{ color: '#cbd5e1' }}>—</span>;
                    }
                    const str = String(val);
                    if (str.includes('<') && str.includes('>')) {
                        return <span style={{ fontSize: '12px', color: '#334155' }}>{stripHtml(str)}</span>;
                    }
                    return str;
                }
            });
        });

        // Pinned Left: Actions (View, Edit, Delete, AI Assistant + Initial Drawings & Final Deliverable Links)
        defs.push({
            headerName: 'Actions',
            minWidth: 290,
            width: 310,
            pinned: 'left',
            filter: false,
            sortable: false,
            cellRenderer: (p) => {
                if (!p.data) return null;
                const project = p.data;
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '100%' }}>
                        {/* Standard Actions: View, Edit, Delete, AI Assistant */}
                        <button
                            type="button"
                            onClick={() => navigate(`/projects/view/${project.id}`)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                padding: '4px 7px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                            title="View Full Page"
                        >
                            <BiShow size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/projects/edit/${project.id}`)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                padding: '4px 7px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                            title="Edit Project"
                        >
                            <BiEdit size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDeleteProject(project)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                padding: '4px 7px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                            title="Delete Project"
                        >
                            <BiTrash size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setAiAssistantProject(project)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#f5f3ff',
                                border: '1px solid #ddd6fe',
                                color: '#7c3aed',
                                padding: '4px 7px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                            title="AI Project Assistant (Open Chat for this Project)"
                        >
                            <BiBot size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/takeoff/project/${project.id}`)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#fef3c7',
                                border: '1px solid #fde68a',
                                color: '#b45309',
                                padding: '4px 7px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                            title="Construction Takeoff & Estimations for this Project"
                        >
                            <BiRuler size={14} />
                        </button>

                        {/* Thin vertical separator */}
                        <div style={{ width: '1px', height: '16px', background: '#e2e8f0', margin: '0 2px' }} />

                        {/* Initial Link Button (Open in new window + Quick Edit button) */}
                        {project.project_init_link ? (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                borderRadius: '4px',
                                border: '1px solid #bfdbfe',
                                background: '#eff6ff',
                                overflow: 'hidden'
                            }}>
                                <a
                                    href={project.project_init_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        color: '#1d4ed8',
                                        padding: '3px 6px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        lineHeight: 1.2,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px'
                                    }}
                                    title={`Open Initial Drawings:\n${project.project_init_link}`}
                                >
                                    Initial <BiLinkExternal size={10} style={{ opacity: 0.7 }} />
                                </a>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        openSingleFieldModal(project, 'project_init_link', 'Initial Takeoff Link / Folder', 'text', [], 'any', 'https://...');
                                    }}
                                    style={{
                                        background: '#dbeafe',
                                        border: 'none',
                                        borderLeft: '1px solid #bfdbfe',
                                        color: '#1d4ed8',
                                        padding: '3px 4px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        lineHeight: 1.2
                                    }}
                                    title="Edit Initial Link URL"
                                >
                                    <BiEdit size={11} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openSingleFieldModal(project, 'project_init_link', 'Initial Takeoff Link / Folder', 'text', [], 'any', 'https://...');
                                }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    background: '#f8fafc',
                                    border: '1px dashed #cbd5e1',
                                    color: '#64748b',
                                    padding: '3px 6px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    lineHeight: 1.2
                                }}
                                title="Add Initial Link"
                            >
                                <BiPlus size={11} /> Initial
                            </button>
                        )}

                        {/* Final Deliverable Link Button (Open in new window + Quick Edit button) */}
                        {project.project_final_link ? (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                borderRadius: '4px',
                                border: '1px solid #a7f3d0',
                                background: '#ecfdf5',
                                overflow: 'hidden'
                            }}>
                                <a
                                    href={project.project_final_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        color: '#047857',
                                        padding: '3px 6px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        lineHeight: 1.2,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px'
                                    }}
                                    title={`Open Final Deliverable:\n${project.project_final_link}`}
                                >
                                    Final <BiLinkExternal size={10} style={{ opacity: 0.7 }} />
                                </a>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        openSingleFieldModal(project, 'project_final_link', 'Final Deliverable Link / Document', 'text', [], 'any', 'https://...');
                                    }}
                                    style={{
                                        background: '#d1fae5',
                                        border: 'none',
                                        borderLeft: '1px solid #a7f3d0',
                                        color: '#047857',
                                        padding: '3px 4px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        lineHeight: 1.2
                                    }}
                                    title="Edit Final Link URL"
                                >
                                    <BiEdit size={11} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openSingleFieldModal(project, 'project_final_link', 'Final Deliverable Link / Document', 'text', [], 'any', 'https://...');
                                }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    background: '#f8fafc',
                                    border: '1px dashed #cbd5e1',
                                    color: '#64748b',
                                    padding: '3px 6px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    lineHeight: 1.2
                                }}
                                title="Add Final Deliverable Link"
                            >
                                <BiPlus size={11} /> Final
                            </button>
                        )}
                    </div>
                );
            }
        });

        return defs;
    }, [columnConfigs, clientTypes, navigate, handleDeleteProject, handleOpenJoinTeam, handleLeaveTeam, handleOpenPoints, openSingleFieldModal, isAdmin, authUser]);


    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            gap: '12px',
            minWidth: 0,
            maxWidth: '100%',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            {/* Two-Tier Dynamic Status Bar */}
            <div className={styles.statusBarWrapper}>
                {/* Tier 1: Grouping Tabs Row */}
                <div className={styles.statusGroupsRow}>
                    <div className={styles.groupsList}>
                        {dynamicStatusGroups.map((grp) => {
                            const isGrpActive = activeFilter.type === 'group' && activeFilter.value === grp.group_slug;
                            return (
                                <button
                                    key={grp.id || grp.group_slug}
                                    type="button"
                                    className={`${styles.groupTab} ${isGrpActive ? styles.groupTabActive : ''}`}
                                    onClick={() => handleSelectGroup(grp.group_slug)}
                                    style={{
                                        borderLeft: !isGrpActive && grp.color ? `3px solid ${grp.color}` : undefined
                                    }}
                                >
                                    <BiLayer size={14} style={{ color: isGrpActive ? '#ffffff' : (grp.color || '#4f46e5') }} />
                                    <span>{grp.group_name}</span>
                                    <span className={styles.groupBadge}>
                                        {grp.count ?? 0}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        className={styles.manageGroupsBtn}
                        onClick={() => setIsGroupModalOpen(true)}
                        title="Configure custom status groups & categorization"
                    >
                        <BiCog size={14} /> Manage Groups
                    </button>
                </div>

                {/* Tier 2: Standalone Dynamic Status List Row with Horizontal Scroll & Arrows */}
                <div className={styles.statusStandaloneRow}>
                    <button
                        type="button"
                        className={styles.scrollArrowBtn}
                        onClick={handleScrollLeft}
                        disabled={!canScrollLeft}
                        title="Scroll left"
                        aria-label="Scroll left"
                    >
                        <BiChevronLeft size={18} />
                    </button>

                    <div ref={scrollTrackRef} className={styles.standaloneScrollTrack}>
                        {dynamicEnumStatuses.map((st) => {
                            const stSlug = slugify(st);
                            const isStActive = activeFilter.type === 'status' && activeFilter.value === stSlug;
                            const count = statusSummary?.statuses?.[st] ?? 0;
                            return (
                                <button
                                    key={st}
                                    type="button"
                                    className={`${styles.statusTab} ${isStActive ? styles.statusTabActive : ''}`}
                                    onClick={() => handleSelectStatus(st)}
                                >
                                    <span>{st}</span>
                                    {count > 0 && <span className={styles.tabBadge}>{count}</span>}
                                </button>
                            );
                        })}

                        {/* Late Projects Pill */}
                        <button
                            type="button"
                            className={`${styles.statusTab} ${activeFilter.type === 'status' && activeFilter.value === 'late' ? styles.statusTabActive : ''}`}
                            onClick={handleSelectLate}
                            style={{
                                borderColor: activeFilter.type === 'status' && activeFilter.value === 'late' ? '#dc2626' : '#fecaca',
                                color: activeFilter.type === 'status' && activeFilter.value === 'late' ? '#ffffff' : '#dc2626',
                                background: activeFilter.type === 'status' && activeFilter.value === 'late' ? '#dc2626' : '#ffffff'
                            }}
                        >
                            <BiErrorCircle size={14} /> Late Projects
                            <span className={styles.tabBadge} style={{
                                background: activeFilter.type === 'status' && activeFilter.value === 'late' ? 'rgba(255,255,255,0.3)' : '#fee2e2',
                                color: activeFilter.type === 'status' && activeFilter.value === 'late' ? '#ffffff' : '#dc2626'
                            }}>
                                {statusSummary?.late ?? 0}
                            </span>
                        </button>
                    </div>

                    <button
                        type="button"
                        className={styles.scrollArrowBtn}
                        onClick={handleScrollRight}
                        disabled={!canScrollRight}
                        title="Scroll right"
                        aria-label="Scroll right"
                    >
                        <BiChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* AG Grid Projects Table */}
            <div style={{
                flex: 1,
                minHeight: '560px',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                minWidth: 0,
                maxWidth: '100%',
                width: '100%',
                boxSizing: 'border-box'
            }}>
                <AgGridTable
                    rowData={filteredProjects}
                    columnDefs={columnDefs}
                    loading={loading}
                    enableExport={true}
                    enableSearch={true}
                    rowHeight={58}
                    headerHeight={44}
                    height="calc(100vh - 210px)"
                    onCellDoubleClicked={handleCellDoubleClicked}
                    extraHeaderActions={
                        <>
                            <button
                                type="button"
                                onClick={() => navigate('/projects/create')}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: '#4f46e5',
                                    border: '1px solid #4338ca',
                                    borderRadius: '6px',
                                    padding: '6px 14px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(79, 70, 229, 0.2)'
                                }}
                            >
                                <BiPlus size={16} /> Add Project
                            </button>

                            <button
                                type="button"
                                onClick={loadProjects}
                                style={{
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    padding: '6px 10px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#475569'
                                }}
                                title="Reload"
                            >
                                <BiRefresh size={18} />
                            </button>
                        </>
                    }
                />
            </div>

            {/* Activity History Modal */}
            {activityOpen && activityProject && (
                <ActivityLogViewer
                    subjectType="projects"
                    subjectId={activityProject.id}
                    title={`Activity History for Project: ${activityProject.project_title}`}
                    isOpen={activityOpen}
                    onClose={() => {
                        setActivityOpen(false);
                        setActivityProject(null);
                    }}
                />
            )}
            {/* Custom Status Groups Modal */}
            {isGroupModalOpen && (
                <StatusGroupModal
                    isOpen={isGroupModalOpen}
                    onClose={() => setIsGroupModalOpen(false)}
                    enumStatuses={dynamicEnumStatuses}
                    onGroupsUpdated={loadProjects}
                />
            )}

            {/* Join / Edit Team Member Modal */}
            {isJoinModalOpen && selectedProjectForJoin && (
                <JoinProjectModal
                    isOpen={isJoinModalOpen}
                    onClose={() => {
                        setIsJoinModalOpen(false);
                        setSelectedProjectForJoin(null);
                        setSelectedMemberForEdit(null);
                    }}
                    project={selectedProjectForJoin}
                    memberToEdit={selectedMemberForEdit}
                    onSuccess={loadProjects}
                />
            )}

            {/* Team Points Modal (Admin Only) */}
            {pointModalOpen && selectedProjectForPoints && (
                <AddEditPointModal
                    isOpen={pointModalOpen}
                    onClose={() => {
                        setPointModalOpen(false);
                        setSelectedProjectForPoints(null);
                        setSelectedMemberForPoints(null);
                    }}
                    project={selectedProjectForPoints}
                    initialMemberId={selectedMemberForPoints}
                    onSuccess={loadProjects}
                />
            )}

            {/* Standalone Reusable Single-Column / Single-Field Edit Modal */}
            {singleFieldModal.isOpen && (
                <ProjectFieldEditModal
                    key={`modal_${singleFieldModal.projectId}_${singleFieldModal.fieldName}`}
                    isOpen={singleFieldModal.isOpen}
                    onClose={() => setSingleFieldModal(INITIAL_SINGLE_FIELD_MODAL)}
                    projectId={singleFieldModal.projectId}
                    projectTitle={singleFieldModal.projectTitle}
                    fieldName={singleFieldModal.fieldName}
                    fieldLabel={singleFieldModal.fieldLabel}
                    fieldType={singleFieldModal.fieldType}
                    initialValue={singleFieldModal.initialValue}
                    options={singleFieldModal.options}
                    step={singleFieldModal.step}
                    placeholder={singleFieldModal.placeholder}
                    helperText={singleFieldModal.helperText}
                    onSuccess={async () => {
                        await loadProjects();
                    }}
                />
            )}

            {/* Client Edit Modal on double clicking client cells */}
            {clientModal.open && (
                <Modal
                    isOpen={clientModal.open}
                    onClose={() => setClientModal((prev) => ({ ...prev, open: false }))}
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BiUser size={20} color="#4f46e5" />
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                    Edit Client Details
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                    {clientModal.client?.name || clientModal.client?.title || 'Client Profile'} • Type: {clientModal.client?.client_type || 'normal'}
                                </div>
                            </div>
                        </div>
                    }
                    width="620px"
                >
                    <form onSubmit={handleSaveClient} style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '6px 0' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Client Name *</label>
                                <input
                                    type="text"
                                    required
                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                                    value={clientModal.formData.name || ''}
                                    onChange={(e) => setClientModal((prev) => ({ ...prev, formData: { ...prev.formData, name: e.target.value } }))}
                                    placeholder="Full Client Name"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Client Title / Company</label>
                                <input
                                    type="text"
                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                                    value={clientModal.formData.title || ''}
                                    onChange={(e) => setClientModal((prev) => ({ ...prev, formData: { ...prev.formData, title: e.target.value } }))}
                                    placeholder="Company / Title"
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Email Address</label>
                                <input
                                    type="email"
                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                                    value={clientModal.formData.email || ''}
                                    onChange={(e) => setClientModal((prev) => ({ ...prev, formData: { ...prev.formData, email: e.target.value } }))}
                                    placeholder="client@example.com"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Phone Number</label>
                                <input
                                    type="tel"
                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                                    value={clientModal.formData.phone || ''}
                                    onChange={(e) => setClientModal((prev) => ({ ...prev, formData: { ...prev.formData, phone: e.target.value } }))}
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Client Notes</label>
                            <RichTextEditor
                                value={clientModal.formData.notes || ''}
                                onChange={(val) => setClientModal((prev) => ({ ...prev, formData: { ...prev.formData, notes: val } }))}
                                placeholder="Client instructions, preferences, notes..."
                                minHeight={90}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                            <button
                                type="button"
                                onClick={() => setClientModal((prev) => ({ ...prev, open: false }))}
                                style={{ padding: '8px 16px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                                disabled={clientModalSaving}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', background: '#4f46e5', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#ffffff', cursor: clientModalSaving ? 'not-allowed' : 'pointer', opacity: clientModalSaving ? 0.7 : 1 }}
                                disabled={clientModalSaving}
                            >
                                {clientModalSaving ? <BiLoaderAlt className="spin" size={14} /> : <BiSave size={14} />}
                                Save Client Changes
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* AI Assistant Chat Modal for Focused Project */}
            {aiAssistantProject && (
                <AIAssistantModal
                    isOpen={Boolean(aiAssistantProject)}
                    onClose={() => setAiAssistantProject(null)}
                    project={aiAssistantProject}
                />
            )}
        </div>
    );
};

export default ProjectsList;
