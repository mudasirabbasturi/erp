<?php
namespace Core;

class Auth
{
    public static function hashPassword(string $plain): string
    {
        return password_hash($plain, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    public static function verifyPassword(string $plain, string $hash): bool
    {
        return password_verify($plain, $hash);
    }

    public static function generateToken(int $userId, string $name = 'api'): string
    {
        $rawToken = bin2hex(random_bytes(32));
        $hashedToken = hash('sha256', $rawToken);

        Database::insert('user_tokens', [
            'user_id'    => $userId,
            'token'      => $hashedToken,
            'name'       => $name,
            'created_at' => date('Y-m-d H:i:s'),
            'expires_at' => date('Y-m-d H:i:s', strtotime('+30 days')),
        ]);

        return $rawToken;
    }

    public static function validateToken(string $rawToken): ?array
    {
        $hashedToken = hash('sha256', $rawToken);

        $sql = "SELECT u.id, u.username, u.email, u.role_id, u.is_super_admin, u.status,
                       r.name as role_name, r.slug as role_slug,
                       p.full_name, p.phone, p.avatar_media_id
                FROM user_tokens ut
                JOIN users u ON u.id = ut.user_id
                LEFT JOIN roles r ON r.id = u.role_id
                LEFT JOIN user_profiles p ON p.user_id = u.id
                WHERE ut.token = :token 
                  AND (ut.expires_at IS NULL OR ut.expires_at > NOW()) 
                  AND u.status = 'active'
                  AND u.deleted_at IS NULL
                LIMIT 1";

        $user = Database::fetch($sql, ['token' => $hashedToken]);

        if ($user) {
            $user['is_super_admin'] = (int)$user['is_super_admin'];

            // Fetch ALL assigned roles from user_roles pivot table
            $assignedRoles = Database::fetchAll("
                SELECT r.id, r.name, r.slug 
                FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = :uid
            ", ['uid' => $user['id']]);

            // If user_roles was empty, fallback to users.role_id
            if (empty($assignedRoles) && !empty($user['role_id'])) {
                $fallback = Database::fetch("SELECT id, name, slug FROM roles WHERE id = :rid", ['rid' => $user['role_id']]);
                if ($fallback) $assignedRoles = [$fallback];
            }

            $user['roles'] = $assignedRoles;
            $roleIds = array_column($assignedRoles, 'id');

            if (!empty($roleIds)) {
                $placeholders = implode(',', array_fill(0, count($roleIds), '?'));

                // Fetch combined distinct permissions from all roles
                $perms = Database::fetchAll("
                    SELECT DISTINCT p.slug 
                    FROM role_permissions rp
                    JOIN permissions p ON p.id = rp.permission_id
                    WHERE rp.role_id IN ({$placeholders})
                ", $roleIds);
                $user['permissions'] = array_column($perms, 'slug');

                // Fetch combined additive field-level permissions (MAX grants permission if any role has it)
                $fields = Database::fetchAll("
                    SELECT entity, field_name, MAX(can_view) as can_view, MAX(can_edit) as can_edit 
                    FROM field_level_permissions 
                    WHERE role_id IN ({$placeholders})
                    GROUP BY entity, field_name
                ", $roleIds);
                $user['field_permissions'] = $fields;
            } else {
                $user['permissions'] = [];
                $user['field_permissions'] = [];
            }

            // Update last_used_at
            Database::update('user_tokens', [
                'last_used_at' => date('Y-m-d H:i:s')
            ], 'token = :token', ['token' => $hashedToken]);

            return $user;
        }

        return null;
    }

    public static function revokeToken(string $rawToken): bool
    {
        $hashedToken = hash('sha256', $rawToken);
        return Database::delete('user_tokens', 'token = :token', ['token' => $hashedToken]) > 0;
    }
}
