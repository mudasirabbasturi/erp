import React, { useState, useEffect } from 'react';
import {
    BiPlus,
    BiUser,
    BiCheck,
    BiTrash,
    BiLock,
    BiLockOpen,
    BiCalendar,
    BiNote,
    BiTrophy,
    BiLayer
} from 'react-icons/bi';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal/Modal';
import InputText from '../../components/ui/InputText/InputText';
import Select from '../../components/ui/Select/Select';
import RichTextEditor from '../../components/ui/RichTextEditor/RichTextEditor';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';

const STATUS_OPTIONS = [
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'needs_review', label: 'Needs Review' },
];

const PRESET_STEP_COLORS = [
    '#0284c7', // Sky Blue
    '#059669', // Emerald
    '#d97706', // Amber
    '#7c3aed', // Purple
    '#e11d48', // Rose
    '#4f46e5', // Indigo
    '#0f766e', // Teal
];

const JoinProjectModal = ({
    isOpen,
    onClose,
    project,
    memberToEdit = null,
    onSuccess
}) => {
    const toast = useToast();
    const { user: authUser } = useAuth();

    const isAdmin = Boolean(
        authUser?.is_super_admin === 1 ||
        authUser?.role_id === 1 ||
        authUser?.role_id === 2 ||
        authUser?.role_name?.toLowerCase().includes('admin') ||
        (authUser?.roles && authUser.roles.some(r => ['super-admin', 'admin', 'administrator'].includes(r.slug))) ||
        (authUser?.permissions && (authUser.permissions.includes('add_edit_score') || authUser.permissions.includes('update_score')))
    );

    const [stepsCatalog, setStepsCatalog] = useState([]);
    const [selectedSteps, setSelectedSteps] = useState([]);
    const [newStepName, setNewStepName] = useState('');
    const [addingStep, setAddingStep] = useState(false);
    const [status, setStatus] = useState('in_progress');
    const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 10));
    const [completedAt, setCompletedAt] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Load available steps catalog
    const loadInitialData = async () => {
        try {
            const stepsRes = await apiClient.get('/project-steps');
            if (stepsRes.success && stepsRes.data) {
                setStepsCatalog(stepsRes.data);
            }
        } catch (err) {
            console.error('Failed to load steps:', err);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadInitialData();

            if (memberToEdit) {
                setSelectedSteps(Array.isArray(memberToEdit.steps) ? memberToEdit.steps : []);
                setStatus(memberToEdit.status || 'in_progress');
                setStartedAt(memberToEdit.started_at ? memberToEdit.started_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
                setCompletedAt(memberToEdit.completed_at ? memberToEdit.completed_at.slice(0, 10) : '');
                setNotes(memberToEdit.notes || '');
            } else {
                setSelectedSteps(['Marking']);
                setStatus('in_progress');
                setStartedAt(new Date().toISOString().slice(0, 10));
                setCompletedAt('');
                setNotes('');
            }
            setNewStepName('');
        }
    }, [isOpen, memberToEdit]);

    const handleToggleStep = (stepName) => {
        setSelectedSteps((prev) =>
            prev.includes(stepName) ? prev.filter((s) => s !== stepName) : [...prev, stepName]
        );
    };

    // Dynamically create a new step in the steps catalog
    const handleAddNewStep = async (e) => {
        e.preventDefault();
        const trimmed = newStepName.trim();
        if (!trimmed) return;

        if (stepsCatalog.some((s) => s.step_name.toLowerCase() === trimmed.toLowerCase())) {
            toast.warning('Step Exists', 'This step is already in the catalog.');
            if (!selectedSteps.includes(trimmed)) {
                setSelectedSteps((prev) => [...prev, trimmed]);
            }
            setNewStepName('');
            return;
        }

        setAddingStep(true);
        try {
            const randomColor = PRESET_STEP_COLORS[stepsCatalog.length % PRESET_STEP_COLORS.length];
            const res = await apiClient.post('/project-steps', {
                step_name: trimmed,
                color: randomColor,
                sort_order: stepsCatalog.length + 1
            });

            if (res.success && res.data) {
                const created = res.data;
                setStepsCatalog((prev) => [...prev, created]);
                setSelectedSteps((prev) => [...prev, created.step_name]);
                setNewStepName('');
                toast.success('Step Added', `New step "${created.step_name}" added to catalog.`);
            }
        } catch (err) {
            toast.error('Failed to add step', err.message);
        } finally {
            setAddingStep(false);
        }
    };

    const handleSave = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const currentUserId = memberToEdit?.user_id || authUser?.id;
        if (!currentUserId) {
            toast.error('Authentication Error', 'No active user found. Please sign in again.');
            return;
        }

        if (selectedSteps.length === 0) {
            toast.error('Validation Error', 'Please select at least one task/step to join.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                user_id: Number(currentUserId),
                steps: selectedSteps,
                status,
                started_at: startedAt || null,
                completed_at: status === 'completed' && !completedAt ? new Date().toISOString().slice(0, 10) : (completedAt || null),
                notes: notes.trim() || null
            };

            if (memberToEdit) {
                await apiClient.put(`/projects/${project.id}/team/${memberToEdit.id}`, payload);
                toast.success('Updated', 'Project tasks and participation updated successfully.');
            } else {
                await apiClient.post(`/projects/${project.id}/team/join`, payload);
                toast.success('Joined Project', 'You have successfully joined this project!');
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            toast.error('Save Failed', err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleLeave = async () => {
        if (!memberToEdit) return;
        if (!window.confirm(`Are you sure you want to leave / remove your participation from "${project.project_title}"?`)) {
            return;
        }

        setSaving(true);
        try {
            await apiClient.delete(`/projects/${project.id}/team/${memberToEdit.id}`);
            toast.success('Left Project', 'You have left this project.');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            toast.error('Removal Failed', err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                memberToEdit
                    ? `Edit My Project Tasks: ${project?.project_title || ''}`
                    : `Join Project: ${project?.project_title || ''}`
            }
            size="large"
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                        {memberToEdit && (
                            <button
                                type="button"
                                onClick={handleLeave}
                                disabled={saving}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '7px 14px',
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    borderRadius: '6px',
                                    color: '#dc2626',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                <BiTrash size={14} /> Leave Project
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '7px 16px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#475569',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '7px 20px',
                                background: '#4f46e5',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: saving ? 'not-allowed' : 'pointer',
                                boxShadow: '0 1px 2px rgba(79, 70, 229, 0.25)',
                                opacity: saving ? 0.7 : 1
                            }}
                        >
                            {memberToEdit ? <BiCheck size={16} /> : <BiPlus size={16} />}
                            {saving ? 'Saving...' : memberToEdit ? 'Save Changes' : 'Join & Save'}
                        </button>
                    </div>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Project Header Summary */}
                <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                            {project?.project_title}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                            Project #{project?.id} • Client: {project?.client_name || 'N/A'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#475569' }}>
                            Total Budget: <strong style={{ color: '#0f172a' }}>${Number(project?.project_total_budget || 0).toLocaleString()}</strong>
                        </div>
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        <div style={{ fontSize: '12px', color: '#475569' }}>
                            Project Points: <strong style={{ color: '#4f46e5' }}>{project?.project_points ?? 0} pts</strong>
                        </div>
                    </div>
                </div>

                {/* Logged in Member Joining Profile info */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '10px 14px'
                }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#4f46e5',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '13px'
                    }}>
                        {(authUser?.first_name?.[0] || authUser?.username?.[0] || 'U').toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>
                                {authUser?.full_name || `${authUser?.first_name || ''} ${authUser?.last_name || ''}`.trim() || authUser?.username}
                            </span>
                            <span style={{ fontSize: '10px', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                {authUser?.role_name || (authUser?.is_super_admin === 1 ? 'Super Admin' : 'Staff')}
                            </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {memberToEdit ? 'Updating your assigned tasks, steps, and progress status in this project' : 'Select tasks/steps and progress status to join this project'}
                        </div>
                    </div>
                </div>

                {/* Flexible Project Steps Catalog */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BiLayer color="#4f46e5" /> Select Tasks & Steps for this Member *
                        </label>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {selectedSteps.length} step(s) selected
                        </span>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '8px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '12px',
                        maxHeight: '180px',
                        overflowY: 'auto'
                    }}>
                        {stepsCatalog.map((st) => {
                            const isChecked = selectedSteps.includes(st.step_name);
                            return (
                                <label
                                    key={st.id || st.step_key}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        background: isChecked ? '#eef2ff' : '#f8fafc',
                                        border: `1px solid ${isChecked ? '#a5b4fc' : '#e2e8f0'}`,
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: isChecked ? 600 : 500,
                                        color: isChecked ? '#3730a3' : '#334155',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleStep(st.step_name)}
                                        style={{ accentColor: '#4f46e5', width: '15px', height: '15px' }}
                                    />
                                    <span style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: st.color || '#4f46e5',
                                        flexShrink: 0
                                    }} />
                                    <span>{st.step_name}</span>
                                </label>
                            );
                        })}
                    </div>

                    {/* Inline Quick Add New Step to Catalog */}
                    <div style={{
                        marginTop: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#f8fafc',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px dashed #cbd5e1'
                    }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                            Add New Step:
                        </span>
                        <input
                            type="text"
                            value={newStepName}
                            onChange={(e) => setNewStepName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddNewStep(e);
                                }
                            }}
                            placeholder="e.g. Architectural Takeoff, Site Inspection"
                            style={{
                                flex: 1,
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                padding: '5px 10px',
                                fontSize: '12px',
                                background: '#ffffff'
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleAddNewStep}
                            disabled={addingStep || !newStepName.trim()}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 12px',
                                background: '#4f46e5',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: addingStep || !newStepName.trim() ? 'not-allowed' : 'pointer',
                                opacity: addingStep || !newStepName.trim() ? 0.6 : 1
                            }}
                        >
                            <BiPlus size={14} /> Add
                        </button>
                    </div>
                </div>

                {/* Status & Dates Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                            Member Progress Status
                        </label>
                        <Select
                            options={STATUS_OPTIONS}
                            value={status}
                            onChange={(val) => setStatus(val)}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                            <BiCalendar style={{ marginRight: '4px' }} /> Started Date
                        </label>
                        <input
                            type="date"
                            value={startedAt}
                            onChange={(e) => setStartedAt(e.target.value)}
                            style={{
                                width: '100%',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '7px 12px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                            <BiCalendar style={{ marginRight: '4px' }} /> Completed Date
                        </label>
                        <input
                            type="date"
                            value={completedAt}
                            onChange={(e) => setCompletedAt(e.target.value)}
                            style={{
                                width: '100%',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '7px 12px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                        <BiNote style={{ marginRight: '4px' }} /> Member Task Notes
                    </label>
                    <RichTextEditor
                        value={notes || ''}
                        onChange={(content) => setNotes(content)}
                        placeholder="Add any specific scope notes, takeoff notes, or milestones for this member..."
                        minHeight={90}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default JoinProjectModal;
