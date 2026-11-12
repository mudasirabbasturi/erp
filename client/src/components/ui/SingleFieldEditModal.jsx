import React, { useState, useEffect, useMemo } from 'react';
import { BiSave, BiLoaderAlt, BiEdit } from 'react-icons/bi';
import Modal from '../ui/Modal/Modal';
import apiClient from '../../api/client';
import { useToast } from '../ui/Toast';
import RichTextEditor from '../ui/RichTextEditor';

/**
 * Reusable Standalone Single-Column / Single-Field Edit Modal
 *
 * Supports Projects, Clients, Users, and any entity with a PUT/PATCH endpoint.
 *
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {number|string} entityId - Primary record ID
 * @param {string} entityName - e.g. 'clients' | 'users' | 'projects'
 * @param {string} endpoint - Custom endpoint e.g. '/clients/5' or '/users/10'
 * @param {string} recordTitle - Title or label of record (e.g. 'Client #12 ABC Corp')
 * @param {string} fieldName - DB column (e.g. 'phone', 'email', 'status', 'notes')
 * @param {string} fieldLabel - User-friendly label (e.g. 'Phone Number', 'Account Status')
 * @param {string} fieldType - 'text' | 'textarea' | 'number' | 'select' | 'date' | 'toggle' | 'richtext'
 * @param {*} initialValue - Starting value
 * @param {Array} options - Select options (strings or { value, label })
 * @param {string|number} step - Step for number inputs
 * @param {string} placeholder - Input placeholder
 * @param {string} helperText - Optional help text
 * @param {function} onSuccess - Callback (fieldName, savedValue, responseData) => void
 * @param {function} customSaveHandler - Optional async function(fieldName, payloadValue) => Promise<any>
 */
