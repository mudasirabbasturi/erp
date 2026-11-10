import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    BiUpload,
    BiTrash,
    BiFile,
    BiImage,
    BiSpreadsheet,
    BiArchive,
    BiRefresh,
    BiSearch,
    BiFolder,
    BiFolderPlus,
    BiFolderOpen,
    BiCheck,
    BiMove,
    BiDownload,
    BiDotsVerticalRounded,
    BiEdit,
    BiUser,
    BiHistory,
    BiChevronRight,
    BiCheckSquare,
    BiSquare
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast, Modal, Select } from '../../components/ui';
import { getMediaUrl } from '../../utils/media';
import ActivityLogViewer from '../../components/ActivityLogs/ActivityLogViewer';
import styles from './MediaLibrary.module.css';

const MediaLibrary = () => {
    const { user: currentUser, isSuperAdmin } = useAuth();
    const toast = useToast();

    // Media & pagination states
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [totalFiles, setTotalFiles] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const perPage = 24;

    // Filters
    const [filterType, setFilterType] = useState('all');
    const [search, setSearch] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('all');
    const [usersList, setUsersList] = useState([]);

    // Folders state
    const [folders, setFolders] = useState([]);
    const [rootFilesCount, setRootFilesCount] = useState(0);
    const [activeFolderId, setActiveFolderId] = useState('all'); // 'all', 'root', or folder ID

    // Selection state
    const [selectedFileIds, setSelectedFileIds] = useState([]);

    // Upload state
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgressText, setUploadProgressText] = useState('');

    // Modal states
    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState(null);
    const [folderNameInput, setFolderNameInput] = useState('');
    const [folderParentInput, setFolderParentInput] = useState('');

    const [moveModalOpen, setMoveModalOpen] = useState(false);
    const [targetMoveFolderId, setTargetMoveFolderId] = useState('');
    const [filesToMove, setFilesToMove] = useState([]);

    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState(null);

    const [activityModalOpen, setActivityModalOpen] = useState(false);

    // Load available staff/users for media filter
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await apiClient.get('/media/users');
                if (res.success) {
                    setUsersList(res.data || []);
                }
            } catch (err) {
                console.error('Failed to load media users list:', err);
            }
        };
        fetchUsers();
    }, []);

    // Load Folders list
    const loadFolders = useCallback(async () => {
        try {
            const params = {};
            if (selectedUserId !== 'all') {
                params.user_id = selectedUserId;
            }
            const res = await apiClient.get('/media/folders', params);
            if (res.success) {
                setFolders(res.data?.folders || []);
                setRootFilesCount(res.data?.root_files_count || 0);
            }
        } catch (err) {
            console.error('Failed to load folders:', err);
        }
    }, [selectedUserId]);

    useEffect(() => {
        loadFolders();
    }, [loadFolders]);

    // Load media files (page 1 or load more)
    const loadMedia = useCallback(async (targetPage = 1, append = false) => {
        if (targetPage === 1) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const params = {
                page: targetPage,
                per_page: perPage
            };

            if (filterType !== 'all') params.type = filterType;
            if (search.trim()) params.search = search.trim();
            if (selectedUserId !== 'all') params.user_id = selectedUserId;
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
            console.error('Failed to load media items:', err);
            toast.error(err.message || 'Failed to load media library');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filterType, search, selectedUserId, activeFolderId, toast]);

    // Reload files whenever filters or active folder changes
    useEffect(() => {
        loadMedia(1, false);
        setSelectedFileIds([]);
    }, [loadMedia]);

    // Handle "Load More" click
    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            loadMedia(page + 1, true);
        }
    };

    // Upload Files (supports multiple files)
    const handleFileUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        let successCount = 0;
        let failCount = 0;

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setUploadProgressText(`Uploading ${i + 1} of ${files.length}: ${file.name}...`);

                const formData = new FormData();
                formData.append('file', file);
                formData.append('caption', file.name);

                // If currently inside a specific folder, upload directly to that folder
                if (activeFolderId && activeFolderId !== 'all' && activeFolderId !== 'root') {
                    formData.append('folder_id', activeFolderId);
                }

                try {
                    await apiClient.upload('/media/upload', formData);
                    successCount++;
                } catch (err) {
                    failCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`Successfully uploaded ${successCount} file(s)!`);
                loadMedia(1, false);
                loadFolders();
            }
            if (failCount > 0) {
                toast.error(`Failed to upload ${failCount} file(s).`);
            }
        } catch (err) {
            toast.error(err.message || 'File upload failed');
        } finally {
            setIsUploading(false);
            setUploadProgressText('');
            e.target.value = '';
        }
    };

    // Selection handlers
    const toggleSelectFile = (fileId) => {
        setSelectedFileIds(prev =>
            prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
        );
    };

    const handleSelectAllVisible = () => {
        if (selectedFileIds.length === mediaItems.length) {
            setSelectedFileIds([]);
        } else {
            setSelectedFileIds(mediaItems.map(item => item.id));
        }
    };

    const handleClearSelection = () => {
        setSelectedFileIds([]);
    };

    // Single & Bulk Delete
    const handleDeleteSingle = async (item) => {
        if (!window.confirm(`Are you sure you want to delete "${item.original_name}"?`)) return;
        try {
            await apiClient.delete(`/media/${item.id}`);
            toast.success(`"${item.original_name}" deleted successfully.`);
            setMediaItems(prev => prev.filter(f => f.id !== item.id));
            setTotalFiles(prev => Math.max(0, prev - 1));
            setSelectedFileIds(prev => prev.filter(id => id !== item.id));
            loadFolders();
            if (previewModalOpen && previewItem?.id === item.id) {
                setPreviewModalOpen(false);
            }
        } catch (err) {
            toast.error(err.message || 'Failed to delete file');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedFileIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to permanently delete ${selectedFileIds.length} selected file(s)?`)) return;

        try {
            const res = await apiClient.post('/media/bulk-delete', { file_ids: selectedFileIds });
            if (res.success) {
                toast.success(res.message || `${selectedFileIds.length} file(s) deleted.`);
                setSelectedFileIds([]);
                loadMedia(1, false);
                loadFolders();
            }
        } catch (err) {
            toast.error(err.message || 'Bulk delete failed');
        }
    };

    // Move Files
    const openMoveModalForSelected = () => {
        if (selectedFileIds.length === 0) return;
        setFilesToMove(selectedFileIds);
        setTargetMoveFolderId('');
        setMoveModalOpen(true);
    };

    const openMoveModalForSingle = (item) => {
        setFilesToMove([item.id]);
        setTargetMoveFolderId(item.folder_id ? String(item.folder_id) : '');
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
                toast.success(res.message || 'File(s) moved successfully and database paths updated.');
                setMoveModalOpen(false);
                setSelectedFileIds([]);
                loadMedia(1, false);
                loadFolders();
            }
        } catch (err) {
            toast.error(err.message || 'Failed to move file(s)');
        }
    };

    // Folder CRUD
    const handleOpenCreateFolderModal = (parentId = null) => {
        setEditingFolder(null);
        setFolderNameInput('');
        setFolderParentInput(parentId ? String(parentId) : '');
        setFolderModalOpen(true);
    };

    const handleOpenEditFolderModal = (folder, e) => {
        e.stopPropagation();
        setEditingFolder(folder);
        setFolderNameInput(folder.name);
        setFolderParentInput(folder.parent_id ? String(folder.parent_id) : '');
        setFolderModalOpen(true);
    };

    const handleSaveFolder = async () => {
        if (!folderNameInput.trim()) {
            toast.error('Folder name is required');
            return;
        }

        try {
            const payload = {
                name: folderNameInput.trim(),
                parent_id: folderParentInput ? parseInt(folderParentInput, 10) : null
            };

            if (editingFolder) {
                await apiClient.put(`/media/folders/${editingFolder.id}`, payload);
                toast.success(`Folder "${folderNameInput}" updated successfully!`);
            } else {
                await apiClient.post('/media/folders', payload);
                toast.success(`Folder "${folderNameInput}" created successfully!`);
            }

            setFolderModalOpen(false);
            loadFolders();
            loadMedia(1, false);
        } catch (err) {
            toast.error(err.message || 'Failed to save folder');
        }
    };

    const handleDeleteFolder = async (folder, e) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete folder "${folder.name}"? Files inside will be moved to root/parent.`)) {
            return;
        }

        try {
            await apiClient.delete(`/media/folders/${folder.id}`);
            toast.success(`Folder "${folder.name}" deleted successfully.`);
            if (activeFolderId === folder.id) {
                setActiveFolderId('all');
            }
            loadFolders();
            loadMedia(1, false);
        } catch (err) {
            toast.error(err.message || 'Failed to delete folder');
        }
    };

    // Formatters
    const getFileIcon = (type) => {
        switch (type) {
            case 'image': return <BiImage size={32} color="#4f46e5" />;
            case 'document': return <BiFile size={32} color="#059669" />;
            case 'spreadsheet': return <BiSpreadsheet size={32} color="#16a34a" />;
            case 'archive': return <BiArchive size={32} color="#d97706" />;
            default: return <BiFile size={32} color="#64748b" />;
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Options for user filter Select
    const userOptions = useMemo(() => {
        const list = [{ value: 'all', label: 'All Staff Media' }];
        usersList.forEach(u => {
            const countStr = u.media_count !== undefined ? ` (${u.media_count} files)` : '';
            list.push({
                value: String(u.id),
                label: (u.full_name || u.username) + countStr
            });
        });
        return list;
    }, [usersList]);

    // Options for folder parent / target Select
    const folderSelectOptions = useMemo(() => {
        const list = [{ value: '', label: 'Root Directory (No folder)' }];
        folders.forEach(f => {
            // Exclude self if editing
            if (editingFolder && editingFolder.id === f.id) return;
            list.push({
                value: String(f.id),
                label: `📁 ${f.name} (${f.path})`
            });
        });
        return list;
    }, [folders, editingFolder]);

    // Active folder breadcrumb display
    const activeFolderObj = useMemo(() => {
        if (activeFolderId === 'all') return { name: 'All Media Library' };
        if (activeFolderId === 'root') return { name: 'Root / Unfiled Files' };
        return folders.find(f => f.id === parseInt(activeFolderId, 10)) || { name: 'Folder' };
    }, [activeFolderId, folders]);

    return (
        <div className={styles.container}>
            {/* Header Card */}
            <div className={styles.headerCard}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>
                        <BiFolderOpen size={24} color="#4f46e5" />
                        <span>Media Library & Asset Management</span>
                    </h1>
                    <p className={styles.subtitle}>
                        Organize files and project documents into folders, move assets with real-time path updates, and audit activity.
                    </p>
                </div>

                <div className={styles.headerActions}>
                    <button
                        className={styles.btnSecondary}
                        onClick={() => setActivityModalOpen(true)}
                        title="View Media Audit & Activity History"
                    >
                        <BiHistory size={16} color="#4f46e5" />
                        <span>Activity History</span>
                    </button>

                    <label className={styles.btnPrimary} style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                        <BiUpload size={16} />
                        <span>{isUploading ? 'Uploading...' : 'Upload Files'}</span>
                        <input
                            type="file"
                            multiple
                            onChange={handleFileUpload}
                            disabled={isUploading}
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>
            </div>

            {/* Upload progress indicator */}
            {isUploading && (
                <div style={{
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    color: '#3730a3',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #4f46e5',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                    }} />
                    <span>{uploadProgressText || 'Uploading media files, please wait...'}</span>
                </div>
            )}

            {/* Main Layout Grid */}
            <div className={styles.mainLayout}>
                {/* Left Folder Hierarchy Sidebar */}
                <div className={styles.folderSidebar}>
                    <div className={styles.folderSidebarHeader}>
                        <span className={styles.folderSidebarTitle}>
                            <BiFolder size={18} color="#4f46e5" />
                            <span>Folders</span>
                        </span>
                        <button
                            className={styles.btnNewFolder}
                            onClick={() => handleOpenCreateFolderModal()}
                            title="Create new folder"
                        >
                            <BiFolderPlus size={14} />
                            <span>+ Folder</span>
                        </button>
                    </div>

                    <div className={styles.folderList}>
                        {/* All Media Option */}
                        <div
                            className={`${styles.folderItem} ${activeFolderId === 'all' ? styles.folderItemActive : ''}`}
                            onClick={() => setActiveFolderId('all')}
                        >
                            <div className={styles.folderItemLeft}>
                                <BiFolderOpen size={16} color={activeFolderId === 'all' ? '#4f46e5' : '#64748b'} />
                                <span>All Media</span>
                            </div>
                            <span className={styles.folderBadge}>{totalFiles}</span>
                        </div>

                        {/* Root Files Option */}
                        <div
                            className={`${styles.folderItem} ${activeFolderId === 'root' ? styles.folderItemActive : ''}`}
                            onClick={() => setActiveFolderId('root')}
                        >
                            <div className={styles.folderItemLeft}>
                                <BiFolder size={16} color={activeFolderId === 'root' ? '#4f46e5' : '#64748b'} />
                                <span>Root Files</span>
                            </div>
                            <span className={styles.folderBadge}>{rootFilesCount}</span>
                        </div>

                        {/* Folder List */}
                        {folders.map((folder) => {
                            const isActive = activeFolderId === folder.id;
                            return (
                                <div
                                    key={folder.id}
                                    className={`${styles.folderItem} ${isActive ? styles.folderItemActive : ''}`}
                                    onClick={() => setActiveFolderId(folder.id)}
                                    title={`Path: ${folder.path}`}
                                >
                                    <div className={styles.folderItemLeft}>
                                        <BiFolder size={16} color={isActive ? '#4f46e5' : '#f59e0b'} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder.name}</span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span className={styles.folderBadge}>{folder.files_count || 0}</span>

                                        <button
                                            className={styles.folderActionsTrigger}
                                            onClick={(e) => handleOpenEditFolderModal(folder, e)}
                                            title="Rename or move folder"
                                        >
                                            <BiEdit size={13} />
                                        </button>

                                        <button
                                            className={styles.folderActionsTrigger}
                                            onClick={(e) => handleDeleteFolder(folder, e)}
                                            title="Delete folder"
                                            style={{ color: '#dc2626' }}
                                        >
                                            <BiTrash size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Content Area */}
                <div className={styles.contentArea}>
                    {/* Toolbar & Filters Card */}
                    <div className={styles.toolbarCard}>
                        {/* Top: Breadcrumbs & Staff Filter */}
                        <div className={styles.toolbarTop}>
                            <div className={styles.breadcrumbs}>
                                <span className={styles.breadcrumbCrumb} onClick={() => setActiveFolderId('all')}>
                                    Library
                                </span>
                                <BiChevronRight size={14} color="#94a3b8" />
                                <span className={styles.breadcrumbActive}>
                                    {activeFolderObj.name}
                                </span>
                            </div>

                            {/* User Filter (Custom Select) */}
                            {isSuperAdmin && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
                                    <BiUser size={15} color="#64748b" />
                                    <Select
                                        value={selectedUserId}
                                        onChange={(val) => setSelectedUserId(val)}
                                        options={userOptions}
                                        searchable={true}
                                        size="small"
                                        placeholder="Filter by staff..."
                                        style={{ width: '210px' }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Bottom: Search & File Type Pills */}
                        <div className={styles.toolbarBottom}>
                            <div className={styles.searchBox}>
                                <BiSearch size={15} color="#64748b" style={{ marginRight: '6px' }} />
                                <input
                                    type="text"
                                    className={styles.searchInput}
                                    placeholder="Search filename or caption..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            <div className={styles.typeFilters}>
                                {['all', 'image', 'document', 'spreadsheet', 'archive', 'other'].map((type) => (
                                    <button
                                        key={type}
                                        className={`${styles.typeFilterBtn} ${filterType === type ? styles.typeFilterBtnActive : ''}`}
                                        onClick={() => setFilterType(type)}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Multi-Selection Action Bar */}
                    {selectedFileIds.length > 0 && (
                        <div className={styles.selectionBar}>
                            <div className={styles.selectionCount}>
                                <BiCheckSquare size={18} color="#818cf8" />
                                <span>{selectedFileIds.length} file(s) selected</span>
                            </div>

                            <div className={styles.selectionActions}>
                                <button
                                    className={styles.btnSelectionAction}
                                    onClick={openMoveModalForSelected}
                                    title="Move selected files to a folder"
                                >
                                    <BiMove size={14} />
                                    <span>Move to Folder</span>
                                </button>

                                <button
                                    className={`${styles.btnSelectionAction} ${styles.btnSelectionDanger}`}
                                    onClick={handleBulkDelete}
                                    title="Delete selected files"
                                >
                                    <BiTrash size={14} />
                                    <span>Delete Selected</span>
                                </button>

                                <button
                                    className={styles.btnSelectionAction}
                                    onClick={handleClearSelection}
                                    title="Deselect all"
                                >
                                    <span>Clear</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Media Items Grid */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b', fontSize: '14px' }}>
                            Loading media files...
                        </div>
                    ) : mediaItems.length === 0 ? (
                        <div className={styles.emptyState}>
                            <BiImage size={44} color="#cbd5e1" style={{ marginBottom: '10px' }} />
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#334155' }}>
                                No media files found
                            </div>
                            <p style={{ fontSize: '13px', marginTop: '4px', color: '#64748b' }}>
                                {search
                                    ? `No files matching "${search}".`
                                    : 'Upload drawing files, photos, or documents into this folder to get started.'}
                            </p>
                            <label className={styles.btnPrimary} style={{ marginTop: '12px', display: 'inline-flex' }}>
                                <BiUpload size={15} /> Upload Files
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    ) : (
                        <>
                            {/* Toolbar to select all visible files */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>
                                    Showing {mediaItems.length} of {totalFiles} files
                                </span>
                                <button
                                    onClick={handleSelectAllVisible}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#4f46e5',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {selectedFileIds.length === mediaItems.length ? 'Deselect All' : 'Select All Visible'}
                                </button>
                            </div>

                            <div className={styles.mediaGrid}>
                                {mediaItems.map((item) => {
                                    const isSelected = selectedFileIds.includes(item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            className={`${styles.mediaCard} ${isSelected ? styles.mediaCardSelected : ''}`}
                                        >
                                            {/* Card Top Overlay Controls */}
                                            <div className={styles.cardTopControls}>
                                                <div
                                                    className={`${styles.checkboxContainer} ${isSelected ? styles.checkboxChecked : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleSelectFile(item.id);
                                                    }}
                                                    title={isSelected ? 'Deselect' : 'Select file'}
                                                >
                                                    {isSelected && <BiCheck size={14} />}
                                                </div>

                                                <div className={styles.cardQuickActions}>
                                                    <button
                                                        className={styles.quickActionBtn}
                                                        onClick={() => openMoveModalForSingle(item)}
                                                        title="Move to another folder"
                                                    >
                                                        <BiMove size={13} />
                                                    </button>
                                                    <button
                                                        className={`${styles.quickActionBtn} ${styles.quickActionBtnDanger}`}
                                                        onClick={() => handleDeleteSingle(item)}
                                                        title="Delete file"
                                                    >
                                                        <BiTrash size={13} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Preview Thumbnail */}
                                            <div
                                                className={styles.previewArea}
                                                onClick={() => {
                                                    setPreviewItem(item);
                                                    setPreviewModalOpen(true);
                                                }}
                                            >
                                                {item.file_type === 'image' ? (
                                                    <img
                                                        src={getMediaUrl(item.file_path)}
                                                        alt={item.original_name}
                                                        className={styles.previewImg}
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                        {getFileIcon(item.file_type)}
                                                        <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#64748b' }}>
                                                            {item.file_type}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Card Body Details */}
                                            <div className={styles.cardBody}>
                                                <div className={styles.fileName} title={item.original_name}>
                                                    {item.original_name}
                                                </div>

                                                <div className={styles.cardMeta}>
                                                    <span>{formatFileSize(item.file_size)}</span>
                                                    <span>{item.created_at?.slice(0, 10)}</span>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                                                    <span className={styles.uploaderTag} title={`Uploaded by: ${item.uploader_name || item.uploader_username}`}>
                                                        @{item.uploader_username || 'user'}
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

                            {/* Load More Pagination Section */}
                            <div className={styles.loadMoreContainer}>
                                <div className={styles.loadMoreProgress}>
                                    Showing {mediaItems.length} of {totalFiles} media items
                                </div>

                                {hasMore ? (
                                    <button
                                        className={styles.btnLoadMore}
                                        onClick={handleLoadMore}
                                        disabled={loadingMore}
                                    >
                                        {loadingMore ? (
                                            <>
                                                <div style={{
                                                    width: '14px',
                                                    height: '14px',
                                                    border: '2px solid #4f46e5',
                                                    borderTopColor: 'transparent',
                                                    borderRadius: '50%',
                                                    animation: 'spin 0.8s linear infinite'
                                                }} />
                                                <span>Loading more files...</span>
                                            </>
                                        ) : (
                                            <>
                                                <BiRefresh size={16} />
                                                <span>Load More Files</span>
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                        All files loaded
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Folder Create / Edit Modal */}
            <Modal
                open={folderModalOpen}
                onClose={() => setFolderModalOpen(false)}
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BiFolderPlus size={20} color="#4f46e5" />
                        <span>{editingFolder ? 'Rename or Move Folder' : 'Create New Folder'}</span>
                    </div>
                }
                size="small"
                width="460px"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                            Folder Name *
                        </label>
                        <input
                            type="text"
                            value={folderNameInput}
                            onChange={(e) => setFolderNameInput(e.target.value)}
                            placeholder="e.g. Design Drawings, Invoices, Contracts"
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '13px',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                            Parent Folder (Optional)
                        </label>
                        <Select
                            value={folderParentInput}
                            onChange={(val) => setFolderParentInput(val)}
                            options={folderSelectOptions}
                            placeholder="Select parent folder..."
                            searchable={true}
                            style={{ width: '100%' }}
                        />
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                            Leave as "Root Directory" to create a top-level folder.
                        </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                        <button
                            className={styles.btnSecondary}
                            onClick={() => setFolderModalOpen(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className={styles.btnPrimary}
                            onClick={handleSaveFolder}
                        >
                            {editingFolder ? 'Update Folder' : 'Create Folder'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Move Files Modal */}
            <Modal
                open={moveModalOpen}
                onClose={() => setMoveModalOpen(false)}
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BiMove size={20} color="#4f46e5" />
                        <span>Move {filesToMove.length} File(s) to Folder</span>
                    </div>
                }
                size="small"
                width="480px"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                        Select the target destination folder. The physical file paths and database paths will be automatically updated.
                    </p>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                            Target Folder Destination
                        </label>
                        <Select
                            value={targetMoveFolderId}
                            onChange={(val) => setTargetMoveFolderId(val)}
                            options={folderSelectOptions}
                            placeholder="Choose target folder..."
                            searchable={true}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                        <button
                            className={styles.btnSecondary}
                            onClick={() => setMoveModalOpen(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className={styles.btnPrimary}
                            onClick={handleConfirmMove}
                        >
                            Confirm Move
                        </button>
                    </div>
                </div>
            </Modal>

            {/* File Details & Preview Modal */}
            {previewItem && (
                <Modal
                    open={previewModalOpen}
                    onClose={() => setPreviewModalOpen(false)}
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '500px', overflow: 'hidden' }}>
                            <BiImage size={20} color="#4f46e5" />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {previewItem.original_name}
                            </span>
                        </div>
                    }
                    size="medium"
                    width="650px"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Media Preview Box */}
                        <div style={{
                            maxHeight: '340px',
                            background: '#0f172a',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                        }}>
                            {previewItem.file_type === 'image' ? (
                                <img
                                    src={getMediaUrl(previewItem.file_path)}
                                    alt={previewItem.original_name}
                                    style={{ maxWidth: '100%', maxHeight: '340px', objectFit: 'contain' }}
                                />
                            ) : (
                                <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                    {getFileIcon(previewItem.file_type)}
                                    <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
                                        {previewItem.mime_type}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* File Metadata Details */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '10px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            fontSize: '12.5px'
                        }}>
                            <div>
                                <span style={{ color: '#64748b' }}>File Size:</span>{' '}
                                <strong style={{ color: '#0f172a' }}>{formatFileSize(previewItem.file_size)}</strong>
                            </div>
                            <div>
                                <span style={{ color: '#64748b' }}>File Type:</span>{' '}
                                <strong style={{ color: '#0f172a', textTransform: 'capitalize' }}>{previewItem.file_type}</strong>
                            </div>
                            <div>
                                <span style={{ color: '#64748b' }}>Uploaded By:</span>{' '}
                                <strong style={{ color: '#4f46e5' }}>{previewItem.uploader_name || previewItem.uploader_username}</strong>
                            </div>
                            <div>
                                <span style={{ color: '#64748b' }}>Uploaded Date:</span>{' '}
                                <strong style={{ color: '#0f172a' }}>{previewItem.created_at}</strong>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <span style={{ color: '#64748b' }}>Database Path:</span>{' '}
                                <code style={{ fontSize: '11px', background: '#ffffff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                    {previewItem.file_path}
                                </code>
                            </div>
                        </div>

                        {/* Actions in Preview Modal */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                            <button
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: '#fee2e2',
                                    color: '#b91c1c',
                                    border: '1px solid #fecaca',
                                    borderRadius: '6px',
                                    padding: '7px 14px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                                onClick={() => handleDeleteSingle(previewItem)}
                            >
                                <BiTrash size={14} /> Delete
                            </button>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className={styles.btnSecondary}
                                    onClick={() => {
                                        setPreviewModalOpen(false);
                                        openMoveModalForSingle(previewItem);
                                    }}
                                >
                                    <BiMove size={14} /> Move
                                </button>

                                <a
                                    href={getMediaUrl(previewItem.file_path)}
                                    download={previewItem.original_name}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.btnPrimary}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <BiDownload size={14} /> Download
                                </a>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Media Activity / Audit Log Viewer */}
            <ActivityLogViewer
                open={activityModalOpen}
                onClose={() => setActivityModalOpen(false)}
                module="media"
                title="Media Library Audit Log & History"
            />
        </div>
    );
};

export default MediaLibrary;
