<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;
use App\Services\ActivityLogger;

class ProjectController extends Controller
{
    /**
     * List projects with dynamic column selection, client details, and filtering
     */
    public function index(Request $request): Response
    {
        $page = (int)$request->query('page', 1);
        $perPage = (int)$request->query('per_page', 50);
        $search = trim($request->query('search', ''));
        $status = $request->query('status');
        $group = $request->query('group');
        $constructionType = $request->query('construction_type');
        $source = $request->query('source');
        $clientId = $request->query('client_id');
        $isLate = $request->query('is_late');

        $offset = ($page - 1) * $perPage;
        $where = ["p.deleted_at IS NULL"];
        $params = [];

        if (!empty($search)) {
            $where[] = "(p.project_title LIKE :search_title OR p.project_address LIKE :search_addr OR c.name LIKE :search_client OR p.project_main_scope LIKE :search_scope)";
            $params['search_title'] = "%{$search}%";
            $params['search_addr'] = "%{$search}%";
            $params['search_client'] = "%{$search}%";
            $params['search_scope'] = "%{$search}%";
        }

        // 1. Check if group parameter is specified
        if (!empty($group) && $group !== 'all') {
            $matchedGroup = Database::fetch("SELECT * FROM status_groups WHERE entity = 'projects' AND group_slug = :slug", ['slug' => $group]);
            if ($matchedGroup) {
                $stList = json_decode($matchedGroup['statuses'] ?? '[]', true);
                $conds = json_decode($matchedGroup['filter_conditions'] ?? '{}', true);

                if (!empty($stList) && is_array($stList) && !in_array('*', $stList)) {
                    $inP = [];
                    foreach ($stList as $idx => $st) {
                        $key = "grp_st_{$idx}";
                        $inP[] = ":{$key}";
                        $params[$key] = $st;
                    }
                    $where[] = "p.project_progress_status IN (" . implode(',', $inP) . ")";
                }

                if (!empty($conds['is_late'])) {
                    $where[] = "p.is_project_late = 1";
                }
            }
        } elseif (!empty($status) && $status !== 'all') {
            // 2. Check if status is a status group slug
            $matchedGroup = Database::fetch("SELECT * FROM status_groups WHERE entity = 'projects' AND group_slug = :slug", ['slug' => $status]);
            if ($matchedGroup) {
                $stList = json_decode($matchedGroup['statuses'] ?? '[]', true);
                $conds = json_decode($matchedGroup['filter_conditions'] ?? '{}', true);

                if (!empty($stList) && is_array($stList) && !in_array('*', $stList)) {
                    $inP = [];
                    foreach ($stList as $idx => $st) {
                        $key = "grp_st_{$idx}";
                        $inP[] = ":{$key}";
                        $params[$key] = $st;
                    }
                    $where[] = "p.project_progress_status IN (" . implode(',', $inP) . ")";
                }

                if (!empty($conds['is_late'])) {
                    $where[] = "p.is_project_late = 1";
                }
            } elseif ($status === 'late') {
                $where[] = "p.is_project_late = 1";
            } else {
                // Check against dynamic enum values (both exact and hyphenated/slugified)
                $enumValues = $this->getEnumOptions('projects', 'project_progress_status');
                $matchedEnum = null;
                foreach ($enumValues as $ev) {
                    if (strcasecmp($ev, $status) === 0 || strcasecmp(str_replace(' ', '-', $ev), $status) === 0) {
                        $matchedEnum = $ev;
                        break;
                    }
                }
                if ($matchedEnum) {
                    $where[] = "p.project_progress_status = :status";
                    $params['status'] = $matchedEnum;
                } else {
                    $where[] = "p.project_progress_status = :status";
                    $params['status'] = $status;
                }
            }
        }

        if (!empty($constructionType) && $constructionType !== 'all') {
            $where[] = "p.project_construction_type = :construction_type";
            $params['construction_type'] = $constructionType;
        }

        if (!empty($source) && $source !== 'all') {
            $where[] = "p.project_source = :source";
            $params['source'] = $source;
        }

        if (!empty($clientId)) {
            $where[] = "p.client_id = :client_id";
            $params['client_id'] = (int)$clientId;
        }

        if ($isLate !== null && $isLate !== '' && $isLate !== 'all') {
            $where[] = "p.is_project_late = :is_late";
            $params['is_late'] = (int)$isLate;
        }

        $whereSql = implode(' AND ', $where);

        $totalSql = "SELECT COUNT(*) FROM projects p LEFT JOIN clients c ON p.client_id = c.id WHERE {$whereSql}";
        $total = (int)Database::fetchColumn($totalSql, $params);

        // Fetch active columns configured for 'projects' entity
        $activeCols = Database::fetchAll("SELECT column_name FROM entity_column_configs WHERE entity = 'projects' AND is_active = 1");
        $activeColNames = array_column($activeCols, 'column_name');

        // Core fields always included
        $selectFields = [
            'p.id',
            'p.project_title',
            'p.client_id',
            'c.name AS client_name',
            'c.title AS client_code',
            'c.title AS client_title',
            'c.notes AS client_notes',
            'c.client_type AS client_type',
            'c.email AS client_email',
            'c.phone AS client_phone',
            'c.address AS client_address',
            'c.city AS client_city',
            'c.state AS client_state',
            'c.country AS client_country',
            'p.project_progress_status',
            'p.is_project_late',
            'p.project_due_date',
            'p.project_total_budget',
            'p.project_deduction_amount',
            'p.project_points',
            'p.project_construction_type',
            'p.project_source',
            'p.created_at',
            'p.updated_at'
        ];

        // Dynamically add any custom active columns present in projects schema
        $projectCols = Database::fetchAll("SHOW COLUMNS FROM projects");
        $projectColMap = array_flip(array_column($projectCols, 'Field'));

        foreach ($activeColNames as $col) {
            if (isset($projectColMap[$col]) && !in_array("p.{$col}", $selectFields)) {
                $selectFields[] = "p.{$col}";
            }
        }

        $fieldsSql = implode(', ', $selectFields);

        $sql = "SELECT {$fieldsSql}
                FROM projects p
                LEFT JOIN clients c ON p.client_id = c.id
                WHERE {$whereSql}
                ORDER BY p.id DESC
                LIMIT {$perPage} OFFSET {$offset}";

        $items = Database::fetchAll($sql, $params);

        // Eager-load project team members and compute points metrics
        $currentUser = $this->user($request);
        $currentUserId = $currentUser ? (int)$currentUser['id'] : 0;

        if (!empty($items)) {
            $projectIds = array_column($items, 'id');
            $inIds = implode(',', array_map('intval', $projectIds));

            $allMembers = Database::fetchAll("
                SELECT ptm.*,
                       u.username,
                       up.full_name,
                       r.name AS role_name,
                       m.file_path AS avatar_url
                FROM project_team_members ptm
                JOIN users u ON u.id = ptm.user_id
                LEFT JOIN user_profiles up ON up.user_id = u.id
                LEFT JOIN roles r ON r.id = u.role_id
                LEFT JOIN media m ON m.id = up.avatar_media_id
                WHERE ptm.project_id IN ({$inIds}) AND ptm.deleted_at IS NULL
                ORDER BY ptm.id ASC
            ");

            $membersByProject = [];
            foreach ($allMembers as $m) {
                $m['steps'] = json_decode($m['steps'] ?? '[]', true) ?: [];
                $m['points_gain'] = (float)$m['points_gain'];
                $displayName = !empty($m['full_name']) ? $m['full_name'] : $m['username'];
                $m['name'] = $displayName;
                $m['user'] = [
                    'id'         => (int)$m['user_id'],
                    'name'       => $displayName,
                    'username'   => $m['username'],
                    'avatar_url' => $m['avatar_url']
                ];
                $membersByProject[$m['project_id']][] = $m;
            }

            // Eager-load multi-clients for all projects
            $allClients = Database::fetchAll("
                SELECT pc.project_id,
                       c.id,
                       c.name,
                       c.title,
                       c.title AS company_name,
                       c.title AS client_code,
                       c.client_type,
                       c.email,
                       c.phone,
                       c.address,
                       c.city,
                       c.state,
                       c.country,
                       c.notes
                FROM project_clients pc
                JOIN clients c ON c.id = pc.client_id
                WHERE pc.project_id IN ({$inIds}) AND c.deleted_at IS NULL
                ORDER BY pc.id ASC
            ");

            $clientsByProject = [];
            foreach ($allClients as $cl) {
                $clientsByProject[$cl['project_id']][] = $cl;
            }

            foreach ($items as &$item) {
                $pId = $item['id'];
                $members = $membersByProject[$pId] ?? [];
                $item['project_team_members'] = $members;
                $item['team_members'] = $members;
                $item['team_count'] = count($members);

                // Multi-client assignments
                $cls = $clientsByProject[$pId] ?? [];
                if (empty($cls) && !empty($item['client_id'])) {
                    $cls = [[
                        'id'           => (int)$item['client_id'],
                        'name'         => $item['client_name'] ?? '',
                        'title'        => $item['client_title'] ?? ($item['client_code'] ?? ''),
                        'company_name' => $item['client_code'] ?? '',
                        'client_type'  => $item['client_type'] ?? 'normal',
                        'email'        => $item['client_email'] ?? '',
                        'phone'        => $item['client_phone'] ?? '',
                        'address'      => $item['client_address'] ?? '',
                        'notes'        => $item['client_notes'] ?? '',
                        'status'       => 'active'
                    ]];
                }
                $item['clients'] = $cls;
                $item['client_ids'] = array_column($cls, 'id');
                $item['admin_clients'] = array_values(array_filter($cls, fn($c) => strtolower($c['client_type'] ?? '') === 'admin'));
                $item['normal_clients'] = array_values(array_filter($cls, fn($c) => strtolower($c['client_type'] ?? '') !== 'admin'));

                // Compute points
                $totalPts = (float)($item['project_points'] ?? 0);
                $usedPts = 0.0;
                $isJoined = false;
                $currentUserMember = null;

                foreach ($members as $m) {
                    $usedPts += (float)$m['points_gain'];
                    if ((int)$m['user_id'] === $currentUserId) {
                        $isJoined = true;
                        $currentUserMember = $m;
                    }
                }

                $item['points_used'] = $usedPts;
                $item['points_left'] = max(0, $totalPts - $usedPts);
                $item['is_joined'] = $isJoined;
                $item['current_user_member'] = $currentUserMember;
            }
        }

        return $this->paginate($items, $total, $page, $perPage, 'Projects retrieved successfully');
    }

    /**
     * Show single project details with client info
     */
    public function show(Request $request): Response
    {
        $id = (int)$request->param('id');
        $sql = "SELECT p.*, 
                       c.name AS client_name, 
                       c.title AS client_code, 
                       c.client_type AS client_type,
                       c.email AS client_email, 
                       c.phone AS client_phone,
                       c.address AS client_address,
                       c.city AS client_city,
                       c.state AS client_state,
                       c.country AS client_country
                FROM projects p
                LEFT JOIN clients c ON p.client_id = c.id
                WHERE p.id = :id AND p.deleted_at IS NULL";

        $project = Database::fetch($sql, ['id' => $id]);

        if (!$project) {
            return $this->error('Project record not found.', 404);
        }

        $members = Database::fetchAll("
            SELECT ptm.*,
                   u.username,
                   u.email,
                   up.full_name,
                   up.phone,
                   r.name AS role_name,
                   m.file_path AS avatar_url
            FROM project_team_members ptm
            JOIN users u ON u.id = ptm.user_id
            LEFT JOIN user_profiles up ON up.user_id = u.id
            LEFT JOIN roles r ON r.id = u.role_id
            LEFT JOIN media m ON m.id = up.avatar_media_id
            WHERE ptm.project_id = :id AND ptm.deleted_at IS NULL
            ORDER BY ptm.id ASC
        ", ['id' => $id]);

        $currentUser = $this->user($request);
        $currentUserId = $currentUser ? (int)$currentUser['id'] : 0;
        $totalPts = (float)($project['project_points'] ?? 0);
        $usedPts = 0.0;
        $isJoined = false;
        $currentUserMember = null;

        foreach ($members as &$m) {
            $m['steps'] = json_decode($m['steps'] ?? '[]', true) ?: [];
            $m['points_gain'] = (float)$m['points_gain'];
            $displayName = !empty($m['full_name']) ? $m['full_name'] : $m['username'];
            $m['name'] = $displayName;
            $m['user'] = [
                'id'         => (int)$m['user_id'],
                'name'       => $displayName,
                'username'   => $m['username'],
                'avatar_url' => $m['avatar_url']
            ];
            $usedPts += $m['points_gain'];
            if ((int)$m['user_id'] === $currentUserId) {
                $isJoined = true;
                $currentUserMember = $m;
            }
        }

        $project['project_team_members'] = $members;
        $project['team_members'] = $members;
        $project['points_used'] = $usedPts;
        $project['points_left'] = max(0, $totalPts - $usedPts);
        $project['is_joined'] = $isJoined;
        $project['current_user_member'] = $currentUserMember;

        // Fetch all assigned clients via project_clients
        $clients = Database::fetchAll("
            SELECT c.*,
                   c.name AS client_name,
                   c.title AS company_name,
                   c.title AS client_code
            FROM project_clients pc
            JOIN clients c ON c.id = pc.client_id
            WHERE pc.project_id = :id AND c.deleted_at IS NULL
            ORDER BY pc.id ASC
        ", ['id' => $id]);

        if (empty($clients) && !empty($project['client_id'])) {
            $fallbackClient = Database::fetch("SELECT * FROM clients WHERE id = :cid AND deleted_at IS NULL", ['cid' => $project['client_id']]);
            if ($fallbackClient) {
                $clients = [$fallbackClient];
            }
        }

        $project['clients'] = $clients;
        $project['client_ids'] = array_map('intval', array_column($clients, 'id'));
        $project['admin_clients'] = array_values(array_filter($clients, fn($c) => strtolower($c['client_type'] ?? '') === 'admin'));
        $project['normal_clients'] = array_values(array_filter($clients, fn($c) => strtolower($c['client_type'] ?? '') !== 'admin'));

        return $this->success($project, 'Project details retrieved');
    }

    /**
     * Create a new project (supports all dynamic columns)
     */
    public function store(Request $request): Response
    {
        $user = $this->user($request);
        $title = trim($request->input('project_title', ''));

        if (empty($title)) {
            return $this->error('Project Title is required.', 422);
        }

        // Fetch valid columns from table
        $columns = Database::fetchAll("SHOW COLUMNS FROM projects");
        $validCols = array_column($columns, 'Field');

        $inputData = $request->all();
        $insertData = [];

        foreach ($validCols as $col) {
            if (in_array($col, ['id', 'created_at', 'updated_at', 'deleted_at'])) continue;

            if (array_key_exists($col, $inputData)) {
                $val = $inputData[$col];
                $insertData[$col] = ($val !== '' && $val !== null) ? $val : null;
            }
        }

        $insertData['project_title'] = $title;
        if (!isset($insertData['project_progress_status'])) {
            $insertData['project_progress_status'] = 'Pending';
        }
        if (!isset($insertData['project_preview_status'])) {
            $insertData['project_preview_status'] = 'active';
        }
        if (!isset($insertData['is_project_late'])) {
            $insertData['is_project_late'] = 0;
        }

        $insertData['created_at'] = date('Y-m-d H:i:s');
        $insertData['updated_at'] = date('Y-m-d H:i:s');

        $projectId = Database::insert('projects', $insertData);

        // Sync multi-client associations
        $clientIds = $request->input('client_ids');
        if (is_array($clientIds)) {
            Database::delete('project_clients', 'project_id = :pid', ['pid' => $projectId]);
            foreach ($clientIds as $cid) {
                $cid = (int)$cid;
                if ($cid > 0) {
                    Database::insert('project_clients', [
                        'project_id' => $projectId,
                        'client_id'  => $cid,
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s')
                    ]);
                }
            }
            if (!empty($clientIds)) {
                Database::update('projects', ['client_id' => (int)$clientIds[0]], 'id = :pid', ['pid' => $projectId]);
            }
        }

        // Sync client field updates if passed in 'client_updates'
        $clientUpdates = $request->input('client_updates');
        if (is_array($clientUpdates)) {
            $allowedCols = ['phone', 'email', 'address', 'title', 'notes'];
            foreach ($clientUpdates as $cid => $cData) {
                $cid = (int)$cid;
                if ($cid > 0 && is_array($cData)) {
                    if (isset($cData['company_name']) && !isset($cData['title'])) {
                        $cData['title'] = $cData['company_name'];
                    }
                    $toUpdate = [];
                    foreach ($allowedCols as $col) {
                        if (array_key_exists($col, $cData)) {
                            $toUpdate[$col] = $cData[$col];
                        }
                    }
                    if (!empty($toUpdate)) {
                        $toUpdate['updated_at'] = date('Y-m-d H:i:s');
                        Database::update('clients', $toUpdate, 'id = :id', ['id' => $cid]);
                    }
                }
            }
        }

        $project = Database::fetch("SELECT * FROM projects WHERE id = :id", ['id' => $projectId]);

        ActivityLogger::log(
            $user ? (int)$user['id'] : null,
            'created',
            'projects',
            $projectId,
            $title,
            "Created project '{$title}'",
            null,
            $insertData
        );

        return $this->success($project, 'Project created successfully', 201);
    }

    /**
     * Update an existing project (supports all dynamic columns)
     */
    public function update(Request $request): Response
    {
        $id = (int)$request->param('id');
        $user = $this->user($request);

        $project = Database::fetch("SELECT * FROM projects WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);
        if (!$project) {
            return $this->error('Project record not found.', 404);
        }

        // Fetch valid columns from table
        $columns = Database::fetchAll("SHOW COLUMNS FROM projects");
        $validCols = array_column($columns, 'Field');

        $inputData = $request->all();

        // Support convenient column aliases (e.g. title -> project_title)
        $aliases = [
            'title'             => 'project_title',
            'status'            => 'project_progress_status',
            'points'            => 'project_points',
            'due_date'          => 'project_due_date',
            'is_late'           => 'is_project_late',
            'construction_type' => 'project_construction_type',
            'area'              => 'project_area',
            'floor'             => 'project_floor_number',
            'floor_number'      => 'project_floor_number',
            'template_id'       => 'project_template',
            'template'          => 'project_template',
            'source_id'         => 'project_source',
            'source'            => 'project_source',
            'pricing_status'    => 'project_pricing',
            'pricing'           => 'project_pricing',
            'initial_file_link' => 'project_init_link',
            'final_file_link'   => 'project_final_link',
            'main_scope'        => 'project_main_scope',
            'detailed_scope'    => 'project_scope_details',
            'scope_details'     => 'project_scope_details',
            'budget'            => 'project_total_budget',
            'total_budget'      => 'project_total_budget',
            'deduction'         => 'project_deduction_amount',
            'deduction_amount'  => 'project_deduction_amount',
            'address'           => 'project_address',
            'notes'             => 'project_estimator_notes',
            'estimator_notes'   => 'project_estimator_notes',
            'project_notes'     => 'project_estimator_notes',
            'admin_notes'       => 'project_admin_notes',
        ];
        foreach ($aliases as $short => $col) {
            if (array_key_exists($short, $inputData) && !array_key_exists($col, $inputData)) {
                $inputData[$col] = $inputData[$short];
            }
        }

        $updateData = [];

        foreach ($validCols as $col) {
            if (in_array($col, ['id', 'created_at', 'updated_at', 'deleted_at'])) continue;

            if (array_key_exists($col, $inputData)) {
                $val = $inputData[$col];
                $updateData[$col] = ($val !== '' && $val !== null) ? $val : null;
            }
        }

        $updateData['updated_at'] = date('Y-m-d H:i:s');

        Database::update('projects', $updateData, 'id = :id', ['id' => $id]);

        // Sync multi-client associations
        $clientIds = $request->input('client_ids');
        if (is_array($clientIds)) {
            Database::delete('project_clients', 'project_id = :pid', ['pid' => $id]);
            $firstId = null;
            foreach ($clientIds as $cid) {
                $cid = (int)$cid;
                if ($cid > 0) {
                    if ($firstId === null) {
                        $firstId = $cid;
                    }
                    Database::insert('project_clients', [
                        'project_id' => $id,
                        'client_id'  => $cid,
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s')
                    ]);
                }
            }
            Database::update('projects', ['client_id' => $firstId], 'id = :pid', ['pid' => $id]);
        }

        // Sync client field updates if passed in 'client_updates'
        $clientUpdates = $request->input('client_updates');
        if (is_array($clientUpdates)) {
            $allowedCols = ['phone', 'email', 'address', 'title', 'notes'];
            foreach ($clientUpdates as $cid => $cData) {
                $cid = (int)$cid;
                if ($cid > 0 && is_array($cData)) {
                    if (isset($cData['company_name']) && !isset($cData['title'])) {
                        $cData['title'] = $cData['company_name'];
                    }
                    $toUpdate = [];
                    foreach ($allowedCols as $col) {
                        if (array_key_exists($col, $cData)) {
                            $toUpdate[$col] = $cData[$col];
                        }
                    }
                    if (!empty($toUpdate)) {
                        $toUpdate['updated_at'] = date('Y-m-d H:i:s');
                        Database::update('clients', $toUpdate, 'id = :id', ['id' => $cid]);
                    }
                }
            }
        }

        $updated = Database::fetch("SELECT * FROM projects WHERE id = :id", ['id' => $id]);

        ActivityLogger::log(
            $user ? (int)$user['id'] : null,
            'updated',
            'projects',
            $id,
            $updated['project_title'],
            "Updated project '{$updated['project_title']}'",
            $project,
            $updateData
        );

        return $this->success($updated, 'Project updated successfully');
    }

    /**
     * Soft delete a project
     */
    public function destroy(Request $request): Response
    {
        $id = (int)$request->param('id');
        $user = $this->user($request);

        $project = Database::fetch("SELECT * FROM projects WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);
        if (!$project) {
            return $this->error('Project record not found.', 404);
        }

        Database::update('projects', ['deleted_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => $id]);

        ActivityLogger::log(
            $user ? (int)$user['id'] : null,
            'deleted',
            'projects',
            $id,
            $project['project_title'],
            "Deleted project '{$project['project_title']}'",
            $project,
            ['deleted_at' => date('Y-m-d H:i:s')]
        );

        return $this->success(null, 'Project deleted successfully');
    }

    /**
     * Get dynamic lookup values and enum options directly from the database schema
     */
    public function getLookups(Request $request): Response
    {
        $progressStatuses = $this->getEnumOptions('projects', 'project_progress_status');
        $constructionTypes = $this->getEnumOptions('projects', 'project_construction_type');
        $sources = $this->getEnumOptions('projects', 'project_source');
        $previewStatuses = $this->getEnumOptions('projects', 'project_preview_status');
        $clientTypes = $this->getEnumOptions('clients', 'client_type');

        // Dynamically find all other ENUM columns on 'projects' table
        $enumCols = Database::fetchAll("
            SELECT COLUMN_NAME, COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'projects' 
              AND DATA_TYPE = 'enum'
        ");

        $allEnums = [];
        foreach ($enumCols as $ec) {
            $colName = $ec['COLUMN_NAME'];
            $allEnums[$colName] = $this->getEnumOptions('projects', $colName);
        }

        return $this->success([
            'project_progress_status'   => $progressStatuses,
            'project_construction_type' => $constructionTypes,
            'project_source'            => $sources,
            'project_preview_status'    => $previewStatuses,
            'client_type'               => $clientTypes,
            'enums'                     => $allEnums
        ], 'Project dynamic lookups retrieved');
    }

    /**
     * Dynamically retrieve enum options from database schema
     */
    public function getEnumOptions(string $table, string $column): array
    {
        $row = Database::fetch("
            SELECT COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = :table 
              AND COLUMN_NAME = :column
        ", ['table' => $table, 'column' => $column]);

        if ($row && preg_match("/^enum\((.*)\)$/i", $row['COLUMN_TYPE'], $matches)) {
            $raw = $matches[1];
            $values = [];
            preg_match_all("/'((?:[^'\\\\]|\\\\.)*)'/", $raw, $valMatches);
            if (!empty($valMatches[1])) {
                foreach ($valMatches[1] as $v) {
                    $values[] = str_replace("''", "'", stripslashes($v));
                }
            }
            return $values;
        }

        return [];
    }

    /**
     * Get counts by progress status and late flag for status pills & header metrics
     */
    public function statusSummary(Request $request): Response
    {
        // 1. Fetch dynamic enum values directly from MySQL/MariaDB schema
        $enumValues = $this->getEnumOptions('projects', 'project_progress_status');

        $counts = Database::fetchAll("
            SELECT project_progress_status, COUNT(*) as total 
            FROM projects 
            WHERE deleted_at IS NULL 
            GROUP BY project_progress_status
        ");

        $lateCount = (int)Database::fetchColumn("
            SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL AND is_project_late = 1
        ");

        $totalCount = (int)Database::fetchColumn("
            SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL
        ");

        // Ensure each dynamic enum value has a count entry (at least 0)
        $statusMap = [];
        foreach ($enumValues as $val) {
            $statusMap[$val] = 0;
        }
        foreach ($counts as $c) {
            if ($c['project_progress_status'] !== null) {
                $statusMap[$c['project_progress_status']] = (int)$c['total'];
            }
        }

        // 2. Fetch configured status groups for projects with dynamic counts
        $groups = Database::fetchAll("
            SELECT * FROM status_groups 
            WHERE entity = 'projects' AND is_active = 1 
            ORDER BY sort_order ASC, id ASC
        ");

        foreach ($groups as &$group) {
            $stList = json_decode($group['statuses'] ?? '[]', true);
            $conds = json_decode($group['filter_conditions'] ?? '{}', true);

            $gWhere = ["deleted_at IS NULL"];
            $gParams = [];

            if (is_array($stList) && in_array('*', $stList)) {
                // all projects
            } elseif (!empty($stList) && is_array($stList)) {
                $inP = [];
                foreach ($stList as $idx => $st) {
                    $key = "grp_st_{$idx}";
                    $inP[] = ":{$key}";
                    $gParams[$key] = $st;
                }
                $gWhere[] = "project_progress_status IN (" . implode(',', $inP) . ")";
            }

            if (!empty($conds['is_late'])) {
                $gWhere[] = "is_project_late = 1";
            }

            $gWhereSql = implode(' AND ', $gWhere);
            $group['count'] = (int)Database::fetchColumn("SELECT COUNT(*) FROM projects WHERE {$gWhereSql}", $gParams);
        }

        return $this->success([
            'total'         => $totalCount,
            'late'          => $lateCount,
            'enum_statuses' => $enumValues,
            'statuses'      => $statusMap,
            'groups'        => $groups,
        ], 'Status summary retrieved');
    }
}

