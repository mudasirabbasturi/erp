<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;

class TrackingController extends Controller
{
    /**
     * Get all users with their tracking activity summary and live heartbeat status
     */
    public function index(Request $request): Response
    {
        $status = $request->query('status', 'active');
        $date = $request->query('date', date('Y-m-d'));

        // Fetch users
        $users = Database::fetchAll("
            SELECT u.id, u.username, u.email, u.status, u.created_at,
                   up.full_name, up.phone,
                   r.name AS role_name,
                   m.file_path AS avatar_url
            FROM users u
            LEFT JOIN user_profiles up ON up.user_id = u.id
            LEFT JOIN roles r ON r.id = u.role_id
            LEFT JOIN media m ON m.id = up.avatar_media_id
            WHERE u.deleted_at IS NULL " . ($status !== 'all' ? "AND u.status = :status" : "") . "
            ORDER BY u.id ASC
        ", $status !== 'all' ? ['status' => $status] : []);

        // Aggregate activity stats for each user for the selected date
        $stats = Database::fetchAll("
            SELECT user_id,
                   COUNT(*) AS total_minutes,
                   SUM(clicks) AS total_clicks,
                   SUM(keystrokes) AS total_keystrokes,
                   SUM(CASE WHEN is_idle = 1 THEN 1 ELSE 0 END) AS total_idle_minutes,
                   MAX(tracked_at) AS last_tracked_at
            FROM user_activities
            WHERE DATE(tracked_at) = :date
            GROUP BY user_id
        ", ['date' => $date]);

        $statsByUser = [];
        foreach ($stats as $s) {
            $statsByUser[$s['user_id']] = $s;
        }

        $now = time();
        $data = array_map(function ($u) use ($statsByUser, $now) {
            $userId = $u['id'];
            $st = $statsByUser[$userId] ?? null;
            $lastTracked = $st['last_tracked_at'] ?? null;
            $lastTrackedTs = $lastTracked ? strtotime($lastTracked) : 0;

            // Online if tracked within the last 5 minutes
            $isOnline = ($now - $lastTrackedTs) <= 300;

            return [
                'id' => (int)$u['id'],
                'username' => $u['username'],
                'full_name' => $u['full_name'] ?: $u['username'],
                'email' => $u['email'],
                'phone' => $u['phone'],
                'role_name' => $u['role_name'] ?: 'Staff',
                'avatar_url' => $u['avatar_url'],
                'status' => $u['status'],
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
     * Get granular activity statistics, application usage, and timeline for a single user
     */
    public function getActivityStats(Request $request): Response
    {
        $userId = (int)$request->query('user_id');
        if (!$userId) {
            // Default to current authenticated user
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

            // Timeline hour slot
            $trackedTs = strtotime($a['tracked_at']);
            $hourKey = date('H', $trackedTs);
            if (isset($timelineMap[$hourKey])) {
                $timelineMap[$hourKey]['clicks'] += $clicks;
                $timelineMap[$hourKey]['keystrokes'] += $keys;
                $timelineMap[$hourKey]['minutes'] += 1;
            }

            // Application & Window title grouping
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

        // Sort app usage by minutes descending, take top 40
        usort($appUsageMap, function ($x, $y) {
            return $y['minutes'] <=> $x['minutes'];
        });
        $appUsage = array_slice($appUsageMap, 0, 40);

        // Calculate active vs idle percentages
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

    /**
     * Extract a clean application name from a window title
     */
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

