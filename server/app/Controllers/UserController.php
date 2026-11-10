<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;
use Core\Auth;
use App\Services\ActivityLogger;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $page = (int)$request->query('page', 1);
        $perPage = (int)$request->query('per_page', 20);
        $search = trim($request->query('search', ''));
        $roleId = $request->query('role_id');
        $status = $request->query('status');

        $offset = ($page - 1) * $perPage;
        $isSuper = $this->isSuperAdmin($request);

        $where = ["u.deleted_at IS NULL"];
        $params = [];

        // Exclude Super Admin from user list (Super Admin cannot be edited/listed as normal staff)
        $where[] = "u.is_super_admin = 0";

        if (!empty($search)) {
            $where[] = "(u.username LIKE :search_u OR u.email LIKE :search_e OR p.full_name LIKE :search_n OR p.phone LIKE :search_p)";
            $params['search_u'] = "%{$search}%";
            $params['search_e'] = "%{$search}%";
            $params['search_n'] = "%{$search}%";
            $params['search_p'] = "%{$search}%";
        }

        if (!empty($roleId)) {
            $where[] = "EXISTS (SELECT 1 FROM user_roles ur_filter WHERE ur_filter.user_id = u.id AND ur_filter.role_id = :role_id)";
            $params['role_id'] = $roleId;
        }

        if (!empty($status)) {
            $where[] = "u.status = :status";
            $params['status'] = $status;
        }

        $whereSql = implode(' AND ', $where);

        $totalSql = "SELECT COUNT(*) FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE {$whereSql}";
        $total = (int)Database::fetchColumn($totalSql, $params);

        // Fetch active columns configured in entity_column_configs
        $activeCols = Database::fetchAll("SELECT column_name FROM entity_column_configs WHERE entity = 'users' AND is_active = 1");
        $activeColNames = array_column($activeCols, 'column_name');

        // Core fields always included
        $selectFields = [
            'u.id',
            'u.username',
            'u.email',
            'u.status',
            'u.is_super_admin',
            'u.created_at',
            'u.last_active_at',
            'p.full_name',
            'p.avatar_media_id',
            'm.file_path as avatar_file_path'
        ];

        // Dynamically add active columns if they exist in schema
        $userCols = Database::fetchAll("SHOW COLUMNS FROM users");
        $userColMap = array_flip(array_column($userCols, 'Field'));
        $profileCols = Database::fetchAll("SHOW COLUMNS FROM user_profiles");
        $profileColMap = array_flip(array_column($profileCols, 'Field'));

        foreach ($activeColNames as $col) {
            if (isset($userColMap[$col]) && !in_array("u.{$col}", $selectFields)) {
                $selectFields[] = "u.{$col}";
            } elseif (isset($profileColMap[$col]) && !in_array("p.{$col}", $selectFields)) {
                $selectFields[] = "p.{$col}";
            }
        }

        $fieldsSql = implode(', ', $selectFields);

        $sql = "SELECT {$fieldsSql}
                FROM users u
                LEFT JOIN user_profiles p ON p.user_id = u.id
                LEFT JOIN media m ON m.id = p.avatar_media_id AND m.deleted_at IS NULL
                WHERE {$whereSql}
                ORDER BY u.id DESC
                LIMIT {$perPage} OFFSET {$offset}";

        $users = Database::fetchAll($sql, $params);

        // Attach multiple assigned roles for every user
        if (!empty($users)) {
            $userIds = array_column($users, 'id');
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $rolesData = Database::fetchAll("
                SELECT ur.user_id, r.id as role_id, r.name as role_name, r.slug as role_slug 
                FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id IN ({$placeholders})
                ORDER BY r.name ASC
            ", $userIds);

            $rolesByUser = [];
            foreach ($rolesData as $rd) {
                $rolesByUser[$rd['user_id']][] = [
                    'id'   => $rd['role_id'],
                    'name' => $rd['role_name'],
                    'slug' => $rd['role_slug']
                ];
            }

            foreach ($users as &$u) {
                $u['roles'] = $rolesByUser[$u['id']] ?? [];
                $u['role_names'] = array_column($u['roles'], 'name');
            }
        }

        return $this->paginate($users, $total, $page, $perPage, 'Users retrieved successfully');
    }

    public function show(Request $request): Response
    {
        $id = (int)$request->param('id');
        $isSuper = $this->isSuperAdmin($request);

        $sql = "SELECT u.*
                FROM users u
                WHERE u.id = :id AND u.deleted_at IS NULL";

        $user = Database::fetch($sql, ['id' => $id]);

        if (!$user) {
            return $this->error('User not found.', 404);
        }

        // Hide Super Admin details from non-super-admins
        if ((int)$user['is_super_admin'] === 1 && !$isSuper) {
            return $this->error('Access denied to protected system account.', 403);
        }

        unset($user['password_hash']);

        // Fetch assigned roles from user_roles
        $assignedRoles = Database::fetchAll("
            SELECT r.id, r.name, r.slug 
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = :id
            ORDER BY r.name ASC
        ", ['id' => $id]);

        if (empty($assignedRoles) && !empty($user['role_id'])) {
            $fallback = Database::fetch("SELECT id, name, slug FROM roles WHERE id = :rid", ['rid' => $user['role_id']]);
            if ($fallback) $assignedRoles = [$fallback];
        }

        $user['roles'] = $assignedRoles;
        $user['role_ids'] = array_column($assignedRoles, 'id');

        $profile = Database::fetch("SELECT p.*, m.file_path as avatar_file_path FROM user_profiles p LEFT JOIN media m ON m.id = p.avatar_media_id WHERE p.user_id = :id", ['id' => $id]);
        $bankAccounts = Database::fetchAll("SELECT * FROM user_bank_accounts WHERE user_id = :id ORDER BY is_primary DESC", ['id' => $id]);
        $addresses = Database::fetchAll("SELECT * FROM user_addresses WHERE user_id = :id", ['id' => $id]);
        $references = Database::fetchAll("SELECT * FROM user_references WHERE user_id = :id", ['id' => $id]);
        $metaRows = Database::fetchAll("SELECT meta_key, meta_value FROM user_meta WHERE user_id = :id", ['id' => $id]);

        $meta = [];
        foreach ($metaRows as $row) {
            $meta[$row['meta_key']] = $row['meta_value'];
        }

        return $this->success([
            'user'          => $user,
            'profile'       => $profile,
            'bank_accounts' => $bankAccounts,
            'addresses'     => $addresses,
            'references'    => $references,
            'meta'          => $meta,
        ], 'User details retrieved');
    }

    public function store(Request $request): Response
    {
        $validated = $this->validate($request, [
            'username'        => 'required|string|unique:users,username',
            'email'           => 'required|email|unique:users,email',
            'password'        => 'required|string|min:6',
            'role_ids'        => 'nullable', // Array of multiple role IDs
            'role_id'         => 'nullable|integer',
            'full_name'       => 'required|string',
            'phone'           => 'nullable|string',
            'avatar_media_id' => 'nullable|integer',
            'dob'             => 'nullable|string',
            'gender'          => 'nullable|in:male,female,other',
            'hiring_date'     => 'nullable|string',
            'joining_date'    => 'nullable|string',
            'leaving_date'    => 'nullable|string',
            'notes'           => 'nullable|string',
            'status'          => 'nullable|in:active,inactive,suspended',
            'bank_accounts'   => 'nullable',
            'addresses'       => 'nullable',
            'references'      => 'nullable',
            'meta'            => 'nullable',
        ]);

        // Process role IDs (array or single)
        $roleIds = $request->input('role_ids');
        if (!is_array($roleIds) || empty($roleIds)) {
            $roleIds = !empty($validated['role_id']) ? [(int)$validated['role_id']] : [2]; // Default to Administrator
        }

        Database::beginTransaction();
        try {
            $primaryRoleId = (int)$roleIds[0];

            // Create user
            $userId = Database::insert('users', [
                'username'       => $validated['username'],
                'email'          => $validated['email'],
                'password_hash'  => Auth::hashPassword($validated['password']),
                'role_id'        => $primaryRoleId,
                'is_super_admin' => 0,
                'status'         => $validated['status'] ?? 'active',
                'created_at'     => date('Y-m-d H:i:s'),
                'updated_at'     => date('Y-m-d H:i:s'),
            ]);

            // Sync multiple roles in user_roles pivot
            foreach ($roleIds as $rId) {
                Database::insert('user_roles', [
                    'user_id' => $userId,
                    'role_id' => (int)$rId
                ]);
            }

            // Create profile
            Database::insert('user_profiles', [
                'user_id'         => $userId,
                'full_name'       => $validated['full_name'],
                'phone'           => $validated['phone'] ?? null,
                'avatar_media_id' => $validated['avatar_media_id'] ?? null,
                'dob'             => !empty($validated['dob']) ? $validated['dob'] : null,
                'gender'          => $validated['gender'] ?? null,
                'hiring_date'     => !empty($validated['hiring_date']) ? $validated['hiring_date'] : null,
                'joining_date'    => !empty($validated['joining_date']) ? $validated['joining_date'] : null,
                'leaving_date'    => !empty($validated['leaving_date']) ? $validated['leaving_date'] : null,
                'notes'           => $validated['notes'] ?? null,
                'created_at'      => date('Y-m-d H:i:s'),
                'updated_at'      => date('Y-m-d H:i:s'),
            ]);

            // Save bank accounts (if provided)
            $bankAccounts = $request->input('bank_accounts');
            if (is_array($bankAccounts)) {
                foreach ($bankAccounts as $ba) {
                    if (!empty($ba['account_title']) && !empty($ba['account_number_or_iban'])) {
                        Database::insert('user_bank_accounts', [
                            'user_id'                => $userId,
                            'wallet_type'            => $ba['wallet_type'] ?? 'bank_account',
                            'account_title'          => $ba['account_title'],
                            'account_number_or_iban' => $ba['account_number_or_iban'],
                            'bank_name'              => $ba['bank_name'] ?? null,
                            'branch_code_or_name'    => $ba['branch_code_or_name'] ?? null,
                            'is_primary'             => !empty($ba['is_primary']) ? 1 : 0,
                            'notes'                  => $ba['notes'] ?? null,
                            'created_at'             => date('Y-m-d H:i:s'),
                            'updated_at'             => date('Y-m-d H:i:s'),
                        ]);
                    }
                }
            }

            // Save addresses (if provided)
            $addresses = $request->input('addresses');
            if (is_array($addresses)) {
                foreach ($addresses as $addr) {
                    if (!empty($addr['address_line_1']) && !empty($addr['city'])) {
                        Database::insert('user_addresses', [
                            'user_id'        => $userId,
                            'address_type'   => $addr['address_type'] ?? 'current',
                            'address_line_1' => $addr['address_line_1'],
                            'address_line_2' => $addr['address_line_2'] ?? null,
                            'city'           => $addr['city'],
                            'state'          => $addr['state'] ?? null,
                            'postal_code'    => $addr['postal_code'] ?? null,
                            'country'        => $addr['country'] ?? 'Pakistan',
                            'created_at'     => date('Y-m-d H:i:s'),
                            'updated_at'     => date('Y-m-d H:i:s'),
                        ]);
                    }
                }
            }

            // Save references (if provided)
            $references = $request->input('references');
            if (is_array($references)) {
                foreach ($references as $ref) {
                    if (!empty($ref['name']) && !empty($ref['phone'])) {
                        Database::insert('user_references', [
                            'user_id'      => $userId,
                            'name'         => $ref['name'],
                            'relationship' => $ref['relationship'] ?? 'Colleague',
                            'phone'        => $ref['phone'],
                            'email'        => $ref['email'] ?? null,
                            'organization' => $ref['organization'] ?? null,
                            'notes'        => $ref['notes'] ?? null,
                            'created_at'   => date('Y-m-d H:i:s'),
                            'updated_at'   => date('Y-m-d H:i:s'),
                        ]);
                    }
                }
            }

            // Save dynamic meta (if provided)
            $meta = $request->input('meta');
            if (is_array($meta)) {
                foreach ($meta as $k => $v) {
                    Database::insert('user_meta', [
                        'user_id'    => $userId,
                        'meta_key'   => $k,
                        'meta_value' => is_array($v) ? json_encode($v) : (string)$v,
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s'),
                    ]);
                }
            }

            Database::commit();

            $currentUser = $this->user($request);
            ActivityLogger::log(
                $currentUser ? (int)$currentUser['id'] : null,
                'created',
                'users',
                $userId,
                $validated['username'],
                "Created user '{$validated['username']}' ({$validated['full_name']})",
                null,
                ['id' => $userId, 'username' => $validated['username'], 'email' => $validated['email'], 'role_id' => $primaryRoleId]
            );

            return $this->success(['id' => $userId], 'User created successfully', 201);
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }
    }

    public function update(Request $request): Response
    {
        $id = (int)$request->param('id');
        $targetUser = Database::fetch("SELECT * FROM users WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);

        if (!$targetUser) {
            return $this->error('User not found.', 404);
        }

        // Immunity Safeguard: Super Admin cannot be edited by normal users
        if ((int)$targetUser['is_super_admin'] === 1 && !$this->isSuperAdmin($request)) {
            return $this->error('Forbidden: Super Admin account cannot be modified.', 403);
        }

        $validated = $this->validate($request, [
            'username'        => "required|string|unique:users,username,{$id}",
            'email'           => "required|email|unique:users,email,{$id}",
            'password'        => 'nullable|string|min:6',
            'role_ids'        => 'nullable',
            'role_id'         => 'nullable|integer',
            'full_name'       => 'required|string',
            'phone'           => 'nullable|string',
            'avatar_media_id' => 'nullable|integer',
            'dob'             => 'nullable|string',
            'gender'          => 'nullable|in:male,female,other',
            'hiring_date'     => 'nullable|string',
            'joining_date'    => 'nullable|string',
            'leaving_date'    => 'nullable|string',
            'notes'           => 'nullable|string',
            'status'          => 'nullable|in:active,inactive,suspended',
        ]);

        $roleIds = $request->input('role_ids');
        if (!is_array($roleIds) || empty($roleIds)) {
            $roleIds = !empty($validated['role_id']) ? [(int)$validated['role_id']] : [(int)$targetUser['role_id']];
        }

        Database::beginTransaction();
        try {
            $primaryRoleId = (int)$roleIds[0];

            $userUpdateData = [
                'username'   => $validated['username'],
                'email'      => $validated['email'],
                'role_id'    => $primaryRoleId,
                'status'     => $validated['status'] ?? $targetUser['status'],
                'updated_at' => date('Y-m-d H:i:s'),
            ];

            if (!empty($validated['password'])) {
                $userUpdateData['password_hash'] = Auth::hashPassword($validated['password']);
            }

            Database::update('users', $userUpdateData, 'id = :id', ['id' => $id]);

            // Sync user_roles
            Database::delete('user_roles', 'user_id = :id', ['id' => $id]);
            foreach ($roleIds as $rId) {
                Database::insert('user_roles', [
                    'user_id' => $id,
                    'role_id' => (int)$rId
                ]);
            }

            // Update profile
            $profileUpdateData = [
                'full_name'       => $validated['full_name'],
                'phone'           => $validated['phone'] ?? null,
                'avatar_media_id' => $validated['avatar_media_id'] ?? null,
                'dob'             => !empty($validated['dob']) ? $validated['dob'] : null,
                'gender'          => $validated['gender'] ?? null,
                'hiring_date'     => !empty($validated['hiring_date']) ? $validated['hiring_date'] : null,
                'joining_date'    => !empty($validated['joining_date']) ? $validated['joining_date'] : null,
                'leaving_date'    => !empty($validated['leaving_date']) ? $validated['leaving_date'] : null,
                'notes'           => $validated['notes'] ?? null,
                'updated_at'      => date('Y-m-d H:i:s'),
            ];

            $profileExists = Database::fetchColumn("SELECT COUNT(*) FROM user_profiles WHERE user_id = :id", ['id' => $id]);
            if ($profileExists) {
                Database::update('user_profiles', $profileUpdateData, 'user_id = :id', ['id' => $id]);
            } else {
                $profileUpdateData['user_id'] = $id;
                Database::insert('user_profiles', $profileUpdateData);
            }

            // Sync bank accounts if provided
            $bankAccounts = $request->input('bank_accounts');
            if (is_array($bankAccounts)) {
                Database::delete('user_bank_accounts', 'user_id = :id', ['id' => $id]);
                foreach ($bankAccounts as $ba) {
                    if (!empty($ba['account_title']) && !empty($ba['account_number_or_iban'])) {
                        Database::insert('user_bank_accounts', [
                            'user_id'                => $id,
                            'wallet_type'            => $ba['wallet_type'] ?? 'bank_account',
                            'account_title'          => $ba['account_title'],
                            'account_number_or_iban' => $ba['account_number_or_iban'],
                            'bank_name'              => $ba['bank_name'] ?? null,
                            'branch_code_or_name'    => $ba['branch_code_or_name'] ?? null,
                            'is_primary'             => !empty($ba['is_primary']) ? 1 : 0,
                            'notes'                  => $ba['notes'] ?? null,
                            'created_at'             => date('Y-m-d H:i:s'),
                            'updated_at'             => date('Y-m-d H:i:s'),
                        ]);
                    }
                }
            }

            // Sync addresses if provided
            $addresses = $request->input('addresses');
            if (is_array($addresses)) {
                Database::delete('user_addresses', 'user_id = :id', ['id' => $id]);
                foreach ($addresses as $addr) {
                    if (!empty($addr['address_line_1']) && !empty($addr['city'])) {
                        Database::insert('user_addresses', [
                            'user_id'        => $id,
                            'address_type'   => $addr['address_type'] ?? 'current',
                            'address_line_1' => $addr['address_line_1'],
                            'address_line_2' => $addr['address_line_2'] ?? null,
                            'city'           => $addr['city'],
                            'state'          => $addr['state'] ?? null,
                            'postal_code'    => $addr['postal_code'] ?? null,
                            'country'        => $addr['country'] ?? 'Pakistan',
                            'created_at'     => date('Y-m-d H:i:s'),
                            'updated_at'     => date('Y-m-d H:i:s'),
                        ]);
                    }
                }
            }

            // Sync references if provided
            $references = $request->input('references');
            if (is_array($references)) {
                Database::delete('user_references', 'user_id = :id', ['id' => $id]);
                foreach ($references as $ref) {
                    if (!empty($ref['name']) && !empty($ref['phone'])) {
                        Database::insert('user_references', [
                            'user_id'      => $id,
                            'name'         => $ref['name'],
                            'relationship' => $ref['relationship'] ?? 'Colleague',
                            'phone'        => $ref['phone'],
                            'email'        => $ref['email'] ?? null,
                            'organization' => $ref['organization'] ?? null,
                            'notes'        => $ref['notes'] ?? null,
                            'created_at'   => date('Y-m-d H:i:s'),
                            'updated_at'   => date('Y-m-d H:i:s'),
                        ]);
                    }
                }
            }

            // Sync meta if provided
            $meta = $request->input('meta');
            if (is_array($meta)) {
                Database::delete('user_meta', 'user_id = :id', ['id' => $id]);
                foreach ($meta as $k => $v) {
                    Database::insert('user_meta', [
                        'user_id'    => $id,
                        'meta_key'   => $k,
                        'meta_value' => is_array($v) ? json_encode($v) : (string)$v,
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s'),
                    ]);
                }
            }

            Database::commit();

            $currentUser = $this->user($request);
            ActivityLogger::log(
                $currentUser ? (int)$currentUser['id'] : null,
                'updated',
                'users',
                $id,
                $validated['username'],
                "Updated user profile for '{$validated['username']}'",
                $targetUser,
                $userUpdateData
            );

            return $this->success(null, 'User updated successfully');
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }
    }

    public function destroy(Request $request): Response
    {
        $id = (int)$request->param('id');
        $targetUser = Database::fetch("SELECT * FROM users WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);

        if (!$targetUser) {
            return $this->error('User not found.', 404);
        }

        // Immunity Safeguard: Super Admin cannot be deleted
        if ((int)$targetUser['is_super_admin'] === 1) {
            return $this->error('Super Admin account cannot be deleted.', 403);
        }

        Database::update('users', [
            'deleted_at' => date('Y-m-d H:i:s'),
            'status'     => 'inactive'
        ], 'id = :id', ['id' => $id]);

        $currentUser = $this->user($request);
        ActivityLogger::log(
            $currentUser ? (int)$currentUser['id'] : null,
            'deleted',
            'users',
            $id,
            $targetUser['username'],
            "Soft deleted user '{$targetUser['username']}'",
            $targetUser,
            ['deleted_at' => date('Y-m-d H:i:s')]
        );

        return $this->success(null, 'User deleted successfully.');
    }
}
