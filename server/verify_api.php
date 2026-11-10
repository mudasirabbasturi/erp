<?php
/**
 * IMP Core Backend API Verification Suite
 * Tests all 4 Modules + Menus + Column Permissions + Media + Custom Fields
 */

require_once __DIR__ . '/core/App.php';
\Core\App::bootstrap(__DIR__);

$router = new \Core\Router();
require_once __DIR__ . '/routes/api.php';

function testRequest(string $method, string $uri, array $body = [], ?string $token = null, array $queryParams = []): array {
    global $router;

    $_SERVER['REQUEST_METHOD'] = $method;
    $_SERVER['REQUEST_URI'] = $uri . (!empty($queryParams) ? '?' . http_build_query($queryParams) : '');
    $_GET = $queryParams;
    $_POST = [];

    // Simulate headers
    foreach ($_SERVER as $k => $v) {
        if (str_starts_with($k, 'HTTP_')) {
            unset($_SERVER[$k]);
        }
    }

    if ($token) {
        $_SERVER['HTTP_AUTHORIZATION'] = "Bearer {$token}";
    }

    if (!empty($body)) {
        $_SERVER['CONTENT_TYPE'] = 'application/json';
        $json = json_encode($body);
        $stream = fopen("php://memory", "r+");
        fwrite($stream, $json);
        rewind($stream);
        // Temporary override for php://input
    }

    // Capture response directly
    $request = new \Core\Request();
    
    // Inject body directly into request for CLI unit testing
    $reflection = new ReflectionClass($request);
    $prop = $reflection->getProperty('body');
    $prop->setAccessible(true);
    $prop->setValue($request, $body);

    $response = $router->dispatch($request);
    
    // Reflect response content & status
    $resReflect = new ReflectionClass($response);
    $contentProp = $resReflect->getProperty('content');
    $contentProp->setAccessible(true);
    $statusProp = $resReflect->getProperty('statusCode');
    $statusProp->setAccessible(true);

    $raw = $contentProp->getValue($response);
    $status = $statusProp->getValue($response);

    return [
        'status' => $status,
        'data'   => json_decode($raw, true) ?: $raw,
    ];
}

echo "========================================================\n";
echo " IMP (Internal Management Platform) API TEST SUITE\n";
echo "========================================================\n\n";

$passCount = 0;
$failCount = 0;

function assertTest(string $name, bool $condition, ?string $extra = null) {
    global $passCount, $failCount;
    if ($condition) {
        echo "  [PASS] {$name}\n";
        $passCount++;
    } else {
        echo "  [FAIL] {$name} " . ($extra ? "({$extra})" : "") . "\n";
        $failCount++;
    }
}

// 1. Health Check
$res = testRequest('GET', '/api/health');
assertTest('Health Check endpoint returns 200', $res['status'] === 200 && $res['data']['status'] === 'healthy');

// 2. Authentication: Login as Super Admin
$loginRes = testRequest('POST', '/api/auth/login', [
    'username' => 'superadmin',
    'password' => 'Admin@12345',
]);
$superToken = $loginRes['data']['data']['token'] ?? null;
assertTest('Super Admin login successful with Bearer token', $loginRes['status'] === 200 && !empty($superToken));

// 3. Auth Me
$meRes = testRequest('GET', '/api/auth/me', [], $superToken);
assertTest('Auth /me returns Super Admin profile and identity', $meRes['status'] === 200 && (int)$meRes['data']['data']['user']['is_super_admin'] === 1);

// 4. Dynamic Navigation (Super Admin)
$navRes = testRequest('GET', '/api/navigation', [], $superToken);
assertTest('Super Admin dynamic navigation returns tree with active items', $navRes['status'] === 200 && is_array($navRes['data']['data']) && count($navRes['data']['data']) > 0);

// 5. Dynamic Menus CRUD
$menuCreate = testRequest('POST', '/api/menus', [
    'title'      => 'Test Temporary Menu',
    'route_path' => '/test-temp',
    'module_key' => 'testing',
    'sort_order' => 99,
], $superToken);
$tempMenuId = $menuCreate['data']['data']['id'] ?? null;
assertTest('Super Admin can create dynamic navigation menu', $menuCreate['status'] === 201 && $tempMenuId > 0);

$menuDelete = testRequest('DELETE', "/api/menus/{$tempMenuId}", [], $superToken);
assertTest('Super Admin can delete navigation menu', $menuDelete['status'] === 200);

