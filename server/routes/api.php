<?php
use Core\Router;
use App\Middleware\AuthMiddleware;
use App\Middleware\SuperAdminGuard;
use App\Controllers\AuthController;
use App\Controllers\UserController;
use App\Controllers\ClientController;
use App\Controllers\ProjectController;
use App\Controllers\RolePermissionController;
use App\Controllers\MediaController;
use App\Controllers\SchemaController;
use App\Controllers\ColumnConfigController;
use App\Controllers\ActivityLogController;
use App\Controllers\StatusGroupController;
use App\Controllers\ProjectTeamController;
use App\Controllers\TrackingController;
use App\Controllers\SettingsController;
use App\Controllers\TakeoffController;

/** @var Router $router */

$router->group('/api', function (Router $api) {

    // Health check
    $api->get('/health', function () {
        return ['status' => 'healthy', 'service' => 'ERP Core Super Admin API', 'version' => '2.0.0', 'time' => date('Y-m-d H:i:s')];
    });

    // ----------------------------------------------------
    // AUTHENTICATION ROUTES
    // ----------------------------------------------------
    $api->post('/login', [AuthController::class, 'login']);
    $api->group('/auth', function (Router $auth) {
        $auth->post('/login', [AuthController::class, 'login']);
        $auth->get('/me', [AuthController::class, 'me'], [AuthMiddleware::class]);
        $auth->post('/logout', [AuthController::class, 'logout'], [AuthMiddleware::class]);
        $auth->post('/password', [AuthController::class, 'updatePassword'], [AuthMiddleware::class]);
    });

    // ----------------------------------------------------
    // ROLES & PERMISSIONS
    // ----------------------------------------------------
    $api->get('/roles', [RolePermissionController::class, 'rolesIndex'], [AuthMiddleware::class]);
    $api->post('/roles', [RolePermissionController::class, 'rolesStore'], [AuthMiddleware::class, SuperAdminGuard::class]);
    $api->put('/roles/{id}', [RolePermissionController::class, 'rolesUpdate'], [AuthMiddleware::class, SuperAdminGuard::class]);
    $api->delete('/roles/{id}', [RolePermissionController::class, 'rolesDestroy'], [AuthMiddleware::class, SuperAdminGuard::class]);
    $api->get('/permissions', [RolePermissionController::class, 'permissionsIndex'], [AuthMiddleware::class]);
    $api->post('/roles/field-permissions', [RolePermissionController::class, 'saveFieldPermissions'], [AuthMiddleware::class, SuperAdminGuard::class]);
    $api->post('/roles/enum-permissions', [RolePermissionController::class, 'saveEnumPermissions'], [AuthMiddleware::class, SuperAdminGuard::class]);

    // ----------------------------------------------------
    // STATUS GROUPS (Reusable entity status groups & categorization)
    // ----------------------------------------------------
    $api->group('/status-groups', function (Router $sg) {
        $sg->get('', [StatusGroupController::class, 'index']);
        $sg->post('', [StatusGroupController::class, 'store']);
        $sg->put('/{id}', [StatusGroupController::class, 'update']);
        $sg->delete('/{id}', [StatusGroupController::class, 'destroy']);
    }, [AuthMiddleware::class]);

    // ----------------------------------------------------
    // USER MANAGEMENT
    // ----------------------------------------------------
    $api->group('/users', function (Router $users) {
        $users->get('', [UserController::class, 'index']);
        $users->get('/{id}', [UserController::class, 'show']);
        $users->post('', [UserController::class, 'store']);
        $users->put('/{id}', [UserController::class, 'update']);
        $users->delete('/{id}', [UserController::class, 'destroy']);
    }, [AuthMiddleware::class]);

    // ----------------------------------------------------
    // CLIENT MANAGEMENT
    // ----------------------------------------------------
    $api->group('/clients', function (Router $clients) {
        $clients->get('', [ClientController::class, 'index']);
        $clients->get('/{id}', [ClientController::class, 'show']);
        $clients->post('', [ClientController::class, 'store']);
        $clients->put('/{id}', [ClientController::class, 'update']);
        $clients->delete('/{id}', [ClientController::class, 'destroy']);
    }, [AuthMiddleware::class]);

    // ----------------------------------------------------
    // PROJECT MANAGEMENT & TEAM MEMBERS
    // ----------------------------------------------------
    $api->group('/projects', function (Router $projects) {
        $projects->get('/summary', [ProjectController::class, 'statusSummary']);
        $projects->get('/lookups', [ProjectController::class, 'getLookups']);
        $projects->get('', [ProjectController::class, 'index']);
        $projects->get('/{id}/team', [ProjectTeamController::class, 'index']);
        $projects->post('/{id}/team/join', [ProjectTeamController::class, 'join']);
        $projects->put('/{id}/team/points', [ProjectTeamController::class, 'updateBulkPoints']);
        $projects->put('/{id}/team/{memberId}/score', [ProjectTeamController::class, 'updateScore']);
        $projects->put('/{id}/team/{memberId}', [ProjectTeamController::class, 'update']);
        $projects->delete('/{id}/team/{memberId}', [ProjectTeamController::class, 'destroy']);
        $projects->get('/{id}', [ProjectController::class, 'show']);
        $projects->post('', [ProjectController::class, 'store']);
        $projects->put('/{id}', [ProjectController::class, 'update']);
        $projects->delete('/{id}', [ProjectController::class, 'destroy']);
    }, [AuthMiddleware::class]);

    $api->group('/project-steps', function (Router $steps) {
        $steps->get('', [ProjectTeamController::class, 'getSteps']);
        $steps->post('', [ProjectTeamController::class, 'createStep']);
    }, [AuthMiddleware::class]);

    // ----------------------------------------------------
    // DATABASE TABLES & SCHEMA MANAGEMENT (Super Admin only)
    // ----------------------------------------------------
    $api->group('/schema', function (Router $schema) {
        $schema->get('/tables', [SchemaController::class, 'getTables']);
        $schema->get('/tables/{table}', [SchemaController::class, 'getTableColumns']);
        $schema->post('/tables/{table}/columns', [SchemaController::class, 'addColumn']);
        $schema->put('/tables/{table}/columns', [SchemaController::class, 'updateColumn']);
        $schema->delete('/tables/{table}/columns/{column}', [SchemaController::class, 'deleteColumn']);

        // Legacy / shortcut user schema endpoints
        $schema->get('/users', [SchemaController::class, 'getUserColumns']);
        $schema->post('/users/columns', [SchemaController::class, 'addColumn']);
        $schema->put('/users/columns', [SchemaController::class, 'updateColumn']);
        $schema->delete('/users/columns/{column}', [SchemaController::class, 'deleteColumn']);
    }, [AuthMiddleware::class, SuperAdminGuard::class]);

    // ----------------------------------------------------
    // ACTIVE COLUMNS CONFIG & QUERY OPTIMIZER
    // ----------------------------------------------------
    $api->group('/columns', function (Router $columns) {
        $columns->get('/config/{entity}', [ColumnConfigController::class, 'getEntityColumns']);
        $columns->post('/config/{entity}', [ColumnConfigController::class, 'saveEntityColumns']);
    }, [AuthMiddleware::class, SuperAdminGuard::class]);

    // ----------------------------------------------------
    // MEDIA & FOLDERS MANAGEMENT
    // ----------------------------------------------------
    $api->group('/media', function (Router $media) {
        // Specific routes first before /{id}
        $media->get('', [MediaController::class, 'index']);
        $media->get('/folders', [MediaController::class, 'folders']);
        $media->post('/folders', [MediaController::class, 'storeFolder']);
        $media->put('/folders/{id}', [MediaController::class, 'updateFolder']);
        $media->delete('/folders/{id}', [MediaController::class, 'destroyFolder']);
        $media->get('/users', [MediaController::class, 'users']);
        $media->post('/upload', [MediaController::class, 'upload']);
        $media->post('/move', [MediaController::class, 'move']);
        $media->post('/bulk-delete', [MediaController::class, 'bulkDelete']);
        $media->get('/{id}', [MediaController::class, 'show']);
        $media->put('/{id}', [MediaController::class, 'update']);
        $media->delete('/{id}', [MediaController::class, 'destroy']);
    }, [AuthMiddleware::class]);

    // ----------------------------------------------------
    // CENTRAL AUDIT / ACTIVITY LOGS
    // ----------------------------------------------------
    $api->get('/activity-logs', [ActivityLogController::class, 'index'], [AuthMiddleware::class]);

    // ----------------------------------------------------
    // TRACKING & USER ACTIVITY (Web & Python Desktop Agent)
    // ----------------------------------------------------
    // Desktop Agent Endpoints (Compatible with Python tracker: /api/track/...)
    $api->get('/track/settings', [TrackingController::class, 'getTrackerSettings']);
    $api->get('/track/screenshot/pending/{userId}', [TrackingController::class, 'checkPendingScreenshot']);
    $api->get('/track/screenshot/image/{driveFileId}', [TrackingController::class, 'serveDriveImage']);
    $api->post('/track/screenshot', [TrackingController::class, 'uploadScreenshot']);
    $api->post('/track/activity', [TrackingController::class, 'storeActivity']);
    $api->get('/track/users', [TrackingController::class, 'index']);
    $api->get('/track/screenshots', [TrackingController::class, 'getScreenshots']);
    $api->get('/track/screenshots/latest-all', [TrackingController::class, 'getLatestAllScreenshots']);
    $api->post('/track/screenshots/delete', [TrackingController::class, 'deleteScreenshots']);
    $api->post('/track/screenshot/trigger', [TrackingController::class, 'triggerScreenshot']);
    $api->get('/track/active-status/{userId}', [TrackingController::class, 'checkActiveStatus']);
    $api->post('/track/update-status', [TrackingController::class, 'updateStatusHeartbeat']);
    $api->post('/track/toggle-permission', [TrackingController::class, 'toggleWfh']);
    $api->post('/track/toggle-logout-restriction', [TrackingController::class, 'toggleLogoutRestriction']);
    $api->post('/track/settings/update', [TrackingController::class, 'updateGlobalSettings']);
    $api->get('/track/activity/stats', [TrackingController::class, 'getActivityStats']);

    // Web Dashboard Management Endpoints
    $api->group('/tracking', function (Router $track) {
        $track->get('/users', [TrackingController::class, 'index']);
        $track->get('/activity/stats', [TrackingController::class, 'getActivityStats']);
        $track->post('/activity', [TrackingController::class, 'storeActivity']);
        $track->get('/screenshots', [TrackingController::class, 'getScreenshots']);
        $track->get('/screenshots/latest-all', [TrackingController::class, 'getLatestAllScreenshots']);
        $track->post('/screenshots/delete', [TrackingController::class, 'deleteScreenshots']);
        $track->post('/screenshot/trigger', [TrackingController::class, 'triggerScreenshot']);
        $track->get('/active-status/{userId}', [TrackingController::class, 'checkActiveStatus']);
        $track->post('/toggle-permission', [TrackingController::class, 'toggleWfh']);
        $track->post('/toggle-logout-restriction', [TrackingController::class, 'toggleLogoutRestriction']);
        $track->get('/settings', [TrackingController::class, 'getTrackerSettings']);
        $track->post('/settings', [TrackingController::class, 'updateGlobalSettings']);
        $track->post('/settings/update', [TrackingController::class, 'updateGlobalSettings']);
    }, [AuthMiddleware::class]);

    // Google Drive & Cloud Storage Settings
    $api->get('/settings/google-drive/oauth-callback', [SettingsController::class, 'googleDriveOAuthCallback']);
    $api->group('/settings/google-drive', function (Router $gd) {
        $gd->get('', [SettingsController::class, 'getGoogleDriveSettings']);
        $gd->post('/test', [SettingsController::class, 'testGoogleDrive']);
        $gd->post('/update', [SettingsController::class, 'updateGoogleDrive']);
        $gd->post('/oauth-url', [SettingsController::class, 'getGoogleDriveOAuthUrl']);
        $gd->post('/disconnect-oauth', [SettingsController::class, 'disconnectGoogleDriveOAuth']);
    }, [AuthMiddleware::class]);

    // ----------------------------------------------------
    // SYSTEM SETTINGS & AI ASSISTANT
    // ----------------------------------------------------
    $api->group('/settings', function (Router $settings) {
        $settings->get('', [SettingsController::class, 'getSettings']);
        $settings->post('', [SettingsController::class, 'updateSettings']);
        $settings->post('/ai/test', [SettingsController::class, 'testAIConnection']);
        $settings->post('/ai/switch-model', [SettingsController::class, 'switchAIModel']);
        $settings->post('/ai/chat', [SettingsController::class, 'chatAI']);
        $settings->get('/ai/conversations', [SettingsController::class, 'getConversations']);
        $settings->get('/ai/messages', [SettingsController::class, 'getConversationMessages']);
        $settings->post('/ai/conversations/clear', [SettingsController::class, 'clearConversation']);
    }, [AuthMiddleware::class]);

    // ----------------------------------------------------
    // CONSTRUCTION TAKEOFF & ESTIMATION MODULE
    // ----------------------------------------------------
    $api->group('/takeoff', function (Router $takeoff) {
        // Sessions
        $takeoff->get('/sessions', [TakeoffController::class, 'index']);
        $takeoff->post('/sessions', [TakeoffController::class, 'create']);
        $takeoff->get('/sessions/{id}', [TakeoffController::class, 'show']);
        $takeoff->put('/sessions/{id}', [TakeoffController::class, 'update']);
        $takeoff->delete('/sessions/{id}', [TakeoffController::class, 'delete']);
        $takeoff->post('/sessions/{id}/duplicate', [TakeoffController::class, 'duplicate']);

        // Blueprints / Drawings
        $takeoff->post('/sessions/{id}/blueprints', [TakeoffController::class, 'uploadBlueprint']);
        $takeoff->post('/sessions/{id}/blueprints/media', [TakeoffController::class, 'selectFromMedia']);
        $takeoff->post('/sessions/{id}/blueprints/sample', [TakeoffController::class, 'loadSampleBlueprint']);
        $takeoff->get('/blueprints/{id}/file', [TakeoffController::class, 'getBlueprintFile']);
        $takeoff->delete('/blueprints/{id}', [TakeoffController::class, 'deleteBlueprint']);

        // Scales & Calibration
        $takeoff->get('/sessions/{id}/scales', [TakeoffController::class, 'getScales']);
        $takeoff->post('/sessions/{id}/scales', [TakeoffController::class, 'saveScale']);
        $takeoff->post('/sessions/{id}/scales/calibrate', [TakeoffController::class, 'calibrate']);
        $takeoff->delete('/scales/{id}', [TakeoffController::class, 'deleteScale']);

        // Measurements (Server-verified calculations)
        $takeoff->get('/sessions/{id}/measurements', [TakeoffController::class, 'getMeasurements']);
        $takeoff->post('/sessions/{id}/measurements', [TakeoffController::class, 'batchSaveMeasurements']);
        $takeoff->put('/measurements/{id}', [TakeoffController::class, 'updateMeasurement']);
        $takeoff->delete('/measurements/{id}', [TakeoffController::class, 'deleteMeasurement']);
        $takeoff->post('/measurements/bulk-delete', [TakeoffController::class, 'bulkDeleteMeasurements']);
        $takeoff->post('/measurements/{id}/link-assembly', [TakeoffController::class, 'linkAssembly']);

        // Assemblies & Cost Estimation Items
        $takeoff->get('/sessions/{id}/assemblies', [TakeoffController::class, 'getAssemblies']);
        $takeoff->post('/sessions/{id}/assemblies', [TakeoffController::class, 'saveAssembly']);
        $takeoff->delete('/assemblies/{id}', [TakeoffController::class, 'deleteAssembly']);
        $takeoff->post('/assemblies/{id}/items', [TakeoffController::class, 'saveAssemblyItem']);
        $takeoff->delete('/assemblies/items/{id}', [TakeoffController::class, 'deleteAssemblyItem']);

        // Aggregates & Exporting
        $takeoff->get('/sessions/{id}/totals', [TakeoffController::class, 'getTotals']);
        $takeoff->post('/sessions/{id}/export', [TakeoffController::class, 'export']);
    }, [AuthMiddleware::class]);
});
