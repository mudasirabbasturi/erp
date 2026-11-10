import React from 'react';
import {
    BiFolder,
    BiBuilding,
    BiMapPin,
    BiCalendar,
    BiDollarCircle,
    BiEdit,
    BiShow,
    BiHistory,
    BiLinkExternal,
    BiNote,
    BiFile,
    BiErrorCircle,
    BiCheckCircle,
    BiGroup,
    BiUser,
    BiLock,
    BiLockOpen,
    BiPlus,
    BiTrash,
    BiTrophy,
    BiPhone,
    BiEnvelope,
    BiShieldQuarter
} from 'react-icons/bi';
import { getMediaUrl } from '../../utils/media';
import { RichContentView } from '../../components/ui/RichTextEditor';
import styles from './Projects.module.css';

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

const ProjectCustomDetail = (params) => {
    const project = params.data;
    if (!project) return null;

    const { onEdit, onView, onActivity, onJoinTeam, onLeaveTeam } = params;

    const totalBudget = Number(project.project_total_budget || 0);
    const deduction = Number(project.project_deduction_amount || 0);
    const netValue = totalBudget - deduction;
    const members = project.project_team_members || project.team_members || [];

    return (
        <div style={{
            padding: '20px 24px',
            background: '#f8fafc',
            borderTop: '2px solid #4f46e5',
            borderBottom: '2px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            fontFamily: 'var(--font-family, "Adobe Clean Regular", sans-serif)',
            boxSizing: 'border-box',
            width: '100%'
        }}>
            {/* Top Card: Project Header & Quick Actions */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                background: '#ffffff',
                padding: '14px 20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: '#eef2ff',
                        color: '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <BiFolder size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                            {project.project_title}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            <span style={{ fontWeight: 600 }}>Project ID: #{project.id}</span>
                            {project.client_name && (
                                <>
                                    <span>•</span>
                                    <span style={{ fontWeight: 600, color: '#334155' }}>
                                        Client: {project.client_name} {project.client_code ? `(${project.client_code})` : ''}
                                    </span>
                                </>
                            )}
                            {project.project_due_date && (
                                <>
                                    <span>•</span>
                                    <span>Due: <strong>{project.project_due_date}</strong></span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className={`${styles.statusBadge} ${getStatusBadgeClass(project.project_progress_status)}`}>
                        {project.project_progress_status || 'Pending'}
                    </span>

                    {project.is_project_late === 1 ? (
                        <span className={styles.lateBadge}>
                            <BiErrorCircle size={12} /> OVERDUE / LATE
                        </span>
                    ) : (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '3px 8px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                            ● On Schedule
                        </span>
                    )}

                    {onActivity && (
                        <button
                            type="button"
                            onClick={() => onActivity(project)}
                            className={styles.btnSecondary}
                            style={{ padding: '5px 10px', fontSize: '11px' }}
                            title="Audit Activity Logs"
                        >
                            <BiHistory /> Activity
                        </button>
                    )}

                    {onEdit && (
                        <button
                            type="button"
                            onClick={() => onEdit(project)}
                            className={styles.btnSecondary}
                            style={{ padding: '5px 10px', fontSize: '11px' }}
                            title="Edit Project"
                        >
                            <BiEdit /> Edit
                        </button>
                    )}

                    {onView && (
                        <button
                            type="button"
                            onClick={() => onView(project)}
                            className={styles.btnPrimary}
                            style={{ padding: '5px 12px', fontSize: '11px' }}
                            title="Open Full Page View"
                        >
                            <BiShow /> Full Page
                        </button>
                    )}
                </div>
            </div>

            {/* Row 2: Two Big Overview Cards: Financial Metrics & Full Client Details */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '16px'
            }}>
                {/* Financial Metrics & Profit Card */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <div style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderBottom: '1px solid #f1f5f9',
                        paddingBottom: '8px'
                    }}>
                        <BiDollarCircle size={18} style={{ color: '#059669' }} /> Financial Metrics & Profit Value
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '10px'
                    }}>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                Total Budget
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#059669', marginTop: '3px', fontFamily: 'Consolas, monospace' }}>
                                {project.project_total_budget ? `$${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                            </div>
                        </div>

                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                Deduction Amount
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626', marginTop: '3px', fontFamily: 'Consolas, monospace' }}>
                                {project.project_deduction_amount ? `-$${deduction.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$0.00'}
                            </div>
                        </div>

                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                Net Project Margin
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#4f46e5', marginTop: '3px', fontFamily: 'Consolas, monospace' }}>
                                {project.project_total_budget ? `$${netValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                            </div>
                        </div>

                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                Project Due Date
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: project.is_project_late === 1 ? '#dc2626' : '#0f172a', marginTop: '3px' }}>
                                {project.project_due_date || 'No Date Specified'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Client Full Information Card */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <div style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #f1f5f9',
                        paddingBottom: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BiBuilding size={18} style={{ color: '#4f46e5' }} /> Client & Organization Details
                        </div>
                        {project.client_type && (
                            <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: project.client_type === 'admin' ? '#fef3c7' : '#e0e7ff',
                                color: project.client_type === 'admin' ? '#92400e' : '#3730a3',
                                border: `1px solid ${project.client_type === 'admin' ? '#fde68a' : '#c7d2fe'}`
                            }}>
                                {project.client_type === 'admin' ? 'Priority / Admin Client' : 'Standard Client'}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#64748b' }}>Client Name / Title:</span>
                            <strong style={{ color: '#0f172a' }}>
                                {project.client_name || 'No Client Assigned'} {project.client_code ? `(${project.client_code})` : ''}
                            </strong>
                        </div>

                        {project.client_email && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <BiEnvelope size={14} /> Email:
                                </span>
                                <a href={`mailto:${project.client_email}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                                    {project.client_email}
                                </a>
                            </div>
                        )}

                        {project.client_phone && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <BiPhone size={14} /> Phone:
                                </span>
                                <span style={{ color: '#0f172a', fontWeight: 600 }}>
                                    {project.client_phone}
                                </span>
                            </div>
                        )}

                        {(project.client_city || project.client_state || project.client_country) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <BiMapPin size={14} /> Location:
                                </span>
                                <span style={{ color: '#334155', fontWeight: 600 }}>
                                    {[project.client_city, project.client_state, project.client_country].filter(Boolean).join(', ')}
                                </span>
                            </div>
                        )}

                        {project.client_address && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span style={{ color: '#64748b' }}>Full Address:</span>
                                <span style={{ color: '#334155', textAlign: 'right', maxWidth: '65%' }}>
                                    {project.client_address}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Team Members & Task Contributions Card */}
            <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '8px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BiGroup size={18} style={{ color: '#4f46e5' }} />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                            Project Team Members & Task Steps
                        </span>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            background: '#e0e7ff',
                            color: '#3730a3',
                            padding: '2px 8px',
                            borderRadius: '10px'
                        }}>
                            {members.length} {members.length === 1 ? 'member' : 'members'}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {/* Points Indicator */}
                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BiTrophy style={{ color: '#d97706' }} />
                            <span>
                                Total: <strong style={{ color: '#0f172a' }}>{Number(project.project_points || 0)} pts</strong>
                            </span>
                            <span>•</span>
                            <span>
                                Used: <strong style={{ color: '#0284c7' }}>{project.points_used ?? 0}</strong>
                            </span>
                            <span>•</span>
                            <span style={{
                                color: (project.points_left ?? 0) > 0 ? '#059669' : '#dc2626',
                                fontWeight: 600
                            }}>
                                Left: {project.points_left ?? 0}
                            </span>
                        </div>

                        {/* Join / Edit My Participation button */}
                        {onJoinTeam && (
                            <button
                                type="button"
                                onClick={() => onJoinTeam(project, project.current_user_member || null)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '5px 12px',
                                    background: project.is_joined ? '#ecfdf5' : '#4f46e5',
                                    border: `1px solid ${project.is_joined ? '#a7f3d0' : '#4338ca'}`,
                                    color: project.is_joined ? '#047857' : '#ffffff',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }}
                            >
                                {project.is_joined ? <BiLockOpen size={14} /> : <BiLock size={14} />}
                                {project.is_joined ? 'Edit My Tasks' : 'Join Project'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Member Cards List */}
                {members.length === 0 ? (
                    <div style={{
                        padding: '16px',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontSize: '12px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px dashed #cbd5e1'
                    }}>
                        No team members have joined this project yet. Click <strong>"Join Project"</strong> to join and assign steps.
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '10px'
                    }}>
                        {members.map((m) => {
                            const steps = Array.isArray(m.steps) ? m.steps : [];
                            const avatarUrl = m.avatar_url ? getMediaUrl(m.avatar_url) : null;
                            const isCompleted = m.status === 'completed';

                            return (
                                <div
                                    key={m.id}
                                    style={{
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        padding: '10px 12px',
                                        background: '#f8fafc',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                background: '#4f46e5',
                                                color: '#ffffff',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden'
                                            }}>
                                                {avatarUrl ? (
                                                    <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    (m.first_name?.[0] || m.username?.[0] || 'U').toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                                                    {m.full_name || m.username}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#64748b' }}>
                                                    {m.role_name || 'Staff'} {m.email ? `• ${m.email}` : ''}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: 700,
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                textTransform: 'uppercase',
                                                background: isCompleted ? '#dcfce7' : m.status === 'on_hold' ? '#fee2e2' : '#fef3c7',
                                                color: isCompleted ? '#15803d' : m.status === 'on_hold' ? '#dc2626' : '#b45309'
                                            }}>
                                                {m.status?.replace('_', ' ')}
                                            </span>

                                            {onJoinTeam && (
                                                <button
                                                    type="button"
                                                    onClick={() => onJoinTeam(project, m)}
                                                    style={{
                                                        background: '#ffffff',
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '4px',
                                                        padding: '3px 6px',
                                                        fontSize: '11px',
                                                        cursor: 'pointer',
                                                        color: '#475569'
                                                    }}
                                                    title="Edit participation details"
                                                >
                                                    <BiEdit size={12} />
                                                </button>
                                            )}
                                            {onLeaveTeam && (
                                                <button
                                                    type="button"
                                                    onClick={() => onLeaveTeam(project, m.id)}
                                                    style={{
                                                        background: '#fef2f2',
                                                        border: '1px solid #fecaca',
                                                        borderRadius: '4px',
                                                        padding: '3px 6px',
                                                        fontSize: '11px',
                                                        cursor: 'pointer',
                                                        color: '#dc2626'
                                                    }}
                                                    title="Remove from project"
                                                >
                                                    <BiTrash size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Steps Assigned */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {steps.map((st) => (
                                            <span
                                                key={st}
                                                style={{
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: '#ffffff',
                                                    border: '1px solid #cbd5e1',
                                                    color: '#334155'
                                                }}
                                            >
                                                {st}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Score and Dates */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: '11px',
                                        color: '#64748b',
                                        borderTop: '1px solid #e2e8f0',
                                        paddingTop: '6px'
                                    }}>
                                        <div>
                                            Points Gained: <strong style={{ color: '#0f172a' }}>{m.points_gain ?? 0} pts</strong>
                                        </div>
                                        <div>
                                            {m.started_at ? `Started: ${m.started_at.slice(0, 10)}` : ''}
                                            {m.completed_at ? ` • Done: ${m.completed_at.slice(0, 10)}` : ''}
                                        </div>
                                    </div>

                                    {m.notes && (
                                        <div style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic', background: '#ffffff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                                            "{m.notes}"
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Scope, Specs, Links & Notes Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '16px'
            }}>
                {/* Left Card: Scope & Specifications */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                        <BiFile style={{ color: '#4f46e5' }} /> Scope & Technical Breakdown
                    </div>

                    {project.project_main_scope && (
                        <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Main Scope</div>
                            <div style={{ fontSize: '12px', color: '#1e293b', lineHeight: 1.5, marginTop: '2px' }}>
                                <RichContentView html={project.project_main_scope} />
                            </div>
                        </div>
                    )}

                    {project.project_scope_details && (
                        <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Scope Details</div>
                            <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5, marginTop: '2px' }}>
                                <RichContentView html={project.project_scope_details} />
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '4px', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px' }}>
                        <div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>CONSTRUCTION</span>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', textTransform: 'capitalize' }}>
                                {project.project_construction_type || '—'}
                            </div>
                        </div>
                        <div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>AREA / SQFT</span>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                                {project.project_area || '—'}
                            </div>
                        </div>
                        <div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>FLOOR</span>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                                {project.project_floor_number || '—'}
                            </div>
                        </div>
                        <div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>TEMPLATE</span>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                                {project.project_template || '—'}
                            </div>
                        </div>
                        <div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>SOURCE</span>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                                {project.project_source || 'InSource'}
                            </div>
                        </div>
                        <div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>PRICING MODE</span>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                                {project.project_pricing || '—'}
                            </div>
                        </div>
                    </div>

                    {/* Site Address */}
                    {project.project_address && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                            <BiMapPin size={15} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                            <span>{project.project_address}</span>
                        </div>
                    )}
                </div>

                {/* Right Card: Links & Notes */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    {/* Cloud Folders & Links */}
                    {(project.project_init_link || project.project_final_link) && (
                        <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <BiLinkExternal /> Cloud Drawing & Takeoff Links
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {project.project_init_link && (
                                    <a
                                        href={project.project_init_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '6px 12px',
                                            background: '#eff6ff',
                                            color: '#1d4ed8',
                                            border: '1px solid #bfdbfe',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            textDecoration: 'none'
                                        }}
                                    >
                                        <BiFolder size={14} /> Initial Drawings <BiLinkExternal size={11} />
                                    </a>
                                )}

                                {project.project_final_link && (
                                    <a
                                        href={project.project_final_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '6px 12px',
                                            background: '#ecfdf5',
                                            color: '#047857',
                                            border: '1px solid #a7f3d0',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            textDecoration: 'none'
                                        }}
                                    >
                                        <BiCheckCircle size={14} /> Final Takeoff Deliverable <BiLinkExternal size={11} />
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Notes Box */}
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        flex: 1
                    }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BiNote style={{ color: '#f59e0b' }} /> Project Notes & Remarks
                        </div>

                        {(project.project_estimator_notes || project.project_notes) && (
                            <div style={{ fontSize: '12px', color: '#334155', background: '#f8fafc', padding: '8px 12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', marginBottom: '2px' }}>Estimator Notes</div>
                                <RichContentView html={project.project_estimator_notes || project.project_notes} />
                            </div>
                        )}

                        {project.project_admin_notes && (
                            <div style={{ fontSize: '12px', color: '#334155', background: '#f8fafc', padding: '8px 12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', marginBottom: '2px' }}>Admin Notes</div>
                                <RichContentView html={project.project_admin_notes} />
                            </div>
                        )}

                        {!project.project_estimator_notes && !project.project_notes && !project.project_admin_notes && (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>
                                No notes attached to this project.
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectCustomDetail;
