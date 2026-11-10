<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;
use App\Services\ActivityLogger;

class SchemaController extends Controller
{
    private array $excludedTables = [
        'roles',
        'permissions',
        'role_permissions',
        'field_level_permissions',
        'user_roles',
        'user_tokens',
        'system_settings',
        'entity_column_configs',
        'menus',
        'role_menu_permissions',
        'migrations',
        'personal_access_tokens',
        'activity_logs',
        'media_folders'
    ];

    private array $protectedColumns = [
        'users' => ['id', 'username', 'email', 'password_hash', 'role_id', 'status', 'is_super_admin', 'created_at', 'updated_at', 'deleted_at'],
        'user_profiles' => ['id', 'user_id', 'full_name', 'created_at', 'updated_at'],
        'clients' => ['id', 'name', 'client_type', 'created_at', 'updated_at', 'deleted_at'],
        'projects' => ['id', 'project_title', 'client_id', 'project_progress_status', 'created_at', 'updated_at', 'deleted_at'],
        'project_team_members' => ['id', 'project_id', 'user_id', 'created_at', 'updated_at', 'deleted_at'],
        'media' => ['id', 'user_id', 'file_name', 'file_path', 'created_at', 'updated_at']
    ];

    /**
     * Get list of all editable business tables
     */
    public function getTables(Request $request): Response
    {
        $tableStatus = Database::fetchAll("SHOW TABLE STATUS");
        $result = [];

        foreach ($tableStatus as $row) {
            $tableName = $row['Name'];

            // Skip internal system and pivot tables
            if (in_array($tableName, $this->excludedTables)) {
                continue;
            }

            $colCount = (int)Database::fetchColumn(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tbl",
                ['tbl' => $tableName]
            );

            $result[] = [
                'table_name'     => $tableName,
                'label'          => !empty($row['Comment']) ? $row['Comment'] : $this->humanize($tableName),
                'rows'           => (int)$row['Rows'],
                'engine'         => $row['Engine'],
                'collation'      => $row['Collation'],
                'columns_count'  => $colCount,
                'created_at'     => $row['Create_time']
            ];
        }

        return $this->success($result, 'Database tables retrieved successfully');
    }

    /**
     * Get all columns for a specific table
     */
    public function getTableColumns(Request $request): Response
    {
        $table = preg_replace('/[^a-z0-9_]/', '', strtolower($request->param('table')));

        if (empty($table) || in_array($table, $this->excludedTables)) {
            return $this->error('Access to this database table is restricted or invalid.', 403);
        }

        $tableExists = Database::fetchColumn(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tbl",
            ['tbl' => $table]
        );
        if (!$tableExists) {
            return $this->error("Table `{$table}` not found in database.", 404);
        }

        $rawCols = Database::fetchAll("SHOW FULL COLUMNS FROM `{$table}`");
        $formatted = [];

        foreach ($rawCols as $c) {
            $isInternal = in_array($c['Field'], ['id', 'user_id', 'created_at', 'updated_at', 'deleted_at']);
            
            // Extract base type and length if present
            $type = $c['Type'];
            $baseType = preg_replace('/\(.*/', '', $type);
            $length = '';
            $enumOptions = [];
            if (preg_match('/\((.*?)\)/s', $type, $matches)) {
                $length = $matches[1];
                if (strtoupper($baseType) === 'ENUM') {
                    if (preg_match_all("/'((?:[^'\\\\]|\\\\.)*)'/", $matches[1], $enumMatches)) {
                        $enumOptions = array_map('stripslashes', $enumMatches[1]);
                    }
                }
            }

            $formatted[] = [
                'table'        => $table,
                'field'        => $c['Field'],
                'type'         => $type,
                'base_type'    => strtoupper($baseType),
                'length'       => $length,
                'enum_options' => $enumOptions,
                'null'         => $c['Null'] === 'YES',
                'default'      => $c['Default'],
                'key'          => $c['Key'],
                'comment'      => $c['Comment'] ?: $this->humanize($c['Field']),
                'is_system'    => $isInternal
            ];
        }

        return $this->success([
            'table'   => $table,
            'columns' => $formatted
        ], "Columns for table `{$table}` retrieved successfully");
    }

