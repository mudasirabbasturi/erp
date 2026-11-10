<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;
use App\Services\MediaStorageService;
use App\Services\ActivityLogger;

class MediaController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $this->user($request);
        $isSuper = $this->isSuperAdmin($request);

        $page = (int)$request->query('page', 1);
        $perPage = (int)$request->query('per_page', 24);
        $fileType = $request->query('type');
        $search = trim($request->query('search', ''));
        $filterUserId = $request->query('user_id');
        $folderId = $request->query('folder_id'); // 'all', 'root', '0', or numeric id

        $offset = ($page - 1) * $perPage;
        $where = ["m.deleted_at IS NULL"];
        $params = [];

        // Privacy rule: Normal users only see their own uploaded media
        if (!$isSuper) {
            $where[] = "m.user_id = :current_user_id";
            $params['current_user_id'] = $user['id'];
        } elseif (!empty($filterUserId) && $filterUserId !== 'all') {
            $where[] = "m.user_id = :filter_user_id";
            $params['filter_user_id'] = (int)$filterUserId;
        }

        // Folder filter
        if ($folderId !== null && $folderId !== '' && $folderId !== 'all') {
            if ($folderId === 'root' || $folderId === '0' || $folderId === 0) {
                $where[] = "m.folder_id IS NULL";
            } else {
                $where[] = "m.folder_id = :folder_id";
                $params['folder_id'] = (int)$folderId;
            }
        }

        if (!empty($fileType) && $fileType !== 'all') {
            $where[] = "m.file_type = :file_type";
            $params['file_type'] = $fileType;
        }

        if (!empty($search)) {
            $where[] = "(m.original_name LIKE :search_name OR m.caption LIKE :search_cap)";
            $params['search_name'] = "%{$search}%";
            $params['search_cap'] = "%{$search}%";
        }

        $whereSql = implode(' AND ', $where);

        $totalSql = "SELECT COUNT(*) FROM media m WHERE {$whereSql}";
        $total = (int)Database::fetchColumn($totalSql, $params);

        $sql = "SELECT m.*, 
                       u.username as owner_username, p.full_name as owner_name,
                       up.username as uploader_username, upp.full_name as uploader_name,
                       f.name as folder_name, f.path as folder_path
                FROM media m
                JOIN users u ON u.id = m.user_id
                LEFT JOIN user_profiles p ON p.user_id = u.id
                LEFT JOIN users up ON up.id = COALESCE(m.uploaded_by, m.user_id)
                LEFT JOIN user_profiles upp ON upp.user_id = up.id
                LEFT JOIN media_folders f ON f.id = m.folder_id
                WHERE {$whereSql}
                ORDER BY m.id DESC
                LIMIT {$perPage} OFFSET {$offset}";

        $items = Database::fetchAll($sql, $params);

        return $this->paginate($items, $total, $page, $perPage, 'Media library loaded');
    }

    public function folders(Request $request): Response
    {
        $user = $this->user($request);
        $isSuper = $this->isSuperAdmin($request);
        $filterUserId = $request->query('user_id');

        $where = ["f.deleted_at IS NULL"];
        $params = [];

        if (!$isSuper) {
            $where[] = "f.user_id = :uid";
            $params['uid'] = $user['id'];
        } elseif (!empty($filterUserId) && $filterUserId !== 'all') {
            $where[] = "f.user_id = :uid";
            $params['uid'] = (int)$filterUserId;
        }

        $whereSql = implode(' AND ', $where);

        $sql = "SELECT f.*, u.username as creator_username,
                       (SELECT COUNT(*) FROM media m WHERE m.folder_id = f.id AND m.deleted_at IS NULL) as files_count
                FROM media_folders f
                JOIN users u ON u.id = f.user_id
                WHERE {$whereSql}
                ORDER BY f.parent_id ASC, f.name ASC";

        $folders = Database::fetchAll($sql, $params);

        // Also calculate count of root files (folder_id IS NULL)
        $rootWhere = ["m.deleted_at IS NULL", "m.folder_id IS NULL"];
        $rootParams = [];
        if (!$isSuper) {
            $rootWhere[] = "m.user_id = :uid";
            $rootParams['uid'] = $user['id'];
        } elseif (!empty($filterUserId) && $filterUserId !== 'all') {
            $rootWhere[] = "m.user_id = :uid";
            $rootParams['uid'] = (int)$filterUserId;
        }
        $rootCount = (int)Database::fetchColumn("SELECT COUNT(*) FROM media m WHERE " . implode(' AND ', $rootWhere), $rootParams);

        return $this->success([
            'folders' => $folders,
            'root_files_count' => $rootCount
        ], 'Folders loaded successfully');
    }

    public function storeFolder(Request $request): Response
    {
        $authUser = $this->user($request);
        $targetUserId = $request->input('user_id');
        $folderUserId = (int)$authUser['id'];
        if (!empty($targetUserId) && (int)$targetUserId > 0 && ($this->isSuperAdmin($request) || (int)$targetUserId === (int)$authUser['id'])) {
            $folderUserId = (int)$targetUserId;
        }

        $name = trim($request->input('name', ''));
        $parentId = $request->input('parent_id');
        $parentId = (!empty($parentId) && (int)$parentId > 0) ? (int)$parentId : null;

        if (empty($name)) {
            return $this->error('Folder name is required.', 422);
        }

        $cleanName = MediaStorageService::sanitizeFolderName($name);
        $cleanSlug = strtolower(preg_replace('/[^a-zA-Z0-9_-]/', '-', $cleanName));

        // Calculate path
        $path = $cleanName;
        if ($parentId) {
            $parent = Database::fetch("SELECT * FROM media_folders WHERE id = :id AND deleted_at IS NULL", ['id' => $parentId]);
            if ($parent) {
                $path = rtrim($parent['path'], '/') . '/' . $cleanName;
            } else {
                $parentId = null;
            }
        }

        // Create folder directory on disk
        $baseStorage = MediaStorageService::getBaseStoragePath();
        $targetDir = rtrim($baseStorage, '/\\') . DIRECTORY_SEPARATOR . $folderUserId . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path);
        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0777, true);
        }

        $folderId = Database::insert('media_folders', [
            'user_id'    => $folderUserId,
            'parent_id'  => $parentId,
            'name'       => $name,
            'slug'       => $cleanSlug,
            'path'       => $path,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $folder = Database::fetch("SELECT * FROM media_folders WHERE id = :id", ['id' => $folderId]);

        ActivityLogger::log(
            (int)$authUser['id'],
            'created',
            'folder',
            $folderId,
            $name,
            "Created folder '{$name}' for user #{$folderUserId} at '{$path}'",
            null,
            $folder
        );

        return $this->success($folder, 'Folder created successfully', 201);
    }

    public function updateFolder(Request $request): Response
    {
        $id = (int)$request->param('id');
        $user = $this->user($request);
        $isSuper = $this->isSuperAdmin($request);

        $folder = Database::fetch("SELECT * FROM media_folders WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);
        if (!$folder) {
            return $this->error('Folder not found.', 404);
        }

        if (!$isSuper && (int)$folder['user_id'] !== (int)$user['id']) {
            return $this->error('Unauthorized to edit this folder.', 403);
        }

        $name = trim($request->input('name', $folder['name']));
        $parentId = $request->input('parent_id', $folder['parent_id']);
        $parentId = (!empty($parentId) && (int)$parentId > 0) ? (int)$parentId : null;

        // Prevent moving folder into itself
        if ($parentId === $id) {
            return $this->error('Folder cannot be its own parent.', 422);
        }

        $cleanName = MediaStorageService::sanitizeFolderName($name);
        $oldPath = $folder['path'];
        $newPath = $cleanName;

        if ($parentId) {
            $parent = Database::fetch("SELECT * FROM media_folders WHERE id = :id AND deleted_at IS NULL", ['id' => $parentId]);
            if ($parent) {
                // Check circular hierarchy
                if (str_starts_with($parent['path'], $oldPath . '/')) {
                    return $this->error('Cannot move folder inside its own subfolder.', 422);
                }
                $newPath = rtrim($parent['path'], '/') . '/' . $cleanName;
            }
        }

        $userId = (int)$folder['user_id'];
        $baseStorage = MediaStorageService::getBaseStoragePath();
        $oldDir = rtrim($baseStorage, '/\\') . DIRECTORY_SEPARATOR . $userId . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $oldPath);
        $newDir = rtrim($baseStorage, '/\\') . DIRECTORY_SEPARATOR . $userId . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $newPath);

        if (is_dir($oldDir) && $oldDir !== $newDir) {
            $parentNewDir = dirname($newDir);
            if (!is_dir($parentNewDir)) {
                mkdir($parentNewDir, 0777, true);
            }
            @rename($oldDir, $newDir);
        }

        Database::update('media_folders', [
            'name'       => $name,
            'parent_id'  => $parentId,
            'path'       => $newPath,
            'updated_at' => date('Y-m-d H:i:s'),
        ], 'id = :id', ['id' => $id]);

        // If path changed, update child folders and all files in this folder & subfolders
        if ($oldPath !== $newPath) {
            // Update child folders paths
            $childFolders = Database::fetchAll("SELECT * FROM media_folders WHERE path LIKE :likePath AND deleted_at IS NULL", ['likePath' => $oldPath . '/%']);
            foreach ($childFolders as $c) {
                $subNewPath = preg_replace('#^' . preg_quote($oldPath, '#') . '#', $newPath, $c['path']);
                Database::update('media_folders', ['path' => $subNewPath], 'id = :id', ['id' => $c['id']]);
            }

            // Update file paths in DB for all files in this folder
            $files = Database::fetchAll("SELECT id, file_path FROM media WHERE folder_id = :fid AND deleted_at IS NULL", ['fid' => $id]);
            foreach ($files as $file) {
                $newFilePath = preg_replace('#/' . preg_quote($oldPath, '#') . '/#', '/' . $newPath . '/', $file['file_path']);
                Database::update('media', ['file_path' => $newFilePath], 'id = :id', ['id' => $file['id']]);
            }
        }

        ActivityLogger::log(
            (int)$user['id'],
            'updated',
            'folder',
            $id,
            $name,
            "Renamed/moved folder '{$name}' from '{$oldPath}' to '{$newPath}'",
            $folder,
            ['name' => $name, 'parent_id' => $parentId, 'path' => $newPath]
        );

        $updated = Database::fetch("SELECT * FROM media_folders WHERE id = :id", ['id' => $id]);
        return $this->success($updated, 'Folder updated successfully');
    }

    public function destroyFolder(Request $request): Response
    {
        $id = (int)$request->param('id');
        $user = $this->user($request);
        $isSuper = $this->isSuperAdmin($request);

        $folder = Database::fetch("SELECT * FROM media_folders WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);
        if (!$folder) {
            return $this->error('Folder not found.', 404);
        }

        if (!$isSuper && (int)$folder['user_id'] !== (int)$user['id']) {
            return $this->error('Unauthorized to delete this folder.', 403);
        }

        // Reassign files in this folder to the parent folder or root (NULL)
        $targetFolderId = $folder['parent_id'] ?: null;
        $files = Database::fetchAll("SELECT * FROM media WHERE folder_id = :id AND deleted_at IS NULL", ['id' => $id]);

        foreach ($files as $f) {
            try {
                MediaStorageService::moveFile((int)$f['id'], $targetFolderId, (int)$user['id'], $isSuper);
            } catch (\Throwable $e) {
                // Fallback: update DB folder_id
                Database::update('media', ['folder_id' => $targetFolderId], 'id = :id', ['id' => $f['id']]);
            }
        }

        // Soft delete folder
        Database::update('media_folders', ['deleted_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => $id]);

        ActivityLogger::log(
            (int)$user['id'],
            'deleted',
            'folder',
            $id,
            $folder['name'],
            "Deleted folder '{$folder['name']}', moved contents to " . ($targetFolderId ? "parent folder #{$targetFolderId}" : "root"),
            $folder,
            ['deleted_at' => date('Y-m-d H:i:s')]
        );

        return $this->success(null, 'Folder deleted successfully');
    }

    public function upload(Request $request): Response
    {
        $authUser = $this->user($request);

        if (!$request->hasFile('file')) {
            return $this->error('No valid file was uploaded in request payload.', 422);
        }

        $file = $request->file('file');
        $caption = $request->input('caption');
        $folderId = $request->input('folder_id');
        $folderId = (!empty($folderId) && (int)$folderId > 0) ? (int)$folderId : null;
        $isPublic = (bool)$request->input('is_public', false);

        // Check target owner user ID (e.g. when uploading from /users/:id/media)
        $targetUserId = $request->input('user_id');
        $ownerUserId = (int)$authUser['id'];
        if (!empty($targetUserId) && (int)$targetUserId > 0) {
            if ($this->isSuperAdmin($request) || (int)$authUser['id'] === (int)$targetUserId) {
                $ownerUserId = (int)$targetUserId;
            }
        }

        $uploadedBy = (int)$authUser['id'];

        // Check file size (50MB max default)
        $maxBytes = 50 * 1024 * 1024;
        if ($file['size'] > $maxBytes) {
            return $this->error('File exceeds maximum allowed upload size (50MB).', 422);
        }

        try {
            $media = MediaStorageService::storeUploadedFile($file, $ownerUserId, $folderId, $caption, $isPublic, $uploadedBy);
            return $this->success($media, 'File uploaded and cataloged in media library', 201);
        } catch (\Throwable $e) {
            return $this->error('Upload failed: ' . $e->getMessage(), 500);
        }
    }

    public function move(Request $request): Response
    {
        $user = $this->user($request);
        $isSuper = $this->isSuperAdmin($request);

        $fileIds = $request->input('file_ids', []);
        $targetFolderId = $request->input('folder_id');
        $targetFolderId = (!empty($targetFolderId) && (int)$targetFolderId > 0) ? (int)$targetFolderId : null;

        if (empty($fileIds) || !is_array($fileIds)) {
            // Check single id
            $singleId = $request->input('file_id');
            if ($singleId) {
                $fileIds = [(int)$singleId];
            } else {
                return $this->error('Please select at least one file to move.', 422);
            }
        }

        $moved = [];
        $failed = [];

        foreach ($fileIds as $fileId) {
            try {
                $res = MediaStorageService::moveFile((int)$fileId, $targetFolderId, (int)$user['id'], $isSuper);
                $moved[] = $res;
            } catch (\Throwable $e) {
                $failed[] = ['id' => $fileId, 'error' => $e->getMessage()];
            }
        }

        return $this->success([
            'moved_count' => count($moved),
            'failed_count' => count($failed),
            'failed' => $failed,
            'items' => $moved
        ], count($moved) . ' file(s) moved successfully and database paths updated.');
    }

    public function bulkDelete(Request $request): Response
    {
        $user = $this->user($request);
        $isSuper = $this->isSuperAdmin($request);

        $fileIds = $request->input('file_ids', []);
        if (empty($fileIds) || !is_array($fileIds)) {
            return $this->error('Please select at least one file to delete.', 422);
        }

        $deletedCount = 0;
        foreach ($fileIds as $id) {
            try {
                if (MediaStorageService::deleteFile((int)$id, (int)$user['id'], $isSuper)) {
                    $deletedCount++;
                }
            } catch (\Throwable $e) {
                // ignore individual failures in bulk
            }
        }

        return $this->success(['deleted_count' => $deletedCount], "{$deletedCount} file(s) deleted successfully.");
    }

    public function users(Request $request): Response
    {
        // Return list of users who have media files or all users for admin dropdown
        $users = Database::fetchAll("SELECT u.id, u.username, u.email, p.full_name,
                                            (SELECT COUNT(*) FROM media m WHERE m.user_id = u.id AND m.deleted_at IS NULL) as media_count
                                     FROM users u
                                     LEFT JOIN user_profiles p ON p.user_id = u.id
                                     ORDER BY u.id ASC");

        return $this->success($users, 'Media users loaded');
    }

    public function show(Request $request): Response
    {
        $id = (int)$request->param('id');
        $user = $this->user($request);
        $isSuper = $this->isSuperAdmin($request);

        $media = Database::fetch("SELECT m.*, 
                                         u.username as owner_username, p.full_name as owner_name,
                                         up.username as uploader_username, upp.full_name as uploader_name,
                                         f.name as folder_name, f.path as folder_path
                                  FROM media m
                                  JOIN users u ON u.id = m.user_id
                                  LEFT JOIN user_profiles p ON p.user_id = u.id
                                  LEFT JOIN users up ON up.id = COALESCE(m.uploaded_by, m.user_id)
                                  LEFT JOIN user_profiles upp ON upp.user_id = up.id
                                  LEFT JOIN media_folders f ON f.id = m.folder_id
                                  WHERE m.id = :id AND m.deleted_at IS NULL", ['id' => $id]);

        if (!$media) {
            return $this->error('Media file not found.', 404);
        }

        if (!$isSuper && (int)$media['user_id'] !== (int)$user['id'] && (int)$media['is_public'] !== 1) {
            return $this->error('Access denied to private media asset.', 403);
        }

        return $this->success($media, 'Media item details');
    }

    public function update(Request $request): Response
    {
        $id = (int)$request->param('id');
        $user = $this->user($request);
        $isSuper = $this->isSuperAdmin($request);

        $media = Database::fetch("SELECT * FROM media WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);
        if (!$media) {
            return $this->error('Media file not found.', 404);
        }

        if (!$isSuper && (int)$media['user_id'] !== (int)$user['id']) {
            return $this->error('Unauthorized to edit this media item.', 403);
        }

        $caption = $request->input('caption', $media['caption']);
        $isPublic = $request->input('is_public', $media['is_public']);

        Database::update('media', [
            'caption'    => $caption,
            'is_public'  => (int)$isPublic,
            'updated_at' => date('Y-m-d H:i:s'),
        ], 'id = :id', ['id' => $id]);

        ActivityLogger::log(
            (int)$user['id'],
            'updated',
            'media',
            $id,
            $media['original_name'],
            "Updated caption/visibility for '{$media['original_name']}'",
            $media,
            ['caption' => $caption, 'is_public' => $isPublic]
        );

        return $this->success(null, 'Media item updated successfully.');
    }

    public function destroy(Request $request): Response
    {
        $id = (int)$request->param('id');
        $user = $this->user($request);
        $isSuper = $this->isSuperAdmin($request);

        try {
            MediaStorageService::deleteFile($id, (int)$user['id'], $isSuper);
            return $this->success(null, 'Media file deleted successfully.');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), 403);
        }
    }
}
