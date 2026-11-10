-- Create projects table with user-requested column renames and structure
CREATE TABLE IF NOT EXISTS `projects` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_title` varchar(500) DEFAULT NULL,
  `project_address` text DEFAULT NULL,
  `client_id` bigint(20) UNSIGNED DEFAULT NULL,
  `project_pricing` varchar(255) DEFAULT NULL,
  `project_area` varchar(255) DEFAULT NULL,
  `project_construction_type` enum('commercial','residential') DEFAULT NULL,
  `project_line_items_pricing` varchar(255) DEFAULT NULL,
  `project_floor_number` varchar(255) DEFAULT NULL,
  `project_main_scope` text DEFAULT NULL,
  `project_scope_details` text DEFAULT NULL,
  `project_template` varchar(255) DEFAULT NULL,
  `project_init_link` text DEFAULT NULL,
  `project_final_link` text DEFAULT NULL,
  `project_admin_notes` text DEFAULT NULL,
  `project_notes` text DEFAULT NULL,
  `project_private_notes` text DEFAULT NULL,
  `project_total_budget` decimal(10,2) DEFAULT NULL,
  `project_deduction_amount` decimal(10,2) DEFAULT NULL,
  `project_due_date` date DEFAULT NULL,
  `project_points` int(11) DEFAULT NULL,
  `project_progress_status` enum('Planned','Pending','Takeoff On Progress','Pricing On Progress','Completed','Hold','Revision','Cancelled','Deliver') NOT NULL DEFAULT 'Pending',
  `project_source` enum('InSource','OutSource') DEFAULT NULL,
  `project_preview_status` enum('active','draft') NOT NULL DEFAULT 'active',
  `is_project_late` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_client_id_foreign` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample starter project records for instant testing of Table & Master-Detail views
INSERT INTO `projects` 
(`id`, `project_title`, `project_address`, `client_id`, `project_pricing`, `project_area`, `project_construction_type`, `project_line_items_pricing`, `project_floor_number`, `project_main_scope`, `project_scope_details`, `project_template`, `project_init_link`, `project_final_link`, `project_admin_notes`, `project_notes`, `project_private_notes`, `project_total_budget`, `project_deduction_amount`, `project_due_date`, `project_points`, `project_progress_status`, `project_source`, `project_preview_status`, `is_project_late`, `created_at`, `updated_at`) 
VALUES
(1, 'Locklear Naar Residence', 'LOT 20, ISLAND POINT ROAD CHARLOTTE, NORTH CAROLINA', 19, 'no', '8044', 'residential', NULL, '2', 'Drywall & Paint - NOTE: 4x12 sheets FOR DRYWALL', 'Drywall Painting', '1.0', 'https://drive.google.com/drive/folders/1MJ-fFrf9IAQgcWBHIVZb2M-o3YisBTA4', 'https://drive.google.com/drive/folders/1-NpCB9dWjWgJ-1KiXf5DgO3wbWIUBOLA', 'High priority client project', 'Check gypsum sheet alignment', 'Estimator assigned: Moeez', 12500.00, 250.00, DATE_ADD(CURDATE(), INTERVAL 5 DAY), 85, 'Takeoff On Progress', 'InSource', 'active', 0, NOW(), NOW()),
(2, 'VERSACE THE PLAZA - KING OF PRUSSIA', 'SPACE C201A 160 N. GULPH ROAD KING OF PRUSSIA, PA 19406', 20, 'yes', '5400', 'commercial', '84', '1', 'Millwork Lighting Plan, Fixture Plan, Interior Elevations, Store front Elevations', 'Commercial retail millwork estimation', '2.2', 'https://drive.google.com/file/d/1hum1rJmV7_M6AejJ-meryTkUq-xV_u-6/view', 'https://drive.google.com/drive/folders/10BxtskseAvHCSTnzi9R_ZJaBM8ENt43o', 'Expedited review requested by client', 'Labor estimation only', 'Internal margin 28%', 28400.00, 500.00, DATE_ADD(CURDATE(), INTERVAL 2 DAY), 95, 'Pricing On Progress', 'InSource', 'active', 0, NOW(), NOW()),
(3, 'PROPOSED ADDITION TO EXISTING 2-STORY RESIDENCE', '65 CARNATION RD, NY 11756', 21, 'yes', '3200', 'residential', NULL, '2', 'Cost estimation and complete material takeoff', 'Navien boiler, recessed lighting, hardwood floors', '2.2', NULL, 'https://drive.google.com/drive/folders/1bobcak37SyP9LNPXx1iieyHWicQEXgCH', 'Hardwood floor revision pending', 'Check HVAC heatpump specs', 'Client requested quick turnaround', 9800.00, 0.00, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 60, 'Revision', 'InSource', 'active', 1, NOW(), NOW()),
(4, 'NOMI SQUARE PROPOSED MIXED USE PROJECT', '13855 NW 17TH AVENUE NORTH MIAMI, FLORIDA 3316', 22, 'no', '1 Building 1 trash 1 Club House', 'commercial', NULL, '7 Floor', 'Takeoff stucco and painting (interior and exterior), total AC square, corner beads', 'Stucco & Paint Takeoff', '1.0', 'https://drive.google.com/file/d/19zSY_D0JPYFUMxrQy_deJ5VGCNcikMsJ/view', 'https://drive.google.com/drive/folders/1M8yZ8ZLXYqAjzErNX8cGh09OZUM7D_En', 'Large multi-story development', 'Verify yard counts', 'Requires senior signoff', 45000.00, 1200.00, DATE_ADD(CURDATE(), INTERVAL 12 DAY), 120, 'Planned', 'OutSource', 'active', 0, NOW(), NOW()),
(5, 'Meddys Restaurant', 'No. 7 6301 Brookside Plaza Kansas City, MO. 64113', 23, 'yes', '3009', 'commercial', NULL, '1', 'Cost estimate and complete material takeoff', 'General Contracting scope', '2.2', NULL, 'https://drive.google.com/drive/folders/1HXsJREgIzqg0CRju9QnO1hLJQWd4zknd', 'Delivered to client on schedule', 'Customer accepted bid', 'Completed and archived', 15200.00, 0.00, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 75, 'Deliver', 'InSource', 'active', 0, NOW(), NOW());

