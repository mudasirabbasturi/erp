<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;
use App\Services\GoogleDriveService;
use Exception;

class TrackingController extends Controller
{
    /**
     * Get all users with their live tracking status, WFH status, and today's activity stats
     */
    public function index(Request $request): Response
    {
        $status = $request->query('status', 'active');
        $date = $request->query('date', date('Y-m-d'));

        // Fetch users
        $query = "
            SELECT u.id, u.username, u.email, u.status, u.is_super_admin, u.created_at,
                   COALESCE(u.wfh_allowed, 0) AS wfh_allowed,
                   COALESCE(u.ip_restriction, 1) AS ip_restriction,
                   COALESCE(u.logout_restriction, 1) AS logout_restriction,
                   up.full_name, up.phone,
                   r.name AS role_name,
                   m.file_path AS avatar_url
            FROM users u
            LEFT JOIN user_profiles up ON up.user_id = u.id
            LEFT JOIN roles r ON r.id = u.role_id
            LEFT JOIN media m ON m.id = up.avatar_media_id
            WHERE u.deleted_at IS NULL " . ($status !== 'all' ? "AND u.status = :status" : "") . "
            ORDER BY u.id ASC
        ";
        $users = Database::fetchAll($query, $status !== 'all' ? ['status' => $status] : []);

        // Aggregate activity stats for each user for the selected date
        $startOfDay = $date . ' 00:00:00';
        $endOfDay = $date . ' 23:59:59';
        $stats = Database::fetchAll("
            SELECT user_id,
                   COUNT(*) AS total_minutes,
                   SUM(clicks) AS total_clicks,
                   SUM(keystrokes) AS total_keystrokes,
                   SUM(CASE WHEN is_idle = 1 THEN 1 ELSE 0 END) AS total_idle_minutes,
                   MAX(tracked_at) AS last_tracked_at
            FROM user_activities
            WHERE tracked_at >= :start_dt AND tracked_at <= :end_dt
            GROUP BY user_id
        ", ['start_dt' => $startOfDay, 'end_dt' => $endOfDay]);

        $statsByUser = [];
        foreach ($stats as $s) {
            $statsByUser[$s['user_id']] = $s;
        }

        $now = time();
        $data = array_map(function ($u) use ($statsByUser, $now) {
            $userId = (int)$u['id'];
            $st = $statsByUser[$userId] ?? null;
            $lastTracked = $st['last_tracked_at'] ?? null;
            $lastTrackedTs = $lastTracked ? strtotime($lastTracked) : 0;

            // Live status: online if tracked within the last 5 minutes (300 seconds)
            $isOnline = ($now - $lastTrackedTs) <= 300;

            return [
                'id' => $userId,
                'username' => $u['username'],
                'name' => $u['full_name'] ?: $u['username'],
                'full_name' => $u['full_name'] ?: $u['username'],
                'email' => $u['email'],
                'phone' => $u['phone'],
                'role_name' => $u['role_name'] ?: 'Staff',
                'avatar_url' => $u['avatar_url'],
                'status' => $u['status'],
                'wfh_allowed' => (bool)$u['wfh_allowed'],
                'ip_restriction' => (bool)$u['ip_restriction'],
                'logout_restriction' => (bool)$u['logout_restriction'],
                'is_online' => $isOnline,
                'last_active_at' => $lastTracked,
                'total_minutes' => (int)($st['total_minutes'] ?? 0),
                'total_clicks' => (int)($st['total_clicks'] ?? 0),
                'total_keystrokes' => (int)($st['total_keystrokes'] ?? 0),
                'total_idle_minutes' => (int)($st['total_idle_minutes'] ?? 0),
            ];
        }, $users);

        return Response::success($data);
    }

    /**
     * Endpoint for Desktop Tracker App: Fetch global settings and pending screenshot trigger
     */
    public function getTrackerSettings(Request $request): Response
    {
        $userId = (int)$request->query('user_id');

        $row = Database::fetchOne("SELECT * FROM tracker_settings ORDER BY id ASC LIMIT 1");
        if (!$row) {
            $row = [
                'screenshot_interval' => 120,
                'sync_interval' => 120,
                'admin_password' => 'bidwinners12',
                'logout_restriction' => 1,
                'ip_restriction' => 1,
                'allowed_ips' => '139.135.32.54',
            ];
        }

        $allowedIps = array_filter(array_map('trim', explode(',', $row['allowed_ips'] ?? '')));

        // Check if there is an immediate manual screenshot requested for this user
        $hasPendingScreenshot = false;
        if ($userId > 0) {
            $pending = Database::fetchOne("
                SELECT id FROM pending_screenshots 
                WHERE user_id = :uid AND status = 'pending' AND created_at >= NOW() - INTERVAL 10 MINUTE 
                LIMIT 1
            ", ['uid' => $userId]);
            $hasPendingScreenshot = !empty($pending);
        }

        return Response::json([
            'tracker_screenshot_interval' => (int)$row['screenshot_interval'],
            'tracker_sync_interval' => (int)$row['sync_interval'],
            'tracker_admin_password' => $row['admin_password'],
            'tracker_logout_restriction' => (bool)$row['logout_restriction'],
            'tracker_ip_restriction' => (bool)$row['ip_restriction'],
            'tracker_allowed_ips' => array_values($allowedIps),
            'tracker_api_url' => getenv('APP_URL') ?: 'http://127.0.0.1:8000',
            'pending_screenshot' => $hasPendingScreenshot
        ]);
    }

    /**
     * Endpoint for Desktop Tracker App: Polling check for pending screenshot
     */
    public function checkPendingScreenshot(Request $request): Response
    {
        $userId = (int)($request->param('userId') ?? $request->query('user_id', 0));
        if (!$userId) {
            return Response::json(['pending' => false]);
        }

        $pending = Database::fetchOne("
            SELECT id FROM pending_screenshots 
            WHERE user_id = :uid AND status = 'pending' AND created_at >= NOW() - INTERVAL 10 MINUTE 
            LIMIT 1
        ", ['uid' => $userId]);

        return Response::json(['pending' => !empty($pending)]);
    }

    /**
     * Admin Action: Trigger immediate screenshot for a user
     */
    public function triggerScreenshot(Request $request): Response
    {
        $userId = (int)$request->input('user_id');
        if (!$userId) {
            return Response::error('User ID is required', 400);
        }

        $currentUser = $this->user($request);
        $requestedBy = $currentUser ? (int)$currentUser['id'] : null;

        // Cancel existing pending and insert new one
        Database::execute("
            UPDATE pending_screenshots SET status = 'expired' WHERE user_id = :uid AND status = 'pending'
        ", ['uid' => $userId]);

        Database::execute("
            INSERT INTO pending_screenshots (user_id, requested_by, status, created_at)
            VALUES (:uid, :req, 'pending', NOW())
        ", [
            'uid' => $userId,
            'req' => $requestedBy
        ]);

        return Response::success(null, 'Screenshot trigger sent to employee device.');
    }

    /**
     * Endpoint for Desktop Tracker App: Upload captured screenshot
     */
    public function uploadScreenshot(Request $request): Response
    {
        $userId = (int)$request->input('user_id');
        $timestamp = $request->input('timestamp', date('Y-m-d H:i:s'));

        if (!$userId) {
            return Response::error('User ID is required', 400);
        }

        if (empty($_FILES['screenshot']) || $_FILES['screenshot']['error'] !== UPLOAD_ERR_OK) {
            return Response::error('No valid screenshot file uploaded', 400);
        }

        $file = $_FILES['screenshot'];
        $content = file_get_contents($file['tmp_name']);
        if (!$content) {
            return Response::error('Failed to read uploaded file', 500);
        }

        $filename = time() . '_' . $userId . '_screenshot.jpg';
        $relativeLocalPath = 'uploads/screenshots/' . $userId . '/' . $filename;
        $fullLocalPath = __DIR__ . '/../../public/' . $relativeLocalPath;

        // Ensure user directory exists
        $dir = dirname($fullLocalPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }
        file_put_contents($fullLocalPath, $content);

        // Attempt Google Drive upload
        $driveFileId = null;
        $webViewLink = null;
        $thumbnailUrl = null;

        try {
            $gdrive = new GoogleDriveService();
            $uploadRes = $gdrive->uploadFile($content, $filename, 'image/jpeg');
            $driveFileId = $uploadRes['id'] ?? null;
            $webViewLink = $uploadRes['webViewLink'] ?? null;
            $thumbnailUrl = $uploadRes['thumbnailLink'] ?? null;
        } catch (Exception $e) {
            error_log("Google Drive upload warning: " . $e->getMessage());
        }

        // Insert screenshot record
        $screenshotTime = !empty($timestamp) ? date('Y-m-d H:i:s', strtotime($timestamp)) : date('Y-m-d H:i:s');
        Database::execute("
            INSERT INTO user_screenshots (user_id, file_path, drive_file_id, file_name, mime_type, file_size, thumbnail_url, web_view_link, screenshot_time, created_at, updated_at)
            VALUES (:uid, :fp, :dfid, :fn, 'image/jpeg', :fs, :thumb, :wvl, :st, NOW(), NOW())
        ", [
            'uid' => $userId,
            'fp' => $relativeLocalPath,
            'dfid' => $driveFileId,
            'fn' => $filename,
            'fs' => strlen($content),
            'thumb' => $thumbnailUrl,
            'wvl' => $webViewLink,
            'st' => $screenshotTime
        ]);

        // Complete any pending screenshot requests for this user
        Database::execute("
            UPDATE pending_screenshots SET status = 'completed' WHERE user_id = :uid AND status = 'pending'
        ", ['uid' => $userId]);

        return Response::success([
            'file_path' => $relativeLocalPath,
            'drive_file_id' => $driveFileId,
            'web_view_link' => $webViewLink
        ], 'Screenshot uploaded successfully');
    }

    /**
     * Get paginated screenshots for a user with date filters
     */
    public function getScreenshots(Request $request): Response
    {
        $userId = (int)$request->query('user_id');
        if (!$userId) {
            return Response::error('User ID is required', 400);
        }

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $page = max(1, (int)$request->query('page', 1));
        $perPage = max(1, min(100, (int)$request->query('per_page', 24)));
        $offset = ($page - 1) * $perPage;

        $params = ['uid' => $userId];
        $whereSql = "WHERE user_id = :uid";

        if (!empty($startDate) && !empty($endDate)) {
            $whereSql .= " AND screenshot_time BETWEEN :start AND :end";
            $params['start'] = $startDate . ' 00:00:00';
            $params['end'] = $endDate . ' 23:59:59';
        } elseif (!empty($startDate)) {
            $whereSql .= " AND DATE(screenshot_time) = :start";
            $params['start'] = $startDate;
        }

        $total = (int)Database::fetchColumn("SELECT COUNT(*) FROM user_screenshots {$whereSql}", $params);

        $screenshots = Database::fetchAll("
            SELECT id, user_id, file_path, drive_file_id, file_name, thumbnail_url, web_view_link, screenshot_time, created_at
            FROM user_screenshots
            {$whereSql}
            ORDER BY screenshot_time DESC
            LIMIT {$perPage} OFFSET {$offset}
        ", $params);

        $formatted = array_map(function ($s) {
            $localUrl = !empty($s['file_path']) ? '/' . ltrim($s['file_path'], '/') : null;
            $imageUrl = $s['web_view_link'] ?: $localUrl;
            $thumbUrl = $s['thumbnail_url'] ?: $localUrl;

            return [
                'id' => (int)$s['id'],
                'user_id' => (int)$s['user_id'],
                'file_path' => $s['file_path'],
                'drive_file_id' => $s['drive_file_id'],
                'url' => $imageUrl,
                'thumbnail_url' => $thumbUrl,
                'time' => $s['screenshot_time'],
                'created_at' => $s['created_at'],
            ];
        }, $screenshots);

        return Response::json([
            'data' => $formatted,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
            'has_more' => ($offset + count($screenshots)) < $total,
            'next_page_url' => (($offset + count($screenshots)) < $total) ? "?page=" . ($page + 1) : null
        ]);
    }

    /**
     * Delete one or multiple screenshots
     */
    public function deleteScreenshots(Request $request): Response
    {
        $ids = $request->input('ids', []);
        if (empty($ids) || !is_array($ids)) {
            return Response::error('Screenshot IDs array required', 400);
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $rows = Database::fetchAll("SELECT id, file_path, drive_file_id FROM user_screenshots WHERE id IN ({$placeholders})", $ids);

        $gdrive = new GoogleDriveService();

        foreach ($rows as $r) {
            // Delete from Google Drive if exists
            if (!empty($r['drive_file_id'])) {
                $gdrive->deleteFile($r['drive_file_id']);
            }
            // Delete local file if exists
            if (!empty($r['file_path'])) {
                $localPath = __DIR__ . '/../../public/' . ltrim($r['file_path'], '/');
                if (file_exists($localPath)) {
                    @unlink($localPath);
                }
            }
        }

        Database::execute("DELETE FROM user_screenshots WHERE id IN ({$placeholders})", $ids);

        return Response::success(null, count($rows) . ' screenshots deleted successfully.');
    }

    /**
     * Admin Action: Toggle Work From Home (WFH) allowed for a user
     */
    public function toggleWfh(Request $request): Response
    {
        $userId = (int)($request->input('user_id') ?: $request->all()['user_id'] ?? 0);
        $granted = $request->input('is_permission_granted');
        if ($granted === null) {
            $granted = $request->input('wfh_allowed', 0);
        }
        $wfhAllowed = !empty($granted) ? 1 : 0;

        if (!$userId) {
            return Response::error('User ID is required', 400);
        }

        Database::execute("UPDATE users SET wfh_allowed = :wfh WHERE id = :uid", [
            'wfh' => $wfhAllowed,
            'uid' => $userId
        ]);

        return Response::success([
            'user_id' => $userId,
            'wfh_allowed' => (bool)$wfhAllowed,
            'is_permission_granted' => (bool)$wfhAllowed
        ], 'WFH setting updated successfully.');
    }

    /**
     * Instant Active Status Check (Returns true only if user was active within last 120 seconds)
     */
    public function checkActiveStatus(Request $request): Response
    {
        $userId = (int)($request->param('userId') ?? $request->query('user_id', 0));
        if (!$userId) {
            return Response::json(['active' => false]);
        }

        $user = Database::fetchOne("
            SELECT last_active_at,
                   TIMESTAMPDIFF(SECOND, last_active_at, NOW()) AS sec_diff
            FROM users 
            WHERE id = :id AND deleted_at IS NULL
        ", ['id' => $userId]);

        $isActive = false;
        if ($user && $user['last_active_at']) {
            $secDiff = (int)$user['sec_diff'];
            // Active if recorded within last 120 seconds
            $isActive = ($secDiff <= 120 && $secDiff >= 0);
        }

        return Response::json(['active' => $isActive]);
    }

    /**
     * Heartbeat endpoint for desktop tracker: update last_active_at and is_online
     */
    public function updateStatusHeartbeat(Request $request): Response
    {
        $userId = (int)$request->input('user_id');
        if (!$userId) {
            return Response::error('User ID required', 400);
        }

        Database::execute("
            UPDATE users SET last_active_at = NOW(), is_online = 1 WHERE id = :uid
        ", ['uid' => $userId]);

        return Response::success(null, 'Heartbeat recorded');
    }

    /**
     * Admin Action: Toggle Logout Restriction for a user
     */
    public function toggleLogoutRestriction(Request $request): Response
    {
        $userId = (int)($request->input('user_id') ?: $request->all()['user_id'] ?? 0);
        $restrictedVal = $request->input('logout_restriction');
        $restricted = $restrictedVal !== null ? (!empty($restrictedVal) ? 1 : 0) : 1;

        if (!$userId) {
            return Response::error('User ID is required', 400);
        }

        Database::execute("UPDATE users SET logout_restriction = :lr WHERE id = :uid", [
            'lr' => $restricted,
            'uid' => $userId
        ]);

        return Response::success([
            'user_id' => $userId,
            'logout_restriction' => (bool)$restricted
        ], 'Logout restriction updated successfully.');
    }

    /**
     * Get the latest screenshot for all users (for Instant Monitor page)
     */
    public function getLatestAllScreenshots(Request $request): Response
    {
        $now = time();
        $users = Database::fetchAll("
            SELECT u.id AS user_id, u.username,
                   COALESCE(up.full_name, u.username) AS name,
                   u.last_active_at,
                   TIMESTAMPDIFF(SECOND, u.last_active_at, NOW()) AS sec_diff
            FROM users u
            LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE u.deleted_at IS NULL AND u.status = 'active'
            ORDER BY u.id ASC
        ");

        $data = [];
        foreach ($users as $u) {
            $userId = (int)$u['user_id'];
            $secDiff = $u['sec_diff'] !== null ? (int)$u['sec_diff'] : 999999;
            $isOnline = ($secDiff <= 120 && $secDiff >= 0);

            // Fetch absolute latest screenshot for this user
            $latest = Database::fetchOne("
                SELECT id, file_path, drive_file_id, thumbnail_url, web_view_link, screenshot_time
                FROM user_screenshots
                WHERE user_id = :uid
                ORDER BY screenshot_time DESC, id DESC
                LIMIT 1
            ", ['uid' => $userId]);

            $screenshot = null;
            if ($latest) {
                $localUrl = !empty($latest['file_path']) ? '/' . ltrim($latest['file_path'], '/') : null;
                $url = $latest['web_view_link'] ?: $localUrl;
                $thumb = $latest['thumbnail_url'] ?: $localUrl;

                $screenshot = [
                    'id' => (int)$latest['id'],
                    'file_path' => $url,
                    'url' => $url,
                    'thumbnail_url' => $thumb,
                    'screenshot_time' => $latest['screenshot_time']
                ];
            }

            $data[] = [
                'user_id' => $userId,
                'name' => $u['name'],
                'is_online' => $isOnline,
                'last_active_at' => $u['last_active_at'],
                'screenshot' => $screenshot
            ];
        }

        return Response::json($data);
    }

    /**
     * Admin Action: Update global tracker settings
     */
    public function updateGlobalSettings(Request $request): Response
    {
        $screenshotInterval = (int)$request->input('tracker_screenshot_interval', 120);
        $syncInterval = (int)$request->input('tracker_sync_interval', 120);
        $adminPassword = trim($request->input('tracker_admin_password', 'bidwinners12'));
        $logoutRestriction = !empty($request->input('tracker_logout_restriction')) ? 1 : 0;
        $ipRestriction = !empty($request->input('tracker_ip_restriction')) ? 1 : 0;
        $allowedIps = $request->input('tracker_allowed_ips', []);

        if (is_array($allowedIps)) {
            $allowedIpsStr = implode(',', array_filter(array_map('trim', $allowedIps)));
        } else {
            $allowedIpsStr = trim((string)$allowedIps);
        }

        Database::execute("
            INSERT INTO tracker_settings (id, screenshot_interval, sync_interval, admin_password, logout_restriction, ip_restriction, allowed_ips)
            VALUES (1, :si, :sync, :pw, :lr, :ir, :ips)
            ON DUPLICATE KEY UPDATE
                screenshot_interval = VALUES(screenshot_interval),
                sync_interval = VALUES(sync_interval),
                admin_password = VALUES(admin_password),
                logout_restriction = VALUES(logout_restriction),
                ip_restriction = VALUES(ip_restriction),
                allowed_ips = VALUES(allowed_ips),
                updated_at = NOW()
        ", [
            'si' => max(10, $screenshotInterval),
            'sync' => max(5, $syncInterval),
            'pw' => $adminPassword ?: 'bidwinners12',
            'lr' => $logoutRestriction,
            'ir' => $ipRestriction,
            'ips' => $allowedIpsStr
        ]);

        return Response::success(null, 'Tracker settings updated successfully.');
    }

    /**
     * Get granular activity statistics, application usage, and timeline for a single user
     */
    public function getActivityStats(Request $request): Response
    {
        $userId = (int)$request->query('user_id');
        if (!$userId) {
            $currentUser = $this->user($request);
            $userId = $currentUser ? (int)$currentUser['id'] : 0;
        }

        if (!$userId) {
            return Response::error('User ID is required', 400);
        }

        $date = $request->query('date', date('Y-m-d'));
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        if (!empty($startDate) && !empty($endDate)) {
            $sql = "
                SELECT id, user_id, app_name, window_title, url, clicks, keystrokes, is_idle, tracked_at
                FROM user_activities
                WHERE user_id = :uid
                  AND tracked_at BETWEEN :start AND :end
                ORDER BY tracked_at ASC
            ";
            $params = [
                'uid' => $userId,
                'start' => $startDate . ' 00:00:00',
                'end' => $endDate . ' 23:59:59',
            ];
        } else {
            $sql = "
                SELECT id, user_id, app_name, window_title, url, clicks, keystrokes, is_idle, tracked_at
                FROM user_activities
                WHERE user_id = :uid
                  AND DATE(tracked_at) = :date
                ORDER BY tracked_at ASC
            ";
            $params = [
                'uid' => $userId,
                'date' => $date,
            ];
        }

        $activities = Database::fetchAll($sql, $params);

        $totalClicks = 0;
        $totalKeys = 0;
        $totalIdle = 0;
        $totalMinutes = count($activities);

        $appUsageMap = [];
        $timelineMap = [];

        // Initialize 24-hour timeline
        for ($h = 0; $h < 24; $h++) {
            $key = str_pad((string)$h, 2, '0', STR_PAD_LEFT);
            $timelineMap[$key] = [
                'hour' => $key . ':00',
                'clicks' => 0,
                'keystrokes' => 0,
                'minutes' => 0,
            ];
        }

        foreach ($activities as $a) {
            $clicks = (int)$a['clicks'];
            $keys = (int)$a['keystrokes'];
            $isIdle = (int)$a['is_idle'] === 1;

            $totalClicks += $clicks;
            $totalKeys += $keys;
            if ($isIdle) {
                $totalIdle++;
            }

            $trackedTs = strtotime($a['tracked_at']);
            $hourKey = date('H', $trackedTs);
            if (isset($timelineMap[$hourKey])) {
                $timelineMap[$hourKey]['clicks'] += $clicks;
                $timelineMap[$hourKey]['keystrokes'] += $keys;
                $timelineMap[$hourKey]['minutes'] += 1;
            }

            $appName = $a['app_name'];
            $windowTitle = $a['window_title'] ?: 'Unknown Window';

            if (!$appName || strtolower($appName) === 'active app' || strtolower($appName) === 'unknown') {
                $appName = $this->resolveAppName($windowTitle);
            }

            $groupKey = $appName . '___' . $windowTitle;
            if (!isset($appUsageMap[$groupKey])) {
                $appUsageMap[$groupKey] = [
                    'app' => $appName,
                    'title' => $windowTitle,
                    'url' => $a['url'],
                    'minutes' => 0,
                    'clicks' => 0,
                    'keystrokes' => 0,
                    'idle' => 0,
                ];
            }

            $appUsageMap[$groupKey]['minutes']++;
            $appUsageMap[$groupKey]['clicks'] += $clicks;
            $appUsageMap[$groupKey]['keystrokes'] += $keys;
            if ($isIdle) {
                $appUsageMap[$groupKey]['idle']++;
            }
        }

        usort($appUsageMap, function ($x, $y) {
            return $y['minutes'] <=> $x['minutes'];
        });
        $appUsage = array_slice($appUsageMap, 0, 40);

        $activeMinutes = max(0, $totalMinutes - $totalIdle);
        $activityRate = $totalMinutes > 0 ? round(($activeMinutes / $totalMinutes) * 100, 1) : 0;

        return Response::success([
            'user_id' => $userId,
            'date' => $date,
            'total_minutes' => $totalMinutes,
            'active_minutes' => $activeMinutes,
            'total_idle_minutes' => $totalIdle,
            'activity_rate' => $activityRate,
            'total_clicks' => $totalClicks,
            'total_keystrokes' => $totalKeys,
            'app_usage' => $appUsage,
            'timeline' => array_values($timelineMap),
        ]);
    }

    /**
     * Store activity packets from desktop agent
     */
    public function storeActivity(Request $request): Response
    {
        $userId = (int)$request->input('user_id');
        $activities = $request->input('activities', []);

        if (!$userId || !is_array($activities)) {
            return Response::error('Invalid activity payload', 400);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            INSERT INTO `user_activities` (`user_id`, `app_name`, `window_title`, `url`, `clicks`, `keystrokes`, `is_idle`, `tracked_at`, `created_at`, `updated_at`)
            VALUES (:user_id, :app_name, :window_title, :url, :clicks, :keystrokes, :is_idle, :tracked_at, NOW(), NOW())
        ");

        foreach ($activities as $act) {
            $stmt->execute([
                'user_id' => $userId,
                'app_name' => $act['app_name'] ?? 'Unknown',
                'window_title' => $act['window_title'] ?? 'Unknown',
                'url' => $act['url'] ?? null,
                'clicks' => (int)($act['clicks'] ?? 0),
                'keystrokes' => (int)($act['keystrokes'] ?? 0),
                'is_idle' => !empty($act['is_idle']) ? 1 : 0,
                'tracked_at' => !empty($act['timestamp']) ? date('Y-m-d H:i:s', strtotime($act['timestamp'])) : date('Y-m-d H:i:s'),
            ]);
        }

        return Response::success(null, 'Activities stored successfully');
    }

    private function resolveAppName(string $title): string
    {
        if (empty($title)) return 'Unknown';

        $fileExtensions = ['.php', '.js', '.jsx', '.json', '.py', '.html', '.css', '.log', '.txt', '.md', '.sql', '.env'];
        $separators = [' - ', ' | ', ' : '];

        foreach ($separators as $sep) {
            if (str_contains($title, $sep)) {
                $parts = array_map('trim', explode($sep, $title));
                $count = count($parts);

                for ($i = $count - 1; $i >= 0; $i--) {
                    $segment = $parts[$i];
                    if (strlen($segment) <= 2) continue;

                    $isFileName = false;
                    foreach ($fileExtensions as $ext) {
                        if (str_ends_with(strtolower($segment), $ext)) {
                            $isFileName = true;
                            break;
                        }
                    }

                    if (!$isFileName) {
                        return $segment;
                    }
                }
            }
        }

        if (stripos($title, 'Google Chrome') !== false) return 'Google Chrome';
        if (stripos($title, 'Visual Studio Code') !== false || stripos($title, 'Code') !== false) return 'VS Code';
        if (stripos($title, 'Antigravity') !== false) return 'Antigravity';
        if (stripos($title, 'Excel') !== false) return 'Microsoft Excel';

        return substr($title, 0, 40);
    }
}
