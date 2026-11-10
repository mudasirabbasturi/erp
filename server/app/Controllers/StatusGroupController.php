<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;
use App\Services\ActivityLogger;

class StatusGroupController extends Controller
{
    /**
     * Get all status groups for an entity (default 'projects') with dynamic count metrics
     */
    public function index(Request $request): Response
    {
        $entity = $request->query('entity', 'projects');

        $groups = Database::fetchAll("
            SELECT * FROM status_groups 
            WHERE entity = :entity AND is_active = 1 
            ORDER BY sort_order ASC, id ASC
        ", ['entity' => $entity]);

        // Calculate dynamic project counts for each group if entity === 'projects'
        if ($entity === 'projects') {
            foreach ($groups as &$group) {
                $statuses = json_decode($group['statuses'] ?? '[]', true);
                $filterConditions = json_decode($group['filter_conditions'] ?? '{}', true);

                $where = ["deleted_at IS NULL"];
                $params = [];

                if (is_array($statuses) && in_array('*', $statuses)) {
                    // All
                } elseif (!empty($statuses) && is_array($statuses)) {
                    $inPlaceholders = [];
                    foreach ($statuses as $idx => $st) {
                        $key = "st_{$idx}";
                        $inPlaceholders[] = ":{$key}";
                        $params[$key] = $st;
                    }
                    $where[] = "project_progress_status IN (" . implode(',', $inPlaceholders) . ")";
                }

                if (!empty($filterConditions['is_late'])) {
                    $where[] = "is_project_late = 1";
                }

                $whereSql = implode(' AND ', $where);
                $count = (int)Database::fetchColumn("SELECT COUNT(*) FROM projects WHERE {$whereSql}", $params);
                $group['count'] = $count;
            }
        }

        return $this->success($groups, 'Status groups retrieved');
    }

    /**
     * Create a new custom status group
     */
    public function store(Request $request): Response
    {
        $validated = $this->validate($request, [
            'group_name' => 'required|string',
            'group_slug' => 'required|string',
            'statuses'   => 'required',
        ]);

        $entity = $request->input('entity', 'projects');
        $slug = preg_replace('/[^a-z0-9_-]/', '-', strtolower(trim($validated['group_slug'])));

        // Check unique slug within entity
        $exists = Database::fetchColumn("
            SELECT id FROM status_groups WHERE entity = :entity AND group_slug = :slug
        ", ['entity' => $entity, 'slug' => $slug]);

        if ($exists) {
            return $this->error('A status group with this slug already exists for this entity.', 422);
        }

        $statuses = $request->input('statuses');
        if (is_array($statuses)) {
            $statuses = json_encode(array_values($statuses));
        }

        $filterConditions = $request->input('filter_conditions');
        if (is_array($filterConditions)) {
            $filterConditions = json_encode($filterConditions);
        }

        $color = $request->input('color', '#4f46e5');
        $sortOrder = (int)$request->input('sort_order', 0);

        $id = Database::insert('status_groups', [
            'entity'            => $entity,
            'group_name'        => trim($validated['group_name']),
            'group_slug'        => $slug,
            'statuses'          => $statuses,
            'filter_conditions' => $filterConditions,
            'color'             => $color,
            'sort_order'        => $sortOrder,
            'is_system'         => 0,
            'is_active'         => 1,
            'created_at'        => date('Y-m-d H:i:s'),
            'updated_at'        => date('Y-m-d H:i:s')
        ]);

        $currentUser = $this->user($request);
        ActivityLogger::log(
            $currentUser ? (int)$currentUser['id'] : null,
            'created',
            'status_groups',
            $id,
            $validated['group_name'],
            "Created custom status group '{$validated['group_name']}' for {$entity}",
            null,
            ['group_slug' => $slug, 'entity' => $entity]
        );

        return $this->success(['id' => $id, 'group_slug' => $slug], 'Status group created successfully', 201);
    }

    /**
     * Update an existing status group
     */
    public function update(Request $request): Response
    {
        $id = (int)$request->param('id');
        $group = Database::fetch("SELECT * FROM status_groups WHERE id = :id", ['id' => $id]);

        if (!$group) {
            return $this->error('Status group not found', 404);
        }

        $validated = $this->validate($request, [
            'group_name' => 'required|string',
        ]);

        $statuses = $request->input('statuses');
        if (is_array($statuses)) {
            $statuses = json_encode(array_values($statuses));
        } else {
            $statuses = $group['statuses'];
        }

        $filterConditions = $request->input('filter_conditions');
        if (is_array($filterConditions)) {
            $filterConditions = json_encode($filterConditions);
        } elseif ($filterConditions === null && array_key_exists('filter_conditions', $request->all())) {
            $filterConditions = null;
        } else {
            $filterConditions = $group['filter_conditions'];
        }

        $color = $request->input('color', $group['color']);
        $sortOrder = $request->input('sort_order', $group['sort_order']);

        Database::update('status_groups', [
            'group_name'        => trim($validated['group_name']),
            'statuses'          => $statuses,
            'filter_conditions' => $filterConditions,
            'color'             => $color,
            'sort_order'        => (int)$sortOrder,
            'updated_at'        => date('Y-m-d H:i:s')
        ], 'id = :id', ['id' => $id]);

        $currentUser = $this->user($request);
        ActivityLogger::log(
            $currentUser ? (int)$currentUser['id'] : null,
            'updated',
            'status_groups',
            $id,
            $validated['group_name'],
            "Updated status group '{$validated['group_name']}'",
            $group,
            ['group_name' => $validated['group_name']]
        );

        return $this->success(null, 'Status group updated successfully');
    }

    /**
     * Delete custom status group (system groups protected)
     */
    public function destroy(Request $request): Response
    {
        $id = (int)$request->param('id');
        $group = Database::fetch("SELECT * FROM status_groups WHERE id = :id", ['id' => $id]);

        if (!$group) {
            return $this->error('Status group not found', 404);
        }

        if ((int)$group['is_system'] === 1) {
            return $this->error('System default status groups cannot be deleted', 403);
        }

        Database::delete('status_groups', 'id = :id', ['id' => $id]);

        $currentUser = $this->user($request);
        ActivityLogger::log(
            $currentUser ? (int)$currentUser['id'] : null,
            'deleted',
            'status_groups',
            $id,
            $group['group_name'],
            "Deleted custom status group '{$group['group_name']}'",
            $group,
            null
        );

        return $this->success(null, 'Status group deleted successfully');
    }
}

