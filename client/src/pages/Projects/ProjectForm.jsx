import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    BiArrowBack,
    BiSave,
    BiFolder,
    BiBuilding,
    BiMapPin,
    BiDollarCircle,
    BiCalendar,
    BiLinkExternal,
    BiNote,
    BiPlusCircle,
    BiFile,
    BiTable,
    BiCrown,
    BiUser,
    BiChevronDown,
    BiChevronUp,
    BiX,
    BiCheck,
    BiTrash,
    BiEdit,
    BiSearch,
    BiLoaderAlt
} from 'react-icons/bi';
import apiClient from '../../api/client';
import Select from '../../components/ui/Select/Select';
import RichTextEditor from '../../components/ui/RichTextEditor/RichTextEditor';
import Modal from '../../components/ui/Modal/Modal';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import styles from './ProjectForm.module.css';

const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

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

const LATE_OPTIONS = [
    { value: 0, label: 'No (On Track)' },
    { value: 1, label: 'Yes (Marked Late)' }
];

const ProjectForm = () => {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const toast = useToast();
    const { setCustomBreadcrumbs } = usePageActions();

    const [loading, setLoading] = useState(isEdit);
    const [submitting, setSubmitting] = useState(false);

    // Dynamic Lookups from backend database schema
    const [lookups, setLookups] = useState({
        project_progress_status: [],
        project_construction_type: [],
        project_source: [],
        project_preview_status: [],
        client_type: [],
        enums: {}
    });

    const [clients, setClients] = useState([]);
    const [columnConfigs, setColumnConfigs] = useState([]);
    const [schemaColumns, setSchemaColumns] = useState([]);

    // Multi-client management state
    const [selectedClientIds, setSelectedClientIds] = useState([]);
    const [addClientModalOpen, setAddClientModalOpen] = useState(false);
    const [clientFilterType, setClientFilterType] = useState('all');
    const [clientSearchTerm, setClientSearchTerm] = useState('');

    // Standalone client edit modal state
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

    const [formData, setFormData] = useState({
        project_title: '',
        project_address: '',
        client_id: '',
        project_pricing: 'No',
        project_area: '',
        project_construction_type: '',
        project_line_items_pricing: '',
        project_floor_number: '',
        project_main_scope: '',
        project_scope_details: '',
        project_template: '',
        project_init_link: '',
        project_final_link: '',
        project_admin_notes: '',
        project_estimator_notes: '',
        project_total_budget: '',
        project_deduction_amount: '',
        project_due_date: '',
        project_points: '',
        project_progress_status: 'Pending',
        project_source: 'InSource',
        project_preview_status: 'active',
        is_project_late: 0
    });

    useEffect(() => {
        setCustomBreadcrumbs([
            { label: 'Projects', to: '/projects' },
            { label: isEdit ? `Edit Project #${id}` : 'Create New Project' }
        ]);
    }, [id, isEdit, setCustomBreadcrumbs]);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const [lookupsRes, clientsRes, colsRes, schemaRes] = await Promise.all([
                    apiClient.get('/projects/lookups').catch(() => ({ data: {} })),
                    apiClient.get('/clients', { per_page: 1000 }).catch(() => ({ data: [] })),
                    apiClient.get('/columns/config/projects').catch(() => ({ data: [] })),
                    apiClient.get('/schema/tables/projects').catch(() => ({ data: { columns: [] } }))
                ]);

                if (lookupsRes.success && lookupsRes.data) {
                    setLookups(lookupsRes.data);
                }

                const clientList = clientsRes.data || [];
                setClients(clientList);

                if (colsRes.success && colsRes.data) {
                    setColumnConfigs(colsRes.data);
                }

                if (schemaRes.success && schemaRes.data) {
                    setSchemaColumns(schemaRes.data.columns || []);
                }

                if (isEdit) {
                    const projectRes = await apiClient.get(`/projects/${id}`);
                    if (projectRes.success && projectRes.data) {
                        const proj = projectRes.data;

                        setFormData((prev) => ({
                            ...prev,
                            ...proj,
                            project_estimator_notes: proj.project_estimator_notes || proj.project_notes || '',
                            client_id: proj.client_id ? String(proj.client_id) : '',
                            project_pricing: proj.project_pricing && String(proj.project_pricing).trim().toLowerCase().startsWith('y')
                                ? 'Yes'
                                : (proj.project_pricing && String(proj.project_pricing).trim().toLowerCase().startsWith('n')
                                    ? 'No'
                                    : (proj.project_pricing || 'No')),
                            is_project_late: proj.is_project_late ? 1 : 0
                        }));

                        // Populate multi-client assignments
                        const assignedIds = proj.client_ids && proj.client_ids.length > 0
                            ? proj.client_ids.map(Number)
                            : (proj.client_id ? [Number(proj.client_id)] : []);

                        setSelectedClientIds(assignedIds);
                    } else {
                        toast.error('Project Error', projectRes.message || 'Project not found');
                        navigate('/projects');
                    }
                } else {
                    // Default to 'Pending' for new project
                    const statuses = lookupsRes.data?.project_progress_status || [];
                    const pendingStatus = statuses.find((s) => String(s).toLowerCase() === 'pending') || 'Pending';
                    setFormData((prev) => ({
                        ...prev,
                        project_progress_status: pendingStatus
                    }));
                }
            } catch (err) {
                toast.error('Error', err.message || 'Failed to initialize project form');
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [id, isEdit, navigate, toast]);

    const handleChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value
        }));
    };

    // Multi-client handlers
    const handleAssignClient = (clientId) => {
        const idNum = Number(clientId);
        if (!selectedClientIds.some((id) => Number(id) === idNum)) {
            setSelectedClientIds((prev) => [...prev, idNum]);
        }
    };

    const handleRemoveClient = (clientId) => {
        const idNum = Number(clientId);
        setSelectedClientIds((prev) => prev.filter((id) => Number(id) !== idNum));
    };

    const openClientEditModal = (client) => {
        setClientModal({
            open: true,
            client,
            formData: {
                name: client.name || client.title || '',
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
                setClients((prev) =>
                    prev.map((c) =>
                        c.id === clientModal.client.id
                            ? { ...c, ...clientModal.formData }
                            : c
                    )
                );
                setClientModal((prev) => ({ ...prev, open: false }));
            } else {
                toast.error('Update Failed', res.message || 'Failed to update client');
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to update client');
        } finally {
            setModalSaving(false);
        }
    };

    // Dynamic Select Options based on live database enum values
    const progressStatusOptions = useMemo(() => {
        const list = lookups.project_progress_status || [];
        if (list.length === 0) {
            return [
                { value: 'Planned', label: 'Planned' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Takeoff On Progress', label: 'Takeoff On Progress' },
                { value: 'Pricing On Progress', label: 'Pricing On Progress' },
                { value: 'Completed', label: 'Completed' },
                { value: 'Hold', label: 'Hold' },
                { value: 'Revision', label: 'Revision' },
                { value: 'Cancelled', label: 'Cancelled' },
                { value: 'Deliver', label: 'Deliver' }
            ];
        }
        return list.map((st) => ({ value: st, label: st }));
    }, [lookups.project_progress_status]);

    const constructionTypeOptions = useMemo(() => {
        const list = lookups.project_construction_type || [];
        if (list.length === 0) {
            return [
                { value: '', label: '— Select Construction Type —' },
                { value: 'commercial', label: 'Commercial' },
                { value: 'residential', label: 'Residential' }
            ];
        }
        return [
            { value: '', label: '— Select Construction Type —' },
            ...list.map((ct) => ({ value: ct, label: ct.charAt(0).toUpperCase() + ct.slice(1) }))
        ];
    }, [lookups.project_construction_type]);

    const sourceOptions = useMemo(() => {
        const list = lookups.project_source || [];
        if (list.length === 0) {
            return [
                { value: 'InSource', label: 'InSource (Internal Team)' },
                { value: 'OutSource', label: 'OutSource (External Partners)' }
            ];
        }
        return list.map((src) => ({ value: src, label: src }));
    }, [lookups.project_source]);

    const previewStatusOptions = useMemo(() => {
        const list = lookups.project_preview_status || [];
        if (list.length === 0) {
            return [
                { value: 'active', label: 'Active (Visible)' },
                { value: 'draft', label: 'Draft' }
            ];
        }
        return list.map((pv) => ({ value: pv, label: pv.charAt(0).toUpperCase() + pv.slice(1) }));
    }, [lookups.project_preview_status]);

    const pricingModeOptions = useMemo(() => [
        { value: 'Yes', label: 'Yes' },
        { value: 'No', label: 'No' }
    ], []);

    // Filter dynamic custom fields that are active
    const dynamicFields = useMemo(() => {
        const schemaMap = {};
        (schemaColumns || []).forEach((c) => {
            schemaMap[c.field] = c;
        });

        return (columnConfigs || [])
            .filter((cfg) => !CORE_FIELDS.includes(cfg.column_name) && cfg.is_active === 1)
            .map((cfg) => {
                const schemaInfo = schemaMap[cfg.column_name] || {};
                return {
                    name: cfg.column_name,
                    label: cfg.label || cfg.column_name,
                    base_type: schemaInfo.base_type || 'VARCHAR',
                    enum_options: schemaInfo.enum_options || lookups.enums?.[cfg.column_name] || []
                };
            });
    }, [columnConfigs, schemaColumns, lookups.enums]);

    // Filter available clients in modal
    const filteredModalClients = useMemo(() => {
        return clients.filter((c) => {
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
    }, [clients, clientFilterType, clientSearchTerm]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.project_title.trim()) {
            toast.warning('Validation Warning', 'Project title is required');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                project_progress_status: formData.project_progress_status || 'Pending',
                client_ids: selectedClientIds,
                client_id: selectedClientIds.length > 0 ? selectedClientIds[0] : null
            };

            let res;
            if (isEdit) {
                res = await apiClient.put(`/projects/${id}`, payload);
            } else {
                res = await apiClient.post('/projects', payload);
            }

            if (res.success) {
                toast.success('Success', isEdit ? 'Project updated successfully' : 'Project created successfully');
                navigate('/projects');
            } else {
                toast.error('Submission Failed', res.message || 'Could not save project');
            }
        } catch (err) {
            toast.error('Error', err.message || 'An unexpected error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
                <BiFolder size={36} style={{ color: '#94a3b8', marginBottom: '12px' }} />
                <div style={{ fontSize: '15px', fontWeight: 600 }}>Loading project details...</div>
            </div>
        );
    }

    return (
        <div className={styles.formContainer}>
            <form onSubmit={handleSubmit}>
                {/* Form Top Header Card */}
                <div className={styles.formHeader}>
                    <div className={styles.headerLeft}>
                        <button
                            type="button"
                            onClick={() => navigate('/projects')}
                            className={styles.backBtn}
                        >
                            <BiArrowBack size={15} /> All Projects
                        </button>
                        <h1 className={styles.formTitle}>
                            <BiFolder />
                            <span>{isEdit ? `Edit Project: ${formData.project_title || `#${id}`}` : 'Create New Project'}</span>
                        </h1>
                    </div>

                    <div className={styles.headerActions}>
                        <button
                            type="button"
                            onClick={() => navigate('/projects')}
                            className={styles.btnCancel}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={styles.btnSubmit}
                        >
                            <BiSave size={16} />
                            {submitting ? 'Saving Project...' : isEdit ? 'Update Project' : 'Create Project'}
                        </button>
                    </div>
                </div>

                {/* Main Form: Two Column Balanced Layout */}
                <div className={styles.formLayout}>

                    {/* ========== LEFT COLUMN ========== */}
                    <div className={styles.formColumn}>

                        {/* Card 1: Core Project Information & Site Address */}
                        <div className={styles.formCard}>
                            <div className={styles.cardHeader}>
                                <div className={styles.cardHeaderTitle}>
                                    <BiFile /> Core Project Details
                                </div>
                            </div>
                            <div className={styles.cardBody}>
                                {/* Project Title */}
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>
                                        Project Title <span className={styles.required}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className={styles.textInput}
                                        placeholder="e.g. Iron Wolf Apartments Takeoff"
                                        value={formData.project_title}
                                        onChange={(e) => handleChange('project_title', e.target.value)}
                                    />
                                </div>

                                {/* Site Address - Rich Text Editor */}
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>
                                        Project Address
                                    </label>
                                    <RichTextEditor
                                        label="Site Address (Project Location)"
                                        value={formData.project_address}
                                        onChange={(val) => handleChange('project_address', val)}
                                        placeholder="Enter full site physical location, street, city, state, zip..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Card 2: Scopes & Trade Specifications */}
                        <div className={styles.formCard}>
                            <div className={styles.cardHeader}>
                                <div className={styles.cardHeaderTitle}>
                                    <BiFile /> Scope & Technical Breakdown
                                </div>
                            </div>
                            <div className={styles.cardBody}>
                                {/* Main Scope */}
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>
                                        Project Main Scope
                                    </label>
                                    <RichTextEditor
                                        label="Main Project Scope"
                                        value={formData.project_main_scope}
                                        onChange={(val) => handleChange('project_main_scope', val)}
                                        placeholder="Provide detailed breakdown of trades, takeoffs, and deliverables..."
                                    />
                                </div>

                                {/* Scope Details / Breakdown */}
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>
                                        Project Scope Details
                                    </label>
                                    <RichTextEditor
                                        label="Scope Breakdown / Trade Details"
                                        value={formData.project_scope_details}
                                        onChange={(val) => handleChange('project_scope_details', val)}
                                        placeholder="Secondary specifications, trade breakdown, exclusions..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Card 3: External Deliverable Links */}
                        <div className={styles.formCard}>
                            <div className={styles.cardHeader}>
                                <div className={styles.cardHeaderTitle}>
                                    <BiLinkExternal /> Drawings & Deliverable Links
                                </div>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>Initial Drawings Folder Link</label>
                                    <input
                                        type="url"
                                        className={styles.textInput}
                                        placeholder="https://drive.google.com/drive/folders/..."
                                        value={formData.project_init_link}
                                        onChange={(e) => handleChange('project_init_link', e.target.value)}
                                    />
                                </div>

                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>Final Takeoff Deliverable Link</label>
                                    <input
                                        type="url"
                                        className={styles.textInput}
                                        placeholder="https://drive.google.com/file/d/..."
                                        value={formData.project_final_link}
                                        onChange={(e) => handleChange('project_final_link', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Card 4: Notes & Remarks */}
                        <div className={styles.formCard}>
                            <div className={styles.cardHeader}>
                                <div className={styles.cardHeaderTitle}>
                                    <BiNote /> Notes & Internal Remarks
                                </div>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>
                                        Estimator Notes
                                    </label>
                                    <RichTextEditor
                                        label="Estimator Notes"
                                        value={formData.project_estimator_notes}
                                        onChange={(val) => handleChange('project_estimator_notes', val)}
                                        placeholder="Notes recorded by estimators during takeoff..."
                                    />
                                </div>

                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>
                                        Admin Notes
                                    </label>
                                    <RichTextEditor
                                        label="Admin Notes"
                                        value={formData.project_admin_notes}
                                        onChange={(val) => handleChange('project_admin_notes', val)}
                                        placeholder="Administrative instructions, priority remarks..."
                                    />
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* ========== RIGHT COLUMN ========== */}
                    <div className={styles.formColumn}>

                        {/* Card 1: Assigned Clients (Standalone Modal & Clean Cards) */}
                        <div className={styles.formCard}>
                            <div className={styles.cardHeader}>
                                <div className={styles.cardHeaderTitle}>
                                    <BiBuilding /> Assigned Clients
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className={styles.clientCountBadge}>
                                        {selectedClientIds.length} {selectedClientIds.length === 1 ? 'client' : 'clients'}
                                    </span>
                                    <button
                                        type="button"
                                        className={styles.btnAddClient}
                                        onClick={() => setAddClientModalOpen(true)}
                                        title="Add / Assign clients to this project"
                                    >
                                        <BiPlusCircle size={14} /> Add Client
                                    </button>
                                </div>
                            </div>
                            <div className={styles.cardBody}>
                                {selectedClientIds.length === 0 ? (
                                    <div className={styles.emptyClientsState}>
                                        <BiBuilding size={32} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                                        <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#475569' }}>
                                            No clients assigned to this project yet
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                                            Click "+ Add Client" above to assign clients.
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.assignedClientsList}>
                                        {selectedClientIds.map((cId) => {
                                            const client = clients.find((c) => Number(c.id) === Number(cId)) || { id: cId, name: `Client #${cId}` };
                                            const isAdminClient = (client.client_type || '').toLowerCase() === 'admin';
                                            const clientName = client.name || client.title || `Client #${client.id}`;
                                            const initials = getInitials(clientName);
                                            const clientTitle = client.title || client.company_name || 'No title / company';

                                            return (
                                                <div key={cId} className={styles.clientCard}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div
                                                                className={`${styles.clientAvatar} ${isAdminClient ? styles.clientAvatarAdmin : styles.clientAvatarNormal
                                                                    }`}
                                                            >
                                                                {initials}
                                                            </div>
                                                            <div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                                                                        {clientName}
                                                                    </span>
                                                                    <span
                                                                        className={`${styles.clientTypeBadge} ${isAdminClient ? styles.clientTypeBadgeAdmin : styles.clientTypeBadgeNormal
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
                                                            <button
                                                                type="button"
                                                                className={styles.clientEditPill}
                                                                onClick={() => openClientEditModal(client)}
                                                                title="Edit Client Details (All columns)"
                                                            >
                                                                <BiEdit size={13} /> Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={styles.clientRemovePill}
                                                                onClick={() => handleRemoveClient(cId)}
                                                                title="Remove client from project"
                                                            >
                                                                <BiTrash size={13} /> Remove
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {client.notes && (
                                                        <div className={styles.clientNotesBlock}>
                                                            <span className={styles.clientNotesLabel}>
                                                                <BiNote /> Client Notes
                                                            </span>
                                                            <div
                                                                className={styles.clientNotesContent}
                                                                dangerouslySetInnerHTML={{ __html: client.notes }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Card 2: Schedule & Status (Dynamic Status Enum) */}
                        <div className={styles.formCard}>
                            <div className={styles.cardHeader}>
                                <div className={styles.cardHeaderTitle}>
                                    <BiCalendar /> Status & Schedule
                                </div>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.row2}>
                                    {/* Progress Status (Fetched Dynamically from DB Enum) */}
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>
                                            Progress Status
                                        </label>
                                        <Select
                                            options={progressStatusOptions}
                                            value={formData.project_progress_status}
                                            onChange={(val) => handleChange('project_progress_status', val)}
                                        />
                                    </div>

                                    {/* Preview Status */}
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Visibility</label>
                                        <Select
                                            options={previewStatusOptions}
                                            value={formData.project_preview_status}
                                            onChange={(val) => handleChange('project_preview_status', val)}
                                        />
                                    </div>
                                </div>

                                <div className={styles.row2}>
                                    {/* Due Date */}
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Project Due Date</label>
                                        <input
                                            type="date"
                                            className={styles.textInput}
                                            value={formData.project_due_date ? formData.project_due_date.slice(0, 10) : ''}
                                            onChange={(e) => handleChange('project_due_date', e.target.value)}
                                        />
                                    </div>

                                    {/* Late Flag */}
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Marked Late Flag</label>
                                        <Select
                                            options={LATE_OPTIONS}
                                            value={formData.is_project_late}
                                            onChange={(val) => handleChange('is_project_late', Number(val))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card 3: Metrics & Pricing Specifications */}
                        <div className={styles.formCard}>
                            <div className={styles.cardHeader}>
                                <div className={styles.cardHeaderTitle}>
                                    <BiDollarCircle /> Financials & Technical Parameters
                                </div>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.row2}>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Total Budget ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className={styles.textInput}
                                            placeholder="0.00"
                                            value={formData.project_total_budget || ''}
                                            onChange={(e) => handleChange('project_total_budget', e.target.value)}
                                        />
                                    </div>

                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Deduction Amount ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className={styles.textInput}
                                            placeholder="0.00"
                                            value={formData.project_deduction_amount || ''}
                                            onChange={(e) => handleChange('project_deduction_amount', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className={styles.row3}>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Project Points</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            className={styles.textInput}
                                            placeholder="e.g. 50"
                                            value={formData.project_points || ''}
                                            onChange={(e) => handleChange('project_points', e.target.value)}
                                        />
                                    </div>

                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Area / SqFt</label>
                                        <input
                                            type="text"
                                            className={styles.textInput}
                                            placeholder="e.g. 12,500"
                                            value={formData.project_area || ''}
                                            onChange={(e) => handleChange('project_area', e.target.value)}
                                        />
                                    </div>

                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Floor Number</label>
                                        <input
                                            type="text"
                                            className={styles.textInput}
                                            placeholder="e.g. 3"
                                            value={formData.project_floor_number || ''}
                                            onChange={(e) => handleChange('project_floor_number', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className={styles.row3}>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Construction Type</label>
                                        <Select
                                            options={constructionTypeOptions}
                                            value={formData.project_construction_type}
                                            onChange={(val) => handleChange('project_construction_type', val)}
                                        />
                                    </div>

                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Pricing Mode</label>
                                        <Select
                                            options={pricingModeOptions}
                                            value={formData.project_pricing || 'No'}
                                            onChange={(val) => handleChange('project_pricing', val)}
                                            placeholder="Select Pricing Mode"
                                        />
                                    </div>

                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Source</label>
                                        <Select
                                            options={sourceOptions}
                                            value={formData.project_source}
                                            onChange={(val) => handleChange('project_source', val)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card 4: Dynamic Custom Database Attributes */}
                        {dynamicFields.length > 0 && (
                            <div className={styles.formCard}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardHeaderTitle}>
                                        <BiTable /> Dynamic Database Attributes
                                    </div>
                                </div>
                                <div className={styles.cardBody}>
                                    {dynamicFields.map((field) => {
                                        const val = formData[field.name] || '';

                                        if (field.base_type === 'ENUM' && field.enum_options.length > 0) {
                                            const opts = [
                                                { value: '', label: `— Select ${field.label} —` },
                                                ...field.enum_options.map((opt) => ({ value: opt, label: opt }))
                                            ];
                                            return (
                                                <div key={field.name} className={styles.fieldGroup}>
                                                    <label className={styles.fieldLabel}>{field.label}</label>
                                                    <Select
                                                        options={opts}
                                                        value={val}
                                                        onChange={(newVal) => handleChange(field.name, newVal)}
                                                    />
                                                </div>
                                            );
                                        }

                                        if (field.base_type === 'TEXT' || field.base_type === 'LONGTEXT') {
                                            return (
                                                <div key={field.name} className={styles.fieldGroup}>
                                                    <RichTextEditor
                                                        label={field.label}
                                                        value={val}
                                                        onChange={(newVal) => handleChange(field.name, newVal)}
                                                    />
                                                </div>
                                            );
                                        }

                                        if (field.base_type === 'DATE') {
                                            return (
                                                <div key={field.name} className={styles.fieldGroup}>
                                                    <label className={styles.fieldLabel}>{field.label}</label>
                                                    <input
                                                        type="date"
                                                        className={styles.textInput}
                                                        value={val ? String(val).slice(0, 10) : ''}
                                                        onChange={(e) => handleChange(field.name, e.target.value)}
                                                    />
                                                </div>
                                            );
                                        }

                                        if (field.base_type === 'INT' || field.base_type === 'DECIMAL' || field.base_type === 'FLOAT') {
                                            return (
                                                <div key={field.name} className={styles.fieldGroup}>
                                                    <label className={styles.fieldLabel}>{field.label}</label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        className={styles.textInput}
                                                        value={val}
                                                        onChange={(e) => handleChange(field.name, e.target.value)}
                                                    />
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={field.name} className={styles.fieldGroup}>
                                                <label className={styles.fieldLabel}>{field.label}</label>
                                                <input
                                                    type="text"
                                                    className={styles.textInput}
                                                    value={val}
                                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </form>

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
                                    Filter by client status/type and assign to this project
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
                            {filteredModalClients.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                    <BiBuilding size={32} style={{ marginBottom: '8px' }} />
                                    <div>No clients match the selected filter.</div>
                                </div>
                            ) : (
                                filteredModalClients.map((cl) => {
                                    const clientName = cl.name || cl.title || `Client #${cl.id}`;
                                    const initials = getInitials(clientName);
                                    const isAdmin = (cl.client_type || '').toLowerCase() === 'admin';
                                    const alreadyAssigned = selectedClientIds.some((id) => Number(id) === Number(cl.id));

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
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveClient(cl.id)}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            color: '#059669',
                                                            background: '#ecfdf5',
                                                            border: '1px solid #a7f3d0',
                                                            padding: '5px 12px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Click to remove client from project"
                                                    >
                                                        <BiCheck size={14} /> Assigned
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAssignClient(cl.id)}
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
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <BiPlusCircle size={14} /> Assign
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

            {/* Standalone Edit Client Details Modal */}
            {clientModal.open && (
                <Modal
                    isOpen={clientModal.open}
                    onClose={() => setClientModal((prev) => ({ ...prev, open: false }))}
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BiEdit size={20} color="#4f46e5" />
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                    Edit Client #{clientModal.client?.id}
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                                    Update contact info, role type, and notes for this client
                                </div>
                            </div>
                        </div>
                    }
                    width="660px"
                >
                    <form onSubmit={handleSaveClient} className={styles.modalBodyWrap}>
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
        </div>
    );
};

export default ProjectForm;
