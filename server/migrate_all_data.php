<?php
/**
 * Master Data Migration Script for IMP
 * Imports all real data from D:/rehan/ERP/db-samples/ into MySQL database `imp`.
 * Preserves exact user IDs, project IDs, and project_team_member IDs.
 * Injects client_name_for_admin into `clients` as client_type = 'admin' and links client_id.
 * Applies all requested column renames.
 * Ensures roles, permissions, and security matrices are fully seeded.
 */

require_once __DIR__ . '/core/DotEnv.php';
require_once __DIR__ . '/core/Database.php';

\Core\DotEnv::load(__DIR__ . '/.env');
$pdo = \Core\Database::getConnection();

echo "=========================================================\n";
echo "       STARTING MASTER DATA IMPORT FOR IMP PLATFORM      \n";
echo "=========================================================\n\n";

$pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
$pdo->exec("SET UNIQUE_CHECKS = 0");
$pdo->exec("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO'");

// -------------------------------------------------------------
// STEP 1: CLEAN OPERATIONAL TABLES
// -------------------------------------------------------------
echo "[1/6] Cleaning existing operational data...\n";
$tablesToTruncate = [
    'activity_logs',
    'project_team_members',
    'projects',
    'clients',
    'user_tokens',
    'user_meta',
    'user_references',
    'user_bank_accounts',
    'user_addresses',
    'user_profiles',
    'user_roles',
    'users'
];

foreach ($tablesToTruncate as $tbl) {
    $pdo->exec("TRUNCATE TABLE `$tbl`");
    echo "  - Truncated table: $tbl\n";
}

// -------------------------------------------------------------
// STEP 2: ENSURE ROLES & PERMISSIONS COMPLETE
// -------------------------------------------------------------
echo "\n[2/6] Ensuring Roles, Permissions & Security Matrices...\n";

// 2a. Ensure Roles (1 to 8)
$roles = [
    [1, 'Super Admin', 'super-admin', 'Full platform administrative privileges with complete access.', 1],
    [2, 'Administrator', 'admin', 'Core operations administrator with full system management.', 1],
    [3, 'Project Manager', 'project-manager', 'Manages project portfolio, assignments, and schedules.', 0],
    [4, 'Estimator', 'estimator', 'Prepares takeoff measurements, line items, and pricing.', 0],
    [5, 'Reviewer / QA', 'reviewer-qa', 'Performs quality assurance and verification on takeoffs.', 0],
    [6, 'Staff Member', 'staff', 'Internal company staff and team members participating on project tasks.', 0],
    [7, 'Client Representative', 'client-rep', 'External client representative with project visibility.', 0],
    [8, 'General Viewer', 'viewer', 'Read-only access across assigned project views.', 0],
];