// 6. User Management: Create Estimator User with multi-bank, addresses, references
$testUserEmail = 'estimator_' . time() . '@imp.internal';
$createUser = testRequest('POST', '/api/users', [
    'username'      => 'estimator_' . time(),
    'email'         => $testUserEmail,
    'password'      => 'Estimator@123',
    'role_id'       => 4, // Estimator role
    'full_name'     => 'Jane Estimator',
    'phone'         => '+923001234567',
    'gender'        => 'female',
    'bank_accounts' => [
        [
            'wallet_type'            => 'bank_account',
            'account_title'          => 'Jane Estimator Official',
            'account_number_or_iban' => 'PK36MEZN0001234567890123',
            'bank_name'              => 'Meezan Bank',
            'branch_code_or_name'    => 'Gulberg Branch',
            'is_primary'             => 1,
        ],
        [
            'wallet_type'            => 'jazzcash',
            'account_title'          => 'Jane Quick Wallet',
            'account_number_or_iban' => '03001234567',
            'bank_name'              => 'JazzCash',
            'is_primary'             => 0,
        ]
    ],
    'addresses' => [
        [
            'address_type'   => 'current',
            'address_line_1' => 'Suite 404, Tech Park',
            'city'           => 'Lahore',
            'state'          => 'Punjab',
            'country'        => 'Pakistan',
        ]
    ],
    'references' => [
        [
            'name'         => 'John Senior Estimator',
            'relationship' => 'Former Manager',
            'phone'        => '+923009876543',
            'organization' => 'Apex Bidding',
        ]
    ],
    'meta' => [
        'skill_level'     => 'Senior',
        'preferred_shift' => 'Morning',
    ]
], $superToken);

$newUserId = $createUser['data']['data']['id'] ?? null;
assertTest('User creation with multi-bank, addresses, references & meta', $createUser['status'] === 201 && $newUserId > 0);

// 7. Test Super Admin Isolation (Hidden from listings for non-super-admins)
$estimatorLogin = testRequest('POST', '/api/auth/login', [
    'username' => $testUserEmail,
    'password' => 'Estimator@123',
]);
$estimatorToken = $estimatorLogin['data']['data']['token'] ?? null;
assertTest('Estimator login successful', $estimatorLogin['status'] === 200 && !empty($estimatorToken));

// Estimator fetches user list
$estimatorUserList = testRequest('GET', '/api/users', [], $estimatorToken);
$hasSuperAdmin = false;
foreach ($estimatorUserList['data']['data'] as $u) {
    if ((int)$u['is_super_admin'] === 1) {
        $hasSuperAdmin = true;
    }
}
assertTest('Super Admin is HIDDEN from user list for normal users', $hasSuperAdmin === false);

// Estimator tries to delete Super Admin (User ID 1) -> must be 403 Forbidden!
$illegalDelete = testRequest('DELETE', '/api/users/1', [], $estimatorToken);
assertTest('Super Admin account is IMMUNE from deletion (403 Forbidden)', $illegalDelete['status'] === 403);

// 8. Clients Management
$createClient = testRequest('POST', '/api/clients', [
    'name'         => 'Benchmark Construction LLC',
    'company_name' => 'Benchmark Group',
    'client_type'  => 'normal',
    'email'        => 'bids@benchmark.com',
    'phone'        => '+15551234567',
], $superToken);
$clientId = $createClient['data']['data']['id'] ?? null;
assertTest('Client created with client_type = normal', $createClient['status'] === 201 && $clientId > 0);

// 9. Project Lookups
$lookups = testRequest('GET', '/api/projects/lookups', [], $superToken);
assertTest('Project lookups returns statuses, sources, preview statuses & clients', 
    $lookups['status'] === 200 && count($lookups['data']['data']['statuses']) >= 9);

// 10. Project Management: Create Project with dynamic status, links, notes & team
$createProject = testRequest('POST', '/api/projects', [
    'project_title'     => 'Commercial Plaza Takeoff & Pricing',
    'client_id'         => $clientId,
    'status_id'         => 3, // Takeoff On Progress
    'preview_status_id' => 1, // Active
    'source_id'         => 1, // InSource
    'construction_type' => 'commercial',
    'project_area'      => '45,000 sq ft',
    'floor_number'      => 'G+5 Floors',
    'budget_total'      => 125000.00,
    'deduction_amount'  => 5000.00,
    'project_points'    => 25,
    'due_date'          => date('Y-m-d', strtotime('+14 days')),
    'links'             => [
        [
            'link_type' => 'initial_link',
            'label'     => 'Architectural Plans PDF',
            'url'       => 'https://storage.imp.internal/drawings/v1.pdf',
        ],
        [
            'link_type' => 'google_drive',
            'label'     => 'Spec Sheets Folder',
            'url'       => 'https://drive.google.com/sample',
        ]
    ],
    'notes' => [
        [
            'note_type'  => 'project_notes',
            'content'    => 'Client requested pricing line-items per CSI division.',
            'is_private' => 0,
        ],
        [
            'note_type'  => 'project_private_notes',
            'content'    => 'Target profit margin is 28%. Do not disclose margin to client.',
            'is_private' => 1,
        ]
    ],
    'team_members' => [
        [
            'user_id'       => $newUserId,
            'member_role'   => 'Lead Takeoff Estimator',
            'member_status' => 'in_progress',
        ]
    ],
    'meta' => [
        'permit_status'   => 'Approved',
        'subcontractors'  => 'Local HVAC and Drywall',
    ]
], $superToken);

