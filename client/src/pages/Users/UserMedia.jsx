import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    BiArrowBack,
    BiUpload,
    BiTrash,
    BiDownload,
    BiImage,
    BiFile,
    BiSpreadsheet,
    BiArchive,
    BiSearch,
    BiRefresh,
    BiFolder,
    BiFolderPlus,
    BiFolderOpen,
    BiMove,
    BiCheckSquare,
    BiCheck,
    BiHistory,
    BiChevronRight
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { usePageActions } from '../../context/PageActionContext';
import { useToast, Modal, Select } from '../../components/ui';
import { getMediaUrl } from '../../utils/media';
import ActivityLogViewer from '../../components/ActivityLogs/ActivityLogViewer';

const UserMedia = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { setCustomBreadcrumbs } = usePageActions();
    const toast = useToast();

    const [user, setUser] = useState(null);
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalFiles, setTotalFiles] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const perPage = 24;

    // Filters
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');

    // Folders
    const [folders, setFolders] = useState([]);
    const [rootFilesCount, setRootFilesCount] = useState(0);
    const [activeFolderId, setActiveFolderId] = useState('all');

    // Multi-selection
    const [selectedFileIds, setSelectedFileIds] = useState([]);

    // Modals
    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [folderNameInput, setFolderNameInput] = useState('');
    const [folderParentInput, setFolderParentInput] = useState('');

    const [moveModalOpen, setMoveModalOpen] = useState(false);
    const [targetMoveFolderId, setTargetMoveFolderId] = useState('');
    const [filesToMove, setFilesToMove] = useState([]);

    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState(null);

    const [activityModalOpen, setActivityModalOpen] = useState(false);

    // Fetch User info
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const uRes = await apiClient.get(`/users/${id}`);
                if (uRes.success) {
                    setUser(uRes.data);
                    const userName = uRes.data?.profile?.full_name || uRes.data?.user?.username || `User #${id}`;
                    setCustomBreadcrumbs([
                        { label: 'Staff Directory', to: '/users' },
                        { label: userName, to: `/users/view/${id}` },
                        { label: 'Media Assets' }
                    ]);
                }
            } catch (err) {
                console.error(err);
                toast.error(err.message || 'Failed to load user info');
            }
        };
        fetchUser();
        return () => {
            setCustomBreadcrumbs(null);
        };
    }, [id, setCustomBreadcrumbs, toast]);

    // Load Folders for this user
    const loadFolders = useCallback(async () => {
        try {
            const res = await apiClient.get('/media/folders', { user_id: id });
            if (res.success) {
                setFolders(res.data?.folders || []);
                setRootFilesCount(res.data?.root_files_count || 0);
            }
        } catch (err) {
            console.error('Failed to load user folders:', err);
        }
    }, [id]);

    useEffect(() => {
        loadFolders();
    }, [loadFolders]);

    // Load media files for this user
    const loadMedia = useCallback(async (targetPage = 1, append = false) => {
        if (targetPage === 1) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const params = {
                user_id: id,
                page: targetPage,
                per_page: perPage
            };

            if (filterType !== 'all') params.type = filterType;
            if (search.trim()) params.search = search.trim();
            if (activeFolderId !== 'all') params.folder_id = activeFolderId;

            const res = await apiClient.get('/media', params);
            if (res.success) {
                const newItems = res.data || [];
                const total = res.pagination?.total || newItems.length;

                if (append) {
                    setMediaItems(prev => [...prev, ...newItems]);
                } else {
                    setMediaItems(newItems);
                }

                setTotalFiles(total);
                setPage(targetPage);
                setHasMore(targetPage * perPage < total);
            }
        } catch (err) {
            console.error(err);
            toast.error(err.message || 'Failed to load user media records');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [id, filterType, search, activeFolderId, toast]);

    useEffect(() => {
        loadMedia(1, false);
        setSelectedFileIds([]);
    }, [loadMedia]);

    // Handle "Load More"
    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            loadMedia(page + 1, true);
        }
    };

    // Upload Files
    const handleFileUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        let successCount = 0;
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('user_id', id);
                formData.append('caption', file.name);

                if (activeFolderId && activeFolderId !== 'all' && activeFolderId !== 'root') {
                    formData.append('folder_id', activeFolderId);
                }

                await apiClient.upload('/media/upload', formData);
                successCount++;
            }
            toast.success(`${successCount} file(s) uploaded successfully!`);
            loadMedia(1, false);
            loadFolders();
        } catch (err) {
            toast.error(err.message || 'Upload failed');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    // Selection
    const toggleSelectFile = (fileId) => {
        setSelectedFileIds(prev =>
            prev.includes(fileId) ? prev.filter(fId => fId !== fileId) : [...prev, fileId]
        );
    };

    const handleSelectAllVisible = () => {
        if (selectedFileIds.length === mediaItems.length) {
            setSelectedFileIds([]);
        } else {
            setSelectedFileIds(mediaItems.map(item => item.id));
        }
    };

    // Delete single & bulk
    const handleDeleteSingle = async (item) => {
        if (!window.confirm(`Are you sure you want to delete "${item.original_name}"?`)) return;
        try {
            await apiClient.delete(`/media/${item.id}`);
            toast.success(`"${item.original_name}" deleted.`);
            setMediaItems(prev => prev.filter(m => m.id !== item.id));
            setTotalFiles(prev => Math.max(0, prev - 1));
            setSelectedFileIds(prev => prev.filter(fId => fId !== item.id));
            loadFolders();
            if (previewModalOpen && previewItem?.id === item.id) {
                setPreviewModalOpen(false);
            }
        } catch (err) {
            toast.error(err.message || 'Failed to delete media');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedFileIds.length === 0) return;
        if (!window.confirm(`Delete ${selectedFileIds.length} selected files?`)) return;

        try {
            const res = await apiClient.post('/media/bulk-delete', { file_ids: selectedFileIds });
            if (res.success) {
                toast.success(res.message || 'Files deleted successfully.');
                setSelectedFileIds([]);
                loadMedia(1, false);
                loadFolders();
            }
        } catch (err) {
            toast.error(err.message || 'Bulk delete failed');
        }
    };

    // Move files
    const openMoveModalForSelected = () => {
        if (selectedFileIds.length === 0) return;
        setFilesToMove(selectedFileIds);
        setTargetMoveFolderId('');
        setMoveModalOpen(true);
    };

    const handleConfirmMove = async () => {
        if (filesToMove.length === 0) return;
        try {
            const folderVal = targetMoveFolderId === '' ? null : parseInt(targetMoveFolderId, 10);
            const res = await apiClient.post('/media/move', {
                file_ids: filesToMove,
                folder_id: folderVal
            });
            if (res.success) {
                toast.success(res.message || 'Files moved successfully.');
                setMoveModalOpen(false);
                setSelectedFileIds([]);
                loadMedia(1, false);
                loadFolders();
            }
        } catch (err) {
            toast.error(err.message || 'Move failed');
        }
    };

    // Create folder
    const handleSaveFolder = async () => {
        if (!folderNameInput.trim()) {
            toast.error('Folder name is required');
            return;
        }
        try {
            const payload = {
                name: folderNameInput.trim(),
                parent_id: folderParentInput ? parseInt(folderParentInput, 10) : null,
                user_id: id
            };
            await apiClient.post('/media/folders', payload);
            toast.success(`Folder "${folderNameInput}" created!`);
            setFolderModalOpen(false);
            loadFolders();
            loadMedia(1, false);
        } catch (err) {
            toast.error(err.message || 'Failed to create folder');
        }
    };

    const folderSelectOptions = useMemo(() => {
        const list = [{ value: '', label: 'Root Directory' }];
        folders.forEach(f => {
            list.push({
                value: String(f.id),
                label: `📁 ${f.name} (${f.path})`
            });
        });
        return list;
    }, [folders]);

    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getFileIcon = (type) => {
        switch (type) {
            case 'image': return <BiImage size={28} color="#4f46e5" />;
            case 'document': return <BiFile size={28} color="#059669" />;
            case 'spreadsheet': return <BiSpreadsheet size={28} color="#16a34a" />;
            case 'archive': return <BiArchive size={28} color="#d97706" />;
            default: return <BiFile size={28} color="#64748b" />;
        }
    };

    const userName = user?.profile?.full_name || user?.user?.username || `User #${id}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
            {/* Header Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#ffffff',
                padding: '18px 24px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                flexWrap: 'wrap',
                gap: '12px'
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
                        <BiArrowBack size={16} /> Directory
                    </button>

                    <div>
                        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                            Media & Documents: {userName}
                        </h1>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                            Dedicated document library, credential records, contracts, and uploads for this staff member.
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={() => setActivityModalOpen(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '7px 14px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#475569',
                            cursor: 'pointer'
                        }}
                    >
                        <BiHistory size={16} color="#4f46e5" /> Audit Log
                    </button>

                    <label
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#4f46e5',
                            border: '1px solid #4338ca',
                            borderRadius: '6px',
                            padding: '7px 16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#ffffff',
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            opacity: uploading ? 0.7 : 1
                        }}
                    >
                        <BiUpload size={16} /> {uploading ? 'Uploading...' : 'Upload Files'}
                        <input
                            type="file"
                            multiple
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                    </label>
                </div>
            </div>

            {/* Main Area: Folders Left + Grid Right */}
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', alignItems: 'start' }}>
                {/* Folders Column */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BiFolder size={16} color="#4f46e5" /> User Folders
                        </span>
                        <button
                            onClick={() => {
                                setFolderNameInput('');
                                setFolderParentInput('');
                                setFolderModalOpen(true);
                            }}
                            style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            + Folder
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div
                            onClick={() => setActiveFolderId('all')}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '7px 10px',
                                borderRadius: '6px',
                                fontSize: '12.5px',
                                cursor: 'pointer',
                                background: activeFolderId === 'all' ? '#eef2ff' : 'transparent',
                                color: activeFolderId === 'all' ? '#4f46e5' : '#334155',
                                fontWeight: activeFolderId === 'all' ? 600 : 500
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <BiFolderOpen size={15} /> All Media
                            </span>
                            <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '8px' }}>
                                {totalFiles}
                            </span>
                        </div>

                        <div
                            onClick={() => setActiveFolderId('root')}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '7px 10px',
                                borderRadius: '6px',
                                fontSize: '12.5px',
                                cursor: 'pointer',
                                background: activeFolderId === 'root' ? '#eef2ff' : 'transparent',
                                color: activeFolderId === 'root' ? '#4f46e5' : '#334155',
                                fontWeight: activeFolderId === 'root' ? 600 : 500
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <BiFolder size={15} /> Root Files
                            </span>
                            <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '8px' }}>
                                {rootFilesCount}
                            </span>
                        </div>

                        {folders.map(f => {
                            const isActive = activeFolderId === f.id;
                            return (
                                <div
                                    key={f.id}
                                    onClick={() => setActiveFolderId(f.id)}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '7px 10px',
                                        borderRadius: '6px',
                                        fontSize: '12.5px',
                                        cursor: 'pointer',
                                        background: isActive ? '#eef2ff' : 'transparent',
                                        color: isActive ? '#4f46e5' : '#334155',
                                        fontWeight: isActive ? 600 : 500
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        <BiFolder size={15} color={isActive ? '#4f46e5' : '#f59e0b'} />
                                        {f.name}
                                    </span>
                                    <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '8px' }}>
                                        {f.files_count || 0}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Media Files Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Filters Toolbar */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        background: '#ffffff',
                        padding: '12px 18px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '240px' }}>
                            <BiSearch size={16} color="#94a3b8" />
                            <input
                                type="text"
                                placeholder="Search user files..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                            {['all', 'image', 'document', 'spreadsheet', 'archive', 'other'].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setFilterType(t)}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: '12px',
                                        fontSize: '11.5px',
                                        fontWeight: 600,
                                        border: '1px solid',
                                        borderColor: filterType === t ? '#4f46e5' : '#cbd5e1',
                                        background: filterType === t ? '#4f46e5' : '#ffffff',
                                        color: filterType === t ? '#ffffff' : '#475569',
                                        cursor: 'pointer',
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Multi-Selection Bar */}
                    {selectedFileIds.length > 0 && (
                        <div style={{
                            background: '#1e293b',
                            color: '#ffffff',
                            padding: '10px 18px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                                <BiCheckSquare size={16} color="#818cf8" />
                                <span>{selectedFileIds.length} file(s) selected</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={openMoveModalForSelected}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: 'rgba(255,255,255,0.15)',
                                        border: '1px solid rgba(255,255,255,0.25)',
                                        color: '#ffffff',
                                        padding: '5px 12px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <BiMove size={13} /> Move to Folder
                                </button>

                                <button
                                    onClick={handleBulkDelete}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: '#dc2626',
                                        border: 'none',
                                        color: '#ffffff',
                                        padding: '5px 12px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <BiTrash size={13} /> Delete Selected
                                </button>

                                <button
                                    onClick={() => setSelectedFileIds([])}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#cbd5e1',
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Files Grid */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b', fontSize: '14px' }}>
                            Loading user files...
                        </div>
                    ) : mediaItems.length === 0 ? (
                        <div style={{
                            background: '#ffffff',
                            border: '1px dashed #cbd5e1',
                            borderRadius: '10px',
                            padding: '60px 20px',
                            textAlign: 'center',
                            color: '#64748b'
                        }}>
                            <BiImage size={40} color="#cbd5e1" style={{ marginBottom: '8px' }} />
                            <div style={{ fontSize: '15px', fontWeight: 600, color: '#334155' }}>
                                No files found for this staff member
                            </div>
                            <p style={{ fontSize: '13px', marginTop: '4px' }}>
                                Click "Upload Files" to attach documents or images to this staff profile.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>
                                    Showing {mediaItems.length} of {totalFiles} files
                                </span>
                                <button
                                    onClick={handleSelectAllVisible}
                                    style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    {selectedFileIds.length === mediaItems.length ? 'Deselect All' : 'Select All Visible'}
                                </button>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                gap: '14px'
                            }}>
                                {mediaItems.map(item => {
                                    const isSelected = selectedFileIds.includes(item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            style={{
                                                background: '#ffffff',
                                                border: isSelected ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                                position: 'relative'
                                            }}
                                        >
                                            {/* Checkbox overlay */}
                                            <div
                                                onClick={() => toggleSelectFile(item.id)}
                                                style={{
                                                    position: 'absolute',
                                                    top: '8px',
                                                    left: '8px',
                                                    width: '20px',
                                                    height: '20px',
                                                    background: isSelected ? '#4f46e5' : 'rgba(255,255,255,0.95)',
                                                    border: isSelected ? '1.5px solid #4f46e5' : '1.5px solid #cbd5e1',
                                                    borderRadius: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    color: '#ffffff',
                                                    zIndex: 2
                                                }}
                                            >
                                                {isSelected && <BiCheck size={14} />}
                                            </div>

                                            {/* Thumbnail */}
                                            <div
                                                onClick={() => {
                                                    setPreviewItem(item);
                                                    setPreviewModalOpen(true);
                                                }}
                                                style={{
                                                    height: '135px',
                                                    background: '#f8fafc',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderBottom: '1px solid #e2e8f0',
                                                    cursor: 'pointer',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {item.file_type === 'image' ? (
                                                    <img
                                                        src={getMediaUrl(item.file_path)}
                                                        alt={item.original_name}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                        {getFileIcon(item.file_type)}
                                                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                                                            {item.file_type}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.original_name}>
                                                    {item.original_name}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>{formatFileSize(item.file_size)}</span>
                                                    <span>{item.created_at?.slice(0, 10)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
                                                    <span style={{ fontSize: '10.5px', color: '#4f46e5', background: '#eef2ff', padding: '1px 6px', borderRadius: '4px', fontWeight: 500 }} title={`Uploaded by: ${item.uploader_name || item.uploader_username || 'Staff'}`}>
                                                        by @{item.uploader_username || 'staff'}
                                                    </span>
                                                    {item.folder_name && (
                                                        <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                            <BiFolder size={11} color="#f59e0b" />
                                                            {item.folder_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Load more */}
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                                {hasMore ? (
                                    <button
                                        onClick={handleLoadMore}
                                        disabled={loadingMore}
                                        style={{
                                            background: '#ffffff',
                                            border: '1px solid #cbd5e1',
                                            padding: '8px 20px',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {loadingMore ? 'Loading more files...' : 'Load More Files'}
                                    </button>
                                ) : (
                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>All user files loaded</span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Folder Create Modal */}
            <Modal
                open={folderModalOpen}
                onClose={() => setFolderModalOpen(false)}
                title="Create New Folder for Staff Member"
                size="small"
                width="440px"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                            Folder Name *
                        </label>
                        <input
                            type="text"
                            value={folderNameInput}
                            onChange={(e) => setFolderNameInput(e.target.value)}
                            placeholder="e.g. Identity Documents, Degrees, Reviews"
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                            Parent Folder
                        </label>
                        <Select
                            value={folderParentInput}
                            onChange={(val) => setFolderParentInput(val)}
                            options={folderSelectOptions}
                            placeholder="Root Directory"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                        <button
                            onClick={() => setFolderModalOpen(false)}
                            style={{ padding: '6px 14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveFolder}
                            style={{ padding: '6px 16px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Create Folder
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Move Modal */}
            <Modal
                open={moveModalOpen}
                onClose={() => setMoveModalOpen(false)}
                title={`Move ${filesToMove.length} File(s) to Folder`}
                size="small"
                width="460px"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                        Select the target folder. Files will be moved and database paths updated automatically.
                    </p>
                    <Select
                        value={targetMoveFolderId}
                        onChange={(val) => setTargetMoveFolderId(val)}
                        options={folderSelectOptions}
                        placeholder="Select target folder..."
                        style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                        <button
                            onClick={() => setMoveModalOpen(false)}
                            style={{ padding: '6px 14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmMove}
                            style={{ padding: '6px 16px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Move Files
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Preview Modal */}
            {previewItem && (
                <Modal
                    open={previewModalOpen}
                    onClose={() => setPreviewModalOpen(false)}
                    title={previewItem.original_name}
                    size="medium"
                    width="620px"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ maxHeight: '320px', background: '#0f172a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {previewItem.file_type === 'image' ? (
                                <img
                                    src={getMediaUrl(previewItem.file_path)}
                                    alt={previewItem.original_name}
                                    style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain' }}
                                />
                            ) : (
                                <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    {getFileIcon(previewItem.file_type)}
                                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>{previewItem.mime_type}</span>
                                </div>
                            )}
                        </div>

                        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                            <div>Size: <strong>{formatFileSize(previewItem.file_size)}</strong></div>
                            <div>Date: <strong>{previewItem.created_at}</strong></div>
                            <div style={{ gridColumn: 'span 2' }}>
                                DB Path: <code>{previewItem.file_path}</code>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                            <button
                                onClick={() => handleDeleteSingle(previewItem)}
                                style={{ padding: '6px 12px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            >
                                <BiTrash size={13} /> Delete
                            </button>
                            <a
                                href={getMediaUrl(previewItem.file_path)}
                                download={previewItem.original_name}
                                target="_blank"
                                rel="noreferrer"
                                style={{ padding: '6px 16px', background: '#4f46e5', color: '#ffffff', borderRadius: '4px', textDecoration: 'none', fontWeight: 600, fontSize: '13px' }}
                            >
                                <BiDownload size={13} /> Download
                            </a>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Audit Log Modal */}
            <ActivityLogViewer
                open={activityModalOpen}
                onClose={() => setActivityModalOpen(false)}
                module="media"
                title={`Audit Log for ${userName}'s Media`}
            />
        </div>
    );
};

export default UserMedia;
