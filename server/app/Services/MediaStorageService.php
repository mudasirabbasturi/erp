<?php
namespace App\Services;

use Core\Database;
use Core\DotEnv;
use App\Services\ActivityLogger;

class MediaStorageService
{
    public static function getBaseStoragePath(): string
    {
        return DotEnv::get('UPLOAD_STORAGE_PATH', realpath(__DIR__ . '/../../public/uploads/media') ?: 'D:/rehan/ERP/server/public/uploads/media');
    }

    public static function sanitizeName(string $name): string
    {
        return preg_replace('/[^a-zA-Z0-9_\.-]/', '_', trim($name));
    }

    public static function sanitizeFolderName(string $name): string
    {
        $clean = preg_replace('/[\\/\\\\:\*\?"<>\|]/', '_', trim($name));
        return trim(preg_replace('/\s+/', ' ', $clean));
    }

    public static function getFolderPath(int $folderId): string
    {
        $folder = Database::fetch("SELECT * FROM media_folders WHERE id = :id AND deleted_at IS NULL", ['id' => $folderId]);
        if (!$folder) {
            return '';
        }
        return $folder['path'] ?: self::sanitizeFolderName($folder['name']);
    }

    public static function storeUploadedFile(array $file, int $userId, ?int $folderId = null, ?string $caption = null, bool $isPublic = false, ?int $uploadedBy = null): array
    {
        $uploaderId = $uploadedBy ?: $userId;
        $baseStorage = self::getBaseStoragePath();
        $targetSubDir = '';
        $folderRecord = null;

        if ($folderId) {
            $folderRecord = Database::fetch("SELECT * FROM media_folders WHERE id = :id AND deleted_at IS NULL", ['id' => $folderId]);
            if ($folderRecord) {
                $targetSubDir = $folderRecord['path'];
            }
        }

        if (empty($targetSubDir)) {
            $year = date('Y');
            $month = date('m');
            $targetSubDir = "{$year}/{$month}";
        }

        $userDir = rtrim($baseStorage, '/\\') . DIRECTORY_SEPARATOR . $userId . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $targetSubDir);

        if (!is_dir($userDir)) {
            mkdir($userDir, 0777, true);
        }

