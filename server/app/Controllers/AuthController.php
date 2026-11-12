<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;
use Core\Auth;

class AuthController extends Controller
{
    public function login(Request $request): Response
    {
        $body = $request->all();
        $login = $body['username'] ?? $body['email'] ?? null;
        $password = $body['password'] ?? null;

        if (!$login || !$password) {
            return $this->error('Username or email and password are required.', 422);
        }

        // Search by username or email
        $sql = "SELECT u.id, u.username, u.email, u.password_hash, u.role_id, u.is_super_admin, u.status,
                       r.name as role_name, r.slug as role_slug
                FROM users u
                JOIN roles r ON r.id = u.role_id
                WHERE (u.username = :login_u OR u.email = :login_e) 
                  AND u.deleted_at IS NULL
                LIMIT 1";

        $user = Database::fetch($sql, ['login_u' => $login, 'login_e' => $login]);

        if (!$user) {
            return $this->error('Invalid credentials.', 401);
        }

        if ($user['status'] !== 'active') {
            return $this->error("Account is {$user['status']}. Please contact administrator.", 403);
        }

        if (!Auth::verifyPassword($password, $user['password_hash'])) {
            return $this->error('Invalid credentials.', 401);
        }

        // Generate high-speed API token
        $token = Auth::generateToken((int)$user['id'], 'web_login');

        // Update last_active_at
        Database::update('users', ['last_active_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => $user['id']]);

        // Load profile with avatar
        $profile = Database::fetch("SELECT p.full_name, p.phone, p.avatar_media_id, m.file_path as avatar_file_path 
                                     FROM user_profiles p 
                                     LEFT JOIN media m ON m.id = p.avatar_media_id AND m.deleted_at IS NULL 
                                     WHERE p.user_id = :id", ['id' => $user['id']]);

        // Load all assigned roles
        $assignedRoles = Database::fetchAll("
            SELECT r.id, r.name, r.slug 
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = :uid
        ", ['uid' => $user['id']]);

        if (empty($assignedRoles) && !empty($user['role_id'])) {
            $fallback = Database::fetch("SELECT id, name, slug FROM roles WHERE id = :rid", ['rid' => $user['role_id']]);
            if ($fallback) $assignedRoles = [$fallback];
        }

        $roleIds = array_column($assignedRoles, 'id');
        $permsList = [];
        $fieldPerms = [];

        if (!empty($roleIds)) {
            $placeholders = implode(',', array_fill(0, count($roleIds), '?'));
            $perms = Database::fetchAll("
                SELECT DISTINCT p.slug 
                FROM role_permissions rp
                JOIN permissions p ON p.id = rp.permission_id
                WHERE rp.role_id IN ({$placeholders})
            ", $roleIds);
            $permsList = array_column($perms, 'slug');

            $fieldPerms = Database::fetchAll("
                SELECT entity, field_name, MAX(can_view) as can_view, MAX(can_add) as can_add, MAX(can_edit) as can_edit 
                FROM field_level_permissions 
                WHERE role_id IN ({$placeholders})
                GROUP BY entity, field_name
            ", $roleIds);
        }

        unset($user['password_hash']);

        return $this->success([
            'token'             => $token,
            'user'              => array_merge($user, [
                'full_name'         => $profile['full_name'] ?? $user['username'],
                'phone'             => $profile['phone'] ?? null,
                'avatar_media_id'   => $profile['avatar_media_id'] ?? null,
                'avatar_file_path'  => $profile['avatar_file_path'] ?? null,
                'roles'             => $assignedRoles,
                'permissions'       => $permsList,
                'field_permissions' => $fieldPerms,
            ]),
        ], 'Login successful');
    }

    public function me(Request $request): Response
    {
        $user = $this->user($request);
        if (!$user) {
            return $this->error('Unauthenticated', 401);
        }

        // Fetch detailed profile, bank accounts, and addresses
        $profile = Database::fetch("SELECT p.*, m.file_path as avatar_file_path 
                                     FROM user_profiles p 
                                     LEFT JOIN media m ON m.id = p.avatar_media_id AND m.deleted_at IS NULL 
                                     WHERE p.user_id = :id", ['id' => $user['id']]);
        $bankAccounts = Database::fetchAll("SELECT * FROM user_bank_accounts WHERE user_id = :id ORDER BY is_primary DESC", ['id' => $user['id']]);
        $addresses = Database::fetchAll("SELECT * FROM user_addresses WHERE user_id = :id", ['id' => $user['id']]);
        $references = Database::fetchAll("SELECT * FROM user_references WHERE user_id = :id", ['id' => $user['id']]);
        $meta = Database::fetchAll("SELECT meta_key, meta_value FROM user_meta WHERE user_id = :id", ['id' => $user['id']]);

        $metaFormatted = [];
        foreach ($meta as $m) {
            $metaFormatted[$m['meta_key']] = $m['meta_value'];
        }

        return $this->success([
            'user'          => $user,
            'profile'       => $profile,
            'bank_accounts' => $bankAccounts,
            'addresses'     => $addresses,
            'references'    => $references,
            'meta'          => $metaFormatted,
        ], 'Current user session profile');
    }

    public function logout(Request $request): Response
    {
        $token = $request->bearerToken();
        if ($token) {
            Auth::revokeToken($token);
        }
        return $this->success(null, 'Logged out successfully');
    }

    public function updatePassword(Request $request): Response
    {
        $user = $this->user($request);
        $validated = $this->validate($request, [
            'current_password' => 'required|string',
            'new_password'     => 'required|string|min:6',
        ]);

        $dbUser = Database::fetch("SELECT password_hash FROM users WHERE id = :id", ['id' => $user['id']]);
        if (!Auth::verifyPassword($validated['current_password'], $dbUser['password_hash'])) {
            return $this->error('Current password does not match.', 422);
        }

        $newHash = Auth::hashPassword($validated['new_password']);
        Database::update('users', ['password_hash' => $newHash], 'id = :id', ['id' => $user['id']]);

        return $this->success(null, 'Password updated successfully.');
    }
}