    /**
     * Backward-compatible endpoint: Get all columns for User tables (users and user_profiles)
     */
    public function getUserColumns(Request $request): Response
    {
        $usersCols = Database::fetchAll("SHOW FULL COLUMNS FROM users");
        $profileCols = Database::fetchAll("SHOW FULL COLUMNS FROM user_profiles");

        $formatted = [];
        foreach ($usersCols as $c) {
            $isInternal = in_array($c['Field'], ['id', 'created_at', 'updated_at', 'deleted_at']);
            $formatted[] = [
                'table'       => 'users',
                'field'       => $c['Field'],
                'type'        => $c['Type'],
                'null'        => $c['Null'] === 'YES',
                'default'     => $c['Default'],
                'key'         => $c['Key'],
                'comment'     => $c['Comment'] ?: $this->humanize($c['Field']),
                'is_system'   => $isInternal
            ];
        }

        foreach ($profileCols as $c) {
            $isInternal = in_array($c['Field'], ['user_id', 'created_at', 'updated_at']);
            $formatted[] = [
                'table'       => 'user_profiles',
                'field'       => $c['Field'],
                'type'        => $c['Type'],
                'null'        => $c['Null'] === 'YES',
                'default'     => $c['Default'],
                'key'         => $c['Key'],
                'comment'     => $c['Comment'] ?: $this->humanize($c['Field']),
                'is_system'   => $isInternal
            ];
        }

        return $this->success([
            'columns'    => $formatted,
            'all_tables' => ['users', 'user_profiles']
        ], 'User table schema retrieved');
    }