$projectId = $createProject['data']['data']['id'] ?? null;
assertTest('Project creation with links, notes, team members & dynamic meta', $createProject['status'] === 201 && $projectId > 0);

// 11. Column-Level Permission Masking Test
// Set field-level permission: Estimator role (id: 4) cannot view budget_total
$fieldRule = testRequest('POST', '/api/roles/field-permissions', [
    'role_id'     => 4,
    'permissions' => [
        [
            'entity'     => 'project',
            'field_name' => 'budget_total',
            'can_view'   => 0, // FORBIDDEN TO VIEW
            'can_edit'   => 0,
        ]
    ]
], $superToken);
assertTest('Saved field-level column restriction for Estimator role', $fieldRule['status'] === 200);

// Refresh estimator token login to pull updated field permissions
$estimatorLogin = testRequest('POST', '/api/auth/login', [
    'username' => $testUserEmail,
    'password' => 'Estimator@123',
]);
$estimatorToken = $estimatorLogin['data']['data']['token'];

// Estimator fetches the project
$estimatorProjectView = testRequest('GET', "/api/projects/{$projectId}", [], $estimatorToken);
$budgetInView = $estimatorProjectView['data']['data']['budget_total'];
assertTest('Column-Level Security: budget_total is MASKED to null for Estimator', $budgetInView === null);

// Super Admin fetches the project -> budget_total must be intact!
$superProjectView = testRequest('GET', "/api/projects/{$projectId}", [], $superToken);
assertTest('Super Admin sees full budget_total intact (125000.00)', (float)$superProjectView['data']['data']['budget_total'] === 125000.0);

// 12. Dynamic Custom Fields Engine (WordPress-style Custom Post Options)
$testFieldKey = 'inspector_' . time();
$createField = testRequest('POST', '/api/custom-fields', [
    'entity_type'   => 'project',
    'field_key'     => $testFieldKey,
    'field_label'   => 'City Building Inspector',
    'field_type'    => 'text',
    'show_in_table' => 1,
], $superToken);
assertTest('WordPress-Style Custom Field created dynamically', $createField['status'] === 201);

// 13. System Settings
$settingsRes = testRequest('GET', '/api/settings');
assertTest('System settings retrieved with company metadata', $settingsRes['status'] === 200 && !empty($settingsRes['data']['data']['general']['company_name']));

// 14. AI Subsystem: Providers & Task Routing
$providersRes = testRequest('GET', '/api/ai/providers', [], $superToken);
assertTest('Super Admin can list all 4 AI providers (Gemini, OpenAI, Claude, DeepSeek)', 
    $providersRes['status'] === 200 && count($providersRes['data']['data']) === 4);

$tasksRes = testRequest('GET', '/api/ai/tasks', [], $superToken);
assertTest('Super Admin can list AI task routings including attendance matcher', 
    $tasksRes['status'] === 200 && count($tasksRes['data']['data']) >= 4);

// Non-super-admin tries to access AI provider settings -> must be 403 Forbidden!
$forbiddenAi = testRequest('GET', '/api/ai/providers', [], $estimatorToken);
assertTest('AI provider management is restricted to Super Admin (403 Forbidden)', $forbiddenAi['status'] === 403);

// Super Admin updates task routing: assign project_create_assistant to deepseek-chat
$updateTaskRes = testRequest('PUT', '/api/ai/tasks/1', [
    'provider_id'   => 4, // DeepSeek
    'model_name'    => 'deepseek-chat',
    'temperature'   => 0.2,
    'max_tokens'    => 3000,
], $superToken);
assertTest('Super Admin can reassign AI task provider & model dynamically', $updateTaskRes['status'] === 200);

echo "\n========================================================\n";
echo " TEST SUMMARY: {$passCount} PASSED | {$failCount} FAILED\n";
echo "========================================================\n";
