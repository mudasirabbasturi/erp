<?php

namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;
use App\Services\TakeoffCalculatorService;
use App\Services\ActivityLogger;

class TakeoffController extends Controller
{
    /* =========================================================================
     * SESSIONS
     * ========================================================================= */

    /**
     * List takeoff sessions with filters and computed metrics
     */
    public function index(Request $request): Response
    {
        $projectId = (int)$request->query('project_id', 0);
        $status = trim($request->query('status', ''));
        $search = trim($request->query('search', ''));

        $where = ["s.deleted_at IS NULL"];
        $params = [];

        if ($projectId > 0) {
            $where[] = "s.project_id = :project_id";
            $params['project_id'] = $projectId;
        }

        if (!empty($status) && in_array($status, ['draft', 'final', 'archived'])) {
            $where[] = "s.status = :status";
            $params['status'] = $status;
        }

        if (!empty($search)) {
            $where[] = "(s.name LIKE :search OR s.description LIKE :search)";
            $params['search'] = "%{$search}%";
        }

        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT s.*, 
                   p.project_title,
                   u.username as creator_name,
                   (SELECT COUNT(*) FROM takeoff_blueprints b WHERE b.session_id = s.id AND b.deleted_at IS NULL) as blueprints_count,
                   (SELECT COUNT(*) FROM takeoff_measurements m WHERE m.session_id = s.id AND m.deleted_at IS NULL) as measurements_count,
                   (SELECT COUNT(*) FROM takeoff_assemblies a WHERE a.session_id = s.id) as assemblies_count
            FROM takeoff_sessions s
            LEFT JOIN projects p ON p.id = s.project_id
            LEFT JOIN users u ON u.id = s.created_by
            WHERE {$whereSql}
            ORDER BY s.id DESC
        ";

        $sessions = Database::fetchAll($sql, $params);
        return Response::success($sessions);
    }

    /**
     * Create a new takeoff session
     */
    public function create(Request $request): Response
    {
        $currentUser = $this->user($request);
        $userId = $currentUser ? (int)$currentUser['id'] : 1;

        $name = trim($request->input('name', ''));
        if (empty($name)) {
            return Response::error('Session name is required', 400);
        }

        $projectId = (int)$request->input('project_id', 0) ?: null;
        $description = trim($request->input('description', ''));
        $status = $request->input('status', 'draft');
        if (!in_array($status, ['draft', 'final', 'archived'])) {
            $status = 'draft';
        }

        $now = date('Y-m-d H:i:s');
        $sessionId = Database::insert('takeoff_sessions', [
            'workspace_id' => 1,
            'project_id' => $projectId,
            'name' => $name,
            'description' => $description,
            'status' => $status,
            'created_by' => $userId,
            'created_at' => $now,
            'updated_at' => $now
        ]);

        // Auto-seed a default calibration scale (100 px = 1 ft)
        $defaultScaleId = Database::insert('takeoff_scales', [
            'session_id' => $sessionId,
            'name' => 'Default Scale (100 px = 1 ft)',
            'pixels_per_unit' => 100.0000,
            'unit' => 'ft',
            'calibration_points' => json_encode([['x' => 0, 'y' => 0], ['x' => 100, 'y' => 0]]),
            'is_default' => 1,
            'created_at' => $now
        ]);

        Database::update('takeoff_sessions', ['default_scale_id' => $defaultScaleId], 'id = :id', ['id' => $sessionId]);

        // Auto-seed starter assemblies for fast estimating
        Database::insert('takeoff_assemblies', [
            'session_id' => $sessionId,
            'name' => 'Interior Drywall & Paint',
            'unit' => 'sq ft',
            'unit_cost' => 4.50,
            'currency' => 'USD',
            'waste_factor' => 10.00,
            'labor_rate' => 1.50,
            'notes' => 'Standard 5/8" gypsum board, taped, mudded & painted',
            'created_at' => $now
        ]);

        Database::insert('takeoff_assemblies', [
            'session_id' => $sessionId,
            'name' => 'Polished Concrete Slab',
            'unit' => 'sq ft',
            'unit_cost' => 8.75,
            'currency' => 'USD',
            'waste_factor' => 5.00,
            'labor_rate' => 3.00,
            'notes' => '4" slab with wire mesh and light polish finish',
            'created_at' => $now
        ]);

        $session = Database::fetch("SELECT * FROM takeoff_sessions WHERE id = :id", ['id' => $sessionId]);
        return Response::success($session, 'Takeoff session created successfully', 201);
    }

