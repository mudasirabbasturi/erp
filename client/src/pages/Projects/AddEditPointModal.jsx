import React, { useState, useEffect, useMemo } from 'react';
import {
    BiAward,
    BiErrorCircle,
    BiSave,
    BiLoaderAlt,
    BiUser
} from 'react-icons/bi';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal/Modal';
import { useToast } from '../../components/ui/Toast';
import { getMediaUrl } from '../../utils/media';

const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Reusable Team Member Points Allocation Modal
 *
 * 100% identical in functionality, calculations, and UX across
 * ProjectsList and ProjectView.
 */
const AddEditPointModal = ({
    isOpen,
    onClose,
    project,
    onSuccess = null
}) => {
    const toast = useToast();
    const [memberPointsMap, setMemberPointsMap] = useState({});
    const [saving, setSaving] = useState(false);

    const members = useMemo(() => {
        return project?.project_team_members || project?.team_members || [];
    }, [project]);

    const totalProjectPoints = Number(project?.project_points || 0);

    // Initialize points map whenever modal opens or project changes
    useEffect(() => {
        if (isOpen) {
            const initialMap = {};
            members.forEach((m) => {
                initialMap[m.id] = Number(m.points_gain || 0);
            });
            setMemberPointsMap(initialMap);
        }
    }, [isOpen, members]);

    // Live allocated points
    const modalAllocatedPoints = useMemo(() => {
        return Object.values(memberPointsMap).reduce((acc, pts) => acc + (Number(pts) || 0), 0);
    }, [memberPointsMap]);

    // Live remaining points
    const modalRemainingPoints = useMemo(() => {
        return totalProjectPoints - modalAllocatedPoints;
    }, [totalProjectPoints, modalAllocatedPoints]);

    if (!isOpen) return null;

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!project?.id) return;

        setSaving(true);
        try {
            const membersPayload = Object.entries(memberPointsMap).map(([mId, pts]) => ({
                id: Number(mId),
                points_gain: Math.max(0, Number(pts) || 0)
            }));

            const res = await apiClient.put(`/projects/${project.id}/team/points`, { members: membersPayload });
            if (res.success) {
                toast.success('Team Points Updated', 'Team points allocation saved successfully.');
                if (onSuccess) onSuccess();
                onClose();
            } else {
                toast.error('Failed to Update Points', res.message || 'Could not update points.');
            }
        } catch (err) {
            toast.error('Error', err.message || 'Failed to update team points');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BiAward size={20} color="#4f46e5" />
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                            Edit Team Member Points
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                            {project?.project_title ? `${project.project_title} · ` : ''}Allocate points across team members with real-time remaining points calculation
                        </div>
                    </div>
                </div>
            }
            width="620px"
        >
            <form onSubmit={handleSave} style={{ padding: '6px 0' }}>
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
                                {totalProjectPoints.toFixed(1)} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>pts</span>
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
                                width: `${Math.min(100, Math.max(0, (modalAllocatedPoints / Math.max(1, totalProjectPoints || 1)) * 100))}%`,
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
                {members.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                        {members.map((m) => {
                            const displayName = m.name || m.full_name || m.username || m.user?.name || `User #${m.user_id}`;
                            const initials = getInitials(displayName);
                            const currentPts = memberPointsMap[m.id] !== undefined ? memberPointsMap[m.id] : Number(m.points_gain || 0);
                            const avatarSrc = (m.avatar_url || m.avatar) ? getMediaUrl(m.avatar_url || m.avatar) : null;

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
                                            justifyContent: 'center',
                                            overflow: 'hidden'
                                        }}>
                                            {avatarSrc ? (
                                                <img src={avatarSrc} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                ) : (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                        <BiUser size={32} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>No Team Members Assigned</div>
                        <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                            Members must join the project before points can be allocated.
                        </div>
                    </div>
                )}

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
                        onClick={onClose}
                        disabled={saving}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#475569',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || members.length === 0}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 18px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#4f46e5',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: saving || members.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: saving || members.length === 0 ? 0.7 : 1
                        }}
                    >
                        {saving ? <BiLoaderAlt className="spin" size={16} /> : <BiSave size={16} />}
                        Save Points Allocation
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AddEditPointModal;