        $originalName = basename($file['name']);
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $sanitizedName = self::sanitizeName(pathinfo($originalName, PATHINFO_FILENAME));
        $hashPrefix = bin2hex(random_bytes(8));
        $storedName = "{$sanitizedName}_{$hashPrefix}.{$extension}";
        $targetPath = $userDir . DIRECTORY_SEPARATOR . $storedName;

        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            throw new \Exception("Failed to move uploaded file to target destination.");
        }

        $fileSize = filesize($targetPath);
        $mimeType = mime_content_type($targetPath) ?: 'application/octet-stream';
        $dimensions = null;

        // Classify file type
        $fileType = 'other';
        if (str_starts_with($mimeType, 'image/')) {
            $fileType = 'image';
            $imageInfo = @getimagesize($targetPath);
            if ($imageInfo) {
                $dimensions = "{$imageInfo[0]}x{$imageInfo[1]}";
            }
        } elseif (in_array($extension, ['pdf', 'doc', 'docx', 'txt', 'rtf'])) {
            $fileType = 'document';
        } elseif (in_array($extension, ['xls', 'xlsx', 'csv'])) {
            $fileType = 'spreadsheet';
        } elseif (in_array($extension, ['zip', 'rar', '7z', 'tar', 'gz'])) {
            $fileType = 'archive';
        }

        // Relative path for web access and database storage
        $relativePath = "uploads/media/{$userId}/" . str_replace('\\', '/', $targetSubDir) . "/{$storedName}";

        $mediaId = Database::insert('media', [
            'user_id'       => $userId,
            'uploaded_by'   => $uploaderId,
            'folder_id'     => $folderRecord ? $folderRecord['id'] : null,
            'original_name' => $originalName,
            'stored_name'   => $storedName,
            'file_path'     => $relativePath,
            'file_type'     => $fileType,
            'mime_type'     => $mimeType,
            'file_size'     => $fileSize,
            'dimensions'    => $dimensions,
            'caption'       => $caption,
            'is_public'     => $isPublic ? 1 : 0,
            'created_at'    => date('Y-m-d H:i:s'),
            'updated_at'    => date('Y-m-d H:i:s'),
        ]);

        $created = Database::fetch("SELECT * FROM media WHERE id = :id", ['id' => $mediaId]);

        // Audit log
        ActivityLogger::log(
            $uploaderId,
            'uploaded',
            'media',
            $mediaId,
            $originalName,
            "Uploaded file '{$originalName}' for user #{$userId} to " . ($folderRecord ? "folder '{$folderRecord['name']}'" : "root directory"),
            null,
            $created
        );

        return $created;
    }

    public static function moveFile(int $mediaId, ?int $targetFolderId, int $requestingUserId, bool $isSuperAdmin = false): array
    {
        $media = Database::fetch("SELECT * FROM media WHERE id = :id AND deleted_at IS NULL", ['id' => $mediaId]);
        if (!$media) {
            throw new \Exception("Media item with ID {$mediaId} not found.");
        }

        if (!$isSuperAdmin && (int)$media['user_id'] !== $requestingUserId) {
            throw new \Exception("Unauthorized: You can only move your own media assets.");
        }

        $userId = (int)$media['user_id'];
        $baseStorage = self::getBaseStoragePath();
        $targetFolder = null;
        $targetSubDir = '';

        if (!empty($targetFolderId)) {
            $targetFolder = Database::fetch("SELECT * FROM media_folders WHERE id = :id AND deleted_at IS NULL", ['id' => $targetFolderId]);
            if (!$targetFolder) {
                throw new \Exception("Target destination folder does not exist.");
            }
            $targetSubDir = $targetFolder['path'];
        } else {
            // Root storage for user
            $targetSubDir = "root";
        }

        $destDir = rtrim($baseStorage, '/\\') . DIRECTORY_SEPARATOR . $userId . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $targetSubDir);
        if (!is_dir($destDir)) {
            mkdir($destDir, 0777, true);
        }

        $currentPhysical = realpath(__DIR__ . '/../../public') ? realpath(__DIR__ . '/../../public') . '/' . ltrim($media['file_path'], '/\\') : 'D:/rehan/ERP/server/public/' . ltrim($media['file_path'], '/\\');
        $newPhysical = $destDir . DIRECTORY_SEPARATOR . $media['stored_name'];
        $newRelativePath = "uploads/media/{$userId}/" . str_replace('\\', '/', $targetSubDir) . "/{$media['stored_name']}";

        // If file exists at old physical location, move it
        if (file_exists($currentPhysical) && $currentPhysical !== $newPhysical) {
            @rename($currentPhysical, $newPhysical);
        }

        $oldValues = ['folder_id' => $media['folder_id'], 'file_path' => $media['file_path']];
        $newValues = ['folder_id' => $targetFolder ? (int)$targetFolder['id'] : null, 'file_path' => $newRelativePath];

        Database::update('media', [
            'folder_id'  => $targetFolder ? (int)$targetFolder['id'] : null,
            'file_path'  => $newRelativePath,
            'updated_at' => date('Y-m-d H:i:s'),
        ], 'id = :id', ['id' => $mediaId]);

        ActivityLogger::log(
            $requestingUserId,
            'moved',
            'media',
            $mediaId,
            $media['original_name'],
            "Moved file '{$media['original_name']}' to " . ($targetFolder ? "folder '{$targetFolder['name']}'" : "root directory"),
            $oldValues,
            $newValues
        );

        return Database::fetch("SELECT * FROM media WHERE id = :id", ['id' => $mediaId]);
    }

    public static function deleteFile(int $mediaId, ?int $requestingUserId = null, bool $isSuperAdmin = false): bool
    {
        $media = Database::fetch("SELECT * FROM media WHERE id = :id", ['id' => $mediaId]);
        if (!$media) {
            return false;
        }

        // Check ownership unless Super Admin
        if (!$isSuperAdmin && (int)$media['user_id'] !== $requestingUserId) {
            throw new \Exception("Unauthorized: You can only delete your own media files.");
        }

        $fullPath = realpath(__DIR__ . '/../../public') ? realpath(__DIR__ . '/../../public') . '/' . ltrim($media['file_path'], '/\\') : 'D:/rehan/ERP/server/public/' . ltrim($media['file_path'], '/\\');
        if (file_exists($fullPath)) {
            @unlink($fullPath);
        }

        Database::update('media', ['deleted_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => $mediaId]);

        ActivityLogger::log(
            $requestingUserId,
            'deleted',
            'media',
            $mediaId,
            $media['original_name'],
            "Deleted file '{$media['original_name']}'",
            $media,
            ['deleted_at' => date('Y-m-d H:i:s')]
        );

        return true;
    }
}
