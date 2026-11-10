-- ========================================================
-- IMP (Internal Management Platform) Master Database Schema
-- Database: imp
-- Character Set: utf8mb4 / utf8mb4_unicode_ci
-- ========================================================

CREATE DATABASE IF NOT EXISTS `imp` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `imp`;

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- 1. ROLES & PERMISSIONS
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `roles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `module` VARCHAR(50) NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `label` VARCHAR(150) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_perm_module` (`module`),
  INDEX `idx_perm_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id` BIGINT UNSIGNED NOT NULL,
  `permission_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 2. DYNAMIC MENUS & ROLE MENU ACCESS
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `menus` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `parent_id` BIGINT UNSIGNED NULL,
  `title` VARCHAR(100) NOT NULL,
  `route_path` VARCHAR(255) NOT NULL,
  `icon` VARCHAR(50) DEFAULT 'AppstoreOutlined',
  `badge_text` VARCHAR(50) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `module_key` VARCHAR(50) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_menus_parent` (`parent_id`),
  INDEX `idx_menus_sort` (`sort_order`),
  CONSTRAINT `fk_menus_parent` FOREIGN KEY (`parent_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role_menu_permissions` (
  `role_id` BIGINT UNSIGNED NOT NULL,
  `menu_id` BIGINT UNSIGNED NOT NULL,
  `can_view` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`role_id`, `menu_id`),
  CONSTRAINT `fk_rmp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rmp_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 3. DYNAMIC COLUMN / FIELD-LEVEL PERMISSIONS
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `field_level_permissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_id` BIGINT UNSIGNED NOT NULL,
  `entity` VARCHAR(50) NOT NULL,
  `field_name` VARCHAR(100) NOT NULL,
  `can_view` TINYINT(1) NOT NULL DEFAULT 1,
  `can_edit` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_entity_field` (`role_id`, `entity`, `field_name`),
  CONSTRAINT `fk_flp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 4. USERS & EXTENSIONS
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role_id` BIGINT UNSIGNED NOT NULL,
  `is_super_admin` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  `last_active_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_role` (`role_id`),
  INDEX `idx_users_super_admin` (`is_super_admin`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `token` VARCHAR(64) NOT NULL UNIQUE,
  `name` VARCHAR(100) DEFAULT 'api_token',
  `last_used_at` TIMESTAMP NULL DEFAULT NULL,
  `expires_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ut_token` (`token`),
  CONSTRAINT `fk_ut_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_profiles` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NULL,
  `avatar_media_id` BIGINT UNSIGNED NULL,
  `dob` DATE NULL,
  `gender` ENUM('male', 'female', 'other') NULL,
  `hiring_date` DATE NULL,
  `joining_date` DATE NULL,
  `leaving_date` DATE NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_bank_accounts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `wallet_type` ENUM('bank_account', 'jazzcash', 'easypaisa', 'nayapay', 'sadapay', 'other') NOT NULL DEFAULT 'bank_account',
  `account_title` VARCHAR(255) NOT NULL,
  `account_number_or_iban` VARCHAR(100) NOT NULL,
  `bank_name` VARCHAR(100) NULL,
  `branch_code_or_name` VARCHAR(100) NULL,
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_uba_user` (`user_id`),
  CONSTRAINT `fk_uba_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_addresses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `address_type` ENUM('current', 'permanent', 'office') NOT NULL DEFAULT 'current',
  `address_line_1` TEXT NOT NULL,
  `address_line_2` TEXT NULL,
  `city` VARCHAR(100) NOT NULL,
  `state` VARCHAR(100) NULL,
  `postal_code` VARCHAR(50) NULL,
  `country` VARCHAR(100) NOT NULL DEFAULT 'Pakistan',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ua_user` (`user_id`),
  CONSTRAINT `fk_ua_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_references` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `relationship` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NULL,
  `organization` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ur_user` (`user_id`),
  CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_meta` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `meta_key` VARCHAR(100) NOT NULL,
  `meta_value` LONGTEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_um_user_key` (`user_id`, `meta_key`),
  CONSTRAINT `fk_um_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 5. CLIENTS
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `clients` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `company_name` VARCHAR(255) NULL,
  `client_type` ENUM('admin', 'normal') NOT NULL DEFAULT 'normal',
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NULL,
  `address` TEXT NULL,
  `notes` TEXT NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_clients_type` (`client_type`),
  INDEX `idx_clients_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 6. PROJECT LOOKUPS & MASTER PROJECTS
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `project_statuses` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `badge_color` VARCHAR(30) DEFAULT '#3B82F6',
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ps_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_preview_statuses` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `badge_color` VARCHAR(30) DEFAULT '#10B981',
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_sources` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `projects` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_code` VARCHAR(50) NOT NULL UNIQUE,
  `project_title` VARCHAR(500) NOT NULL,
  `client_id` BIGINT UNSIGNED NOT NULL,
  `project_address` TEXT NULL,
  `construction_type` ENUM('commercial', 'residential', 'industrial', 'mixed') DEFAULT 'commercial',
  `project_area` VARCHAR(100) NULL,
  `floor_number` VARCHAR(100) NULL,
  `main_scope` TEXT NULL,
  `scope_details` TEXT NULL,
  `project_template` VARCHAR(100) NULL,
  `budget_total` DECIMAL(12,2) DEFAULT 0.00,
  `deduction_amount` DECIMAL(12,2) DEFAULT 0.00,
  `project_points` INT DEFAULT 0,
  `due_date` DATE NULL,
  `status_id` INT UNSIGNED NOT NULL,
  `preview_status_id` INT UNSIGNED NOT NULL,
  `source_id` INT UNSIGNED NOT NULL,
  `is_late` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_prj_code` (`project_code`),
  INDEX `idx_prj_client` (`client_id`),
  INDEX `idx_prj_status` (`status_id`),
  INDEX `idx_prj_due` (`due_date`),
  INDEX `idx_prj_source` (`source_id`),
  CONSTRAINT `fk_prj_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `fk_prj_status` FOREIGN KEY (`status_id`) REFERENCES `project_statuses` (`id`),
  CONSTRAINT `fk_prj_prev_status` FOREIGN KEY (`preview_status_id`) REFERENCES `project_preview_statuses` (`id`),
  CONSTRAINT `fk_prj_source` FOREIGN KEY (`source_id`) REFERENCES `project_sources` (`id`),
  CONSTRAINT `fk_prj_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_links` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` BIGINT UNSIGNED NOT NULL,
  `link_type` VARCHAR(50) NOT NULL,
  `label` VARCHAR(150) NOT NULL,
  `url` TEXT NOT NULL,
  `added_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pl_project` (`project_id`),
  CONSTRAINT `fk_pl_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pl_user` FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_notes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` BIGINT UNSIGNED NOT NULL,
  `note_type` VARCHAR(50) NOT NULL,
  `content` TEXT NOT NULL,
  `is_private` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pn_project` (`project_id`),
  CONSTRAINT `fk_pn_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pn_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_team_members` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `member_role` VARCHAR(100) DEFAULT 'Estimator',
  `member_status` ENUM('assigned', 'in_progress', 'needs_review', 'completed', 'on_hold') NOT NULL DEFAULT 'in_progress',
  `started_at` DATE NULL,
  `completed_at` DATE NULL,
  `points_gain` DECIMAL(10,2) DEFAULT 0.00,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ptm_project` (`project_id`),
  INDEX `idx_ptm_user` (`user_id`),
  CONSTRAINT `fk_ptm_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ptm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_workflow_steps` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `step_name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_member_steps` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `team_member_id` BIGINT UNSIGNED NOT NULL,
  `step_id` INT UNSIGNED NOT NULL,
  `is_completed` TINYINT(1) NOT NULL DEFAULT 0,
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pms_member` (`team_member_id`),
  CONSTRAINT `fk_pms_member` FOREIGN KEY (`team_member_id`) REFERENCES `project_team_members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pms_step` FOREIGN KEY (`step_id`) REFERENCES `project_workflow_steps` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 7. WORDPRESS-STYLE DYNAMIC CUSTOM FIELDS
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `custom_field_definitions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entity_type` ENUM('project', 'user', 'client') NOT NULL DEFAULT 'project',
  `field_key` VARCHAR(100) NOT NULL,
  `field_label` VARCHAR(150) NOT NULL,
  `field_type` ENUM('text', 'number', 'decimal', 'date', 'select', 'multiselect', 'file', 'textarea') NOT NULL DEFAULT 'text',
  `options_json` TEXT NULL,
  `is_required` TINYINT(1) NOT NULL DEFAULT 0,
  `show_in_table` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cfd_entity_key` (`entity_type`, `field_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_meta` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` BIGINT UNSIGNED NOT NULL,
  `meta_key` VARCHAR(100) NOT NULL,
  `meta_value` LONGTEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pm_proj_key` (`project_id`, `meta_key`),
  CONSTRAINT `fk_pm_proj` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 8. WORDPRESS-STYLE MEDIA MANAGEMENT
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `media` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `stored_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_type` ENUM('image', 'document', 'spreadsheet', 'archive', 'other') NOT NULL DEFAULT 'other',
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` BIGINT UNSIGNED NOT NULL,
  `dimensions` VARCHAR(50) NULL,
  `caption` VARCHAR(255) NULL,
  `is_public` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_media_user` (`user_id`),
  INDEX `idx_media_type` (`file_type`),
  CONSTRAINT `fk_media_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 9. GLOBAL SYSTEM SETTINGS (REPLACES payroll_configs)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_group` VARCHAR(50) NOT NULL DEFAULT 'general',
  `setting_key` VARCHAR(100) NOT NULL UNIQUE,
  `setting_value` LONGTEXT NOT NULL,
  `value_type` ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string',
  `description` VARCHAR(255) NULL,
  `is_public` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ss_group` (`setting_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 10. SEED INITIAL CORE DATA
-- --------------------------------------------------------

-- Initial Roles
INSERT INTO `roles` (`id`, `name`, `slug`, `description`, `is_system`) VALUES
(1, 'Super Admin', 'super-admin', 'Master Administrator with total unrestricted bypass permissions', 1),
(2, 'Administrator', 'admin', 'System Administrator', 1),
(3, 'Project Manager', 'project-manager', 'Manages assignments, reviews, and estimators', 0),
(4, 'Estimator', 'estimator', 'Prepares takeoffs, line items, and scope pricing', 0),
(5, 'Reviewer / QA', 'reviewer-qa', 'Reviews takeoffs and pricing scopes', 0);

-- Initial Super Admin User (Password: Admin@12345)
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `role_id`, `is_super_admin`, `status`) VALUES
(1, 'superadmin', 'admin@imp.internal', '$2y$10$snGQ9Qb3vQvHqW0dyFHaNOrk5RtrsoIKdv7Nq.1XFI.bOWsDR1lcG', 1, 1, 'active');

INSERT INTO `user_profiles` (`user_id`, `full_name`, `phone`, `gender`, `notes`) VALUES
(1, 'Master Super Admin', '+923000000000', 'male', 'System Protected Account');

-- Initial Project Statuses
INSERT INTO `project_statuses` (`id`, `code`, `name`, `badge_color`, `sort_order`, `is_active`) VALUES
(1, 'planned', 'Planned', '#8B5CF6', 1, 1),
(2, 'pending', 'Pending', '#F59E0B', 2, 1),
(3, 'takeoff_progress', 'Takeoff On Progress', '#3B82F6', 3, 1),
(4, 'pricing_progress', 'Pricing On Progress', '#06B6D4', 4, 1),
(5, 'completed', 'Completed', '#10B981', 5, 1),
(6, 'hold', 'Hold', '#EF4444', 6, 1),
(7, 'revision', 'Revision', '#EC4899', 7, 1),
(8, 'cancelled', 'Cancelled', '#6B7280', 8, 1),
(9, 'deliver', 'Deliver', '#059669', 9, 1);

-- Initial Preview Statuses
INSERT INTO `project_preview_statuses` (`id`, `code`, `name`, `badge_color`, `sort_order`, `is_active`) VALUES
(1, 'active', 'Active', '#10B981', 1, 1),
(2, 'draft', 'Draft', '#F59E0B', 2, 1),
(3, 'archived', 'Archived', '#6B7280', 3, 1);

-- Initial Project Sources
INSERT INTO `project_sources` (`id`, `code`, `name`, `description`, `is_active`) VALUES
(1, 'in_source', 'InSource', 'In-house sourced projects', 1),
(2, 'out_source', 'OutSource', 'Externally outsourced bids', 1),
(3, 'direct_client', 'Direct Client', 'Direct client inbound request', 1);

-- Initial Dynamic Menus (Super Admin Managed)
INSERT INTO `menus` (`id`, `parent_id`, `title`, `route_path`, `icon`, `badge_text`, `sort_order`, `module_key`, `is_active`) VALUES
(1, NULL, 'Dashboard', '/dashboard', 'DashboardOutlined', NULL, 1, 'dashboard', 1),
(2, NULL, 'Projects', '/projects', 'ProjectOutlined', NULL, 2, 'projects', 1),
(3, 2, 'All Projects', '/projects', 'UnorderedListOutlined', NULL, 1, 'projects', 1),
(4, 2, 'My Projects', '/projects/my-projects', 'UserOutlined', NULL, 2, 'projects', 1),
(5, 2, 'Project Statuses', '/projects/statuses', 'TagsOutlined', NULL, 3, 'projects', 1),
(6, NULL, 'User Management', '/users', 'TeamOutlined', NULL, 3, 'users', 1),
(7, 6, 'All Users', '/users', 'UsergroupAddOutlined', NULL, 1, 'users', 1),
(8, 6, 'Roles & Permissions', '/roles', 'SafetyOutlined', NULL, 2, 'roles', 1),
(9, 6, 'Navigation Menus', '/menus', 'MenuOutlined', 'SuperAdmin', 3, 'menus', 1),
(10, NULL, 'Clients', '/clients', 'ContactsOutlined', NULL, 4, 'clients', 1),
(11, NULL, 'Media Library', '/media', 'PictureOutlined', NULL, 5, 'media', 1),
(12, NULL, 'Custom Fields', '/custom-fields', 'AppstoreAddOutlined', NULL, 6, 'custom_fields', 1),
(13, NULL, 'Settings', '/settings', 'SettingOutlined', NULL, 7, 'settings', 1);

-- Initial System Settings
INSERT INTO `system_settings` (`setting_group`, `setting_key`, `setting_value`, `value_type`, `description`, `is_public`) VALUES
('general', 'company_name', 'Internal Management Platform', 'string', 'Official company title', 1),
('general', 'default_currency', 'PKR', 'string', 'Default currency code', 1),
('general', 'currency_symbol', 'Rs.', 'string', 'Currency symbol display', 1),
('media', 'max_upload_size_mb', '50', 'number', 'Maximum allowed upload file size in megabytes', 1),
('media', 'allowed_extensions', 'jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,csv,zip,dwg', 'string', 'Allowed file extensions', 1);

SET FOREIGN_KEY_CHECKS = 1;
