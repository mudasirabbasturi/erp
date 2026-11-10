import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BiShieldQuarter,
    BiSave,
    BiRefresh,
    BiKey,
    BiColumns,
    BiCheckSquare,
    BiLock
} from 'react-icons/bi';
import apiClient from '../../api/client';
import Select from '../../components/ui/Select/Select';
import { useToast } from '../../components/ui/Toast';
import { usePageActions } from '../../context/PageActionContext';

const DEFAULT_COLUMN_FIELDS = [
    { entity: 'project', field_name: 'project_total_budget', label: 'Total Budget ($)', default_view: 1, default_add: 1, default_edit: 0 },
    { entity: 'project', field_name: 'project_deduction_amount', label: 'Deduction Amount ($)', default_view: 1, default_add: 1, default_edit: 0 },
    { entity: 'project', field_name: 'project_points', label: 'Project Performance Points', default_view: 1, default_add: 1, default_edit: 1 },
    { entity: 'project', field_name: 'project_private_notes', label: 'Private Confidential Notes', default_view: 0, default_add: 0, default_edit: 0 },
    { entity: 'user', field_name: 'bank_accounts', label: 'Bank Account & IBAN Details', default_view: 0, default_add: 0, default_edit: 0 },
    { entity: 'user', field_name: 'salary_or_payroll', label: 'Payroll & Salary History', default_view: 0, default_add: 0, default_edit: 0 },
    { entity: 'user', field_name: 'emergency_references', label: 'Emergency Character References', default_view: 1, default_add: 1, default_edit: 0 },
    { entity: 'user', field_name: 'home_addresses', label: 'Personal Residential Addresses', default_view: 1, default_add: 1, default_edit: 0 },
];

const DEFAULT_ENUM_FIELDS = [
    // Project Progress Status
    { entity: 'projects', field_name: 'project_progress_status', enum_value: 'Planned', label: 'Progress Status: Planned', default_view: 1, default_set: 1 },
    { entity: 'projects', field_name: 'project_progress_status', enum_value: 'Pending', label: 'Progress Status: Pending', default_view: 1, default_set: 1 },
    { entity: 'projects', field_name: 'project_progress_status', enum_value: 'Takeoff On Progress', label: 'Progress Status: Takeoff On Progress', default_view: 1, default_set: 1 },
    { entity: 'projects', field_name: 'project_progress_status', enum_value: 'Pricing On Progress', label: 'Progress Status: Pricing On Progress', default_view: 1, default_set: 1 },
    { entity: 'projects', field_name: 'project_progress_status', enum_value: 'Completed', label: 'Progress Status: Completed', default_view: 1, default_set: 1 },
    { entity: 'projects', field_name: 'project_progress_status', enum_value: 'Hold', label: 'Progress Status: Hold', default_view: 1, default_set: 1 },
    { entity: 'projects', field_name: 'project_progress_status', enum_value: 'Revision', label: 'Progress Status: Revision', default_view: 1, default_set: 1 },
    { entity: 'projects', field_name: 'project_progress_status', enum_value: 'Cancelled', label: 'Progress Status: Cancelled', default_view: 1, default_set: 1 },
    { entity: 'projects', field_name: 'project_progress_status', enum_value: 'Deliver', label: 'Progress Status: Deliver', default_view: 1, default_set: 1 },
    // Project Construction & Source
    { entity: 'projects', field_name: 'project_construction_type', enum_value: 'commercial', label: 'Construction: Commercial', default_view: 1, default_set: 1 },
    { entity: 'projects', field_name: 'project_construction_type', enum_value: 'residential', label: 'Construction: Residential', default_view: 1, default_set: 1 },
    { entity: 'projects', field_name: 'project_source', enum_value: 'InSource', label: 'Source: InSource', default_view: 1, default_set: 1 },
    { entity: 'projects', field_name: 'project_source', enum_value: 'OutSource', label: 'Source: OutSource', default_view: 1, default_set: 1 },
    // Users Status
    { entity: 'users', field_name: 'status', enum_value: 'active', label: 'User Status: Active', default_view: 1, default_set: 1 },
    { entity: 'users', field_name: 'status', enum_value: 'inactive', label: 'User Status: Inactive', default_view: 1, default_set: 1 },
    { entity: 'users', field_name: 'status', enum_value: 'suspended', label: 'User Status: Suspended', default_view: 1, default_set: 0 },
    // Clients Type
    { entity: 'clients', field_name: 'client_type', enum_value: 'normal', label: 'Client Type: Normal', default_view: 1, default_set: 1 },
    { entity: 'clients', field_name: 'client_type', enum_value: 'admin', label: 'Client Type: Admin / Priority', default_view: 1, default_set: 0 },
];

