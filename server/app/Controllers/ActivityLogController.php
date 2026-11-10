<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;

class ActivityLogController extends Controller
{
    public function index(Request $request): Response
    {
        $page = (int)$request->query('page', 1);
        $perPage = (int)$request->query('per_page', 25);
        $module = $request->query('module');
        $recordId = $request->query('record_id');
        $userId = $request->query('user_id');
        $action = $request->query('action');
        $search = trim($request->query('search', ''));

        $offset = ($page - 1) * $perPage;
        $where = ["1=1"];
        $params = [];

        if (!empty($module) && $module !== 'all') {
            $where[] = "a.module = :module";
            $params['module'] = $module;
        }

        if (!empty($recordId)) {
            $where[] = "a.record_id = :record_id";
            $params['record_id'] = (int)$recordId;
        }

        if (!empty($userId) && $userId !== 'all') {
            $where[] = "a.user_id = :user_id";
            $params['user_id'] = (int)$userId;
        }

        if (!empty($action) && $action !== 'all') {
            $where[] = "a.action = :action";
            $params['action'] = $action;
        }

        if (!empty($search)) {
            $where[] = "(a.record_title LIKE :search1 OR a.description LIKE :search2 OR u.username LIKE :search3)";
            $params['search1'] = "%{$search}%";
            $params['search2'] = "%{$search}%";
            $params['search3'] = "%{$search}%";
        }

        $whereSql = implode(' AND ', $where);

        $totalSql = "SELECT COUNT(*) FROM activity_logs a 
                     LEFT JOIN users u ON u.id = a.user_id 
                     WHERE {$whereSql}";
        $total = (int)Database::fetchColumn($totalSql, $params);

        $sql = "SELECT a.*, u.username, p.full_name
                FROM activity_logs a
                LEFT JOIN users u ON u.id = a.user_id
                LEFT JOIN user_profiles p ON p.user_id = u.id
                WHERE {$whereSql}
                ORDER BY a.id DESC
                LIMIT {$perPage} OFFSET {$offset}";

        $items = Database::fetchAll($sql, $params);

        // Decode JSON fields for ease of client consumption
        foreach ($items as &$item) {
            if (!empty($item['old_values'])) {
                $decoded = json_decode($item['old_values'], true);
                if ($decoded !== null) $item['old_values'] = $decoded;
            }
            if (!empty($item['new_values'])) {
                $decoded = json_decode($item['new_values'], true);
                if ($decoded !== null) $item['new_values'] = $decoded;
            }
        }

        return $this->paginate($items, $total, $page, $perPage, 'Activity logs retrieved successfully');
    }
}

