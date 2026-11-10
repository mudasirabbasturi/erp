<?php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=imp', 'root', '');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Seed status groups
$groups = [
    [
        'entity' => 'projects',
        'group_name' => 'All Projects',
        'group_slug' => 'all',
        'statuses' => json_encode(['*']),
        'filter_conditions' => null,
        'color' => '#4f46e5',
        'sort_order' => 1,
        'is_system' => 1
    ],
    [
        'entity' => 'projects',
        'group_name' => 'Current Projects',
        'group_slug' => 'current',
        'statuses' => json_encode(['Planned', 'Pending', 'Takeoff On Progress', 'Pricing On Progress']),
        'filter_conditions' => null,
        'color' => '#0284c7',
        'sort_order' => 2,
        'is_system' => 0
    ],
    [
        'entity' => 'projects',
        'group_name' => 'Completed Projects',
        'group_slug' => 'completed',
        'statuses' => json_encode(['Completed', 'Deliver']),
        'filter_conditions' => null,
        'color' => '#059669',
        'sort_order' => 3,
        'is_system' => 0
    ],
    [
        'entity' => 'projects',
        'group_name' => 'Delayed Projects',
        'group_slug' => 'delayed',
        'statuses' => json_encode(['Hold', 'Revision']),
        'filter_conditions' => json_encode(['is_late' => 1]),
        'color' => '#dc2626',
        'sort_order' => 4,
        'is_system' => 0
    ],
    [
        'entity' => 'projects',
        'group_name' => 'On Hold & Cancelled',
        'group_slug' => 'on-hold',
        'statuses' => json_encode(['Hold', 'Cancelled']),
        'filter_conditions' => null,
        'color' => '#d97706',
        'sort_order' => 5,
        'is_system' => 0
    ]
];

$stmt = $pdo->prepare("
    INSERT INTO status_groups (entity, group_name, group_slug, statuses, filter_conditions, color, sort_order, is_system, is_active)
    VALUES (:entity, :group_name, :group_slug, :statuses, :filter_conditions, :color, :sort_order, :is_system, 1)
    ON DUPLICATE KEY UPDATE 
        group_name = VALUES(group_name),
        statuses = VALUES(statuses),
        filter_conditions = VALUES(filter_conditions),
        color = VALUES(color),
        sort_order = VALUES(sort_order)
");

foreach ($groups as $g) {
    $stmt->execute($g);
}

// Also seed projects / clients / status permissions into permissions table if missing
$permissions = [
    // Project permissions
    ['projects', 'view', 'projects.view', 'View Projects Directory & Profiles'],
    ['projects', 'create', 'projects.create', 'Create New Project Record'],
    ['projects', 'edit', 'projects.edit', 'Edit Project Scope & Financials'],
    ['projects', 'delete', 'projects.delete', 'Delete Project Record'],
    ['projects', 'export', 'projects.export', 'Export Projects to Excel/CSV'],
    // Enum status permissions for projects
    ['projects', 'status:Planned', 'projects.status.planned', 'Status: Planned'],
    ['projects', 'status:Pending', 'projects.status.pending', 'Status: Pending'],
    ['projects', 'status:Takeoff On Progress', 'projects.status.takeoff_on_progress', 'Status: Takeoff On Progress'],
    ['projects', 'status:Pricing On Progress', 'projects.status.pricing_on_progress', 'Status: Pricing On Progress'],
    ['projects', 'status:Completed', 'projects.status.completed', 'Status: Completed'],
    ['projects', 'status:Hold', 'projects.status.hold', 'Status: Hold'],
    ['projects', 'status:Revision', 'projects.status.revision', 'Status: Revision'],
    ['projects', 'status:Cancelled', 'projects.status.cancelled', 'Status: Cancelled'],
    ['projects', 'status:Deliver', 'projects.status.deliver', 'Status: Deliver'],
    // Client permissions
    ['clients', 'view', 'clients.view', 'View Clients Directory & Profiles'],
    ['clients', 'create', 'clients.create', 'Create New Client'],
    ['clients', 'edit', 'clients.edit', 'Edit Client Details'],
    ['clients', 'delete', 'clients.delete', 'Delete Client Record'],
    ['clients', 'export', 'clients.export', 'Export Clients to Excel/CSV'],
];

$pStmt = $pdo->prepare("
    INSERT INTO permissions (module, action, slug, label)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE label = VALUES(label), module = VALUES(module), action = VALUES(action)
");

foreach ($permissions as $p) {
    $pStmt->execute($p);
}

echo "Seeded status groups and permissions successfully.\n";

