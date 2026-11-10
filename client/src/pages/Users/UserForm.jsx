import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
    BiArrowBack,
    BiSave,
    BiUser,
    BiEnvelope,
    BiLock,
    BiPhone,
    BiCalendar,
    BiCreditCard,
    BiMapPin,
    BiGroup,
    BiPlus,
    BiTrash,
    BiImage,
    BiShieldQuarter,
    BiUpload
} from 'react-icons/bi';
import apiClient from '../../api/client';
import Select from '../../components/ui/Select/Select';
import InputText from '../../components/ui/InputText/InputText';
import MediaPickerModal from '../../components/MediaPicker/MediaPickerModal';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import { getMediaUrl } from '../../utils/media';
import RichTextEditor from '../../components/ui/RichTextEditor/RichTextEditor';

const GENDER_OPTIONS = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' }
];

const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' }
];

const WALLET_TYPE_OPTIONS = [
    { value: 'bank_account', label: 'Traditional Bank Account' },
    { value: 'jazzcash', label: 'JazzCash Wallet' },
    { value: 'easypaisa', label: 'EasyPaisa Wallet' },
    { value: 'nayapay', label: 'NayaPay Wallet' },
    { value: 'sadapay', label: 'SadaPay Wallet' },
    { value: 'other', label: 'Other Digital Wallet' }
];

const ADDRESS_TYPE_OPTIONS = [
    { value: 'current', label: 'Current Residence' },
    { value: 'permanent', label: 'Permanent Address' },
    { value: 'office', label: 'Office / Workplace' }
];

// Helper to extract string value regardless of whether caller passes value directly or an Event
const extractVal = (valOrEvent) => {
    if (valOrEvent && typeof valOrEvent === 'object' && 'target' in valOrEvent) {
        return valOrEvent.target.value;
    }
    return valOrEvent ?? '';
};

