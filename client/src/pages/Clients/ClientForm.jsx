import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    BiArrowBack,
    BiSave,
    BiBriefcase,
    BiBuilding,
    BiPhone,
    BiEnvelope,
    BiMapPin,
    BiNote,
    BiPlusCircle
} from 'react-icons/bi';
import apiClient from '../../api/client';
import Select from '../../components/ui/Select/Select';
import RichTextEditor from '../../components/ui/RichTextEditor/RichTextEditor';
import { usePageActions } from '../../context/PageActionContext';
import { useToast } from '../../components/ui/Toast';
import styles from './Clients.module.css';

const CLIENT_TYPE_OPTIONS = [
    { value: 'normal', label: 'Normal Client' },
    { value: 'admin', label: 'Admin Client' }
];

const CORE_FIELDS = [
    'id', 'title', 'name', 'client_type', 'email', 'phone',
    'address', 'city', 'state', 'country', 'notes',
    'created_at', 'updated_at', 'deleted_at'
];

const ClientForm = () => {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const toast = useToast();
    const { setCustomBreadcrumbs } = usePageActions();

    const [loading, setLoading] = useState(isEdit);
    const [submitting, setSubmitting] = useState(false);
    const [schemaColumns, setSchemaColumns] = useState([]);

    const [formData, setFormData] = useState({
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
    });

    useEffect(() => {
        setCustomBreadcrumbs([
            { label: 'Clients', to: '/clients' },
            { label: isEdit ? `Edit Client #${id}` : 'Create New Client' }
        ]);
    }, [id, isEdit, setCustomBreadcrumbs]);

    // Load table schema (for custom columns) and existing client data if editing
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                // Fetch table schema to detect any custom/dynamic columns added
                const schemaRes = await apiClient.get('/schema/tables/clients');
                if (schemaRes.success && schemaRes.data) {
                    setSchemaColumns(schemaRes.data.columns || []);
                }

                if (isEdit) {
                    const clientRes = await apiClient.get(`/clients/${id}`);
                    if (clientRes.success && clientRes.data) {
                        const client = clientRes.data;
                        setFormData((prev) => ({
                            ...prev,
                            ...client,
                            title: client.title || '',
                            name: client.name || '',
                            client_type: client.client_type || 'normal',
                            email: client.email || '',
                            phone: client.phone || '',
                            address: client.address || '',
                            city: client.city || '',
                            state: client.state || '',
                            country: client.country || '',
                            notes: client.notes || ''
                        }));
                    } else {
                        toast.error('Client Error', clientRes.message || 'Client not found');
                        navigate('/clients');
                    }
                }
            } catch (err) {
                toast.error('Error', err.message || 'Failed to initialize form');
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.warning('Validation Required', 'Client Name is required.');
            return;
        }

        setSubmitting(true);
        try {
            if (isEdit) {
                const res = await apiClient.put(`/clients/${id}`, formData);
                if (res.success) {
                    toast.success('Client Updated', `Client "${formData.name}" has been updated.`);
                    navigate('/clients');
                } else {
                    toast.error('Update Failed', res.message || 'Failed to update client');
                }
            } else {
                const res = await apiClient.post('/clients', formData);
                if (res.success) {
                    toast.success('Client Created', `Client "${formData.name}" has been created.`);
                    navigate('/clients');
                } else {
                    toast.error('Create Failed', res.message || 'Failed to create client');
                }
            }
        } catch (err) {
            toast.error('Submission Failed', err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Filter dynamic custom fields
    const dynamicColumns = schemaColumns.filter((col) => !CORE_FIELDS.includes(col.field));

    if (loading) {
        return (
            <div className={styles.container}>
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                    Loading client information...
                </div>
            </div>
        );
    }

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
                            <BiBriefcase style={{ color: '#4f46e5' }} />
                            {isEdit ? `Edit Client: ${formData.name || 'Client #' + id}` : 'Create New Client'}
                        </h1>
                    </div>
                    <p className={styles.subtitle} style={{ marginLeft: '115px' }}>
                        {isEdit
                            ? 'Update client information, contact channels, location, and dynamic attributes.'
                            : 'Enter client details, contact channels, address, and any custom fields.'}
                    </p>
                </div>
            </div>

            {/* Form Card */}
            <form onSubmit={handleSubmit} className={styles.formCard}>
                {/* 1. Basic Information */}
                <div>
                    <h3 className={styles.sectionTitle}>
                        <BiBuilding style={{ color: '#4f46e5' }} /> 1. Client Identity & Classification
                    </h3>
                    <div className={styles.formGrid3} style={{ marginTop: '12px' }}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Client Name *</label>
                            <input
                                type="text"
                                className={styles.formInput}
                                placeholder="e.g. Acme Logistics, John Doe"
                                value={formData.name || ''}
                                onChange={(e) => handleChange('name', e.target.value)}
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Client Code / Title</label>
                            <input
                                type="text"
                                className={styles.formInput}
                                placeholder="e.g. AA, A.A EXPRESS INC"
                                value={formData.title || ''}
                                onChange={(e) => handleChange('title', e.target.value)}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Client Type *</label>
                            <Select
                                options={CLIENT_TYPE_OPTIONS}
                                value={formData.client_type || 'normal'}
                                onChange={(val) => handleChange('client_type', val)}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Contact Information */}
                <div>
                    <h3 className={styles.sectionTitle}>
                        <BiPhone style={{ color: '#10b981' }} /> 2. Communication Channels
                    </h3>
                    <div className={styles.formGrid2} style={{ marginTop: '12px' }}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Email Address</label>
                            <input
                                type="email"
                                className={styles.formInput}
                                placeholder="e.g. contact@client.com"
                                value={formData.email || ''}
                                onChange={(e) => handleChange('email', e.target.value)}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Phone Number</label>
                            <input
                                type="text"
                                className={styles.formInput}
                                placeholder="e.g. +1 555-019-2834"
                                value={formData.phone || ''}
                                onChange={(e) => handleChange('phone', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Address & Geographical Information */}
                <div>
                    <h3 className={styles.sectionTitle}>
                        <BiMapPin style={{ color: '#f59e0b' }} /> 3. Address & Location
                    </h3>
                    <div className={styles.formGrid3} style={{ marginTop: '12px' }}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Country</label>
                            <input
                                type="text"
                                className={styles.formInput}
                                placeholder="e.g. USA, Canada, Pakistan"
                                value={formData.country || ''}
                                onChange={(e) => handleChange('country', e.target.value)}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>State / Province</label>
                            <input
                                type="text"
                                className={styles.formInput}
                                placeholder="e.g. California, Ontario, Punjab"
                                value={formData.state || ''}
                                onChange={(e) => handleChange('state', e.target.value)}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>City</label>
                            <input
                                type="text"
                                className={styles.formInput}
                                placeholder="e.g. Los Angeles, Toronto, Lahore"
                                value={formData.city || ''}
                                onChange={(e) => handleChange('city', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.formGroup} style={{ marginTop: '14px' }}>
                        <label className={styles.formLabel}>Street Address</label>
                        <input
                            type="text"
                            className={styles.formInput}
                            placeholder="e.g. Suite 400, 123 Business Parkway"
                            value={formData.address || ''}
                            onChange={(e) => handleChange('address', e.target.value)}
                        />
                    </div>
                </div>

                {/* 4. Dynamic Custom Columns (from Database Schema) */}
                {dynamicColumns.length > 0 && (
                    <div>
                        <h3 className={styles.sectionTitle}>
                            <BiPlusCircle style={{ color: '#6366f1' }} /> 4. Custom Database Fields
                        </h3>
                        <div className={styles.formGrid2} style={{ marginTop: '12px' }}>
                            {dynamicColumns.map((col) => {
                                const isEnum = col.base_type === 'ENUM';
                                const enumOpts = col.enum_options || [];

                                return (
                                    <div key={col.field} className={styles.formGroup}>
                                        <label className={styles.formLabel}>
                                            {col.comment || col.field} {!col.null ? '*' : ''}
                                        </label>

                                        {isEnum && enumOpts.length > 0 ? (
                                            <Select
                                                options={[
                                                    { value: '', label: `— Select ${col.comment || col.field} —` },
                                                    ...enumOpts.map((opt) => ({ value: opt, label: opt }))
                                                ]}
                                                value={formData[col.field] || ''}
                                                onChange={(val) => handleChange(col.field, val)}
                                            />
                                        ) : col.base_type === 'DATE' ? (
                                            <input
                                                type="date"
                                                className={styles.formInput}
                                                value={formData[col.field] ? String(formData[col.field]).slice(0, 10) : ''}
                                                onChange={(e) => handleChange(col.field, e.target.value)}
                                            />
                                        ) : col.base_type === 'TEXT' || col.base_type === 'LONGTEXT' ? (
                                            <RichTextEditor
                                                value={formData[col.field] || ''}
                                                onChange={(content) => handleChange(col.field, content)}
                                                placeholder={`Enter ${col.comment || col.field}...`}
                                                minHeight={90}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                className={styles.formInput}
                                                placeholder={`Enter ${col.comment || col.field}`}
                                                value={formData[col.field] !== null && formData[col.field] !== undefined ? formData[col.field] : ''}
                                                onChange={(e) => handleChange(col.field, e.target.value)}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 5. Notes & Remarks */}
                <div>
                    <h3 className={styles.sectionTitle}>
                        <BiNote style={{ color: '#8b5cf6' }} /> {dynamicColumns.length > 0 ? '5' : '4'}. Notes & Remarks
                    </h3>
                    <div style={{ marginTop: '12px' }}>
                        <RichTextEditor
                            value={formData.notes || ''}
                            onChange={(content) => handleChange('notes', content)}
                            placeholder="Add any internal remarks, customer preferences, or historical notes..."
                            minHeight={120}
                        />
                    </div>
                </div>

                {/* Form Action Buttons */}
                <div className={styles.formActions}>
                    <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => navigate('/clients')}
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className={styles.btnPrimary}
                        disabled={submitting}
                    >
                        <BiSave /> {submitting ? 'Saving Client...' : isEdit ? 'Update Client' : 'Create Client'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ClientForm;

