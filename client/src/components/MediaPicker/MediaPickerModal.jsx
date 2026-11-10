import React, { useState, useEffect } from 'react';
import { BiImage, BiUpload, BiCheck, BiFolder } from 'react-icons/bi';
import apiClient from '../../api/client';
import Modal from '../ui/Modal/Modal';
import { useToast } from '../ui';
import { getMediaUrl } from '../../utils/media';

const MediaPickerModal = ({ isOpen, onClose, onSelect, title = "Select Media Asset" }) => {
    const toast = useToast();
    const [mediaList, setMediaList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedId, setSelectedId] = useState(null);

    const loadMedia = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/media', { per_page: 50 });
            if (res.success) {
                setMediaList(res.data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadMedia();
        }
    }, [isOpen]);

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiClient.upload('/media/upload', formData);
            if (res.success && res.data) {
                await loadMedia();
                setSelectedId(res.data.id);
                toast.success(`"${file.name}" uploaded successfully!`);
            }
        } catch (err) {
            toast.error(err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleConfirm = () => {
        const chosen = mediaList.find(m => m.id === selectedId);
        if (chosen) {
            onSelect(chosen);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="large">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Upload bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>
                        Choose existing asset or upload from your computer:
                    </div>
                    <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#4f46e5',
                        color: '#fff',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}>
                        <BiUpload size={16} /> {uploading ? 'Uploading...' : 'Upload from PC'}
                        <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx" />
                    </label>
                </div>

                {/* Media Grid */}
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading media files...</div>
                ) : mediaList.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                        <BiFolder size={40} style={{ opacity: 0.5, marginBottom: '8px' }} />
                        <div>No media items found. Upload one to get started!</div>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                        gap: '12px',
                        maxHeight: '380px',
                        overflowY: 'auto',
                        padding: '4px'
                    }}>
                        {mediaList.map(item => {
                            const isSelected = selectedId === item.id;
                            const isImg = item.file_type === 'image';
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedId(item.id)}
                                    style={{
                                        border: isSelected ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        background: '#f8fafc',
                                        aspectRatio: '1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'column'
                                    }}
                                >
                                    {isImg ? (
                                        <img
                                            src={getMediaUrl(item.file_path)}
                                            alt={item.original_name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    ) : (
                                        <BiImage size={32} color="#94a3b8" />
                                    )}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        background: 'rgba(0,0,0,0.65)',
                                        color: '#fff',
                                        fontSize: '9px',
                                        padding: '2px 4px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {item.original_name}
                                    </div>
                                    {isSelected && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4,
                                            background: '#4f46e5',
                                            color: '#fff',
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <BiCheck size={14} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                    <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569' }}>Cancel</button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!selectedId}
                        style={{
                            padding: '8px 20px',
                            borderRadius: '6px',
                            border: 'none',
                            background: selectedId ? '#4f46e5' : '#a5b4fc',
                            color: '#fff',
                            fontWeight: 600,
                            cursor: selectedId ? 'pointer' : 'not-allowed'
                        }}
                    >
                        Use Selected Media
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default MediaPickerModal;