    /**
     * Add a new column to a database table
     */
    public function addColumn(Request $request): Response
    {
        $tableParam = $request->param('table') ?: $request->input('table');
        $table = preg_replace('/[^a-z0-9_]/', '', strtolower(trim($tableParam)));

        if (empty($table) || in_array($table, $this->excludedTables)) {
            return $this->error('Target table is restricted or invalid.', 403);
        }

        $validated = $this->validate($request, [
            'column_name'      => 'required|string',
            'data_type'        => 'required|string',
            'comment'          => 'required|string',
            'length'           => 'nullable|string',
            'is_nullable'      => 'nullable|boolean',
            'default_value'    => 'nullable|string',
        ]);

        // Sanitize column name to snake_case alphanumeric + underscore
        $colName = preg_replace('/[^a-z0-9_]/', '', strtolower(str_replace(' ', '_', trim($validated['column_name']))));
        if (empty($colName)) {
            return $this->error('Invalid column name.', 422);
        }

        // Check if column already exists
        $existing = Database::fetchColumn(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tbl AND COLUMN_NAME = :col",
            ['tbl' => $table, 'col' => $colName]
        );
        if ($existing) {
            return $this->error("Column `{$colName}` already exists in table `{$table}`.", 422);
        }

        // Construct SQL data type with optional length
        $rawType = strtoupper(trim($validated['data_type']));
        $allowedTypes = ['VARCHAR', 'TEXT', 'LONGTEXT', 'INT', 'BIGINT', 'TINYINT', 'DECIMAL', 'DATE', 'DATETIME', 'TIMESTAMP', 'ENUM'];
        if (!in_array($rawType, $allowedTypes)) {
            $rawType = 'VARCHAR';
        }

        if ($rawType === 'ENUM') {
            $rawOptions = $request->input('enum_options');
            $opts = [];
            if (is_array($rawOptions)) {
                $opts = $rawOptions;
            } else {
                $lenStr = trim($validated['length'] ?? '');
                $parts = explode(',', $lenStr);
                foreach ($parts as $p) {
                    $cleaned = trim($p, " \t\n\r\0\x0B'\"");
                    if ($cleaned !== '') {
                        $opts[] = $cleaned;
                    }
                }
            }
            $opts = array_values(array_filter(array_map('trim', $opts)));
            if (empty($opts)) {
                return $this->error('ENUM column must have at least one option value.', 422);
            }
            $escapedOpts = array_map(function($o) {
                return "'" . addslashes(trim($o, " \t\n\r\0\x0B'\"")) . "'";
            }, $opts);
            $fullType = "ENUM(" . implode(',', $escapedOpts) . ")";
        } elseif (in_array($rawType, ['VARCHAR', 'INT', 'BIGINT', 'TINYINT', 'DECIMAL'])) {
            $length = trim($validated['length'] ?? '');
            if ($length === '') {
                $defaults = ['VARCHAR' => '255', 'INT' => '11', 'BIGINT' => '20', 'TINYINT' => '1', 'DECIMAL' => '10,2'];
                $length = $defaults[$rawType] ?? '255';
            }
            $cleanLength = preg_replace('/[^0-9,]/', '', $length);
            $fullType = "{$rawType}({$cleanLength})";
        } else {
            $fullType = $rawType;
        }

        $nullableSql = !empty($validated['is_nullable']) ? "NULL" : "NOT NULL";
        
        $defaultSql = "";
        if (isset($validated['default_value']) && $validated['default_value'] !== '') {
            $defaultVal = addslashes($validated['default_value']);
            $defaultSql = "DEFAULT '{$defaultVal}'";
        } elseif (!empty($validated['is_nullable'])) {
            $defaultSql = "DEFAULT NULL";
        }

        $comment = addslashes($validated['comment']);
        $sql = "ALTER TABLE `{$table}` ADD COLUMN `{$colName}` {$fullType} {$nullableSql} {$defaultSql} COMMENT '{$comment}'";

        $db = Database::getConnection();
        try {
            $db->exec($sql);

            // If added to users, user_profiles, clients, or projects, register in entity_column_configs
            $entityName = null;
            if (in_array($table, ['users', 'user_profiles'])) {
                $entityName = 'users';
            } elseif ($table === 'clients') {
                $entityName = 'clients';
            } elseif ($table === 'projects') {
                $entityName = 'projects';
            }

            if ($entityName) {
                $exists = Database::fetchColumn(
                    "SELECT id FROM entity_column_configs WHERE entity = :entity AND column_name = :col",
                    ['entity' => $entityName, 'col' => $colName]
                );
                if (!$exists) {
                    Database::insert('entity_column_configs', [
                        'entity'          => $entityName,
                        'column_name'     => $colName,
                        'label'           => $validated['comment'],
                        'is_active'       => 1,
                        'is_list_visible' => 1,
                        'is_view_visible' => 1,
                        'sort_order'      => 99
                    ]);
                }
            }

            $currentUser = $this->user($request);
            ActivityLogger::log(
                $currentUser ? (int)$currentUser['id'] : null,
                'created',
                'database',
                null,
                "{$table}.{$colName}",
                "Added column `{$colName}` ({$fullType}) to table `{$table}`",
                null,
                ['table' => $table, 'column' => $colName, 'type' => $fullType, 'comment' => $validated['comment']]
            );

            return $this->success(null, "Column `{$colName}` added successfully to table `{$table}`.", 201);
        } catch (\Throwable $e) {
            return $this->error("Failed to add column: " . $e->getMessage(), 500);
        }
    }