const ColumnSecurity = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { setActions, setCustomBreadcrumbs } = usePageActions();

    const [roles, setRoles] = useState([]);
    const [selectedRoleId, setSelectedRoleId] = useState(null);
    const [activeTab, setActiveTab] = useState('columns'); // 'columns' | 'enums'
    const [rules, setRules] = useState([]);
    const [enumRules, setEnumRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadRoles = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/roles');
            if (res.success && res.data) {
                const roleList = res.data || [];
                setRoles(roleList);
                if (roleList.length > 0) {
                    const currentId = selectedRoleId || roleList[0].id;
                    setSelectedRoleId(currentId);
                    const r = roleList.find(x => x.id === Number(currentId)) || roleList[0];
                    initRulesForRole(r);
                }
            }
        } catch (err) {
            toast.error('Failed to load roles', err.message);
        } finally {
            setLoading(false);
        }
    };

    const initRulesForRole = (role) => {
        // 1. Column-level permissions
        const existingFieldPerms = role.field_permissions || [];
        const built = DEFAULT_COLUMN_FIELDS.map(f => {
            const match = existingFieldPerms.find(p => p.entity === f.entity && p.field_name === f.field_name);
            return {
                entity: f.entity,
                field_name: f.field_name,
                label: f.label,
                can_view: match ? match.can_view : f.default_view,
                can_add: match ? (match.can_add !== undefined ? match.can_add : (f.default_add ?? 1)) : (f.default_add ?? 1),
                can_edit: match ? match.can_edit : f.default_edit
            };
        });
        setRules(built);

        // 2. Enum-level permissions
        const existingEnumPerms = role.enum_permissions || [];
        const builtEnums = DEFAULT_ENUM_FIELDS.map(e => {
            const match = existingEnumPerms.find(p => p.entity === e.entity && p.field_name === e.field_name && p.enum_value === e.enum_value);
            return {
                entity: e.entity,
                field_name: e.field_name,
                enum_value: e.enum_value,
                label: e.label,
                can_view: match ? match.can_view : e.default_view,
                can_set: match ? match.can_set : e.default_set
            };
        });
        setEnumRules(builtEnums);
    };

    useEffect(() => {
        loadRoles();
        setCustomBreadcrumbs([
            { label: 'Access Control', to: '/roles' },
            { label: 'Column & Enum Security' }
        ]);

        return () => {
            setCustomBreadcrumbs(null);
            setActions(null);
        };
    }, []);

    const handleSelectRole = (roleId) => {
        setSelectedRoleId(roleId);
        const r = roles.find(x => x.id === Number(roleId));
        if (r) {
            initRulesForRole(r);
        }
    };

    const handleToggleRule = (index, field) => {
        setRules(prev => {
            const list = [...prev];
            list[index] = { ...list[index], [field]: list[index][field] === 1 ? 0 : 1 };
            return list;
        });
    };

    const handleToggleEnumRule = (index, field) => {
        setEnumRules(prev => {
            const list = [...prev];
            list[index] = { ...list[index], [field]: list[index][field] === 1 ? 0 : 1 };
            return list;
        });
    };

    const handleSaveRules = async () => {
        if (!selectedRoleId) return;
        setSaving(true);
        try {
            const targetRole = roles.find(r => r.id === Number(selectedRoleId));
            if (activeTab === 'columns') {
                await apiClient.post('/roles/field-permissions', {
                    role_id: Number(selectedRoleId),
                    permissions: rules.map(r => ({
                        entity: r.entity,
                        field_name: r.field_name,
                        can_view: r.can_view,
                        can_add: r.can_add,
                        can_edit: r.can_edit
                    }))
                });
                toast.success('Column Security Saved', `Column-level security rules updated for "${targetRole?.name}".`);
            } else {
                await apiClient.post('/roles/enum-permissions', {
                    role_id: Number(selectedRoleId),
                    permissions: enumRules.map(r => ({
                        entity: r.entity,
                        field_name: r.field_name,
                        enum_value: r.enum_value,
                        can_view: r.can_view,
                        can_set: r.can_set
                    }))
                });
                toast.success('Enum Permissions Saved', `Enum value security rules updated for "${targetRole?.name}".`);
            }
            await loadRoles();
        } catch (err) {
            toast.error('Save Failed', err.message);
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        setActions(
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                    type="button"
                    onClick={handleSaveRules}
                    disabled={saving}
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
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                        boxShadow: '0 1px 2px rgba(79, 70, 229, 0.2)'
                    }}
                >
                    <BiSave size={16} /> {saving ? 'Saving...' : 'Save Column Rules'}
                </button>
                <button
                    type="button"
                    onClick={loadRoles}
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
                    title="Reload Rules"
                >
                    <BiRefresh size={18} />
                </button>
            </div>
        );
    }, [handleSaveRules, loadRoles, saving, setActions]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Quick Navigation Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px'
            }}>
                <div
                    onClick={() => navigate('/roles')}
                    style={{
                        padding: '14px 18px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        color: '#334155',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BiShieldQuarter size={20} color="#64748b" />
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>All Roles</span>
                    </div>
                </div>

                <div
                    onClick={() => navigate('/roles/permissions')}
                    style={{
                        padding: '14px 18px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        color: '#334155',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BiKey size={20} color="#64748b" />
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>Permissions Directory</span>
                    </div>
                </div>

                <div
                    onClick={() => navigate('/roles/matrix')}
                    style={{
                        padding: '14px 18px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        color: '#334155',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BiCheckSquare size={20} color="#64748b" />
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>Permissions Matrix</span>
                    </div>
                </div>

                <div
                    onClick={() => navigate('/roles/columns')}
                    style={{
                        padding: '14px 18px',
                        background: '#4f46e5',
                        color: '#fff',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BiColumns size={20} />
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>Column Security</span>
                    </div>
                </div>
            </div>

            {/* Role Switcher Toolbar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px 20px',
                gap: '16px',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                        Target Role:
                    </span>
                    <div style={{ width: '260px' }}>
                        <Select
                            searchable={true}
                            showSearch={true}
                            options={roles.map(r => ({ value: r.id, label: r.name }))}
                            value={selectedRoleId}
                            onChange={(val) => handleSelectRole(val)}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        type="button"
                        onClick={handleSaveRules}
                        disabled={saving}
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
                            cursor: saving ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <BiSave size={16} /> Save Security Rules
                    </button>
                </div>
            </div>

            {/* Sub-Navigation Switcher: Column vs Enum Security */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                <button
                    type="button"
                    onClick={() => setActiveTab('columns')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: activeTab === 'columns' ? '#4f46e5' : '#cbd5e1',
                        background: activeTab === 'columns' ? '#4f46e5' : '#ffffff',
                        color: activeTab === 'columns' ? '#ffffff' : '#334155',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                >
                    Column-Level Field Security ({rules.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('enums')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: activeTab === 'enums' ? '#4f46e5' : '#cbd5e1',
                        background: activeTab === 'enums' ? '#4f46e5' : '#ffffff',
                        color: activeTab === 'enums' ? '#ffffff' : '#334155',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                >
                    Enum Value & Status Permissions ({enumRules.length})
                </button>
            </div>

            {/* Rules Table */}
            {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                    Loading security rules...
                </div>
            ) : activeTab === 'columns' ? (
                <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                                <th style={{ padding: '14px 20px' }}>Entity</th>
                                <th style={{ padding: '14px 20px' }}>Protected Column / Field</th>
                                <th style={{ padding: '14px 20px' }}>Technical Identifier</th>
                                <th style={{ padding: '14px 20px', textAlign: 'center', width: '130px' }}>Can View (Read)</th>
                                <th style={{ padding: '14px 20px', textAlign: 'center', width: '130px' }}>Can Add (Create)</th>
                                <th style={{ padding: '14px 20px', textAlign: 'center', width: '130px' }}>Can Edit (Update)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rules.map((rule, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '14px 20px' }}>
                                        <span style={{
                                            background: rule.entity === 'project' ? '#e0f2fe' : '#fce7f3',
                                            color: rule.entity === 'project' ? '#0369a1' : '#9d174d',
                                            padding: '3px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            textTransform: 'uppercase'
                                        }}>
                                            {rule.entity}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#0f172a' }}>
                                        {rule.label}
                                    </td>
                                    <td style={{ padding: '14px 20px', color: '#4f46e5', fontFamily: 'monospace' }}>
                                        {rule.field_name}
                                    </td>
                                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleRule(index, 'can_view')}
                                            style={{
                                                padding: '4px 12px',
                                                borderRadius: '6px',
                                                border: `1px solid ${rule.can_view === 1 ? '#bbf7d0' : '#fecaca'}`,
                                                background: rule.can_view === 1 ? '#f0fdf4' : '#fef2f2',
                                                color: rule.can_view === 1 ? '#15803d' : '#dc2626',
                                                fontWeight: 700,
                                                fontSize: '11px',
                                                cursor: 'pointer'
                                            }}
                                            title="Toggle View Permission"
                                        >
                                            {rule.can_view === 1 ? 'ALLOWED' : 'HIDDEN'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleRule(index, 'can_add')}
                                            style={{
                                                padding: '4px 12px',
                                                borderRadius: '6px',
                                                border: `1px solid ${rule.can_add === 1 ? '#bbf7d0' : '#fee2e2'}`,
                                                background: rule.can_add === 1 ? '#f0fdf4' : '#fff1f2',
                                                color: rule.can_add === 1 ? '#15803d' : '#e11d48',
                                                fontWeight: 700,
                                                fontSize: '11px',
                                                cursor: 'pointer'
                                            }}
                                            title="Toggle Add / Create Permission"
                                        >
                                            {rule.can_add === 1 ? 'CAN ADD' : 'NO ADD'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleRule(index, 'can_edit')}
                                            style={{
                                                padding: '4px 12px',
                                                borderRadius: '6px',
                                                border: `1px solid ${rule.can_edit === 1 ? '#bbf7d0' : '#e2e8f0'}`,
                                                background: rule.can_edit === 1 ? '#f0fdf4' : '#f8fafc',
                                                color: rule.can_edit === 1 ? '#15803d' : '#64748b',
                                                fontWeight: 700,
                                                fontSize: '11px',
                                                cursor: 'pointer'
                                            }}
                                            title="Toggle Edit / Update Permission"
                                        >
                                            {rule.can_edit === 1 ? 'EDITABLE' : 'READ-ONLY'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                                <th style={{ padding: '14px 20px' }}>Entity</th>
                                <th style={{ padding: '14px 20px' }}>Protected Enum Option / Status</th>
                                <th style={{ padding: '14px 20px' }}>Enum Field & Value</th>
                                <th style={{ padding: '14px 20px', textAlign: 'center', width: '160px' }}>Can View Records</th>
                                <th style={{ padding: '14px 20px', textAlign: 'center', width: '160px' }}>Can Set / Transition</th>
                            </tr>
                        </thead>
                        <tbody>
                            {enumRules.map((er, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '14px 20px' }}>
                                        <span style={{
                                            background: er.entity === 'projects' ? '#e0f2fe' : er.entity === 'clients' ? '#fef3c7' : '#fce7f3',
                                            color: er.entity === 'projects' ? '#0369a1' : er.entity === 'clients' ? '#92400e' : '#9d174d',
                                            padding: '3px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            textTransform: 'uppercase'
                                        }}>
                                            {er.entity}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#0f172a' }}>
                                        {er.label}
                                    </td>
                                    <td style={{ padding: '14px 20px', color: '#4f46e5', fontFamily: 'monospace' }}>
                                        {er.field_name} = <strong>"{er.enum_value}"</strong>
                                    </td>
                                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleEnumRule(index, 'can_view')}
                                            style={{
                                                padding: '4px 12px',
                                                borderRadius: '6px',
                                                border: `1px solid ${er.can_view === 1 ? '#bbf7d0' : '#fecaca'}`,
                                                background: er.can_view === 1 ? '#f0fdf4' : '#fef2f2',
                                                color: er.can_view === 1 ? '#15803d' : '#dc2626',
                                                fontWeight: 700,
                                                fontSize: '11px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {er.can_view === 1 ? 'ALLOWED' : 'RESTRICTED'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleEnumRule(index, 'can_set')}
                                            style={{
                                                padding: '4px 12px',
                                                borderRadius: '6px',
                                                border: `1px solid ${er.can_set === 1 ? '#bbf7d0' : '#e2e8f0'}`,
                                                background: er.can_set === 1 ? '#f0fdf4' : '#f8fafc',
                                                color: er.can_set === 1 ? '#15803d' : '#64748b',
                                                fontWeight: 700,
                                                fontSize: '11px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {er.can_set === 1 ? 'CAN SET' : 'BLOCKED'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ColumnSecurity;