const UserForm = () => {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const toast = useToast();
    const { setCustomBreadcrumbs } = usePageActions();

    const [loading, setLoading] = useState(isEdit);
    const [submitting, setSubmitting] = useState(false);
    const [roles, setRoles] = useState([]);
    const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
    const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role_id: '',
        role_ids: [],
        status: 'active',
        full_name: '',
        phone: '',
        avatar_media_id: null,
        dob: '',
        gender: '',
        hiring_date: '',
        joining_date: '',
        leaving_date: '',
        notes: '',
        bank_accounts: [
            { wallet_type: 'bank_account', account_title: '', account_number_or_iban: '', bank_name: '', branch_code_or_name: '', is_primary: 1, notes: '' }
        ],
        addresses: [
            { address_type: 'current', address_line_1: '', address_line_2: '', city: '', state: '', postal_code: '', country: 'Pakistan' }
        ],
        references: [
            { name: '', relationship: 'Colleague', phone: '', email: '', organization: '', notes: '' }
        ]
    });

    // Fetch Roles
    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const res = await apiClient.get('/roles');
                if (res.success && res.data) {
                    const list = Array.isArray(res.data) ? res.data : (res.data.roles || []);
                    setRoles(list.map(r => ({ value: r.id, label: r.name })));
                }
            } catch (err) {
                console.error('Failed to fetch roles:', err);
            }
        };
        fetchRoles();
    }, []);

    // Fetch User on Edit
    useEffect(() => {
        if (!isEdit) return;
        const fetchUser = async () => {
            setLoading(true);
            try {
                const res = await apiClient.get(`/users/${id}`);
                if (res.success && res.data) {
                    const { user, profile, bank_accounts, addresses, references } = res.data;
                    const assignedRoleIds = (user.roles && user.roles.length > 0)
                        ? user.roles.map(r => Number(r.id))
                        : (user.role_id ? [Number(user.role_id)] : []);

                    setFormData({
                        username: user.username || '',
                        email: user.email || '',
                        password: '', // blank unless changing
                        role_id: user.role_id || '',
                        role_ids: assignedRoleIds,
                        status: user.status || 'active',
                        full_name: profile?.full_name || '',
                        phone: profile?.phone || '',
                        avatar_media_id: profile?.avatar_media_id || null,
                        dob: profile?.dob || '',
                        gender: profile?.gender || '',
                        hiring_date: profile?.hiring_date || '',
                        joining_date: profile?.joining_date || '',
                        leaving_date: profile?.leaving_date || '',
                        notes: profile?.notes || '',
                        bank_accounts: (bank_accounts && bank_accounts.length > 0) ? bank_accounts : [
                            { wallet_type: 'bank_account', account_title: '', account_number_or_iban: '', bank_name: '', branch_code_or_name: '', is_primary: 1, notes: '' }
                        ],
                        addresses: (addresses && addresses.length > 0) ? addresses : [
                            { address_type: 'current', address_line_1: '', address_line_2: '', city: '', state: '', postal_code: '', country: 'Pakistan' }
                        ],
                        references: (references && references.length > 0) ? references : [
                            { name: '', relationship: 'Colleague', phone: '', email: '', organization: '', notes: '' }
                        ]
                    });

                    if (profile?.avatar_file_path) {
                        setSelectedAvatarUrl(profile.avatar_file_path);
                    } else if (profile?.avatar_media_id) {
                        try {
                            const mRes = await apiClient.get(`/media/${profile.avatar_media_id}`);
                            if (mRes.success && mRes.data?.file_path) {
                                setSelectedAvatarUrl(mRes.data.file_path);
                            }
                        } catch (e) {
                            console.error('Error fetching avatar media', e);
                        }
                    }

                    const userName = profile?.full_name || user.username || `User #${id}`;
                    setCustomBreadcrumbs([
                        { label: 'Users', to: '/users' },
                        { label: `Edit: ${userName}` }
                    ]);
                }
            } catch (err) {
                toast.error(err.message || 'Failed to load user for editing');
                navigate('/users');
            } finally {
                setLoading(false);
            }
        };

        if (isEdit) {
            fetchUser();
        } else {
            setCustomBreadcrumbs([
                { label: 'Users', to: '/users' },
                { label: 'Add Staff User' }
            ]);
        }

        return () => {
            setCustomBreadcrumbs(null);
        };
    }, [id, isEdit, navigate, setCustomBreadcrumbs]);

    // Handle generic state
    const handleChange = (field, valOrEvent) => {
        const val = extractVal(valOrEvent);
        setFormData(prev => ({ ...prev, [field]: val }));
    };

    // Bank accounts array handlers
    const addBankAccount = () => {
        setFormData(prev => ({
            ...prev,
            bank_accounts: [
                ...prev.bank_accounts,
                { wallet_type: 'bank_account', account_title: '', account_number_or_iban: '', bank_name: '', branch_code_or_name: '', is_primary: 0, notes: '' }
            ]
        }));
    };

    const updateBankAccount = (index, field, valOrEvent) => {
        const val = extractVal(valOrEvent);
        setFormData(prev => {
            const list = [...prev.bank_accounts];
            list[index] = { ...list[index], [field]: val };
            return { ...prev, bank_accounts: list };
        });
    };

    const removeBankAccount = (index) => {
        setFormData(prev => ({
            ...prev,
            bank_accounts: prev.bank_accounts.filter((_, i) => i !== index)
        }));
    };

    // Addresses array handlers
    const addAddress = () => {
        setFormData(prev => ({
            ...prev,
            addresses: [
                ...prev.addresses,
                { address_type: 'current', address_line_1: '', address_line_2: '', city: '', state: '', postal_code: '', country: 'Pakistan' }
            ]
        }));
    };

    const updateAddress = (index, field, valOrEvent) => {
        const val = extractVal(valOrEvent);
        setFormData(prev => {
            const list = [...prev.addresses];
            list[index] = { ...list[index], [field]: val };
            return { ...prev, addresses: list };
        });
    };

    const removeAddress = (index) => {
        setFormData(prev => ({
            ...prev,
            addresses: prev.addresses.filter((_, i) => i !== index)
        }));
    };

    // References array handlers
    const addReference = () => {
        setFormData(prev => ({
            ...prev,
            references: [
                ...prev.references,
                { name: '', relationship: 'Colleague', phone: '', email: '', organization: '', notes: '' }
            ]
        }));
    };

    const updateReference = (index, field, valOrEvent) => {
        const val = extractVal(valOrEvent);
        setFormData(prev => {
            const list = [...prev.references];
            list[index] = { ...list[index], [field]: val };
            return { ...prev, references: list };
        });
    };

    const removeReference = (index) => {
        setFormData(prev => ({
            ...prev,
            references: prev.references.filter((_, i) => i !== index)
        }));
    };

    const handleSelectAvatar = (media) => {
        setFormData(prev => ({ ...prev, avatar_media_id: media.id }));
        setSelectedAvatarUrl(media.file_path);
    };

    const handleDirectAvatarUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Instant real-time preview using object URL
        const localBlobUrl = URL.createObjectURL(file);
        setSelectedAvatarUrl(localBlobUrl);
        setUploadingAvatar(true);

        try {
            const formDataObj = new FormData();
            formDataObj.append('file', file);
            formDataObj.append('caption', `Profile picture for ${formData.full_name || 'Staff'}`);
            if (id) {
                formDataObj.append('user_id', id);
            }

            const res = await apiClient.upload('/media/upload', formDataObj);
            if (res.success && res.data) {
                setFormData(prev => ({ ...prev, avatar_media_id: res.data.id }));
                setSelectedAvatarUrl(res.data.file_path);
                toast.success('Profile Photo Uploaded', 'New profile image has been linked successfully.');
            }
        } catch (err) {
            toast.error('Upload Failed', err.message || 'Could not upload avatar image');
        } finally {
            setUploadingAvatar(false);
            e.target.value = '';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic client validation
        const hasRoles = formData.role_ids && formData.role_ids.length > 0;
        if (!formData.username.trim() || !formData.email.trim() || !formData.full_name.trim() || (!formData.role_id && !hasRoles)) {
            toast.warning('Validation Required', 'Please fill in Username, Email, Full Name, and select at least one Role.');
            return;
        }

        if (!isEdit && !formData.password.trim()) {
            toast.warning('Password Required', 'Password is required when registering a new staff account.');
            return;
        }

        setSubmitting(true);
        try {
            const selectedRoleIds = hasRoles ? formData.role_ids : (formData.role_id ? [Number(formData.role_id)] : [2]);
            const payload = {
                username: formData.username,
                email: formData.email,
                role_ids: selectedRoleIds,
                role_id: Number(selectedRoleIds[0]),
                status: formData.status,
                full_name: formData.full_name,
                phone: formData.phone || null,
                avatar_media_id: formData.avatar_media_id || null,
                dob: formData.dob || null,
                gender: formData.gender || null,
                hiring_date: formData.hiring_date || null,
                joining_date: formData.joining_date || null,
                leaving_date: formData.leaving_date || null,
                notes: formData.notes || null,
                bank_accounts: formData.bank_accounts.filter(b => b.account_title && b.account_number_or_iban),
                addresses: formData.addresses.filter(a => a.address_line_1 && a.city),
                references: formData.references.filter(r => r.name && r.phone)
            };

            if (formData.password.trim()) {
                payload.password = formData.password.trim();
            }

            if (isEdit) {
                await apiClient.put(`/users/${id}`, payload);
                toast.success('Staff Member Updated', `Account for "${formData.full_name}" has been updated.`);
            } else {
                await apiClient.post('/users', payload);
                toast.success('Staff Member Created', `New account for "${formData.full_name}" is now registered.`);
            }
            navigate('/users');
        } catch (err) {
            toast.error('Submission Failed', err.message || 'Operation failed. Please review the form.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '15px' }}>
                Loading staff user form...
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '60px' }}>
            {/* Top Navigation Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px',
                background: '#ffffff',
                padding: '16px 24px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <button
                        type="button"
                        onClick={() => navigate('/users')}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '7px 14px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#334155',
                            cursor: 'pointer'
                        }}
                    >
                        <BiArrowBack size={16} /> Back to Users
                    </button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
                            {isEdit ? `Edit Staff User: ${formData.full_name || formData.username}` : 'Add New Staff User'}
                        </h1>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                            {isEdit ? 'Update profile credentials, banking, addresses, and emergency records' : 'Register a new authenticated employee into the system'}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#4f46e5',
                            border: '1px solid #4338ca',
                            borderRadius: '6px',
                            padding: '8px 20px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#ffffff',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            opacity: submitting ? 0.7 : 1,
                            boxShadow: '0 1px 2px rgba(79, 70, 229, 0.2)'
                        }}
                    >
                        <BiSave size={18} /> {submitting ? 'Saving Changes...' : (isEdit ? 'Update User' : 'Save Staff User')}
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} autoComplete="off">
                {/* 1. Account & Security Credentials */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                    marginBottom: '24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                        <BiShieldQuarter size={22} color="#4f46e5" />
                        <div>
                            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                                Account & Security Credentials
                            </h2>
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                                Core system authentication, credentials, and organizational access role
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Username <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <InputText
                                placeholder="e.g. john_doe"
                                value={formData.username}
                                onChange={(val) => handleChange('username', val)}
                                autoComplete="off"
                                autoCapitalize="off"
                                prefix={<BiUser size={16} color="#94a3b8" />}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Email Address <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <InputText
                                type="email"
                                placeholder="e.g. john@orientlogistics.com"
                                value={formData.email}
                                onChange={(val) => handleChange('email', val)}
                                autoComplete="new-password"
                                prefix={<BiEnvelope size={16} color="#94a3b8" />}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                {isEdit ? 'New Password (leave blank to keep current)' : 'Password'} {!isEdit && <span style={{ color: '#ef4444' }}>*</span>}
                            </label>
                            <InputText
                                type="password"
                                placeholder={isEdit ? '••••••••' : 'Minimum 6 characters'}
                                value={formData.password}
                                onChange={(val) => handleChange('password', val)}
                                autoComplete="new-password"
                                prefix={<BiLock size={16} color="#94a3b8" />}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Account Status <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <Select
                                searchable={true}
                                showSearch={true}
                                options={STATUS_OPTIONS}
                                value={formData.status}
                                onChange={(val) => handleChange('status', val)}
                            />
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                Assigned Roles (Multiple Roles Allowed) <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {roles.map(r => {
                                    const rId = Number(r.value);
                                    const isSelected = formData.role_ids.includes(rId);
                                    return (
                                        <div
                                            key={r.value}
                                            onClick={() => {
                                                const next = isSelected
                                                    ? formData.role_ids.filter(id => id !== rId)
                                                    : [...formData.role_ids, rId];
                                                setFormData(prev => ({
                                                    ...prev,
                                                    role_ids: next,
                                                    role_id: next[0] || ''
                                                }));
                                            }}
                                            style={{
                                                padding: '8px 14px',
                                                borderRadius: '6px',
                                                border: `1.5px solid ${isSelected ? '#4f46e5' : '#cbd5e1'}`,
                                                background: isSelected ? '#eef2ff' : '#ffffff',
                                                color: isSelected ? '#4338ca' : '#334155',
                                                fontSize: '13px',
                                                fontWeight: isSelected ? 600 : 500,
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                userSelect: 'none',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                readOnly
                                                style={{ cursor: 'pointer', accentColor: '#4f46e5' }}
                                            />
                                            <span>{r.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            {formData.role_ids.length === 0 && (
                                <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '6px', display: 'block' }}>
                                    Please select at least one role for this staff user.
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Personal & Profile Information */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                    marginBottom: '24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                        <BiUser size={22} color="#0284c7" />
                        <div>
                            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                                Personal & Profile Details
                            </h2>
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                                Staff member name, contact numbers, profile photo, and demographic facts
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        {/* Avatar Picker Section */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '16px',
                            background: '#f8fafc',
                            border: '1px dashed #cbd5e1',
                            borderRadius: '10px',
                            minWidth: '180px'
                        }}>
                            <div style={{
                                width: '84px',
                                height: '84px',
                                borderRadius: '50%',
                                background: '#e2e8f0',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '12px',
                                border: '2px solid #ffffff',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.08)'
                            }}>
                                {selectedAvatarUrl ? (
                                    <img
                                        src={selectedAvatarUrl.startsWith('blob:') ? selectedAvatarUrl : getMediaUrl(selectedAvatarUrl)}
                                        alt="Selected Avatar"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => {
                                            console.error('Avatar display failed:', selectedAvatarUrl);
                                        }}
                                    />
                                ) : (
                                    <BiUser size={40} color="#94a3b8" />
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                <label style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    background: '#4f46e5',
                                    border: '1px solid #4338ca',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                                    opacity: uploadingAvatar ? 0.7 : 1
                                }}>
                                    <BiUpload size={14} /> {uploadingAvatar ? 'Uploading...' : 'Upload Photo'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleDirectAvatarUpload}
                                        disabled={uploadingAvatar}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setIsMediaPickerOpen(true)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        padding: '5px 12px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: '#334155',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <BiImage size={14} color="#4f46e5" /> Choose from Library
                                </button>
                            </div>
                            {formData.avatar_media_id && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData(prev => ({ ...prev, avatar_media_id: null }));
                                        setSelectedAvatarUrl(null);
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ef4444',
                                        fontSize: '11px',
                                        marginTop: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Remove avatar
                                </button>
                            )}
                        </div>

                        {/* Text Fields */}
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                    Full Name <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <InputText
                                    placeholder="e.g. John Doe"
                                    value={formData.full_name}
                                    onChange={(val) => handleChange('full_name', val)}
                                    autoComplete="off"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                    Contact Phone
                                </label>
                                <InputText
                                    placeholder="e.g. +92 300 1234567"
                                    value={formData.phone}
                                    onChange={(val) => handleChange('phone', val)}
                                    autoComplete="off"
                                    prefix={<BiPhone size={16} color="#94a3b8" />}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                    Gender
                                </label>
                                <Select
                                    searchable={true}
                                    showSearch={true}
                                    placeholder="Select gender..."
                                    options={GENDER_OPTIONS}
                                    value={formData.gender}
                                    onChange={(val) => handleChange('gender', val)}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                    Date of Birth
                                </label>
                                <InputText
                                    type="date"
                                    value={formData.dob}
                                    onChange={(val) => handleChange('dob', val)}
                                    prefix={<BiCalendar size={16} color="#94a3b8" />}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                            Internal Notes & Remarks
                        </label>
                        <RichTextEditor
                            placeholder="Add any administrative or onboarding notes..."
                            value={formData.notes || ''}
                            onChange={(content) => handleChange('notes', content)}
                            minHeight={110}
                        />
                    </div>
                </div>

                {/* 3. Employment & Timeline Dates */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                    marginBottom: '24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                        <BiCalendar size={22} color="#10b981" />
                        <div>
                            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                                Employment & Timeline Milestones
                            </h2>
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                                Hiring, official start date, and tenure termination dates
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Hiring Date
                            </label>
                            <InputText
                                type="date"
                                value={formData.hiring_date}
                                onChange={(val) => handleChange('hiring_date', val)}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Official Joining Date
                            </label>
                            <InputText
                                type="date"
                                value={formData.joining_date}
                                onChange={(val) => handleChange('joining_date', val)}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Leaving / Resignation Date (if applicable)
                            </label>
                            <InputText
                                type="date"
                                value={formData.leaving_date}
                                onChange={(val) => handleChange('leaving_date', val)}
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Banking & Digital Wallets */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                    marginBottom: '24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <BiCreditCard size={22} color="#f59e0b" />
                            <div>
                                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                                    Banking & Digital Wallets
                                </h2>
                                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                                    Salaries and disbursement accounts (Bank, JazzCash, EasyPaisa, SadaPay, etc.)
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={addBankAccount}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#334155',
                                cursor: 'pointer'
                            }}
                        >
                            <BiPlus size={16} /> Add Another Account
                        </button>
                    </div>

                    {formData.bank_accounts.map((bank, index) => (
                        <div key={index} style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '16px',
                            marginBottom: '14px',
                            position: 'relative'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                                    Account #{index + 1}
                                </span>
                                {formData.bank_accounts.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeBankAccount(index)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '12px',
                                            fontWeight: 600
                                        }}
                                    >
                                        <BiTrash size={14} /> Remove
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Account Type
                                    </label>
                                    <Select
                                        searchable={true}
                                        showSearch={true}
                                        options={WALLET_TYPE_OPTIONS}
                                        value={bank.wallet_type}
                                        onChange={(val) => updateBankAccount(index, 'wallet_type', val)}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Bank / Provider Name
                                    </label>
                                    <InputText
                                        placeholder="e.g. Meezan Bank, HBL, JazzCash"
                                        value={bank.bank_name || ''}
                                        onChange={(val) => updateBankAccount(index, 'bank_name', val)}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Account Title
                                    </label>
                                    <InputText
                                        placeholder="e.g. John Doe"
                                        value={bank.account_title || ''}
                                        onChange={(val) => updateBankAccount(index, 'account_title', val)}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Account / IBAN Number
                                    </label>
                                    <InputText
                                        placeholder="e.g. PK00MEZN000123456789"
                                        value={bank.account_number_or_iban || ''}
                                        onChange={(val) => updateBankAccount(index, 'account_number_or_iban', val)}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Branch Code / Name
                                    </label>
                                    <InputText
                                        placeholder="e.g. 0102 Main Branch"
                                        value={bank.branch_code_or_name || ''}
                                        onChange={(val) => updateBankAccount(index, 'branch_code_or_name', val)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 5. Physical Addresses */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                    marginBottom: '24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <BiMapPin size={22} color="#8b5cf6" />
                            <div>
                                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                                    Residential & Physical Addresses
                                </h2>
                                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                                    Current residential location and permanent domicile records
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={addAddress}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#334155',
                                cursor: 'pointer'
                            }}
                        >
                            <BiPlus size={16} /> Add Another Address
                        </button>
                    </div>

                    {formData.addresses.map((addr, index) => (
                        <div key={index} style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '16px',
                            marginBottom: '14px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                                    Address Record #{index + 1}
                                </span>
                                {formData.addresses.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeAddress(index)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '12px',
                                            fontWeight: 600
                                        }}
                                    >
                                        <BiTrash size={14} /> Remove
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Address Classification
                                    </label>
                                    <Select
                                        searchable={true}
                                        showSearch={true}
                                        options={ADDRESS_TYPE_OPTIONS}
                                        value={addr.address_type}
                                        onChange={(val) => updateAddress(index, 'address_type', val)}
                                    />
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Address Line 1 (Street, House No, Area)
                                    </label>
                                    <InputText
                                        placeholder="e.g. Flat 402, Block B, Falcon Complex"
                                        value={addr.address_line_1 || ''}
                                        onChange={(val) => updateAddress(index, 'address_line_1', val)}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        City
                                    </label>
                                    <InputText
                                        placeholder="e.g. Lahore, Karachi, Islamabad"
                                        value={addr.city || ''}
                                        onChange={(val) => updateAddress(index, 'city', val)}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        State / Province
                                    </label>
                                    <InputText
                                        placeholder="e.g. Punjab, Sindh"
                                        value={addr.state || ''}
                                        onChange={(val) => updateAddress(index, 'state', val)}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Postal Code
                                    </label>
                                    <InputText
                                        placeholder="e.g. 54000"
                                        value={addr.postal_code || ''}
                                        onChange={(val) => updateAddress(index, 'postal_code', val)}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Country
                                    </label>
                                    <InputText
                                        placeholder="e.g. Pakistan"
                                        value={addr.country || 'Pakistan'}
                                        onChange={(val) => updateAddress(index, 'country', val)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 6. Emergency Contacts & Character References */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                    marginBottom: '24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <BiGroup size={22} color="#ec4899" />
                            <div>
                                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                                    Emergency Contacts & References
                                </h2>
                                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                                    Professional references and next of kin contact information
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={addReference}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#334155',
                                cursor: 'pointer'
                            }}
                        >
                            <BiPlus size={16} /> Add Reference
                        </button>
                    </div>

                    {formData.references.map((ref, index) => (
                        <div key={index} style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '16px',
                            marginBottom: '14px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                                    Reference Record #{index + 1}
                                </span>
                                {formData.references.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeReference(index)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '12px',
                                            fontWeight: 600
                                        }}
                                    >
                                        <BiTrash size={14} /> Remove
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Contact Full Name
                                    </label>
                                    <InputText
                                        placeholder="e.g. Dr. Robert Vance"
                                        value={ref.name || ''}
                                        onChange={(val) => updateReference(index, 'name', val)}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Relationship
                                    </label>
                                    <InputText
                                        placeholder="e.g. Ex-Manager, Brother, Colleague"
                                        value={ref.relationship || ''}
                                        onChange={(val) => updateReference(index, 'relationship', val)}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Emergency Phone
                                    </label>
                                    <InputText
                                        placeholder="e.g. +92 321 9876543"
                                        value={ref.phone || ''}
                                        onChange={(val) => updateReference(index, 'phone', val)}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Email (Optional)
                                    </label>
                                    <InputText
                                        type="email"
                                        placeholder="e.g. reference@company.com"
                                        value={ref.email || ''}
                                        onChange={(val) => updateReference(index, 'email', val)}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                        Organization / Company
                                    </label>
                                    <InputText
                                        placeholder="e.g. Acme Corp"
                                        value={ref.organization || ''}
                                        onChange={(val) => updateReference(index, 'organization', val)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom Submit Toolbar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    padding: '16px 24px',
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0'
                }}>
                    <button
                        type="button"
                        onClick={() => navigate('/users')}
                        style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '8px 18px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#475569',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#4f46e5',
                            border: '1px solid #4338ca',
                            borderRadius: '6px',
                            padding: '8px 22px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#ffffff',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            opacity: submitting ? 0.7 : 1,
                            boxShadow: '0 1px 2px rgba(79, 70, 229, 0.2)'
                        }}
                    >
                        <BiSave size={18} /> {submitting ? 'Saving...' : (isEdit ? 'Update Staff Member' : 'Create Staff Member')}
                    </button>
                </div>
            </form>

            {/* Media Picker Modal for selecting avatar */}
            <MediaPickerModal
                isOpen={isMediaPickerOpen}
                onClose={() => setIsMediaPickerOpen(false)}
                onSelect={handleSelectAvatar}
                filterType="image"
                title="Select Staff Profile Picture"
            />
        </div>
    );
};

export default UserForm;