    /**
     * Update an existing column in a database table
     */
    public function updateColumn(Request $request): Response
    {
        $tableParam = $request->param('table') ?: $request->input('table');
        $table = preg_replace('/[^a-z0-9_]/', '', strtolower(trim($tableParam)));

        if (empty($table) || in_array($table, $this->excludedTables)) {
            return $this->error('Target table is restricted or invalid.', 403);
        }

        $validated = $this->validate($request, [
            'column_name'   => 'required|string',
            'comment'       => 'required|string',
            'data_type'     => 'required|string',
            'length'        => 'nullable|string',
            'is_nullable'   => 'nullable|boolean',
            'default_value' => 'nullable|string',
        ]);

        $colName = preg_replace('/[^a-z0-9_]/', '', strtolower(trim($validated['column_name'])));

        // Protect internal system primary keys from modification
        if (in_array($colName, ['id', 'user_id', 'deleted_at'])) {
            return $this->error("System primary key columns cannot be modified.", 403);
        }

        $existing = Database::fetch(
            "SELECT COLUMN_TYPE as Type, COLUMN_COMMENT as Comment FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tbl AND COLUMN_NAME = :col",
            ['tbl' => $table, 'col' => $colName]
        );
        if (!$existing) {
            return $this->error("Column `{$colName}` not found in table `{$table}`.", 404);
        }

        $rawType = strtoupper(trim($validated['data_type']));
        $allowedTypes = ['VARCHAR', 'TEXT', 'LONGTEXT', 'INT', 'BIGINT', 'TINYINT', 'DECIMAL', 'DATE', 'DATETIME', 'TIMESTAMP', 'ENUM'];
        if (!in_array($rawType, $allowedTypes)) {
            $fullType = $existing['Type'];
        } elseif ($rawType === 'ENUM') {
            $rawOptions = $request->input('enum_options');
            $opts = [];
            if (is_array($rawOptions)) {
                $opts = $rawOptions;
            } else {
                $lenStr = trim($validated['length'] ?? '');
                $parts = explode(',', $lenStr);
                foreach ($parts as $p) {
                    $cleaned = trim($p, " \t\n\r\0\x0B'\"");
                    if ($cleaned !== '') {
                        $opts[] = $cleaned;
                    }
                }
            }
            $opts = array_values(array_filter(array_map('trim', $opts)));
            if (empty($opts)) {
                return $this->error('ENUM column must have at least one option value.', 422);
            }
            $escapedOpts = array_map(function($o) {
                return "'" . addslashes(trim($o, " \t\n\r\0\x0B'\"")) . "'";
            }, $opts);
            $fullType = "ENUM(" . implode(',', $escapedOpts) . ")";
        } else {
            $length = trim($validated['length'] ?? '');
            if (in_array($rawType, ['VARCHAR', 'INT', 'BIGINT', 'TINYINT', 'DECIMAL'])) {
                if ($length === '') {
                    $defaults = ['VARCHAR' => '255', 'INT' => '11', 'BIGINT' => '20', 'TINYINT' => '1', 'DECIMAL' => '10,2'];
                    $length = $defaults[$rawType] ?? '255';
                }
                $cleanLength = preg_replace('/[^0-9,]/', '', $length);
                $fullType = "{$rawType}({$cleanLength})";
            } else {
                $fullType = $rawType;
            }
        }

        $nullableSql = !empty($validated['is_nullable']) ? "NULL" : "NOT NULL";
        
        $defaultSql = "";
        if (isset($validated['default_value']) && $validated['default_value'] !== '') {
            $defaultVal = addslashes($validated['default_value']);
            $defaultSql = "DEFAULT '{$defaultVal}'";
        } elseif (!empty($validated['is_nullable'])) {
            $defaultSql = "DEFAULT NULL";
        }

        $comment = addslashes($validated['comment']);
        $sql = "ALTER TABLE `{$table}` MODIFY COLUMN `{$colName}` {$fullType} {$nullableSql} {$defaultSql} COMMENT '{$comment}'";

        $db = Database::getConnection();
        try {
            $db->exec($sql);

            // Update label in entity_column_configs if users/user_profiles, clients, or projects
            $entityName = null;
            if (in_array($table, ['users', 'user_profiles'])) {
                $entityName = 'users';
            } elseif ($table === 'clients') {
                $entityName = 'clients';
            } elseif ($table === 'projects') {
                $entityName = 'projects';
            }

            if ($entityName) {
                Database::query("
                    UPDATE entity_column_configs 
                    SET label = :label 
                    WHERE entity = :entity AND column_name = :col
                ", ['label' => $validated['comment'], 'entity' => $entityName, 'col' => $colName]);
            }

            $currentUser = $this->user($request);
            ActivityLogger::log(
                $currentUser ? (int)$currentUser['id'] : null,
                'updated',
                'database',
                null,
                "{$table}.{$colName}",
                "Updated column `{$colName}` in table `{$table}`",
                null,
                ['table' => $table, 'column' => $colName, 'type' => $fullType, 'comment' => $validated['comment']]
            );

            return $this->success(null, "Column `{$colName}` updated successfully in table `{$table}`.");
        } catch (\Throwable $e) {
            return $this->error("Failed to update column: " . $e->getMessage(), 500);
        }
    }

    /**
     * Delete / Drop a custom column from a database table
     */
    public function deleteColumn(Request $request): Response
    {
        $tableParam = $request->param('table') ?: $request->input('table');
        $table = preg_replace('/[^a-z0-9_]/', '', strtolower(trim($tableParam)));

        $colParam = $request->param('column') ?: $request->input('column');
        $colName = preg_replace('/[^a-z0-9_]/', '', strtolower(trim($colParam)));

        if (empty($table) || in_array($table, $this->excludedTables)) {
            return $this->error('Target table is restricted or invalid.', 403);
        }

        if (empty($colName)) {
            return $this->error('Target column is required.', 422);
        }

        // Check if column is protected
        $protected = $this->protectedColumns[$table] ?? ['id', 'created_at', 'updated_at', 'deleted_at'];
        if (in_array($colName, $protected)) {
            return $this->error("Column `{$colName}` is a core system column and cannot be deleted.", 403);
        }

        // Verify column exists in the table
        $existing = Database::fetch(
            "SELECT COLUMN_NAME, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tbl AND COLUMN_NAME = :col",
            ['tbl' => $table, 'col' => $colName]
        );
        if (!$existing) {
            return $this->error("Column `{$colName}` does not exist in table `{$table}`.", 404);
        }

        if ($existing['COLUMN_KEY'] === 'PRI') {
            return $this->error("Primary key column `{$colName}` cannot be dropped.", 403);
        }

        $sql = "ALTER TABLE `{$table}` DROP COLUMN `{$colName}`";
        $db = Database::getConnection();

        try {
            $db->exec($sql);

            // Remove from entity_column_configs if present
            $entityName = null;
            if (in_array($table, ['users', 'user_profiles'])) {
                $entityName = 'users';
            } elseif ($table === 'clients') {
                $entityName = 'clients';
            } elseif ($table === 'projects') {
                $entityName = 'projects';
            }

            if ($entityName) {
                Database::query("
                    DELETE FROM entity_column_configs 
                    WHERE entity = :entity AND column_name = :col
                ", ['entity' => $entityName, 'col' => $colName]);
            }

            $currentUser = $this->user($request);
            ActivityLogger::log(
                $currentUser ? (int)$currentUser['id'] : null,
                'deleted',
                'database',
                null,
                "{$table}.{$colName}",
                "Dropped column `{$colName}` from table `{$table}`",
                null,
                ['table' => $table, 'column' => $colName]
            );

            return $this->success(null, "Column `{$colName}` was permanently deleted from table `{$table}`.");
        } catch (\Throwable $e) {
            return $this->error("Failed to delete column: " . $e->getMessage(), 500);
        }
    }

    private function humanize(string $str): string
    {
        return ucwords(str_replace(['_', '-'], ' ', $str));
    }
}