export const SingleFieldEditModal = ({
    isOpen,
    onClose,
    entityId,
    entityName = 'records',
    endpoint = null,
    recordTitle = '',
    fieldName,
    fieldLabel,
    fieldType = 'text',
    initialValue = '',
    options = [],
    step = 'any',
    min = undefined,
    max = undefined,
    placeholder = '',
    helperText = '',
    onSuccess = null,
    customSaveHandler = null
}) => {
    const toast = useToast();
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const effectiveFieldType = useMemo(() => {
        if (['project_pricing', 'pricing'].includes(fieldName)) return 'select';
        if (['project_source', 'source'].includes(fieldName)) return 'select';
        if (['project_construction_type', 'construction_type'].includes(fieldName)) return 'select';
        if (['project_preview_status', 'preview_status'].includes(fieldName)) return 'select';
        if (['client_type'].includes(fieldName)) return 'select';
        if (['status'].includes(fieldName)) return 'select';
        if (['gender'].includes(fieldName)) return 'select';
        if (['role_id'].includes(fieldName)) return 'select';
        return fieldType;
    }, [fieldName, fieldType]);

    const effectiveOptions = useMemo(() => {
        if (options && options.length > 0) return options;
        if (['project_pricing', 'pricing'].includes(fieldName)) {
            return [
                { value: 'Yes', label: 'Yes' },
                { value: 'No', label: 'No' }
            ];
        }
        if (['project_source', 'source'].includes(fieldName)) {
            return [
                { value: 'InSource', label: 'InSource' },
                { value: 'OutSource', label: 'OutSource' }
            ];
        }
        if (['project_construction_type', 'construction_type'].includes(fieldName)) {
            return [
                { value: 'commercial', label: 'Commercial' },
                { value: 'residential', label: 'Residential' }
            ];
        }
        if (['project_preview_status', 'preview_status'].includes(fieldName)) {
            return [
                { value: 'active', label: 'Active' },
                { value: 'draft', label: 'Draft' }
            ];
        }
        if (['client_type'].includes(fieldName)) {
            return [
                { value: 'normal', label: 'Normal' },
                { value: 'admin', label: 'Admin' }
            ];
        }
        if (['gender'].includes(fieldName)) {
            return [
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' }
            ];
        }
        if (fieldName === 'status') {
            return [
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'suspended', label: 'Suspended' }
            ];
        }
        return options || [];
    }, [options, fieldName]);

    // Sync initial value on open or when props change
    useEffect(() => {
        if (isOpen) {
            setError(null);
            if (['project_pricing', 'pricing'].includes(fieldName)) {
                const str = String(initialValue || '').trim().toLowerCase();
                setValue(str.startsWith('y') ? 'Yes' : (str.startsWith('n') ? 'No' : (initialValue || 'No')));
            } else if (effectiveFieldType === 'toggle') {
                setValue(Boolean(initialValue === 1 || initialValue === '1' || initialValue === true));
            } else if (effectiveFieldType === 'number') {
                setValue(initialValue !== null && initialValue !== undefined ? String(initialValue) : '');
            } else {
                setValue(initialValue !== null && initialValue !== undefined ? String(initialValue) : '');
            }
        } else {
            setValue('');
            setError(null);
        }

        return () => {
            setValue('');
            setError(null);
        };
    }, [isOpen, initialValue, effectiveFieldType, fieldName]);

    const handleClose = () => {
        setValue('');
        setError(null);
        setSaving(false);
        if (onClose) {
            onClose();
        }
    };

    if (!isOpen) return null;

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!entityId || !fieldName) {
            setError('Missing record or field reference');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            let payloadValue = value;
            if (effectiveFieldType === 'number') {
                payloadValue = value === '' ? null : Number(value);
            } else if (effectiveFieldType === 'toggle') {
                payloadValue = value ? 1 : 0;
            }

            let responseData = null;

            if (customSaveHandler) {
                responseData = await customSaveHandler(fieldName, payloadValue);
            } else {
                const targetEndpoint = endpoint || `/${entityName}/${entityId}`;
                const payload = {
                    [fieldName]: payloadValue
                };
                const res = await apiClient.put(targetEndpoint, payload);
                responseData = res?.data;
            }

            if (toast?.success) {
                toast.success('Field Updated', `${fieldLabel || fieldName} updated successfully.`);
            }

            if (onSuccess) {
                onSuccess(fieldName, payloadValue, responseData);
            }

            handleClose();
        } catch (err) {
            console.error('Failed to update field:', err);
            const msg = err.response?.data?.message || err.message || 'Failed to save changes. Please try again.';
            setError(msg);
            if (toast?.error) {
                toast.error('Update Failed', msg);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && effectiveFieldType !== 'textarea' && !isRichTextField && !saving) {
            e.preventDefault();
            handleSave();
        }
    };

    const isRichTextField =
        fieldType === 'richtext' ||
        [
            'project_address',
            'project_main_scope',
            'project_scope_details',
            'project_notes',
            'project_estimator_notes',
            'project_admin_notes',
            'address',
            'main_scope',
            'scope_details',
            'notes',
            'estimator_notes',
            'admin_notes'
        ].includes(fieldName);

    const modalTitle = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#eef2ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4f46e5'
            }}>
                <BiEdit size={18} />
            </div>
            <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                    Edit {fieldLabel || 'Field'}
                </div>
                {recordTitle && (
                    <div style={{ fontSize: '12px', fontWeight: 400, color: '#64748b' }}>
                        {recordTitle}
                    </div>
                )}
            </div>
        </div>
    );

    const renderInput = () => {
        if (isRichTextField) {
            return (
                <div style={{ background: '#ffffff', borderRadius: '8px' }}>
                    <RichTextEditor
                        key={`quill_${entityId}_${fieldName}`}
                        value={value || ''}
                        onChange={(val) => setValue(val)}
                        placeholder={placeholder || `Enter ${fieldLabel}...`}
                        minHeight={180}
                    />
                </div>
            );
        }

        switch (effectiveFieldType) {
            case 'textarea':
                return (
                    <textarea
                        rows={5}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder || `Enter ${fieldLabel}...`}
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#1e293b',
                            lineHeight: 1.5,
                            outline: 'none',
                            transition: 'border-color 0.15s ease',
                            fontFamily: 'inherit',
                            resize: 'vertical'
                        }}
                    />
                );

            case 'number':
                return (
                    <input
                        type="number"
                        step={step}
                        min={min}
                        max={max}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder || '0.00'}
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#1e293b',
                            outline: 'none',
                            fontFamily: 'inherit'
                        }}
                    />
                );

            case 'date':
                return (
                    <input
                        type="date"
                        value={value ? String(value).split('T')[0].split(' ')[0] : ''}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#1e293b',
                            outline: 'none',
                            fontFamily: 'inherit'
                        }}
                    />
                );

            case 'select':
                return (
                    <select
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#1e293b',
                            outline: 'none',
                            background: '#ffffff',
                            fontFamily: 'inherit'
                        }}
                    >
                        <option value="">-- Select {fieldLabel} --</option>
                        {effectiveOptions.map((opt, idx) => {
                            const optVal = typeof opt === 'object' ? opt.value : opt;
                            const optLbl = typeof opt === 'object' ? opt.label : opt;
                            return (
                                <option key={idx} value={optVal}>
                                    {optLbl}
                                </option>
                            );
                        })}
                    </select>
                );

            case 'toggle':
                return (
                    <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: value ? '#fef2f2' : '#f8fafc',
                        border: `1px solid ${value ? '#fecaca' : '#e2e8f0'}`,
                        userSelect: 'none'
                    }}>
                        <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => setValue(e.target.checked)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#4f46e5' }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: value ? '#4338ca' : '#475569' }}>
                            {value ? `Yes - Enabled / True` : `No - Disabled / False`}
                        </span>
                    </label>
                );

            case 'text':
            default:
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder || `Enter ${fieldLabel}...`}
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            color: '#1e293b',
                            outline: 'none',
                            fontFamily: 'inherit'
                        }}
                    />
                );
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={modalTitle}
            width={isRichTextField ? '780px' : '520px'}
        >
            <form onSubmit={handleSave} style={{ padding: '4px 0' }}>
                {error && (
                    <div style={{
                        padding: '10px 14px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        color: '#991b1b',
                        fontSize: '13px',
                        marginBottom: '16px'
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: '#475569',
                        marginBottom: '8px'
                    }}>
                        {fieldLabel}
                    </label>

                    {renderInput()}

                    {helperText && (
                        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', margin: '6px 0 0 0' }}>
                            {helperText}
                        </p>
                    )}
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    paddingTop: '16px',
                    borderTop: '1px solid #f1f5f9'
                }}>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={saving}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#475569',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: saving ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#4f46e5',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.75 : 1,
                            boxShadow: '0 1px 3px rgba(79, 70, 229, 0.3)'
                        }}
                    >
                        {saving ? (
                            <>
                                <BiLoaderAlt className="animate-spin" size={16} />
                                Saving...
                            </>
                        ) : (
                            <>
                                <BiSave size={16} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default SingleFieldEditModal;

