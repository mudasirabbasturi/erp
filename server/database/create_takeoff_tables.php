<?php
$basePath = 'D:/rehan/ERP/server';
require_once $basePath . '/core/App.php';
\Core\App::bootstrap($basePath);

use Core\Database;

$sql = "
CREATE TABLE IF NOT EXISTS `takeoff_sessions` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `workspace_id` INT UNSIGNED DEFAULT 1,
    `project_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('draft', 'final', 'archived') DEFAULT 'draft',
    `default_scale_id` BIGINT UNSIGNED NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    INDEX `idx_ts_project` (`project_id`),
    INDEX `idx_ts_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `takeoff_blueprints` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `session_id` BIGINT UNSIGNED NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `storage_path` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `file_size` BIGINT UNSIGNED NOT NULL,
    `page_count` INT UNSIGNED DEFAULT 1,
    `thumbnail_path` VARCHAR(500) NULL,
    `uploaded_by` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    INDEX `idx_tb_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `takeoff_scales` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `session_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `pixels_per_unit` DECIMAL(12, 4) NOT NULL,
    `unit` ENUM('m', 'ft', 'in', 'cm', 'mm') NOT NULL DEFAULT 'ft',
    `calibration_points` JSON NULL,
    `is_default` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_tsc_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `takeoff_assemblies` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `session_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `unit` VARCHAR(30) NOT NULL DEFAULT 'sq ft',
    `unit_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `currency` VARCHAR(10) DEFAULT 'USD',
    `waste_factor` DECIMAL(5, 2) DEFAULT 0.00,
    `labor_rate` DECIMAL(12, 2) DEFAULT 0.00,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_ta_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `takeoff_assembly_items` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `assembly_id` BIGINT UNSIGNED NOT NULL,
    `material_name` VARCHAR(255) NOT NULL,
    `unit` VARCHAR(30) NOT NULL DEFAULT 'unit',
    `quantity_per_assembly_unit` DECIMAL(10, 3) NOT NULL DEFAULT 1.000,
    `unit_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `supplier` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_tai_assembly` (`assembly_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `takeoff_measurements` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `session_id` BIGINT UNSIGNED NOT NULL,
    `blueprint_id` BIGINT UNSIGNED NULL,
    `page_number` INT UNSIGNED DEFAULT 1,
    `type` ENUM('rect', 'line', 'polygon', 'count', 'volume') NOT NULL,
    `geometry` JSON NOT NULL,
    `raw_quantity` DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    `unit` VARCHAR(30) NOT NULL DEFAULT 'ft',
    `computed_quantity` DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    `depth` DECIMAL(10, 3) NULL DEFAULT NULL,
    `scale_id` BIGINT UNSIGNED NULL,
    `assembly_id` BIGINT UNSIGNED NULL,
    `label` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `color` VARCHAR(30) DEFAULT '#4f46e5',
    `created_by` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    INDEX `idx_tm_session_page` (`session_id`, `page_number`),
    INDEX `idx_tm_type` (`session_id`, `type`),
    INDEX `idx_tm_assembly` (`assembly_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `takeoff_exports` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `session_id` BIGINT UNSIGNED NOT NULL,
    `format` VARCHAR(10) NOT NULL,
    `storage_path` VARCHAR(500) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_te_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
";

try {
    Database::getConnection()->exec($sql);
    echo "Takeoff tables created successfully!\n";
} catch (\Throwable $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}

