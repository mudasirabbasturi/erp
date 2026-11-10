<?php
$basePath = dirname(__DIR__);
require_once $basePath . '/core/App.php';
\Core\App::bootstrap($basePath);

use Core\Database;

try {
    // 1. Create project_clients table
    Database::query("
        CREATE TABLE IF NOT EXISTS `project_clients` (
          `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          `project_id` BIGINT UNSIGNED NOT NULL,
          `client_id` BIGINT UNSIGNED NOT NULL,
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uq_project_client` (`project_id`, `client_id`),
          INDEX `idx_pc_project` (`project_id`),
          INDEX `idx_pc_client` (`client_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    echo "project_clients table verified/created.\n";

    // 2. Populate existing client_id from projects table into project_clients
    $existing = Database::fetchAll("
        SELECT id, client_id 
        FROM projects 
        WHERE client_id IS NOT NULL AND client_id > 0
    ");

    $migrated = 0;
    foreach ($existing as $row) {
        $pId = (int)$row['id'];
        $cId = (int)$row['client_id'];

        $exists = Database::fetch(
            "SELECT id FROM project_clients WHERE project_id = :p AND client_id = :c",
            ['p' => $pId, 'c' => $cId]
        );

        if (!$exists) {
            Database::insert('project_clients', [
                'project_id' => $pId,
                'client_id'  => $cId,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ]);
            $migrated++;
        }
    }

    echo "Migrated {$migrated} existing project-client links.\n";
    echo "Migration completed successfully.\n";

} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
