<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;

class ColumnConfigController extends Controller
{
    /**
     * Get configured columns for an entity (e.g. 'users')
     */
    public function getEntityColumns(Request $request): Response
    {
        $entity = $request->param('entity') ?: 'users';

        // 1. Fetch live DB columns to ensure all existing columns are listed
        if ($entity === 'users') {
            $usersCols = Database::fetchAll("SHOW FULL COLUMNS FROM users");
            $profileCols = Database::fetchAll("SHOW FULL COLUMNS FROM user_profiles");
            $allCols = array_merge($usersCols, $profileCols);
        } else {
            $table = preg_replace('/[^a-z0-9_]/', '', strtolower($entity));
            $allCols = Database::fetchAll("SHOW FULL COLUMNS FROM `{$table}`");
        }

        // Existing saved configs
        $saved = Database::fetchAll("SELECT * FROM entity_column_configs WHERE entity = :entity ORDER BY sort_order ASC, id ASC", [
            'entity' => $entity
        ]);
        $savedMap = [];
        foreach ($saved as $s) {
            $savedMap[$s['column_name']] = $s;
        }

        $result = [];
        $idx = 1;

        foreach ($allCols as $col) {
            $fieldName = $col['Field'];
            // Skip technical internal primary keys from manual config
            if (in_array($fieldName, ['id', 'user_id', 'deleted_at'])) {
                continue;
            }

            if (isset($savedMap[$fieldName])) {
                $result[] = $savedMap[$fieldName];
            } else {
                $label = !empty($col['Comment']) ? $col['Comment'] : ucwords(str_replace('_', ' ', $fieldName));
                $result[] = [
                    'id'              => null,
                    'entity'          => $entity,
                    'column_name'     => $fieldName,
                    'label'           => $label,
                    'is_active'       => 1,
                    'is_list_visible' => 1,
                    'is_view_visible' => 1,
                    'sort_order'      => $idx++
                ];
            }
        }

        return $this->success($result, 'Entity column configurations retrieved');
    }

    /**
     * Save active / fetched columns configuration for an entity
     */
    public function saveEntityColumns(Request $request): Response
    {
        $entity = $request->param('entity') ?: 'users';
        $columns = $request->input('columns');

        if (!is_array($columns)) {
            return $this->error('Columns must be an array of configuration objects.', 422);
        }

        Database::beginTransaction();
        try {
            foreach ($columns as $idx => $item) {
                if (!empty($item['column_name'])) {
                    Database::query("
                        INSERT INTO entity_column_configs (entity, column_name, label, is_active, is_list_visible, is_view_visible, sort_order)
                        VALUES (:entity, :col, :label, :active, :list, :view, :sort)
                        ON DUPLICATE KEY UPDATE
                            label = VALUES(label),
                            is_active = VALUES(is_active),
                            is_list_visible = VALUES(is_list_visible),
                            is_view_visible = VALUES(is_view_visible),
                            sort_order = VALUES(sort_order)
                    ", [
                        'entity' => $entity,
                        'col'    => $item['column_name'],
                        'label'  => $item['label'] ?? $item['column_name'],
                        'active' => !empty($item['is_active']) ? 1 : 0,
                        'list'   => !empty($item['is_list_visible']) ? 1 : 0,
                        'view'   => !empty($item['is_view_visible']) ? 1 : 0,
                        'sort'   => $idx + 1
                    ]);
                }
            }

            Database::commit();
            return $this->success(null, 'Column configurations saved successfully.');
        } catch (\Throwable $e) {
            Database::rollBack();
            return $this->error('Failed to save column configurations: ' . $e->getMessage(), 500);
        }
    }
}

