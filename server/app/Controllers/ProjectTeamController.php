<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;
use App\Services\ActivityLogger;

class ProjectTeamController extends Controller
{
    /**
     * Get all available dynamic project steps (flexible steps catalog)
     */
    public function getSteps(Request $request): Response
    {
        $steps = Database::fetchAll("
            SELECT * FROM project_steps 
            WHERE is_active = 1 
            ORDER BY sort_order ASC, id ASC
        ");

        return $this->success($steps, 'Project steps retrieved');
    }

    /**
     * Create a new step dynamically (flexible catalog - admin or on-the-fly)
     */
    public function createStep(Request $request): Response
    {
        $validated = $this->validate($request, [
            'step_name' => 'required|string',
        ]);

        $stepName = trim($validated['step_name']);
        $stepKey = preg_replace('/[^a-z0-9_]/', '_', strtolower($stepName));

        $exists = Database::fetch("SELECT * FROM project_steps WHERE step_key = :key", ['key' => $stepKey]);
        if ($exists) {
            return $this->success($exists, 'Step already exists');
        }

        $color = $request->input('color', '#4f46e5');
        $sortOrder = (int)$request->input('sort_order', 0);

        $id = Database::insert('project_steps', [
            'step_name'  => $stepName,
            'step_key'   => $stepKey,
            'color'      => $color,
            'sort_order' => $sortOrder,
            'is_active'  => 1,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);

        return $this->success([
            'id'        => $id,
            'step_name' => $stepName,
            'step_key'  => $stepKey,
            'color'     => $color
        ], 'Step created successfully', 201);
    }

    /**
     * Get team members for a specific project with user avatars, roles, steps, and points
     */
    public function index(Request $request): Response
    {
        $projectId = (int)$request->param('id');
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
            WHERE ptm.project_id = :project_id AND ptm.deleted_at IS NULL
            ORDER BY ptm.id ASC
        ", ['project_id' => $projectId]);

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
        }

        return $this->success($members, 'Project team members retrieved');
    }

    /**
     * Join project (current authenticated user) or Add Team Member (admin assigning user)
     */
    public function join(Request $request): Response
    {
        $projectId = (int)$request->param('id');
        $project = Database::fetch("SELECT * FROM projects WHERE id = :id AND deleted_at IS NULL", ['id' => $projectId]);

        if (!$project) {
            return $this->error('Project not found.', 404);
        }

        $currentUser = $this->user($request);
        $userId = (int)$request->input('user_id', $currentUser ? $currentUser['id'] : 0);

        if (!$userId) {
            return $this->error('Valid user ID is required to join project.', 422);
        }

        // Validate user exists
        $user = Database::fetch("SELECT id, username FROM users WHERE id = :id AND deleted_at IS NULL", ['id' => $userId]);
        if (!$user) {
            return $this->error('Target user account not found.', 404);
        }

        $steps = $request->input('steps', []);
        if (is_array($steps)) {
            // Check if any step is not in project_steps catalog, auto-add it so it's reusable
            foreach ($steps as $st) {
                $stName = trim($st);
                if (!empty($stName)) {
                    $stKey = preg_replace('/[^a-z0-9_]/', '_', strtolower($stName));
                    $exists = Database::fetchColumn("SELECT id FROM project_steps WHERE step_key = :k", ['k' => $stKey]);
                    if (!$exists) {
                        Database::insert('project_steps', [
                            'step_name'  => $stName,
                            'step_key'   => $stKey,
                            'color'      => '#6366f1',
                            'sort_order' => 10,
                            'is_active'  => 1
                        ]);
                    }
                }
            }
            $stepsJson = json_encode(array_values($steps));
        } else {
            $stepsJson = json_encode([]);
        }

        $status = $request->input('status', 'in_progress');
        $startedAt = $request->input('started_at', date('Y-m-d'));
        $completedAt = $request->input('completed_at');
        $notes = $request->input('notes');

        $isAdmin = $this->isAdminUser($currentUser);

        // Check if member already joined this project
        $existing = Database::fetch("
            SELECT * FROM project_team_members 
            WHERE project_id = :p_id AND user_id = :u_id AND deleted_at IS NULL
        ", ['p_id' => $projectId, 'u_id' => $userId]);

        // Points security: ONLY Admin / Super Admin can award or change points
        if ($existing) {
            $pointsGain = ($isAdmin && $request->has('points_gain'))
                ? (float)$request->input('points_gain')
                : (float)$existing['points_gain'];

            // Update existing membership
            Database::update('project_team_members', [
                'steps'        => $stepsJson,
                'status'       => $status,
                'started_at'   => $startedAt,
                'completed_at' => $completedAt,
                'notes'        => $notes,
                'points_gain'  => $pointsGain,
                'updated_at'   => date('Y-m-d H:i:s')
            ], 'id = :id', ['id' => $existing['id']]);

            $memberId = $existing['id'];
            $actionMsg = "Updated team participation for '{$user['username']}' on project '{$project['project_title']}'";
        } else {
            $pointsGain = ($isAdmin && $request->has('points_gain'))
                ? (float)$request->input('points_gain')
                : 0.0;

            // Insert new membership
            $memberId = Database::insert('project_team_members', [
                'project_id'   => $projectId,
                'user_id'      => $userId,
                'steps'        => $stepsJson,
                'started_at'   => $startedAt,
                'completed_at' => $completedAt,
                'status'       => $status,
                'notes'        => $notes,
                'points_gain'  => $pointsGain,
                'created_at'   => date('Y-m-d H:i:s'),
                'updated_at'   => date('Y-m-d H:i:s')
            ]);
            $actionMsg = "User '{$user['username']}' joined project '{$project['project_title']}'";
        }

        // Auto-transition status from 'Pending' to 'Takeoff On Progress' if current status is Pending
        $currentProgressStatus = strtolower(trim($project['project_progress_status'] ?? ''));
        if ($currentProgressStatus === 'pending') {
            Database::update('projects', [
                'project_progress_status' => 'Takeoff On Progress',
                'updated_at'              => date('Y-m-d H:i:s')
            ], 'id = :id', ['id' => $projectId]);

            ActivityLogger::log(
                $currentUser ? (int)$currentUser['id'] : null,
                'status_changed',
                'projects',
                $projectId,
                $project['project_title'],
                "Project status automatically updated from 'Pending' to 'Takeoff On Progress' on team member join",
                ['old_status' => $project['project_progress_status']],
                ['new_status' => 'Takeoff On Progress']
            );
        }

        ActivityLogger::log(
            $currentUser ? (int)$currentUser['id'] : null,
            'joined',
            'projects',
            $projectId,
            $project['project_title'],
            $actionMsg,
            null,
            ['member_id' => $memberId, 'user_id' => $userId, 'status' => $status]
        );

        return $this->success([
            'id'          => $memberId,
            'project_id'  => $projectId,
            'user_id'     => $userId,
            'status'      => $status,
            'steps'       => is_array($steps) ? $steps : [],
            'points_gain' => $pointsGain
        ], 'Joined project successfully', 201);
    }

    /**
     * Update a team member's record (steps, status, points, notes, completed_at)
     */
    public function update(Request $request): Response
    {
        $projectId = (int)$request->param('id');
        $memberId = (int)$request->param('memberId');

        $member = Database::fetch("
            SELECT ptm.*, u.username, p.project_title 
            FROM project_team_members ptm
            JOIN users u ON u.id = ptm.user_id
            JOIN projects p ON p.id = ptm.project_id
            WHERE ptm.id = :id AND ptm.project_id = :project_id AND ptm.deleted_at IS NULL
        ", ['id' => $memberId, 'project_id' => $projectId]);

        if (!$member) {
            return $this->error('Team member record not found.', 404);
        }

        $steps = $request->input('steps');
        if (is_array($steps)) {
            // Auto register any dynamic step
            foreach ($steps as $st) {
                $stName = trim($st);
                if (!empty($stName)) {
                    $stKey = preg_replace('/[^a-z0-9_]/', '_', strtolower($stName));
                    $exists = Database::fetchColumn("SELECT id FROM project_steps WHERE step_key = :k", ['k' => $stKey]);
                    if (!$exists) {
                        Database::insert('project_steps', [
                            'step_name'  => $stName,
                            'step_key'   => $stKey,
                            'color'      => '#6366f1',
                            'sort_order' => 10,
                            'is_active'  => 1
                        ]);
                    }
                }
            }
            $stepsJson = json_encode(array_values($steps));
        } else {
            $stepsJson = $member['steps'];
        }

        $status = $request->input('status', $member['status']);
        $startedAt = $request->input('started_at', $member['started_at']);
        $completedAt = $request->input('completed_at', $member['completed_at']);
        $notes = $request->input('notes', $member['notes']);

        $currentUser = $this->user($request);
        $isAdmin = $this->isAdminUser($currentUser);

        // Security enforcement: ONLY Admins can award or modify points
        $pointsGain = ($isAdmin && $request->has('points_gain'))
            ? (float)$request->input('points_gain')
            : (float)$member['points_gain'];

        // If status completed and completed_at is null, default to today
        if ($status === 'completed' && empty($completedAt)) {
            $completedAt = date('Y-m-d');
        }

        Database::update('project_team_members', [
            'steps'        => $stepsJson,
            'status'       => $status,
            'started_at'   => $startedAt,
            'completed_at' => $completedAt,
            'notes'        => $notes,
            'points_gain'  => $pointsGain,
            'updated_at'   => date('Y-m-d H:i:s')
        ], 'id = :id', ['id' => $memberId]);

        ActivityLogger::log(
            $currentUser ? (int)$currentUser['id'] : null,
            'updated',
            'projects',
            $projectId,
            $member['project_title'],
            "Updated contribution details for '{$member['username']}' on project '{$member['project_title']}'",
            $member,
            ['status' => $status, 'points_gain' => $pointsGain]
        );

        return $this->success(null, 'Team member updated successfully');
    }

    /**
     * Dedicated endpoint for Admins to Add / Update Member Points
     */
    public function updateScore(Request $request): Response
    {
        $currentUser = $this->user($request);
        if (!$this->isAdminUser($currentUser)) {
            return $this->error('Forbidden: Only administrators can award or update points.', 403);
        }

        $projectId = (int)$request->param('id');
        $memberId = (int)$request->param('memberId');

        $project = Database::fetch("SELECT id, project_title, project_points FROM projects WHERE id = :id AND deleted_at IS NULL", ['id' => $projectId]);
        if (!$project) {
            return $this->error('Project not found.', 404);
        }

        $member = Database::fetch("
            SELECT ptm.*, u.username 
            FROM project_team_members ptm
            JOIN users u ON u.id = ptm.user_id
            WHERE ptm.id = :id AND ptm.project_id = :project_id AND ptm.deleted_at IS NULL
        ", ['id' => $memberId, 'project_id' => $projectId]);

        if (!$member) {
            return $this->error('Team member record not found.', 404);
        }

        $totalPoints = (float)($project['project_points'] ?? 0);
        $otherMembersUsed = (float)Database::fetchColumn("
            SELECT COALESCE(SUM(points_gain), 0)
            FROM project_team_members 
            WHERE project_id = :p_id AND id != :m_id AND deleted_at IS NULL
        ", ['p_id' => $projectId, 'm_id' => $memberId]);

        $maxForSelected = max(0, $totalPoints - $otherMembersUsed);
        $rawPoints = (float)$request->input('points_gain', 0);
        $clampedPoints = max(0, min($rawPoints, $maxForSelected));

        Database::update('project_team_members', [
            'points_gain' => $clampedPoints,
            'updated_at'  => date('Y-m-d H:i:s')
        ], 'id = :id', ['id' => $memberId]);

        ActivityLogger::log(
            $currentUser ? (int)$currentUser['id'] : null,
            'updated',
            'projects',
            $projectId,
            $project['project_title'],
            "Admin updated score for member '{$member['username']}' to {$clampedPoints} points on project '{$project['project_title']}'",
            ['old_points' => $member['points_gain']],
            ['new_points' => $clampedPoints]
        );

        return $this->success([
            'member_id'    => $memberId,
            'points_gain'  => $clampedPoints,
            'total_points' => $totalPoints,
            'points_used'  => $otherMembersUsed + $clampedPoints,
            'points_left'  => max(0, $totalPoints - ($otherMembersUsed + $clampedPoints))
        ], 'Score updated successfully');
    }

    /**
     * Dedicated endpoint for Admins to Bulk Update All Team Member Points
     */
    public function updateBulkPoints(Request $request): Response
    {
        $currentUser = $this->user($request);
        if (!$this->isAdminUser($currentUser)) {
            return $this->error('Forbidden: Only administrators can award or update points.', 403);
        }

        $projectId = (int)$request->param('id');
        $project = Database::fetch("SELECT id, project_title, project_points FROM projects WHERE id = :id AND deleted_at IS NULL", ['id' => $projectId]);
        if (!$project) {
            return $this->error('Project not found.', 404);
        }

        $members = $request->input('members', []);
        if (!is_array($members)) {
            return $this->error('Members list must be an array.', 422);
        }

        $totalProjectPoints = (float)($project['project_points'] ?? 0);
        $totalAllocated = 0.0;

        foreach ($members as $m) {
            $memberId = (int)($m['id'] ?? 0);
            $pointsGain = max(0, (float)($m['points_gain'] ?? 0));
            $totalAllocated += $pointsGain;

            if ($memberId > 0) {
                Database::update('project_team_members', [
                    'points_gain' => $pointsGain,
                    'updated_at'  => date('Y-m-d H:i:s')
                ], 'id = :id AND project_id = :pid', ['id' => $memberId, 'pid' => $projectId]);
            }
        }

        ActivityLogger::log(
            $currentUser ? (int)$currentUser['id'] : null,
            'updated',
            'projects',
            $projectId,
            $project['project_title'],
            "Admin bulk updated team member points on project '{$project['project_title']}' (total allocated: {$totalAllocated}/{$totalProjectPoints})",
            null,
            ['members_updated' => count($members), 'total_allocated' => $totalAllocated]
        );

        return $this->success([
            'total_points'    => $totalProjectPoints,
            'allocated_points'=> $totalAllocated,
            'points_left'     => max(0, $totalProjectPoints - $totalAllocated),
            'updated_count'   => count($members)
        ], 'Team points updated successfully');
    }

    /**
     * Helper to verify if current user has Admin privileges
     */
    private function isAdminUser(?array $user): bool
    {
        if (!$user) return false;
        if ((int)($user['is_super_admin'] ?? 0) === 1) return true;
        if (in_array((int)($user['role_id'] ?? 0), [1, 2])) return true;
        if (!empty($user['roles'])) {
            foreach ($user['roles'] as $r) {
                if (in_array($r['slug'] ?? '', ['super-admin', 'admin', 'administrator'])) {
                    return true;
                }
            }
        }
        if (!empty($user['permissions']) && (in_array('add_edit_score', $user['permissions']) || in_array('update_score', $user['permissions']))) {
            return true;
        }
        return false;
    }

    /**
     * Leave project / Remove team member from project
     */
    public function destroy(Request $request): Response
    {
        $projectId = (int)$request->param('id');
        $memberId = (int)$request->param('memberId');

        $member = Database::fetch("
            SELECT ptm.*, u.username, p.project_title 
            FROM project_team_members ptm
            JOIN users u ON u.id = ptm.user_id
            JOIN projects p ON p.id = ptm.project_id
            WHERE ptm.id = :id AND ptm.project_id = :project_id AND ptm.deleted_at IS NULL
        ", ['id' => $memberId, 'project_id' => $projectId]);

        if (!$member) {
            return $this->error('Team member record not found.', 404);
        }

        // Soft delete
        Database::update('project_team_members', [
            'deleted_at' => date('Y-m-d H:i:s')
        ], 'id = :id', ['id' => $memberId]);

        $currentUser = $this->user($request);
        ActivityLogger::log(
            $currentUser ? (int)$currentUser['id'] : null,
            'left',
            'projects',
            $projectId,
            $member['project_title'],
            "User '{$member['username']}' left / was removed from project '{$member['project_title']}'",
            $member,
            ['deleted_at' => date('Y-m-d H:i:s')]
        );

        return $this->success(null, 'Member removed from project successfully');
    }
}

