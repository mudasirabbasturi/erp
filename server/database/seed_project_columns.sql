DELETE FROM `entity_column_configs` WHERE `entity` = 'projects';

INSERT INTO `entity_column_configs` 
(`entity`, `column_name`, `label`, `is_active`, `is_list_visible`, `is_view_visible`, `sort_order`) 
VALUES
('projects', 'project_title', 'Project Title', 1, 1, 1, 1),
('projects', 'client_id', 'Client', 1, 1, 1, 2),
('projects', 'project_progress_status', 'Progress Status', 1, 1, 1, 3),
('projects', 'is_project_late', 'Late Flag', 1, 1, 1, 4),
('projects', 'project_due_date', 'Due Date', 1, 1, 1, 5),
('projects', 'project_total_budget', 'Total Budget', 1, 1, 1, 6),
('projects', 'project_deduction_amount', 'Deduction Amount', 1, 1, 1, 7),
('projects', 'project_points', 'Points', 1, 1, 1, 8),
('projects', 'project_construction_type', 'Construction Type', 1, 1, 1, 9),
('projects', 'project_source', 'Source', 1, 1, 1, 10),
('projects', 'project_address', 'Project Address', 1, 1, 1, 11),
('projects', 'project_area', 'Project Area / SF', 1, 0, 1, 12),
('projects', 'project_floor_number', 'Floor Number', 1, 0, 1, 13),
('projects', 'project_main_scope', 'Main Scope', 1, 0, 1, 14),
('projects', 'project_scope_details', 'Scope Details', 1, 0, 1, 15),
('projects', 'project_template', 'Template', 1, 0, 1, 16),
('projects', 'project_pricing', 'Pricing Mode', 1, 0, 1, 17),
('projects', 'project_line_items_pricing', 'Line Items Pricing', 1, 0, 1, 18),
('projects', 'project_init_link', 'Initial Drawing Link', 1, 0, 1, 19),
('projects', 'project_final_link', 'Final Takeoff Link', 1, 0, 1, 20),
('projects', 'project_admin_notes', 'Admin Notes', 1, 0, 1, 21),
('projects', 'project_notes', 'Project Notes', 1, 0, 1, 22),
('projects', 'project_private_notes', 'Private Notes', 1, 0, 1, 23),
('projects', 'project_preview_status', 'Preview Status', 1, 0, 1, 24),
('projects', 'created_at', 'Created Date', 1, 1, 1, 25),
('projects', 'updated_at', 'Updated Date', 1, 0, 1, 26);

