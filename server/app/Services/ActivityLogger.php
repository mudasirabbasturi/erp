<?php
namespace App\Services;

use Core\Database;

class ActivityLogger
{
    /**
     * Centralized audit logging for any module action (create, update, delete, move, upload, etc.)
     */
    public static function log(
        ?int $userId,
        string $action,
        string $module,
        ?int $recordId = null,
        ?string $recordTitle = null,
        ?string $description = null,
        mixed $oldValues = null,
        mixed $newValues = null,
        ?string $ip = null,
        ?string $userAgent = null
    ): ?int {
        try {
            $ipAddress = $ip ?? ($_SERVER['REMOTE_ADDR'] ?? null);
            $uAgent = $userAgent ?? ($_SERVER['HTTP_USER_AGENT'] ?? null);

            $oldJson = $oldValues !== null ? (is_string($oldValues) ? $oldValues : json_encode($oldValues, JSON_UNESCAPED_UNICODE)) : null;
            $newJson = $newValues !== null ? (is_string($newValues) ? $newValues : json_encode($newValues, JSON_UNESCAPED_UNICODE)) : null;

            return Database::insert('activity_logs', [
                'user_id'      => $userId,
                'action'       => strtolower($action),
                'module'       => strtolower($module),
                'record_id'    => $recordId,
                'record_title' => $recordTitle,
                'description'  => $description,
                'old_values'   => $oldJson,
                'new_values'   => $newJson,
                'ip_address'   => $ipAddress,
                'user_agent'   => $uAgent,
                'created_at'   => date('Y-m-d H:i:s'),
            ]);
        } catch (\Throwable $e) {
            // Never break runtime operations if logging fails
            error_log("ActivityLogger error: " . $e->getMessage());
            return null;
        }
    }
}

