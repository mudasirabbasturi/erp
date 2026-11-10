<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;
use App\Services\ActivityLogger;

class RolePermissionController extends Controller
{
    public function rolesIndex(Request $request): Response
    {
        // Exclude Super Admin role (Super Admin has unrestricted master access and cannot be configured or limited)
        $roles = Database::fetchAll("SELECT * FROM roles WHERE slug != 'super-admin' ORDER BY id ASC");

        foreach ($roles as &$role) {
            $perms = Database::fetchAll("SELECT p.id, p.slug, p.label, p.module, p.action 
                                         FROM role_permissions rp 
                                         JOIN permissions p ON p.id = rp.permission_id 
                                         WHERE rp.role_id = :role_id", ['role_id' => $role['id']]);
            $role['permissions'] = $perms;

            $fieldPerms = Database::fetchAll("SELECT * FROM field_level_permissions WHERE role_id = :role_id", [
                'role_id' => $role['id']
            ]);
            $role['field_permissions'] = $fieldPerms;

            $enumPerms = Database::fetchAll("SELECT * FROM enum_permissions WHERE role_id = :role_id", [
                'role_id' => $role['id']
            ]);
            $role['enum_permissions'] = $enumPerms;

            $role['user_count'] = (int)Database::fetchColumn("
                SELECT COUNT(DISTINCT ur.user_id) 
                FROM user_roles ur
                JOIN users u ON u.id = ur.user_id
                WHERE ur.role_id = :role_id AND u.deleted_at IS NULL
            ", ['role_id' => $role['id']]);
        }

        return $this->success($roles, 'Roles retrieved successfully');
    }

    public function rolesStore(Request $request): Response
    {
        $validated = $this->validate($request, [
            'name'        => 'required|string|unique:roles,name',
            'slug'        => 'required|string|unique:roles,slug',
            'description' => 'nullable|string',
            'permissions' => 'nullable',
        ]);

        Database::beginTransaction();
        try {
            $roleId = Database::insert('roles', [
                'name'        => $validated['name'],
                'slug'        => $validated['slug'],
                'description' => $validated['description'] ?? null,
                'is_system'   => 0,
                'created_at'  => date('Y-m-d H:i:s'),
                'updated_at'  => date('Y-m-d H:i:s'),
            ]);

            $permissions = $request->input('permissions');
            if (is_array($permissions)) {
                foreach ($permissions as $permId) {
                    Database::insert('role_permissions', [
                        'role_id'       => $roleId,
                        'permission_id' => $permId,
                    ]);
                }
            }

            $fieldPerms = $request->input('field_permissions');
            if (is_array($fieldPerms)) {
                foreach ($fieldPerms as $fp) {
                    if (!empty($fp['entity']) && !empty($fp['field_name'])) {
                        Database::insert('field_level_permissions', [
                            'role_id'    => $roleId,
                            'entity'     => $fp['entity'],
                            'field_name' => $fp['field_name'],
                            'can_view'   => !empty($fp['can_view']) ? 1 : 0,
                            'can_add'    => !empty($fp['can_add']) ? 1 : 0,
                            'can_edit'   => !empty($fp['can_edit']) ? 1 : 0,
                        ]);
                    }
                }
            }

            $enumPerms = $request->input('enum_permissions');
            if (is_array($enumPerms)) {
                foreach ($enumPerms as $ep) {
                    if (!empty($ep['entity']) && !empty($ep['field_name']) && !empty($ep['enum_value'])) {
                        Database::insert('enum_permissions', [
                            'role_id'    => $roleId,
                            'entity'     => $ep['entity'],
                            'field_name' => $ep['field_name'],
                            'enum_value' => $ep['enum_value'],
                            'can_view'   => !empty($ep['can_view']) ? 1 : 0,
                            'can_set'    => !empty($ep['can_set']) ? 1 : 0,
                        ]);
                    }
                }
            }

            Database::commit();

            $currentUser = $this->user($request);
            ActivityLogger::log(
                $currentUser ? (int)$currentUser['id'] : null,
                'created',
                'roles',
                $roleId,
                $validated['name'],
                "Created role '{$validated['name']}'",
                null,
                ['name' => $validated['name'], 'slug' => $validated['slug']]
            );

            return $this->success(['id' => $roleId], 'Role created successfully', 201);
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }
    }

    public function rolesUpdate(Request $request): Response
    {
        $id = (int)$request->param('id');
        $role = Database::fetch("SELECT * FROM roles WHERE id = :id", ['id' => $id]);

        if (!$role) {
            return $this->error('Role not found.', 404);
        }

        $validated = $this->validate($request, [
            'name'        => "required|string|unique:roles,name,{$id}",
            'description' => 'nullable|string',
            'permissions' => 'nullable',
        ]);

        Database::beginTransaction();
        try {
            Database::update('roles', [
                'name'        => $validated['name'],
                'description' => $validated['description'] ?? null,
                'updated_at'  => date('Y-m-d H:i:s'),
            ], 'id = :id', ['id' => $id]);

            $permissions = $request->input('permissions');
            if (is_array($permissions)) {
                Database::delete('role_permissions', 'role_id = :role_id', ['role_id' => $id]);
                foreach ($permissions as $permId) {
                    Database::insert('role_permissions', [
                        'role_id'       => $id,
                        'permission_id' => $permId,
                    ]);
                }
            }

            $fieldPerms = $request->input('field_permissions');
            if (is_array($fieldPerms)) {
                Database::delete('field_level_permissions', 'role_id = :role_id', ['role_id' => $id]);
                foreach ($fieldPerms as $fp) {
                    if (!empty($fp['entity']) && !empty($fp['field_name'])) {
                        Database::insert('field_level_permissions', [
                            'role_id'    => $id,
                            'entity'     => $fp['entity'],
                            'field_name' => $fp['field_name'],
                            'can_view'   => !empty($fp['can_view']) ? 1 : 0,
                            'can_add'    => !empty($fp['can_add']) ? 1 : 0,
                            'can_edit'   => !empty($fp['can_edit']) ? 1 : 0,
                        ]);
                    }
                }
            }

            $enumPerms = $request->input('enum_permissions');
            if (is_array($enumPerms)) {
                Database::delete('enum_permissions', 'role_id = :role_id', ['role_id' => $id]);
                foreach ($enumPerms as $ep) {
                    if (!empty($ep['entity']) && !empty($ep['field_name']) && !empty($ep['enum_value'])) {
                        Database::insert('enum_permissions', [
                            'role_id'    => $id,
                            'entity'     => $ep['entity'],
                            'field_name' => $ep['field_name'],
                            'enum_value' => $ep['enum_value'],
                            'can_view'   => !empty($ep['can_view']) ? 1 : 0,
                            'can_set'    => !empty($ep['can_set']) ? 1 : 0,
                        ]);
                    }
                }
            }

            Database::commit();

            $currentUser = $this->user($request);
            ActivityLogger::log(
                $currentUser ? (int)$currentUser['id'] : null,
                'updated',
                'roles',
                $id,
                $validated['name'],
                "Updated role '{$validated['name']}' permissions & configuration",
                $role,
                ['name' => $validated['name']]
            );

            return $this->success(null, 'Role updated successfully.');
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }
    }

    public function rolesDestroy(Request $request): Response
    {
        $id = (int)$request->param('id');
        $role = Database::fetch("SELECT * FROM roles WHERE id = :id", ['id' => $id]);

        if (!$role) {
            return $this->error('Role not found.', 404);
        }

        if ((int)$role['is_system'] === 1) {
            return $this->error('System roles cannot be deleted.', 403);
        }

        $userCount = Database::fetchColumn("SELECT COUNT(*) FROM user_roles WHERE role_id = :role_id", ['role_id' => $id]);
        if ($userCount > 0) {
            return $this->error("Cannot delete role: Assigned to {$userCount} active staff.", 422);
        }

        Database::delete('roles', 'id = :id', ['id' => $id]);

        $currentUser = $this->user($request);
        ActivityLogger::log(
            $currentUser ? (int)$currentUser['id'] : null,
            'deleted',
            'roles',
            $id,
            $role['name'],
            "Deleted role '{$role['name']}'",
            $role,
            null
        );

        return $this->success(null, 'Role deleted successfully.');
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

    public function permissionsIndex(Request $request): Response
    {
        // 1. Fetch all route / action permissions from permissions table
        $perms = Database::fetchAll("SELECT * FROM permissions ORDER BY module ASC, action ASC");
        
        $grouped = [];
        foreach ($perms as $p) {
            $grouped[$p['module']][] = $p;
        }

        // 2. Fetch dynamic active columns for entities from entity_column_configs & DB schema
        $activeUserCols = Database::fetchAll("
            SELECT column_name, label 
            FROM entity_column_configs 
            WHERE entity = 'users' AND is_active = 1
            ORDER BY sort_order ASC, id ASC
        ");

        $activeClientCols = Database::fetchAll("
            SELECT column_name, label 
            FROM entity_column_configs 
            WHERE entity = 'clients' AND is_active = 1
            ORDER BY sort_order ASC, id ASC
        ");

        $activeProjectCols = Database::fetchAll("
            SELECT column_name, label 
            FROM entity_column_configs 
            WHERE entity = 'projects' AND is_active = 1
            ORDER BY sort_order ASC, id ASC
        ");

        $columnsByModel = [
            'users'    => $activeUserCols,
            'clients'  => $activeClientCols,
            'projects' => $activeProjectCols,
        ];

        // 3. Dynamic enum values per entity for enum-level permissions
        $enumsByModel = [
            'projects' => [
                [
                    'field'  => 'project_progress_status',
                    'label'  => 'Project Progress Status',
                    'values' => $this->getEnumOptions('projects', 'project_progress_status')
                ],
                [
                    'field'  => 'project_construction_type',
                    'label'  => 'Construction Type',
                    'values' => $this->getEnumOptions('projects', 'project_construction_type')
                ],
                [
                    'field'  => 'project_source',
                    'label'  => 'Project Source',
                    'values' => $this->getEnumOptions('projects', 'project_source')
                ]
            ],
            'users' => [
                [
                    'field'  => 'status',
                    'label'  => 'Account Status',
                    'values' => $this->getEnumOptions('users', 'status')
                ]
            ],
            'clients' => [
                [
                    'field'  => 'client_type',
                    'label'  => 'Client Type',
                    'values' => $this->getEnumOptions('clients', 'client_type')
                ]
            ]
        ];

        return $this->success([
            'all'              => $perms,
            'grouped'          => $grouped,
            'columns_by_model' => $columnsByModel,
            'enums_by_model'   => $enumsByModel,
        ], 'Permissions list with dynamic model columns and enum values');
    }

    public function saveFieldPermissions(Request $request): Response
    {
        $validated = $this->validate($request, [
            'role_id'     => 'required|integer|exists:roles,id',
            'permissions' => 'required',
        ]);

        $roleId = $validated['role_id'];
        $fields = $request->input('permissions');

        if (!is_array($fields)) {
            return $this->error('Permissions must be an array of field rules.', 422);
        }

        Database::beginTransaction();
        try {
            foreach ($fields as $item) {
                if (!empty($item['entity']) && !empty($item['field_name'])) {
                    $exists = Database::fetchColumn("SELECT id FROM field_level_permissions 
                                                     WHERE role_id = :role_id AND entity = :entity AND field_name = :field_name", [
                        'role_id'    => $roleId,
                        'entity'     => $item['entity'],
                        'field_name' => $item['field_name'],
                    ]);

                    $canView = !empty($item['can_view']) ? 1 : 0;
                    $canAdd  = !empty($item['can_add']) ? 1 : 0;
                    $canEdit = !empty($item['can_edit']) ? 1 : 0;

                    if ($exists) {
                        Database::update('field_level_permissions', [
                            'can_view' => $canView,
                            'can_add'  => $canAdd,
                            'can_edit' => $canEdit,
                        ], 'id = :id', ['id' => $exists]);
                    } else {
                        Database::insert('field_level_permissions', [
                            'role_id'    => $roleId,
                            'entity'     => $item['entity'],
                            'field_name' => $item['field_name'],
                            'can_view'   => $canView,
                            'can_add'    => $canAdd,
                            'can_edit'   => $canEdit,
                        ]);
                    }
                }
            }

            Database::commit();
            return $this->success(null, 'Field-level column permissions saved successfully.');
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }
    }

    public function saveEnumPermissions(Request $request): Response
    {
        $validated = $this->validate($request, [
            'role_id'     => 'required|integer|exists:roles,id',
            'permissions' => 'required',
        ]);

        $roleId = $validated['role_id'];
        $enums = $request->input('permissions');

        if (!is_array($enums)) {
            return $this->error('Permissions must be an array of enum rules.', 422);
        }

        Database::beginTransaction();
        try {
            foreach ($enums as $item) {
                if (!empty($item['entity']) && !empty($item['field_name']) && !empty($item['enum_value'])) {
                    $exists = Database::fetchColumn("
                        SELECT id FROM enum_permissions 
                        WHERE role_id = :role_id AND entity = :entity AND field_name = :field_name AND enum_value = :enum_val
                    ", [
                        'role_id'   => $roleId,
                        'entity'    => $item['entity'],
                        'field_name'=> $item['field_name'],
                        'enum_val'  => $item['enum_value'],
                    ]);

                    $canView = !empty($item['can_view']) ? 1 : 0;
                    $canSet = !empty($item['can_set']) ? 1 : 0;

                    if ($exists) {
                        Database::update('enum_permissions', [
                            'can_view' => $canView,
                            'can_set'  => $canSet,
                            'updated_at' => date('Y-m-d H:i:s')
                        ], 'id = :id', ['id' => $exists]);
                    } else {
                        Database::insert('enum_permissions', [
                            'role_id'    => $roleId,
                            'entity'     => $item['entity'],
                            'field_name' => $item['field_name'],
                            'enum_value' => $item['enum_value'],
                            'can_view'   => $canView,
                            'can_set'    => $canSet,
                            'created_at' => date('Y-m-d H:i:s'),
                            'updated_at' => date('Y-m-d H:i:s')
                        ]);
                    }
                }
            }

            Database::commit();
            return $this->success(null, 'Enum-level permissions saved successfully.');
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }
    }
}
