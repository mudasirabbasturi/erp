import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    BiArrowBack,
    BiUser,
    BiPhone,
    BiEnvelope,
    BiCreditCard,
    BiMapPin,
    BiKey,
    BiCalendar,
    BiEdit,
    BiShieldQuarter,
    BiImage,
    BiHistory
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui';
import { getMediaUrl } from '../../utils/media';
import ActivityLogViewer from '../../components/ActivityLogs/ActivityLogViewer';
import { RichContentView } from '../../components/ui/RichTextEditor';

const UserView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { setCustomBreadcrumbs } = usePageActions();
    const toast = useToast();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activityOpen, setActivityOpen] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            setLoading(true);
            try {
                const res = await apiClient.get(`/users/${id}`);
                if (res.success) {
                    setData(res.data);
                    const userName = res.data?.profile?.full_name || res.data?.user?.username || `User #${id}`;
                    setCustomBreadcrumbs([
                        { label: 'Users', to: '/users' },
                        { label: userName }
                    ]);
                }
            } catch (err) {
                toast.error(err.message || 'Failed to load user details');
            } finally {
                setLoading(false);
            }
        };
        fetchUser();

        return () => {
            setCustomBreadcrumbs(null);
        };
    }, [id, setCustomBreadcrumbs]);

    if (loading) {
        return (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '15px' }}>
                Loading user profile...
            </div>
        );
    }

    if (!data || !data.user) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ color: '#ef4444', fontWeight: 600 }}>User not found.</p>
                <button
                    onClick={() => navigate('/users')}
                    style={{
                        padding: '8px 16px',
                        background: '#4f46e5',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                    }}
                >
                    Back to Staff Directory
                </button>
            </div>
        );
    }

    const { user, profile, bank_accounts, addresses, references, meta } = data;
    const isSuper = user.is_super_admin === 1;
    const employeeId = `IMP#${String(user.id).padStart(4, '0')}`;
    const avatarUrl = profile?.avatar_file_path
        ? getMediaUrl(profile.avatar_file_path)
        : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
            {/* Top Navigation Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                    onClick={() => navigate('/users')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer'
                    }}
                >
                    <BiArrowBack size={16} /> Back to Directory
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => navigate(`/users/${id}/media`)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#0f172a',
                            cursor: 'pointer'
                        }}
                    >
                        <BiImage size={16} color="#4f46e5" /> User Media Library
                    </button>
                    <button
                        onClick={() => setActivityOpen(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#0f172a',
                            cursor: 'pointer'
                        }}
                    >
                        <BiHistory size={16} color="#4f46e5" /> Activity Log
                    </button>
                    <button
                        onClick={() => navigate(`/users/edit/${id}`)}
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
                            cursor: 'pointer'
                        }}
                    >
                        <BiEdit size={16} /> Edit User Profile
                    </button>
                </div>
            </div>

            {/* Profile Header Hero Card */}
            <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '28px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                flexWrap: 'wrap'
            }}>
                <div style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                    color: '#ffffff',
                    fontSize: '32px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: '3px solid #e0e7ff',
                    boxShadow: '0 4px 10px rgba(79, 70, 229, 0.2)'
                }}>
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={profile?.full_name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    ) : (
                        (profile?.full_name || user.username || 'U').charAt(0).toUpperCase()
                    )}
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                            {profile?.full_name || user.username}
                        </h1>
                        {isSuper ? (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '4px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                background: '#fef3c7',
                                color: '#92400e',
                                border: '1px solid #fde68a'
                            }}>
                                <BiShieldQuarter size={14} /> SUPER ADMIN
                            </span>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {(user.roles && user.roles.length > 0 ? user.roles : [{ id: user.role_id, name: user.role_name || 'Staff' }]).map(r => (
                                    <span key={r.id || r.name} style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '4px 12px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        background: '#e0e7ff',
                                        color: '#3730a3',
                                        border: '1px solid #c7d2fe'
                                    }}>
                                        <BiUser size={14} /> {r.name}
                                    </span>
                                ))}
                            </div>
                        )}
                        <span style={{
                            padding: '3px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: user.status === 'active' ? '#dcfce7' : '#fee2e2',
                            color: user.status === 'active' ? '#15803d' : '#991b1b'
                        }}>
                            ● {user.status}
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: '24px', marginTop: '12px', color: '#64748b', fontSize: '13px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ background: '#f1f5f9', color: '#4f46e5', padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.4px', fontWeight: 700 }}>{employeeId}</strong>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BiUser color="#4f46e5" /> Username: <strong style={{ color: '#0f172a' }}>{user.username}</strong>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BiEnvelope color="#4f46e5" /> Email: <strong style={{ color: '#0f172a' }}>{user.email}</strong>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BiPhone color="#4f46e5" /> Phone: <strong style={{ color: '#0f172a' }}>{profile?.phone || 'N/A'}</strong>
                        </span>
                    </div>
                </div>
            </div>

            {/* Grid of Sections */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                {/* 1. Account & Security Details */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                        <BiKey size={20} color="#4f46e5" /> Authentication & Account Info
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Employee Code:</span>
                            <span style={{ fontWeight: 700, color: '#4f46e5' }}>{employeeId}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#64748b' }}>Assigned Roles:</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'flex-end' }}>
                                {(user.roles && user.roles.length > 0 ? user.roles : [{ id: user.role_id, name: user.role_name || 'Staff' }]).map(r => (
                                    <span key={r.id || r.name} style={{ fontWeight: 600, color: '#4f46e5', background: '#eef2ff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                        {r.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Registered Date:</span>
                            <span style={{ fontWeight: 500, color: '#0f172a' }}>{user.created_at?.slice(0, 10)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Last Active:</span>
                            <span style={{ fontWeight: 500, color: '#0f172a' }}>{user.last_active_at || 'Never'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Gender:</span>
                            <span style={{ fontWeight: 500, color: '#0f172a', textTransform: 'capitalize' }}>{profile?.gender || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Employment & Dates */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                        <BiCalendar size={20} color="#4f46e5" /> Employment Timeline & Dates
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Date of Birth:</span>
                            <span style={{ fontWeight: 500, color: '#0f172a' }}>{profile?.dob || 'Not specified'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Hiring Date:</span>
                            <span style={{ fontWeight: 500, color: '#0f172a' }}>{profile?.hiring_date || 'Not specified'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Joining Date:</span>
                            <span style={{ fontWeight: 500, color: '#0f172a' }}>{profile?.joining_date || 'Not specified'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Leaving Date:</span>
                            <span style={{ fontWeight: 500, color: '#0f172a' }}>{profile?.leaving_date || 'Active Employee'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: '#64748b' }}>Internal Notes:</span>
                            <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '2px' }}>
                                <RichContentView html={profile?.notes} fallback="None" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Bank Accounts & Wallets */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                        <BiCreditCard size={20} color="#4f46e5" /> Bank Accounts & Wallets ({bank_accounts?.length || 0})
                    </div>
                    {bank_accounts && bank_accounts.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {bank_accounts.map(b => (
                                <div key={b.id} style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{b.bank_name || 'Bank'}</span>
                                        {b.is_primary === 1 && (
                                            <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                                PRIMARY
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>Title: <strong>{b.account_title}</strong></div>
                                    <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#4f46e5', marginTop: '2px' }}>IBAN / No: {b.account_number_or_iban}</div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Wallet Type: {b.wallet_type}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No bank accounts registered.</div>
                    )}
                </div>

                {/* 4. Physical Addresses */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                        <BiMapPin size={20} color="#4f46e5" /> Physical Addresses ({addresses?.length || 0})
                    </div>
                    {addresses && addresses.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {addresses.map(a => (
                                <div key={a.id} style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontSize: '10px', textTransform: 'uppercase', background: '#e0e7ff', color: '#3730a3', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                        {a.address_type}
                                    </span>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginTop: '6px' }}>{a.address_line_1}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{a.city}, {a.state || ''} {a.country}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No physical addresses registered.</div>
                    )}
                </div>
            </div>

            {/* 5. Emergency Contacts & References */}
            {references && references.length > 0 && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                        Emergency Contacts & References
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                        {references.map(r => (
                            <div key={r.id} style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{r.name}</div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Relationship: <strong>{r.relationship}</strong></div>
                                <div style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 600, marginTop: '2px' }}>Phone: {r.phone}</div>
                                {r.email && <div style={{ fontSize: '11px', color: '#64748b' }}>Email: {r.email}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {/* Activity & Audit Log Modal */}
            <ActivityLogViewer
                open={activityOpen}
                onClose={() => setActivityOpen(false)}
                module="users"
                recordId={id}
                title={`Activity & Audit Trail: ${user?.profile?.full_name || user?.user?.username || ''}`}
            />
        </div>
    );
};

export default UserView;