    /**
     * Show full takeoff session workspace state
     */
    public function show(Request $request): Response
    {
        $id = (int)($request->param('id') ?: $id);
        $session = Database::fetch("
            SELECT s.*, p.project_title, u.username as creator_name
            FROM takeoff_sessions s
            LEFT JOIN projects p ON p.id = s.project_id
            LEFT JOIN users u ON u.id = s.created_by
            WHERE s.id = :id AND s.deleted_at IS NULL
        ", ['id' => $id]);

        if (!$session) {
            return Response::error('Takeoff session not found', 404);
        }

        // Blueprints
        $blueprints = Database::fetchAll("
            SELECT * FROM takeoff_blueprints
            WHERE session_id = :sid AND deleted_at IS NULL
            ORDER BY id ASC
        ", ['sid' => $id]);

        // Scales
        $scales = Database::fetchAll("
            SELECT * FROM takeoff_scales
            WHERE session_id = :sid
            ORDER BY is_default DESC, id ASC
        ", ['sid' => $id]);

        // Assemblies with items
        $assemblies = Database::fetchAll("
            SELECT * FROM takeoff_assemblies
            WHERE session_id = :sid
            ORDER BY id ASC
        ", ['sid' => $id]);

        foreach ($assemblies as &$asm) {
            $asm['items'] = Database::fetchAll("
                SELECT * FROM takeoff_assembly_items
                WHERE assembly_id = :aid
                ORDER BY id ASC
            ", ['aid' => $asm['id']]);
        }

        // Measurements
        $measurements = Database::fetchAll("
            SELECT m.*, a.name as assembly_name, a.unit_cost as assembly_unit_cost, a.waste_factor as assembly_waste, a.labor_rate as assembly_labor
            FROM takeoff_measurements m
            LEFT JOIN takeoff_assemblies a ON a.id = m.assembly_id
            WHERE m.session_id = :sid AND m.deleted_at IS NULL
            ORDER BY m.id ASC
        ", ['sid' => $id]);

        foreach ($measurements as &$m) {
            $m['geometry'] = json_decode($m['geometry'] ?? '[]', true);
            $unitCost = (float)($m['assembly_unit_cost'] ?? 0);
            $waste = (float)($m['assembly_waste'] ?? 0);
            $labor = (float)($m['assembly_labor'] ?? 0);
            $m['line_total'] = TakeoffCalculatorService::calculateLineTotal((float)$m['computed_quantity'], $unitCost, $waste, $labor);
        }

        // Compute aggregate totals
        $totals = $this->calculateSessionTotalsInternal($id, $measurements);

        return Response::success([
            'session' => $session,
            'blueprints' => $blueprints,
            'scales' => $scales,
            'assemblies' => $assemblies,
            'measurements' => $measurements,
            'totals' => $totals
        ]);
    }

    /**
     * Update takeoff session
     */
    public function update(Request $request): Response
    {
        $id = (int)($request->param('id') ?: $id);
        $session = Database::fetch("SELECT * FROM takeoff_sessions WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);
        if (!$session) {
            return Response::error('Session not found', 404);
        }

        $fields = [];
        if ($request->has('name')) $fields['name'] = trim($request->input('name'));
        if ($request->has('description')) $fields['description'] = trim($request->input('description'));
        if ($request->has('status')) {
            $st = $request->input('status');
            if (in_array($st, ['draft', 'final', 'archived'])) $fields['status'] = $st;
        }
        if ($request->has('project_id')) $fields['project_id'] = (int)$request->input('project_id') ?: null;
        if ($request->has('default_scale_id')) $fields['default_scale_id'] = (int)$request->input('default_scale_id') ?: null;

        if (!empty($fields)) {
            $fields['updated_at'] = date('Y-m-d H:i:s');
            Database::update('takeoff_sessions', $fields, 'id = :id', ['id' => $id]);
        }

        $updated = Database::fetch("SELECT * FROM takeoff_sessions WHERE id = :id", ['id' => $id]);
        return Response::success($updated, 'Session updated successfully');
    }

    /**
     * Soft delete session
     */
    public function delete(Request $request): Response
    {
        $id = (int)($request->param('id') ?: $id);
        Database::update('takeoff_sessions', ['deleted_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => $id]);
        return Response::success(null, 'Session deleted successfully');
    }

    /**
     * Duplicate a session with all blueprints, scales, assemblies, and measurements
     */
    public function duplicate(Request $request): Response
    {
        $id = (int)($request->param('id') ?: $id);
        $src = Database::fetch("SELECT * FROM takeoff_sessions WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);
        if (!$src) {
            return Response::error('Source session not found', 404);
        }

        $currentUser = $this->user($request);
        $userId = $currentUser ? (int)$currentUser['id'] : 1;
        $now = date('Y-m-d H:i:s');

        $newSessionId = Database::insert('takeoff_sessions', [
            'workspace_id' => $src['workspace_id'],
            'project_id' => $src['project_id'],
            'name' => $src['name'] . ' (Copy)',
            'description' => $src['description'],
            'status' => 'draft',
            'created_by' => $userId,
            'created_at' => $now,
            'updated_at' => $now
        ]);

        // Duplicate Scales
        $scaleMap = [];
        $scales = Database::fetchAll("SELECT * FROM takeoff_scales WHERE session_id = :sid", ['sid' => $id]);
        foreach ($scales as $s) {
            $newScaleId = Database::insert('takeoff_scales', [
                'session_id' => $newSessionId,
                'name' => $s['name'],
                'pixels_per_unit' => $s['pixels_per_unit'],
                'unit' => $s['unit'],
                'calibration_points' => $s['calibration_points'],
                'is_default' => $s['is_default'],
                'created_at' => $now
            ]);
            $scaleMap[$s['id']] = $newScaleId;
            if ($s['is_default']) {
                Database::update('takeoff_sessions', ['default_scale_id' => $newScaleId], 'id = :id', ['id' => $newSessionId]);
            }
        }

        // Duplicate Blueprints
        $blueprintMap = [];
        $blueprints = Database::fetchAll("SELECT * FROM takeoff_blueprints WHERE session_id = :sid AND deleted_at IS NULL", ['sid' => $id]);
        foreach ($blueprints as $b) {
            $newBpId = Database::insert('takeoff_blueprints', [
                'session_id' => $newSessionId,
                'original_filename' => $b['original_filename'],
                'storage_path' => $b['storage_path'],
                'mime_type' => $b['mime_type'],
                'file_size' => $b['file_size'],
                'page_count' => $b['page_count'],
                'thumbnail_path' => $b['thumbnail_path'],
                'uploaded_by' => $userId,
                'created_at' => $now
            ]);
            $blueprintMap[$b['id']] = $newBpId;
        }

        // Duplicate Assemblies
        $assemblyMap = [];
        $assemblies = Database::fetchAll("SELECT * FROM takeoff_assemblies WHERE session_id = :sid", ['sid' => $id]);
        foreach ($assemblies as $a) {
            $newAsmId = Database::insert('takeoff_assemblies', [
                'session_id' => $newSessionId,
                'name' => $a['name'],
                'unit' => $a['unit'],
                'unit_cost' => $a['unit_cost'],
                'currency' => $a['currency'],
                'waste_factor' => $a['waste_factor'],
                'labor_rate' => $a['labor_rate'],
                'notes' => $a['notes'],
                'created_at' => $now
            ]);
            $assemblyMap[$a['id']] = $newAsmId;

            // Sub items
            $items = Database::fetchAll("SELECT * FROM takeoff_assembly_items WHERE assembly_id = :aid", ['aid' => $a['id']]);
            foreach ($items as $it) {
                Database::insert('takeoff_assembly_items', [
                    'assembly_id' => $newAsmId,
                    'material_name' => $it['material_name'],
                    'unit' => $it['unit'],
                    'quantity_per_assembly_unit' => $it['quantity_per_assembly_unit'],
                    'unit_cost' => $it['unit_cost'],
                    'supplier' => $it['supplier'],
                    'created_at' => $now
                ]);
            }
        }

        // Duplicate Measurements
        $measurements = Database::fetchAll("SELECT * FROM takeoff_measurements WHERE session_id = :sid AND deleted_at IS NULL", ['sid' => $id]);
        foreach ($measurements as $m) {
            Database::insert('takeoff_measurements', [
                'session_id' => $newSessionId,
                'blueprint_id' => $blueprintMap[$m['blueprint_id']] ?? null,
                'page_number' => $m['page_number'],
                'type' => $m['type'],
                'geometry' => $m['geometry'],
                'raw_quantity' => $m['raw_quantity'],
                'unit' => $m['unit'],
                'computed_quantity' => $m['computed_quantity'],
                'depth' => $m['depth'],
                'scale_id' => $scaleMap[$m['scale_id']] ?? null,
                'assembly_id' => $assemblyMap[$m['assembly_id']] ?? null,
                'label' => $m['label'],
                'notes' => $m['notes'],
                'color' => $m['color'],
                'created_by' => $userId,
                'created_at' => $now,
                'updated_at' => $now
            ]);
        }

        return Response::success(['id' => $newSessionId], 'Session duplicated successfully');
    }

    /* =========================================================================
     * BLUEPRINTS & MEDIA INTEGRATION
     * ========================================================================= */

    /**
     * Upload construction blueprint into Project Folder + Media Library
     */
    public function uploadBlueprint(Request $request): Response
    {
        $sessionId = (int)($request->param('id') ?: $sessionId);
        $session = Database::fetch("
            SELECT s.*, p.project_title 
            FROM takeoff_sessions s 
            LEFT JOIN projects p ON p.id = s.project_id 
            WHERE s.id = :id AND s.deleted_at IS NULL
        ", ['id' => $sessionId]);

        if (!$session) {
            return Response::error('Session not found', 404);
        }

        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            $msg = 'No file uploaded or upload error occurred';
            if (isset($_FILES['file']['error'])) {
                $errMap = [
                    UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
                    UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE in form',
                    UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
                    UPLOAD_ERR_NO_FILE => 'No file was uploaded'
                ];
                $msg = $errMap[$_FILES['file']['error']] ?? $msg;
            }
            return Response::error($msg, 400);
        }

        $file = $_FILES['file'];
        $origName = $file['name'];
        $tmpPath = $file['tmp_name'];
        $fileSize = (int)$file['size'];

        // MIME validation
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $tmpPath);
        finfo_close($finfo);

        $allowedMimes = [
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/webp',
            'image/tiff'
        ];

        if (!in_array($mime, $allowedMimes)) {
            return Response::error("Unsupported file type ({$mime}). Please upload a PDF, PNG, JPG, or TIFF blueprint.", 415);
        }

        // Build Project-Specific Folder Name: e.g. "Project_6720 - Oakwood Elementary" (safe from URL fragments)
        if (!empty($session['project_id'])) {
            $cleanTitle = preg_replace('/[^a-zA-Z0-9_\-\s]/', '', $session['project_title'] ?: 'Project');
            $cleanTitle = trim(preg_replace('/\s+/', ' ', $cleanTitle));
            $folderName = "Project_" . $session['project_id'] . " - " . ($cleanTitle ?: 'Project');
        } else {
            $cleanName = preg_replace('/[^a-zA-Z0-9_\-\s]/', '', $session['name'] ?: 'Takeoff');
            $cleanName = trim(preg_replace('/\s+/', ' ', $cleanName));
            $folderName = "Session_" . $sessionId . " - " . ($cleanName ?: 'Takeoff');
        }

        $uploadDir = dirname(dirname(__DIR__)) . '/public/uploads/media/' . $folderName;
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION)) ?: ($mime === 'application/pdf' ? 'pdf' : 'png');
        $safeName = uniqid('bp_', true) . '.' . $ext;
        $destPath = $uploadDir . '/' . $safeName;

        if (!move_uploaded_file($tmpPath, $destPath)) {
            return Response::error('Failed to save blueprint to storage', 500);
        }

        $relativePath = '/uploads/media/' . $folderName . '/' . $safeName;
        $currentUser = $this->user($request);
        $userId = $currentUser ? (int)$currentUser['id'] : 1;

        // Auto sync with Media Manager folder & media record
        $folderRow = Database::fetch("SELECT id FROM media_folders WHERE `name` = :name AND deleted_at IS NULL", ['name' => $folderName]);
        if (!$folderRow) {
            $folderId = Database::insert('media_folders', [
                'user_id' => $userId,
                'parent_id' => null,
                'name' => $folderName,
                'slug' => strtolower(preg_replace('/[^a-z0-9]+/i', '-', $folderName)),
                'path' => $folderName,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ]);
        } else {
            $folderId = $folderRow['id'];
        }

        $fileType = ($mime === 'application/pdf') ? 'document' : 'image';
        Database::insert('media', [
            'user_id' => $userId,
            'uploaded_by' => $userId,
            'folder_id' => $folderId,
            'original_name' => $origName,
            'stored_name' => $safeName,
            'file_path' => $relativePath,
            'file_type' => $fileType,
            'mime_type' => $mime,
            'file_size' => $fileSize,
            'is_public' => 1,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);

        // PDF Page count scan
        $pageCount = 1;
        if ($mime === 'application/pdf') {
            $pdfContent = @file_get_contents($destPath);
            if ($pdfContent) {
                preg_match_all("/\/Type\s*\/Page[^s]/", $pdfContent, $matches);
                if (!empty($matches[0])) {
                    $pageCount = max(1, count($matches[0]));
                }
            }
        }

        $bpId = Database::insert('takeoff_blueprints', [
            'session_id' => $sessionId,
            'original_filename' => $origName,
            'storage_path' => $relativePath,
            'mime_type' => $mime,
            'file_size' => $fileSize,
            'page_count' => $pageCount,
            'thumbnail_path' => $mime !== 'application/pdf' ? $relativePath : null,
            'uploaded_by' => $userId,
            'created_at' => date('Y-m-d H:i:s')
        ]);

        $created = Database::fetch("SELECT * FROM takeoff_blueprints WHERE id = :id", ['id' => $bpId]);
        return Response::success($created, 'Blueprint uploaded to project folder & media library', 201);
    }

    /**
     * Choose an existing file from ERP Media Library to use as a Blueprint
     */
    public function selectFromMedia(Request $request): Response
    {
        $sessionId = (int)($request->param('id') ?: $sessionId);
        $mediaId = (int)$request->input('media_id', 0);

        if ($mediaId <= 0) {
            return Response::error('Media ID is required', 400);
        }

        $media = Database::fetch("SELECT * FROM media WHERE id = :id AND deleted_at IS NULL", ['id' => $mediaId]);
        if (!$media) {
            return Response::error('Media file not found', 404);
        }

        $currentUser = $this->user($request);
        $userId = $currentUser ? (int)$currentUser['id'] : 1;

        $bpId = Database::insert('takeoff_blueprints', [
            'session_id' => $sessionId,
            'original_filename' => $media['original_name'],
            'storage_path' => $media['file_path'],
            'mime_type' => $media['mime_type'],
            'file_size' => $media['file_size'],
            'page_count' => 1,
            'thumbnail_path' => $media['file_path'],
            'uploaded_by' => $userId,
            'created_at' => date('Y-m-d H:i:s')
        ]);

        $created = Database::fetch("SELECT * FROM takeoff_blueprints WHERE id = :id", ['id' => $bpId]);
        return Response::success($created, 'Media file linked as takeoff blueprint');
    }

    /**
     * Load sample architectural blueprint (Floor Plan & Building Footprint)
     */
    public function loadSampleBlueprint(Request $request): Response
    {
        $sessionId = (int)($request->param('id'));
        $currentUser = $this->user($request);
        $userId = $currentUser ? (int)$currentUser['id'] : 1;

        $samplePath = '/uploads/media/sample_blueprints/commercial_footprint_plan.png';
        $fullPath = dirname(dirname(__DIR__)) . '/public' . $samplePath;

        $existing = Database::fetch("
            SELECT * FROM takeoff_blueprints 
            WHERE session_id = :sid AND storage_path = :path AND deleted_at IS NULL
        ", ['sid' => $sessionId, 'path' => $samplePath]);

        if ($existing) {
            return Response::success($existing, 'Sample blueprint already attached');
        }

        $bpId = Database::insert('takeoff_blueprints', [
            'session_id' => $sessionId,
            'original_filename' => 'Commercial_Footprint_A101.png',
            'storage_path' => $samplePath,
            'mime_type' => 'image/png',
            'file_size' => file_exists($fullPath) ? filesize($fullPath) : 36217,
            'page_count' => 1,
            'thumbnail_path' => $samplePath,
            'uploaded_by' => $userId,
            'created_at' => date('Y-m-d H:i:s')
        ]);

        // Auto-configure standard 10 px = 1 ft scale for this sample drawing
        Database::insert('takeoff_scales', [
            'session_id' => $sessionId,
            'name' => 'Blueprint Scale (10px = 1ft)',
            'pixels_per_unit' => 10.0,
            'unit' => 'ft',
            'calibration_points' => json_encode([]),
            'is_default' => 1,
            'created_at' => date('Y-m-d H:i:s')
        ]);

        $created = Database::fetch("SELECT * FROM takeoff_blueprints WHERE id = :id", ['id' => $bpId]);
        return Response::success($created, 'Sample commercial footprint blueprint loaded successfully', 201);
    }

    /**
     * Stream blueprint file with headers
     */
    public function getBlueprintFile(Request $request)
    {
        $id = (int)($request->param('id') ?: $id);
        $bp = Database::fetch("SELECT * FROM takeoff_blueprints WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);
        if (!$bp) {
            http_response_code(404);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'Blueprint not found']);
            exit;
        }

        $storagePath = '/' . ltrim($bp['storage_path'], '/');
        $fullPath = dirname(dirname(__DIR__)) . '/public' . $storagePath;
        if (!file_exists($fullPath)) {
            http_response_code(404);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'File missing from storage']);
            exit;
        }

        header('Content-Type: ' . $bp['mime_type']);
        header('Content-Length: ' . filesize($fullPath));
        header('Content-Disposition: inline; filename="' . basename($bp['original_filename']) . '"');
        header('Cache-Control: public, max-age=86400');
        header('Access-Control-Allow-Origin: *');

        readfile($fullPath);
        exit;
    }

    /**
     * Delete blueprint
     */
    public function deleteBlueprint(Request $request): Response
    {
        $id = (int)($request->param('id') ?: $id);
        $now = date('Y-m-d H:i:s');
        Database::update('takeoff_blueprints', ['deleted_at' => $now], 'id = :id', ['id' => $id]);
        Database::update('takeoff_measurements', ['deleted_at' => $now], 'blueprint_id = :bid', ['bid' => $id]);
        return Response::success(null, 'Blueprint and its associated measurements deleted');
    }

    /* =========================================================================
     * SCALES & CALIBRATION
     * ========================================================================= */

    /**
     * List scales for session
     */
    public function getScales(Request $request): Response
    {
        $sessionId = (int)($request->param('id') ?: $sessionId);
        $scales = Database::fetchAll("SELECT * FROM takeoff_scales WHERE session_id = :sid ORDER BY is_default DESC, id ASC", ['sid' => $sessionId]);
        return Response::success($scales);
    }

    /**
     * Calibrate scale from two points
     */
    public function calibrate(Request $request): Response
    {
        $sessionId = (int)($request->param('id') ?: $sessionId);
        $pointA = $request->input('point_a');
        $pointB = $request->input('point_b');
        $realDist = (float)$request->input('real_distance', 0);
        $unit = trim($request->input('unit', 'ft')) ?: 'ft';
        $name = trim($request->input('name', ''));

        if (!is_array($pointA) || !is_array($pointB) || $realDist <= 0) {
            return Response::error('Point A, Point B, and a positive real distance are required for calibration.', 400);
        }

        $ppu = TakeoffCalculatorService::calibrateScale($pointA, $pointB, $realDist);
        if (empty($name)) {
            $name = "Calibrated {$realDist} {$unit} (" . round($ppu, 1) . " px/{$unit})";
        }

        $isDefault = $request->input('is_default') ? 1 : 0;
        if ($isDefault) {
            Database::update('takeoff_scales', ['is_default' => 0], 'session_id = :sid', ['sid' => $sessionId]);
        }

        $scaleId = Database::insert('takeoff_scales', [
            'session_id' => $sessionId,
            'name' => $name,
            'pixels_per_unit' => $ppu,
            'unit' => $unit,
            'calibration_points' => json_encode([$pointA, $pointB]),
            'is_default' => $isDefault,
            'created_at' => date('Y-m-d H:i:s')
        ]);

        if ($isDefault) {
            Database::update('takeoff_sessions', ['default_scale_id' => $scaleId], 'id = :id', ['id' => $sessionId]);
        }

        $scale = Database::fetch("SELECT * FROM takeoff_scales WHERE id = :id", ['id' => $scaleId]);
        return Response::success($scale, 'Scale calibrated successfully', 201);
    }

    /**
     * Save manual scale
     */
    public function saveScale(Request $request): Response
    {
        $sessionId = (int)($request->param('id') ?: $sessionId);
        $name = trim($request->input('name', ''));
        $ppu = (float)$request->input('pixels_per_unit', 0);
        $unit = trim($request->input('unit', 'ft')) ?: 'ft';
        $isDefault = $request->input('is_default') ? 1 : 0;

        if (empty($name) || $ppu <= 0) {
            return Response::error('Scale name and positive pixels_per_unit are required', 400);
        }

        if ($isDefault) {
            Database::update('takeoff_scales', ['is_default' => 0], 'session_id = :sid', ['sid' => $sessionId]);
        }

        $scaleId = Database::insert('takeoff_scales', [
            'session_id' => $sessionId,
            'name' => $name,
            'pixels_per_unit' => $ppu,
            'unit' => $unit,
            'calibration_points' => json_encode([]),
            'is_default' => $isDefault,
            'created_at' => date('Y-m-d H:i:s')
        ]);

        if ($isDefault) {
            Database::update('takeoff_sessions', ['default_scale_id' => $scaleId], 'id = :id', ['id' => $sessionId]);
        }

        $scale = Database::fetch("SELECT * FROM takeoff_scales WHERE id = :id", ['id' => $scaleId]);
        return Response::success($scale, 'Scale created successfully', 201);
    }

    /**
     * Delete scale
     */
    public function deleteScale(Request $request): Response
    {
        $id = (int)($request->param('id') ?: $id);
        Database::query("DELETE FROM takeoff_scales WHERE id = :id", ['id' => $id]);
        return Response::success(null, 'Scale deleted');
    }

    /* =========================================================================
     * MEASUREMENTS (Batch & CRUD with Strict Server Math Verification)
     * ========================================================================= */

    /**
     * Get measurements with optional filtering
     */
    public function getMeasurements(Request $request): Response
    {
        $sessionId = (int)($request->param('id') ?: $sessionId);
        $page = $request->query('page_number');
        $type = $request->query('type');
        $assemblyId = $request->query('assembly_id');

        $where = ["m.session_id = :sid AND m.deleted_at IS NULL"];
        $params = ['sid' => $sessionId];

        if ($page !== null && $page !== '') {
            $where[] = "m.page_number = :page";
            $params['page'] = (int)$page;
        }

        if (!empty($type)) {
            $where[] = "m.type = :type";
            $params['type'] = $type;
        }

        if ($assemblyId !== null && $assemblyId !== '') {
            $where[] = "m.assembly_id = :aid";
            $params['aid'] = (int)$assemblyId;
        }

        $whereSql = implode(' AND ', $where);
        $measurements = Database::fetchAll("
            SELECT m.*, a.name as assembly_name, a.unit_cost as assembly_unit_cost, a.waste_factor as assembly_waste, a.labor_rate as assembly_labor
            FROM takeoff_measurements m
            LEFT JOIN takeoff_assemblies a ON a.id = m.assembly_id
            WHERE {$whereSql}
            ORDER BY m.id ASC
        ", $params);

        foreach ($measurements as &$m) {
            $m['geometry'] = json_decode($m['geometry'] ?? '[]', true);
            $unitCost = (float)($m['assembly_unit_cost'] ?? 0);
            $waste = (float)($m['assembly_waste'] ?? 0);
            $labor = (float)($m['assembly_labor'] ?? 0);
            $m['line_total'] = TakeoffCalculatorService::calculateLineTotal((float)$m['computed_quantity'], $unitCost, $waste, $labor);
        }

        return Response::success($measurements);
    }

    /**
     * Batch save / sync measurements (single or multiple)
     * Recomputes quantity SERVER-SIDE
     */
    public function batchSaveMeasurements(Request $request): Response
    {
        $sessionId = (int)($request->param('id') ?: $sessionId);
        $session = Database::fetch("SELECT * FROM takeoff_sessions WHERE id = :id AND deleted_at IS NULL", ['id' => $sessionId]);
        if (!$session) {
            return Response::error('Session not found', 404);
        }

        $currentUser = $this->user($request);
        $userId = $currentUser ? (int)$currentUser['id'] : 1;
        $now = date('Y-m-d H:i:s');

        $items = $request->input('measurements');
        if (!is_array($items)) {
            $items = [$request->all()];
        }

        // Cache scales for fast lookup
        $scales = Database::fetchAll("SELECT * FROM takeoff_scales WHERE session_id = :sid", ['sid' => $sessionId]);
        $scaleMap = [];
        $defaultPpu = 100.0;
        $defaultUnit = 'ft';
        foreach ($scales as $s) {
            $scaleMap[$s['id']] = $s;
            if ($s['is_default']) {
                $defaultPpu = (float)$s['pixels_per_unit'];
                $defaultUnit = $s['unit'];
            }
        }

        $savedIds = [];

        foreach ($items as $item) {
            if (empty($item['type']) || empty($item['geometry'])) {
                continue;
            }

            $type = $item['type'];
            $geom = is_string($item['geometry']) ? json_decode($item['geometry'], true) : $item['geometry'];
            $depth = isset($item['depth']) ? (float)$item['depth'] : null;

            // Resolve scale
            $scaleId = !empty($item['scale_id']) ? (int)$item['scale_id'] : ($session['default_scale_id'] ?: null);
            $ppu = $defaultPpu;
            $unit = $defaultUnit;
            if ($scaleId && isset($scaleMap[$scaleId])) {
                $ppu = (float)$scaleMap[$scaleId]['pixels_per_unit'];
                $unit = $scaleMap[$scaleId]['unit'];
            }

            // Server-side strict calculation
            $computed = TakeoffCalculatorService::calculateQuantity($type, $geom, $ppu, $depth);

            $data = [
                'session_id' => $sessionId,
                'blueprint_id' => !empty($item['blueprint_id']) ? (int)$item['blueprint_id'] : null,
                'page_number' => !empty($item['page_number']) ? (int)$item['page_number'] : 1,
                'type' => $type,
                'geometry' => json_encode($geom),
                'raw_quantity' => $computed['raw_quantity'],
                'unit' => $unit,
                'computed_quantity' => $computed['computed_quantity'],
                'depth' => $depth,
                'scale_id' => $scaleId,
                'assembly_id' => !empty($item['assembly_id']) ? (int)$item['assembly_id'] : null,
                'label' => trim($item['label'] ?? ucfirst($type)),
                'notes' => trim($item['notes'] ?? ''),
                'color' => trim($item['color'] ?? '#4f46e5'),
                'updated_at' => $now
            ];

            if (!empty($item['id']) && is_numeric($item['id'])) {
                $mId = (int)$item['id'];
                Database::update('takeoff_measurements', $data, 'id = :id AND session_id = :sid', ['id' => $mId, 'sid' => $sessionId]);
                $savedIds[] = $mId;
            } else {
                $data['created_by'] = $userId;
                $data['created_at'] = $now;
                $newId = Database::insert('takeoff_measurements', $data);
                $savedIds[] = $newId;
            }
        }

        // Return refreshed saved items
        $saved = [];
        if (!empty($savedIds)) {
            $inClause = implode(',', array_map('intval', $savedIds));
            $saved = Database::fetchAll("
                SELECT m.*, a.name as assembly_name, a.unit_cost as assembly_unit_cost, a.waste_factor as assembly_waste, a.labor_rate as assembly_labor
                FROM takeoff_measurements m
                LEFT JOIN takeoff_assemblies a ON a.id = m.assembly_id
                WHERE m.id IN ({$inClause})
            ");
            foreach ($saved as &$s) {
                $s['geometry'] = json_decode($s['geometry'] ?? '[]', true);
                $s['line_total'] = TakeoffCalculatorService::calculateLineTotal(
                    (float)$s['computed_quantity'],
                    (float)($s['assembly_unit_cost'] ?? 0),
                    (float)($s['assembly_waste'] ?? 0),
                    (float)($s['assembly_labor'] ?? 0)
                );
            }
        }

        return Response::success($saved, 'Measurements saved and calculated successfully');
    }

    /**
     * Update single measurement
     */
    public function updateMeasurement(Request $request): Response
    {
        $id = (int)($request->param('id') ?: $id);
        $m = Database::fetch("SELECT * FROM takeoff_measurements WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);
        if (!$m) {
            return Response::error('Measurement not found', 404);
        }

        $fields = [];
        $type = $request->input('type', $m['type']);
        $geom = $request->has('geometry')
            ? (is_string($request->input('geometry')) ? json_decode($request->input('geometry'), true) : $request->input('geometry'))
            : json_decode($m['geometry'], true);

        $depth = $request->has('depth') ? (float)$request->input('depth') : (float)$m['depth'];
        $scaleId = $request->has('scale_id') ? (int)$request->input('scale_id') : $m['scale_id'];

        $scale = $scaleId ? Database::fetch("SELECT * FROM takeoff_scales WHERE id = :id", ['id' => $scaleId]) : null;
        $ppu = $scale ? (float)$scale['pixels_per_unit'] : 100.0;
        $unit = $scale ? $scale['unit'] : $m['unit'];

        $computed = TakeoffCalculatorService::calculateQuantity($type, $geom, $ppu, $depth);

        $fields['type'] = $type;
        $fields['geometry'] = json_encode($geom);
        $fields['raw_quantity'] = $computed['raw_quantity'];
        $fields['computed_quantity'] = $computed['computed_quantity'];
        $fields['unit'] = $unit;
        $fields['depth'] = $depth;
        $fields['scale_id'] = $scaleId;

        if ($request->has('label')) $fields['label'] = trim($request->input('label'));
        if ($request->has('notes')) $fields['notes'] = trim($request->input('notes'));
        if ($request->has('color')) $fields['color'] = trim($request->input('color'));
        if ($request->has('assembly_id')) $fields['assembly_id'] = (int)$request->input('assembly_id') ?: null;

        $fields['updated_at'] = date('Y-m-d H:i:s');
        Database::update('takeoff_measurements', $fields, 'id = :id', ['id' => $id]);

        $updated = Database::fetch("
            SELECT m.*, a.name as assembly_name, a.unit_cost as assembly_unit_cost, a.waste_factor as assembly_waste, a.labor_rate as assembly_labor
            FROM takeoff_measurements m
            LEFT JOIN takeoff_assemblies a ON a.id = m.assembly_id
            WHERE m.id = :id
        ", ['id' => $id]);

        $updated['geometry'] = json_decode($updated['geometry'], true);
        $updated['line_total'] = TakeoffCalculatorService::calculateLineTotal(
            (float)$updated['computed_quantity'],
            (float)($updated['assembly_unit_cost'] ?? 0),
            (float)($updated['assembly_waste'] ?? 0),
            (float)($updated['assembly_labor'] ?? 0)
        );

        return Response::success($updated, 'Measurement updated');
    }

    /**
     * Delete measurement
     */
    public function deleteMeasurement(Request $request): Response
    {
        $id = (int)($request->param('id') ?: $id);
        Database::update('takeoff_measurements', ['deleted_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => $id]);
        return Response::success(null, 'Measurement deleted');
    }

    /**
     * Bulk delete measurements
     */
    public function bulkDeleteMeasurements(Request $request): Response
    {
        $ids = $request->input('ids');
        if (!is_array($ids) || empty($ids)) {
            return Response::error('Array of IDs required', 400);
        }

        $sanitized = array_map('intval', $ids);
        $inClause = implode(',', $sanitized);
        $now = date('Y-m-d H:i:s');

        Database::query("UPDATE takeoff_measurements SET deleted_at = '{$now}' WHERE id IN ({$inClause})");
        return Response::success(['deleted_count' => count($sanitized)], 'Selected measurements deleted');
    }

    /**
     * Link measurement to an assembly
     */
    public function linkAssembly(Request $request): Response
    {
        $id = (int)($request->param('id') ?: $id);
        $assemblyId = (int)$request->input('assembly_id') ?: null;
        Database::update('takeoff_measurements', [
            'assembly_id' => $assemblyId,
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = :id', ['id' => $id]);

        return Response::success(['assembly_id' => $assemblyId], 'Assembly linked successfully');
    }

    /* =========================================================================
     * ASSEMBLIES & ESTIMATION
     * ========================================================================= */

    /**
     * List assemblies for session
     */
    public function getAssemblies(Request $request): Response
    {
        $sessionId = (int)($request->param('id') ?: $sessionId);
        $assemblies = Database::fetchAll("SELECT * FROM takeoff_assemblies WHERE session_id = :sid ORDER BY id ASC", ['sid' => $sessionId]);
        foreach ($assemblies as &$a) {
            $a['items'] = Database::fetchAll("SELECT * FROM takeoff_assembly_items WHERE assembly_id = :aid ORDER BY id ASC", ['aid' => $a['id']]);
        }
        return Response::success($assemblies);
    }

    /**
     * Save assembly (create or update)
     */
    public function saveAssembly(Request $request): Response
    {
        $sessionId = (int)($request->param('id') ?: $sessionId);
        $id = (int)$request->input('id', 0);
        $name = trim($request->input('name', ''));
        if (empty($name)) {
            return Response::error('Assembly name is required', 400);
        }

        $data = [
            'session_id' => $sessionId,
            'name' => $name,
            'unit' => trim($request->input('unit', 'sq ft')) ?: 'sq ft',
            'unit_cost' => (float)$request->input('unit_cost', 0),
            'currency' => trim($request->input('currency', 'USD')) ?: 'USD',
            'waste_factor' => (float)$request->input('waste_factor', 0),
            'labor_rate' => (float)$request->input('labor_rate', 0),
            'notes' => trim($request->input('notes', ''))
        ];

        if ($id > 0) {
            Database::update('takeoff_assemblies', $data, 'id = :id AND session_id = :sid', ['id' => $id, 'sid' => $sessionId]);
            $asmId = $id;
        } else {
            $data['created_at'] = date('Y-m-d H:i:s');
            $asmId = Database::insert('takeoff_assemblies', $data);
        }

        $asm = Database::fetch("SELECT * FROM takeoff_assemblies WHERE id = :id", ['id' => $asmId]);
        $asm['items'] = Database::fetchAll("SELECT * FROM takeoff_assembly_items WHERE assembly_id = :aid", ['aid' => $asmId]);
        return Response::success($asm, 'Assembly saved successfully');
    }

    /**
     * Delete assembly
     */
    public function deleteAssembly(Request $request): Response
    {
        $id = (int)($request->param('id') ?: $id);
        Database::update('takeoff_measurements', ['assembly_id' => null], 'assembly_id = :aid', ['aid' => $id]);
        Database::query("DELETE FROM takeoff_assembly_items WHERE assembly_id = :aid", ['aid' => $id]);
        Database::query("DELETE FROM takeoff_assemblies WHERE id = :id", ['id' => $id]);
        return Response::success(null, 'Assembly deleted');
    }

    /**
     * Save sub-item inside an assembly
     */
    public function saveAssemblyItem(Request $request): Response
    {
        $assemblyId = (int)($request->param('id') ?: $assemblyId);
        $name = trim($request->input('material_name', ''));
        if (empty($name)) {
            return Response::error('Material name is required', 400);
        }

        $data = [
            'assembly_id' => $assemblyId,
            'material_name' => $name,
            'unit' => trim($request->input('unit', 'unit')) ?: 'unit',
            'quantity_per_assembly_unit' => (float)$request->input('quantity_per_assembly_unit', 1.0),
            'unit_cost' => (float)$request->input('unit_cost', 0),
            'supplier' => trim($request->input('supplier', ''))
        ];

        $itemId = (int)$request->input('id', 0);
        if ($itemId > 0) {
            Database::update('takeoff_assembly_items', $data, 'id = :id AND assembly_id = :aid', ['id' => $itemId, 'aid' => $assemblyId]);
        } else {
            $data['created_at'] = date('Y-m-d H:i:s');
            $itemId = Database::insert('takeoff_assembly_items', $data);
        }

        $item = Database::fetch("SELECT * FROM takeoff_assembly_items WHERE id = :id", ['id' => $itemId]);
        return Response::success($item, 'Assembly item saved');
    }

    /**
     * Delete assembly sub-item
     */
    public function deleteAssemblyItem(Request $request): Response
    {
        $id = (int)($request->param('id') ?: $id);
        Database::query("DELETE FROM takeoff_assembly_items WHERE id = :id", ['id' => $id]);
        return Response::success(null, 'Assembly item deleted');
    }

    /* =========================================================================
     * TOTALS & EXPORTS
     * ========================================================================= */

    /**
     * Get aggregate totals for a session
     */
    public function getTotals(Request $request): Response
    {
        $sessionId = (int)($request->param('id') ?: $sessionId);
        $measurements = Database::fetchAll("
            SELECT m.*, a.name as assembly_name, a.unit_cost as assembly_unit_cost, a.waste_factor as assembly_waste, a.labor_rate as assembly_labor
            FROM takeoff_measurements m
            LEFT JOIN takeoff_assemblies a ON a.id = m.assembly_id
            WHERE m.session_id = :sid AND m.deleted_at IS NULL
        ", ['sid' => $sessionId]);

        $totals = $this->calculateSessionTotalsInternal($sessionId, $measurements);
        return Response::success($totals);
    }

    /**
     * Export estimate session to CSV
     */
    public function export(Request $request): Response
    {
        $sessionId = (int)($request->param('id') ?: $sessionId);
        $session = Database::fetch("
            SELECT s.*, p.project_title 
            FROM takeoff_sessions s 
            LEFT JOIN projects p ON p.id = s.project_id 
            WHERE s.id = :id AND s.deleted_at IS NULL
        ", ['id' => $sessionId]);

        if (!$session) {
            return Response::error('Session not found', 404);
        }

        $format = strtolower(trim($request->input('format', 'csv')));
        if (!in_array($format, ['csv', 'xlsx', 'pdf'])) {
            $format = 'csv';
        }

        $measurements = Database::fetchAll("
            SELECT m.*, a.name as assembly_name, a.unit_cost as assembly_unit_cost, a.waste_factor as assembly_waste, a.labor_rate as assembly_labor
            FROM takeoff_measurements m
            LEFT JOIN takeoff_assemblies a ON a.id = m.assembly_id
            WHERE m.session_id = :sid AND m.deleted_at IS NULL
            ORDER BY m.id ASC
        ", ['sid' => $sessionId]);

        $exportDir = dirname(dirname(__DIR__)) . '/public/uploads/takeoff/exports';
        if (!is_dir($exportDir)) {
            mkdir($exportDir, 0755, true);
        }

        $filename = 'Takeoff_' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $session['name']) . '_' . date('Ymd_His') . '.' . ($format === 'xlsx' ? 'csv' : $format);
        $fullPath = $exportDir . '/' . $filename;
        $relativePath = '/uploads/takeoff/exports/' . $filename;

        // Build CSV export with UTF-8 BOM
        $fp = fopen($fullPath, 'w');
        fputs($fp, "\xEF\xBB\xBF");

        fputcsv($fp, ['Project Takeoff Estimate Report']);
        fputcsv($fp, ['Session:', $session['name']]);
        fputcsv($fp, ['Project:', $session['project_title'] ?: 'N/A']);
        fputcsv($fp, ['Generated At:', date('Y-m-d H:i:s')]);
        fputcsv($fp, []);

        fputcsv($fp, [
            'ID',
            'Page',
            'Type',
            'Label',
            'Assembly',
            'Raw Quantity (px)',
            'Unit',
            'Computed Quantity',
            'Unit Cost ($)',
            'Waste (%)',
            'Labor Rate ($)',
            'Line Total ($)',
            'Notes'
        ]);

        $grandTotal = 0.0;
        $grandQty = 0.0;

        foreach ($measurements as $m) {
            $cQty = (float)$m['computed_quantity'];
            $uCost = (float)($m['assembly_unit_cost'] ?? 0);
            $waste = (float)($m['assembly_waste'] ?? 0);
            $labor = (float)($m['assembly_labor'] ?? 0);
            $lineTotal = TakeoffCalculatorService::calculateLineTotal($cQty, $uCost, $waste, $labor);

            $grandTotal += $lineTotal;
            $grandQty += $cQty;

            fputcsv($fp, [
                $m['id'],
                $m['page_number'],
                strtoupper($m['type']),
                $m['label'],
                $m['assembly_name'] ?: 'None (Unassigned)',
                $m['raw_quantity'],
                $m['unit'],
                number_format($cQty, 2),
                number_format($uCost, 2),
                number_format($waste, 1) . '%',
                number_format($labor, 2),
                number_format($lineTotal, 2),
                $m['notes']
            ]);
        }

        fputcsv($fp, []);
        fputcsv($fp, ['', '', '', '', 'GRAND TOTAL:', '', '', number_format($grandQty, 2), '', '', '', '$' . number_format($grandTotal, 2), '']);

        fclose($fp);

        $currentUser = $this->user($request);
        $userId = $currentUser ? (int)$currentUser['id'] : 1;

        Database::insert('takeoff_exports', [
            'session_id' => $sessionId,
            'format' => $format,
            'storage_path' => $relativePath,
            'created_by' => $userId,
            'created_at' => date('Y-m-d H:i:s')
        ]);

        return Response::success([
            'download_url' => $relativePath,
            'filename' => $filename,
            'grand_total' => round($grandTotal, 2),
            'format' => $format
        ], 'Export generated successfully');
    }

    /**
     * Internal helper to compute summary aggregates
     */
    private function calculateSessionTotalsInternal(int $sessionId, array $measurements): array
    {
        $byType = [
            'rect' => ['count' => 0, 'quantity' => 0.0, 'total' => 0.0],
            'polygon' => ['count' => 0, 'quantity' => 0.0, 'total' => 0.0],
            'line' => ['count' => 0, 'quantity' => 0.0, 'total' => 0.0],
            'count' => ['count' => 0, 'quantity' => 0.0, 'total' => 0.0],
            'volume' => ['count' => 0, 'quantity' => 0.0, 'total' => 0.0]
        ];

        $byAssembly = [];
        $grandTotalCost = 0.0;
        $totalItems = count($measurements);

        foreach ($measurements as $m) {
            $t = $m['type'];
            $cQty = (float)$m['computed_quantity'];
            $uCost = (float)($m['assembly_unit_cost'] ?? 0);
            $waste = (float)($m['assembly_waste'] ?? 0);
            $labor = (float)($m['assembly_labor'] ?? 0);
            $lineTotal = TakeoffCalculatorService::calculateLineTotal($cQty, $uCost, $waste, $labor);

            if (isset($byType[$t])) {
                $byType[$t]['count']++;
                $byType[$t]['quantity'] += $cQty;
                $byType[$t]['total'] += $lineTotal;
            }

            $asmKey = $m['assembly_name'] ?: 'Unassigned Items';
            if (!isset($byAssembly[$asmKey])) {
                $byAssembly[$asmKey] = [
                    'name' => $asmKey,
                    'count' => 0,
                    'quantity' => 0.0,
                    'total' => 0.0,
                    'unit' => $m['unit']
                ];
            }
            $byAssembly[$asmKey]['count']++;
            $byAssembly[$asmKey]['quantity'] += $cQty;
            $byAssembly[$asmKey]['total'] += $lineTotal;

            $grandTotalCost += $lineTotal;
        }

        return [
            'total_measurements' => $totalItems,
            'grand_total_cost' => round($grandTotalCost, 2),
            'by_type' => $byType,
            'by_assembly' => array_values($byAssembly)
        ];
    }
}