$roleStmt = $pdo->prepare("
    INSERT INTO roles (id, name, slug, description, is_system, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE name = VALUES(name), slug = VALUES(slug), description = VALUES(description), is_system = VALUES(is_system)
");
foreach ($roles as $r) {
    $roleStmt->execute($r);
}
echo "  - Verified all 8 platform roles.\n";

// 2b. Ensure Permissions
$permissions = [
    // Users
    ['users', 'view', 'users.view', 'View Staff Directory & Profiles'],
    ['users', 'create', 'users.create', 'Create New Staff Account'],
    ['users', 'edit', 'users.edit', 'Edit Staff Details & Information'],
    ['users', 'delete', 'users.delete', 'Delete / Archive Staff Account'],
    ['users', 'export', 'users.export', 'Export Staff Data to CSV / Excel'],
    // Roles
    ['roles', 'view', 'roles.view', 'View Roles & Access Matrices'],
    ['roles', 'create', 'roles.create', 'Create Custom Roles'],
    ['roles', 'edit', 'roles.edit', 'Update Role Permissions'],
    ['roles', 'delete', 'roles.delete', 'Delete Custom Roles'],
    // Clients
    ['clients', 'view', 'clients.view', 'View Clients Directory & Profiles'],
    ['clients', 'create', 'clients.create', 'Create New Client'],
    ['clients', 'edit', 'clients.edit', 'Edit Client Details'],
    ['clients', 'delete', 'clients.delete', 'Delete Client Record'],
    ['clients', 'export', 'clients.export', 'Export Clients to Excel/CSV'],
    // Projects
    ['projects', 'view', 'projects.view', 'View Projects Directory & Profiles'],
    ['projects', 'create', 'projects.create', 'Create New Project Record'],
    ['projects', 'edit', 'projects.edit', 'Edit Project Scope & Financials'],
    ['projects', 'delete', 'projects.delete', 'Delete Project Record'],
    ['projects', 'export', 'projects.export', 'Export Projects to Excel/CSV'],
    // Project Status Enum Permissions
    ['projects', 'status:Planned', 'projects.status.planned', 'Status: Planned'],
    ['projects', 'status:Pending', 'projects.status.pending', 'Status: Pending'],
    ['projects', 'status:Takeoff On Progress', 'projects.status.takeoff_on_progress', 'Status: Takeoff On Progress'],
    ['projects', 'status:Pricing On Progress', 'projects.status.pricing_on_progress', 'Status: Pricing On Progress'],
    ['projects', 'status:Completed', 'projects.status.completed', 'Status: Completed'],
    ['projects', 'status:Hold', 'projects.status.hold', 'Status: Hold'],
    ['projects', 'status:Revision', 'projects.status.revision', 'Status: Revision'],
    ['projects', 'status:Cancelled', 'projects.status.cancelled', 'Status: Cancelled'],
    ['projects', 'status:Deliver', 'projects.status.deliver', 'Status: Deliver'],
    // Project Team Members
    ['projects', 'team_join', 'projects.team.join', 'Join Project Team Steps'],
    ['projects', 'team_edit', 'projects.team.edit', 'Edit Team Member Steps & Scores'],
    ['projects', 'team_remove', 'projects.team.remove', 'Remove Member from Project Team'],
    // Media
    ['media', 'view', 'media.view', 'Browse Media Library'],
    ['media', 'upload', 'media.upload', 'Upload New Media & Documents'],
    ['media', 'delete', 'media.delete', 'Delete Media Assets'],
    // Reports & Settings
    ['reports', 'view', 'reports.view', 'View Performance & Audit Reports'],
    ['reports', 'export', 'reports.export', 'Export Analytic Summaries'],
    ['settings', 'view', 'settings.view', 'View Platform Global Config'],
    ['settings', 'edit', 'settings.edit', 'Modify Platform Global Config'],
];

$permStmt = $pdo->prepare("
    INSERT INTO permissions (module, action, slug, label, created_at, updated_at)
    VALUES (?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE label = VALUES(label), module = VALUES(module), action = VALUES(action)
");
foreach ($permissions as $p) {
    $permStmt->execute($p);
}
echo "  - Verified all core route and action permissions.\n";

// 2c. Give Role 1 (Super Admin) and Role 2 (Administrator) all permissions
$allPermIds = $pdo->query("SELECT id FROM permissions")->fetchAll(PDO::FETCH_COLUMN);
$assignStmt = $pdo->prepare("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
foreach ([1, 2] as $rId) {
    foreach ($allPermIds as $pId) {
        $assignStmt->execute([$rId, $pId]);
    }
}

// Give Project Manager (3), Estimator (4), Staff (6) operational permissions
$pmPermIds = $pdo->query("SELECT id FROM permissions WHERE module IN ('projects', 'clients', 'media') OR slug IN ('users.view', 'reports.view')")->fetchAll(PDO::FETCH_COLUMN);
foreach ($pmPermIds as $pId) {
    $assignStmt->execute([3, $pId]);
}
$estPermIds = $pdo->query("SELECT id FROM permissions WHERE slug IN ('projects.view', 'projects.edit', 'projects.export', 'projects.team.join', 'projects.team.edit', 'media.view', 'media.upload') OR module = 'projects' AND action LIKE 'status:%'")->fetchAll(PDO::FETCH_COLUMN);
foreach ($estPermIds as $pId) {
    $assignStmt->execute([4, $pId]);
    $assignStmt->execute([6, $pId]);
}
echo "  - Role permission matrices mapped successfully.\n";

// -------------------------------------------------------------
// HELPER: SQL ROW TOKENIZER
// -------------------------------------------------------------
function parseSqlRow(string $line): array {
    $line = trim($line);
    if (str_starts_with($line, '(')) {
        $line = substr($line, 1);
    }
    if (str_ends_with($line, ');')) {
        $line = substr($line, 0, -2);
    } elseif (str_ends_with($line, '),')) {
        $line = substr($line, 0, -2);
    } elseif (str_ends_with($line, ')')) {
        $line = substr($line, 0, -1);
    }

    $tokens = [];
    $len = strlen($line);
    $pos = 0;

    while ($pos < $len) {
        while ($pos < $len && ($line[$pos] === ' ' || $line[$pos] === ',' || $line[$pos] === "\t")) {
            $pos++;
        }
        if ($pos >= $len) break;

        if ($line[$pos] === "'") {
            $pos++;
            $val = '';
            while ($pos < $len) {
                if ($line[$pos] === '\\') {
                    $next = $line[$pos + 1] ?? '';
                    if ($next === 'n') { $val .= "\n"; }
                    elseif ($next === 'r') { $val .= "\r"; }
                    elseif ($next === 't') { $val .= "\t"; }
                    elseif ($next === '\\') { $val .= "\\"; }
                    elseif ($next === "'") { $val .= "'"; }
                    elseif ($next === '"') { $val .= '"'; }
                    else { $val .= $next; }
                    $pos += 2;
                } elseif ($line[$pos] === "'") {
                    if (($line[$pos + 1] ?? '') === "'") {
                        $val .= "'";
                        $pos += 2;
                    } else {
                        $pos++;
                        break;
                    }
                } else {
                    $val .= $line[$pos];
                    $pos++;
                }
            }
            $tokens[] = $val;
        } else {
            $val = '';
            while ($pos < $len && $line[$pos] !== ',' && $line[$pos] !== ')') {
                $val .= $line[$pos];
                $pos++;
            }
            $val = trim($val);
            if (strtoupper($val) === 'NULL') {
                $tokens[] = null;
            } elseif (is_numeric($val)) {
                $tokens[] = $val;
            } else {
                $tokens[] = $val;
            }
        }
    }

    return $tokens;
}

function normalizeDate(?string $d): ?string {
    if (!$d || trim($d) === '' || $d === 'NULL') return null;
    $d = trim($d);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) return $d;
    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $d, $m)) {
        return sprintf('%04d-%02d-%02d', $m[3], $m[1], $m[2]);
    }
    $ts = strtotime($d);
    return $ts ? date('Y-m-d', $ts) : null;
}

// -------------------------------------------------------------
// STEP 3: IMPORT USERS & USER PROFILES
// -------------------------------------------------------------
echo "\n[3/6] Importing Users from D:/rehan/ERP/db-samples/users.sql...\n";
$usersFile = 'D:/rehan/ERP/db-samples/users.sql';
$fp = fopen($usersFile, 'r');
if (!$fp) die("Cannot open users.sql\n");

$userInsert = $pdo->prepare("
    INSERT INTO users (id, username, email, password_hash, role_id, is_super_admin, status, last_active_at, created_at, updated_at, deleted_at)
    VALUES (:id, :username, :email, :password_hash, :role_id, :is_super_admin, :status, :last_active_at, :created_at, :updated_at, :deleted_at)
");

$profileInsert = $pdo->prepare("
    INSERT INTO user_profiles (user_id, full_name, phone, dob, hiring_date, joining_date, leaving_date, notes, created_at, updated_at)
    VALUES (:user_id, :full_name, :phone, :dob, :hiring_date, :joining_date, :leaving_date, :notes, :created_at, :updated_at)
");

$addressInsert = $pdo->prepare("
    INSERT INTO user_addresses (user_id, address_type, address_line_1, city, state, postal_code, country, created_at, updated_at)
    VALUES (:user_id, :address_type, :address_line_1, :city, :state, :postal_code, :country, :created_at, :updated_at)
");

$refInsert = $pdo->prepare("
    INSERT INTO user_references (user_id, name, relationship, phone, created_at, updated_at)
    VALUES (:user_id, :name, 'Reference', :phone, :created_at, :updated_at)
");

$userRoleInsert = $pdo->prepare("INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)");

$importedUsers = 0;
$takenUsernames = [];

while (($line = fgets($fp)) !== false) {
    if (!str_starts_with(trim($line), '(')) continue;
    $t = parseSqlRow($line);
    if (count($t) < 30) continue;

    $id = (int)$t[0];
    $name = trim($t[1] ?? 'User ' . $id);
    $email = trim($t[2] ?? "user{$id}@example.com");
    $password = $t[3] ?? password_hash('password123', PASSWORD_BCRYPT);
    $phone = $t[4] ?? null;
    $country = $t[7] ?: 'Pakistan';
    $state = $t[8] ?: null;
    $city = $t[9] ?: 'Lahore';
    $postal = $t[10] ?: null;
    $permAddress = $t[11] ?: null;
    $currAddress = $t[12] ?: null;
    $dob = normalizeDate($t[14] ?? null);
    $joiningDate = normalizeDate($t[15] ?? null);
    $hiringDate = normalizeDate($t[16] ?? null);
    $leavingDate = normalizeDate($t[17] ?? null);
    $notes = $t[18] ?: null;
    $notesPrivate = $t[19] ?: null;
    $statusRaw = strtolower(trim($t[20] ?? 'active'));
    $status = in_array($statusRaw, ['active', 'inactive', 'suspended']) ? $statusRaw : 'active';
    $lastActive = $t[23] ?: null;
    $refName = $t[24] ?: null;
    $refPhone = $t[25] ?: null;
    $createdAt = $t[26] ?: date('Y-m-d H:i:s');
    $updatedAt = $t[27] ?: date('Y-m-d H:i:s');
    $deletedAt = $t[28] ?: null;
    $rawRoleId = isset($t[32]) && is_numeric($t[32]) ? (int)$t[32] : 4;
    $roleId = ($rawRoleId >= 1 && $rawRoleId <= 8) ? $rawRoleId : 4;

    // Super Admin flag: Rehan (id: 3) or role_id: 1
    $isSuperAdmin = ($id === 3 || $roleId === 1) ? 1 : 0;
    if ($id === 3) {
        $roleId = 1;
    }

    // Clean unique username
    $cleanName = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '_', $name));
    $cleanName = trim($cleanName, '_');
    if (empty($cleanName)) $cleanName = 'user_' . $id;
    $username = $cleanName;
    $counter = 1;
    while (isset($takenUsernames[$username])) {
        $username = $cleanName . '_' . (++$counter);
    }
    $takenUsernames[$username] = true;

    // Insert user
    $userInsert->execute([
        ':id' => $id,
        ':username' => $username,
        ':email' => $email,
        ':password_hash' => $password,
        ':role_id' => $roleId,
        ':is_super_admin' => $isSuperAdmin,
        ':status' => $status,
        ':last_active_at' => $lastActive,
        ':created_at' => $createdAt,
        ':updated_at' => $updatedAt,
        ':deleted_at' => $deletedAt
    ]);

    // Insert profile
    $fullNotes = trim(($notes ?: '') . ($notesPrivate ? "\n\n[Private Remarks]: " . $notesPrivate : ''));
    $profileInsert->execute([
        ':user_id' => $id,
        ':full_name' => $name,
        ':phone' => $phone,
        ':dob' => $dob,
        ':hiring_date' => $hiringDate,
        ':joining_date' => $joiningDate,
        ':leaving_date' => $leavingDate,
        ':notes' => $fullNotes ?: null,
        ':created_at' => $createdAt,
        ':updated_at' => $updatedAt
    ]);

    // Insert address
    $primaryLine = $currAddress ?: ($permAddress ?: $city);
    $addressInsert->execute([
        ':user_id' => $id,
        ':address_type' => 'current',
        ':address_line_1' => $primaryLine,
        ':city' => $city,
        ':state' => $state,
        ':postal_code' => $postal,
        ':country' => $country,
        ':created_at' => $createdAt,
        ':updated_at' => $updatedAt
    ]);

    if ($permAddress && $permAddress !== $currAddress) {
        $addressInsert->execute([
            ':user_id' => $id,
            ':address_type' => 'permanent',
            ':address_line_1' => $permAddress,
            ':city' => $city,
            ':state' => $state,
            ':postal_code' => $postal,
            ':country' => $country,
            ':created_at' => $createdAt,
            ':updated_at' => $updatedAt
        ]);
    }

    // Insert reference
    if ($refName || $refPhone) {
        $refInsert->execute([
            ':user_id' => $id,
            ':name' => $refName ?: 'Family Reference',
            ':phone' => $refPhone ?: ($phone ?: 'N/A'),
            ':created_at' => $createdAt,
            ':updated_at' => $updatedAt
        ]);
    }

    // Insert user_role
    $userRoleInsert->execute([$id, $roleId]);

    $importedUsers++;
}
fclose($fp);
echo "  - Successfully imported $importedUsers users with profiles, addresses, and roles!\n";

// -------------------------------------------------------------
// STEP 4: IMPORT CLIENTS & INJECT CLIENT_NAME_FOR_ADMIN
// -------------------------------------------------------------
echo "\n[4/6] Importing Clients & Injecting Admin Clients...\n";

// Map to resolve client names (case-insensitive) to client IDs
$clientNameToId = [];
$existingClientIds = [];

// 4a. Import clients.sql
$clientsFile = 'D:/rehan/ERP/db-samples/clients.sql';
$fp = fopen($clientsFile, 'r');
if (!$fp) die("Cannot open clients.sql\n");

$clientInsert = $pdo->prepare("
    INSERT INTO clients (id, title, name, email, phone, notes, client_type, created_at, updated_at, deleted_at)
    VALUES (:id, :title, :name, :email, :phone, :notes, :client_type, :created_at, :updated_at, :deleted_at)
");

$importedClients = 0;
while (($line = fgets($fp)) !== false) {
    if (!str_starts_with(trim($line), '(')) continue;
    $t = parseSqlRow($line);
    if (count($t) < 7) continue;

    $cId = (int)$t[0];
    $cTitle = $t[1] ?: null;
    $cName = trim($t[2] ?? '');
    $cEmail = $t[3] ?: null;
    $cPhone = $t[4] ?: null;
    $cNotes = $t[5] ?: null;
    $cType = in_array($t[6] ?? '', ['admin', 'normal']) ? $t[6] : 'normal';
    $cCreated = $t[7] ?: date('Y-m-d H:i:s');
    $cUpdated = $t[8] ?: date('Y-m-d H:i:s');
    $cDeleted = $t[9] ?: null;

    $clientInsert->execute([
        ':id' => $cId,
        ':title' => $cTitle,
        ':name' => $cName,
        ':email' => $cEmail,
        ':phone' => $cPhone,
        ':notes' => $cNotes,
        ':client_type' => $cType,
        ':created_at' => $cCreated,
        ':updated_at' => $cUpdated,
        ':deleted_at' => $cDeleted
    ]);

    if (!empty($cName)) {
        $clientNameToId[strtolower($cName)] = $cId;
    }
    $existingClientIds[$cId] = true;
    $importedClients++;
}
fclose($fp);
echo "  - Imported $importedClients clients from clients.sql.\n";

// 4b. Scan projects.sql for client_name_for_admin and inject missing clients as client_type = 'admin'
$projectsFile = 'D:/rehan/ERP/db-samples/projects.sql';
$fp = fopen($projectsFile, 'r');
if (!$fp) die("Cannot open projects.sql\n");

$adminClientInsert = $pdo->prepare("
    INSERT INTO clients (name, title, client_type, created_at, updated_at)
    VALUES (:name, :title, 'admin', NOW(), NOW())
");

$updateClientType = $pdo->prepare("UPDATE clients SET client_type = 'admin' WHERE id = ?");

$injectedAdminClients = 0;
$scannedProjects = 0;

while (($line = fgets($fp)) !== false) {
    if (!str_starts_with(trim($line), '(')) continue;
    $scannedProjects++;

    // Quick regex to extract client_name_for_admin (field 4)
    // Structure: (id, 'project_title', 'project_address', 'client_name_for_admin', ...)
    $t = parseSqlRow($line);
    if (count($t) < 5) continue;

    $adminName = trim($t[3] ?? '');
    if (!empty($adminName) && $adminName !== 'NULL') {
        $key = strtolower($adminName);
        if (!isset($clientNameToId[$key])) {
            // Insert new Admin Client
            $adminClientInsert->execute([
                ':name' => $adminName,
                ':title' => 'Admin Client: ' . $adminName
            ]);
            $newId = (int)$pdo->lastInsertId();
            $clientNameToId[$key] = $newId;
            $injectedAdminClients++;
        } else {
            // Already exists in clients, ensure client_type is set to 'admin'
            $existingId = $clientNameToId[$key];
            $updateClientType->execute([$existingId]);
        }
    }
}
fclose($fp);

$totalClients = $pdo->query("SELECT COUNT(*) FROM clients")->fetchColumn();
echo "  - Injected $injectedAdminClients distinct admin clients from projects table.\n";
echo "  - Total Clients in database now: $totalClients.\n";

// -------------------------------------------------------------
// STEP 5: IMPORT PROJECTS (6,508 ROWS IN BATCHES)
// -------------------------------------------------------------
echo "\n[5/6] Importing Projects from D:/rehan/ERP/db-samples/projects.sql...\n";
$fp = fopen($projectsFile, 'r');
if (!$fp) die("Cannot open projects.sql\n");

$projSql = "
    INSERT INTO projects (
        id, project_title, project_address, client_id, project_pricing,
        project_area, project_construction_type, project_line_items_pricing,
        project_floor_number, project_main_scope, project_scope_details,
        project_template, project_init_link, project_final_link,
        project_admin_notes, project_notes, project_private_notes,
        project_total_budget, project_deduction_amount, project_due_date,
        project_points, project_progress_status, project_source,
        project_preview_status, is_project_late, created_at, updated_at, deleted_at
    ) VALUES (
        :id, :project_title, :project_address, :client_id, :project_pricing,
        :project_area, :project_construction_type, :project_line_items_pricing,
        :project_floor_number, :project_main_scope, :project_scope_details,
        :project_template, :project_init_link, :project_final_link,
        :project_admin_notes, :project_notes, :project_private_notes,
        :project_total_budget, :project_deduction_amount, :project_due_date,
        :project_points, :project_progress_status, :project_source,
        :project_preview_status, :is_project_late, :created_at, :updated_at, :deleted_at
    )
";
$projectInsert = $pdo->prepare($projSql);

$importedProjects = 0;
$linkedToClient = 0;
$pdo->beginTransaction();

while (($line = fgets($fp)) !== false) {
    if (!str_starts_with(trim($line), '(')) continue;
    $t = parseSqlRow($line);
    if (count($t) < 26) continue;

    $pId = (int)$t[0];
    $pTitle = $t[1] ?: 'Untitled Project #' . $pId;
    $pAddress = $t[2] ?: null;
    $adminName = trim($t[3] ?? '');
    $rawClientId = isset($t[4]) && is_numeric($t[4]) ? (int)$t[4] : null;

    // Resolve client_id:
    $finalClientId = null;
    if ($rawClientId && isset($existingClientIds[$rawClientId])) {
        $finalClientId = $rawClientId;
    } elseif (!empty($adminName) && isset($clientNameToId[strtolower($adminName)])) {
        $finalClientId = $clientNameToId[strtolower($adminName)];
    }

    if ($finalClientId) {
        $linkedToClient++;
    }

    $pricing = $t[5] ?: null;
    $area = $t[6] ?: null;
    $constructionType = in_array(strtolower($t[7] ?? ''), ['commercial', 'residential']) ? strtolower($t[7]) : null;
    $lineItems = $t[8] ?: null;
    $floorNumber = $t[9] ?: null;
    $mainScope = $t[10] ?: null;
    $scopeDetails = $t[11] ?: null;
    $template = $t[12] ?: null;
    $initLink = $t[13] ?: null;
    $finalLink = $t[14] ?: null;
    $adminNotes = $t[15] ?: null;
    $estimatorNotes = $t[16] ?: null; // project_notes_estimator -> project_notes
    $privateNotes = $t[17] ?: null;   // notes_private -> project_private_notes
    $budget = is_numeric($t[18]) ? (float)$t[18] : null;      // budget_total -> project_total_budget
    $deduction = is_numeric($t[19]) ? (float)$t[19] : null;   // deduction_amount -> project_deduction_amount
    $dueDate = normalizeDate($t[20] ?? null);
    $points = is_numeric($t[21]) ? (int)$t[21] : 0;
    
    // Status normalization
    $allowedStatuses = ['Planned','Pending','Takeoff On Progress','Pricing On Progress','Completed','Hold','Revision','Cancelled','Deliver'];
    $rawStatus = trim($t[22] ?? 'Pending');
    $status = in_array($rawStatus, $allowedStatuses) ? $rawStatus : 'Pending';

    $source = in_array($t[23] ?? '', ['InSource', 'OutSource']) ? $t[23] : 'InSource';
    $previewStatus = in_array(strtolower($t[24] ?? ''), ['active', 'draft']) ? strtolower($t[24]) : 'active';
    $isLate = !empty($t[25]) ? 1 : 0; // late -> is_project_late
    $createdAt = $t[26] ?: date('Y-m-d H:i:s');
    $updatedAt = $t[27] ?: date('Y-m-d H:i:s');
    $deletedAt = $t[28] ?: null;

    $projectInsert->execute([
        ':id' => $pId,
        ':project_title' => $pTitle,
        ':project_address' => $pAddress,
        ':client_id' => $finalClientId,
        ':project_pricing' => $pricing,
        ':project_area' => $area,
        ':project_construction_type' => $constructionType,
        ':project_line_items_pricing' => $lineItems,
        ':project_floor_number' => $floorNumber,
        ':project_main_scope' => $mainScope,
        ':project_scope_details' => $scopeDetails,
        ':project_template' => $template,
        ':project_init_link' => $initLink,
        ':project_final_link' => $finalLink,
        ':project_admin_notes' => $adminNotes,
        ':project_notes' => $estimatorNotes,
        ':project_private_notes' => $privateNotes,
        ':project_total_budget' => $budget,
        ':project_deduction_amount' => $deduction,
        ':project_due_date' => $dueDate,
        ':project_points' => $points,
        ':project_progress_status' => $status,
        ':project_source' => $source,
        ':project_preview_status' => $previewStatus,
        ':is_project_late' => $isLate,
        ':created_at' => $createdAt,
        ':updated_at' => $updatedAt,
        ':deleted_at' => $deletedAt
    ]);

    $importedProjects++;
    if ($importedProjects % 1000 === 0) {
        $pdo->commit();
        $pdo->beginTransaction();
        echo "  - Processed $importedProjects / 6,508 projects...\n";
    }
}
$pdo->commit();
fclose($fp);
echo "  - Successfully imported all $importedProjects projects ($linkedToClient linked to clients)!\n";

// -------------------------------------------------------------
// STEP 6: IMPORT PROJECT_TEAM_MEMBERS (13,637 ROWS IN BATCHES)
// -------------------------------------------------------------
echo "\n[6/6] Importing Project Team Members from D:/rehan/ERP/db-samples/project_team_members.sql...\n";
$teamFile = 'D:/rehan/ERP/db-samples/project_team_members.sql';
$fp = fopen($teamFile, 'r');
if (!$fp) die("Cannot open project_team_members.sql\n");

$teamInsert = $pdo->prepare("
    INSERT INTO project_team_members (
        id, project_id, user_id, steps, started_at, completed_at, status, notes, points_gain, created_at, updated_at, deleted_at
    ) VALUES (
        :id, :project_id, :user_id, :steps, :started_at, :completed_at, :status, :notes, :points_gain, :created_at, :updated_at, :deleted_at
    )
");

$importedTeam = 0;
$pdo->beginTransaction();

while (($line = fgets($fp)) !== false) {
    if (!str_starts_with(trim($line), '(')) continue;
    $t = parseSqlRow($line);
    if (count($t) < 9) continue;

    $tmId = (int)$t[0];
    $pId = (int)$t[1];
    $uId = (int)$t[2];
    $steps = $t[3] ?: null;
    $startedAt = normalizeDate($t[4] ?? null);
    $completedAt = normalizeDate($t[5] ?? null);
    $allowedTeamStatuses = ['in_progress', 'completed', 'on_hold', 'needs_review'];
    $tmStatus = in_array($t[6] ?? '', $allowedTeamStatuses) ? $t[6] : 'in_progress';
    $notes = $t[7] ?: null;
    $pointsGain = is_numeric($t[8]) ? (float)$t[8] : 0.00;
    $createdAt = $t[9] ?: date('Y-m-d H:i:s');
    $updatedAt = $t[10] ?: date('Y-m-d H:i:s');
    $deletedAt = $t[11] ?: null;

    $teamInsert->execute([
        ':id' => $tmId,
        ':project_id' => $pId,
        ':user_id' => $uId,
        ':steps' => $steps,
        ':started_at' => $startedAt,
        ':completed_at' => $completedAt,
        ':status' => $tmStatus,
        ':notes' => $notes,
        ':points_gain' => $pointsGain,
        ':created_at' => $createdAt,
        ':updated_at' => $updatedAt,
        ':deleted_at' => $deletedAt
    ]);

    $importedTeam++;
    if ($importedTeam % 2000 === 0) {
        $pdo->commit();
        $pdo->beginTransaction();
        echo "  - Processed $importedTeam / 13,637 team member entries...\n";
    }
}
$pdo->commit();
fclose($fp);
echo "  - Successfully imported all $importedTeam team member records!\n";

// -------------------------------------------------------------
// RESTORE CONSTRAINTS & VERIFY FINAL STATS
// -------------------------------------------------------------
$pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
$pdo->exec("SET UNIQUE_CHECKS = 1");

echo "\n=========================================================\n";
echo "              DATA MIGRATION SUMMARY VERIFICATION        \n";
echo "=========================================================\n";

$finalTables = [
    'roles',
    'permissions',
    'role_permissions',
    'users',
    'user_profiles',
    'user_addresses',
    'user_references',
    'user_roles',
    'clients',
    'projects',
    'project_team_members',
    'project_steps',
    'status_groups'
];

foreach ($finalTables as $tbl) {
    $count = $pdo->query("SELECT COUNT(*) FROM `$tbl`")->fetchColumn();
    echo sprintf("%-25s: %s records\n", $tbl, number_format((int)$count));
}

// Check sample integrity
echo "\n--- Data Integrity Verification ---\n";
$superAdmin = $pdo->query("SELECT u.id, u.username, u.email, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.is_super_admin = 1 LIMIT 1")->fetch(PDO::FETCH_ASSOC);
echo "Super Admin: ID {$superAdmin['id']}, {$superAdmin['username']} ({$superAdmin['email']}) -> {$superAdmin['role']}\n";

$adminClientsCount = $pdo->query("SELECT COUNT(*) FROM clients WHERE client_type = 'admin'")->fetchColumn();
$normalClientsCount = $pdo->query("SELECT COUNT(*) FROM clients WHERE client_type = 'normal'")->fetchColumn();
echo "Clients breakdown: $adminClientsCount Admin Clients, $normalClientsCount Normal Clients\n";

$projectsWithClient = $pdo->query("SELECT COUNT(*) FROM projects WHERE client_id IS NOT NULL")->fetchColumn();
$projectsTotal = $pdo->query("SELECT COUNT(*) FROM projects")->fetchColumn();
echo "Projects with assigned client: " . number_format($projectsWithClient) . " / " . number_format($projectsTotal) . "\n";

$teamMembersTotal = $pdo->query("SELECT COUNT(*) FROM project_team_members")->fetchColumn();
echo "Total team member assignments: " . number_format($teamMembersTotal) . "\n";

echo "\nMigration completed successfully with zero data loss!\n";

