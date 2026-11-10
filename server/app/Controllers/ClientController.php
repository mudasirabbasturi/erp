<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;
use App\Services\ActivityLogger;

class ClientController extends Controller
{
    /**
     * List all clients with dynamic column query and filtering
     */
    public function index(Request $request): Response
    {
        $page = (int)$request->query('page', 1);
        $perPage = (int)$request->query('per_page', 25);
        $search = trim($request->query('search', ''));
        $clientType = $request->query('client_type');

        $offset = ($page - 1) * $perPage;
        $where = ["c.deleted_at IS NULL"];
        $params = [];

        if (!empty($search)) {
            $where[] = "(c.name LIKE :search_name OR c.title LIKE :search_title OR c.email LIKE :search_email OR c.phone LIKE :search_phone OR c.city LIKE :search_city)";
            $params['search_name'] = "%{$search}%";
            $params['search_title'] = "%{$search}%";
            $params['search_email'] = "%{$search}%";
            $params['search_phone'] = "%{$search}%";
            $params['search_city'] = "%{$search}%";
        }

        if (!empty($clientType) && $clientType !== 'all') {
            $where[] = "c.client_type = :client_type";
            $params['client_type'] = $clientType;
        }

        $whereSql = implode(' AND ', $where);

        $totalSql = "SELECT COUNT(*) FROM clients c WHERE {$whereSql}";
        $total = (int)Database::fetchColumn($totalSql, $params);

        // Fetch active columns configured for 'clients' entity
        $activeCols = Database::fetchAll("SELECT column_name FROM entity_column_configs WHERE entity = 'clients' AND is_active = 1");
        $activeColNames = array_column($activeCols, 'column_name');

        // Core fields always included
        $selectFields = [
            'c.id',
            'c.title',
            'c.name',
            'c.email',
            'c.phone',
            'c.address',
            'c.city',
            'c.state',
            'c.country',
            'c.client_type',
            'c.created_at',
            'c.updated_at'
        ];

        // Dynamically add any custom active columns present in clients schema
        $clientCols = Database::fetchAll("SHOW COLUMNS FROM clients");
        $clientColMap = array_flip(array_column($clientCols, 'Field'));

        foreach ($activeColNames as $col) {
            if (isset($clientColMap[$col]) && !in_array("c.{$col}", $selectFields)) {
                $selectFields[] = "c.{$col}";
            }
        }

        $fieldsSql = implode(', ', $selectFields);

        $sql = "SELECT {$fieldsSql}
                FROM clients c
                WHERE {$whereSql}
                ORDER BY c.id DESC
                LIMIT {$perPage} OFFSET {$offset}";

        $items = Database::fetchAll($sql, $params);

        return $this->paginate($items, $total, $page, $perPage, 'Clients retrieved successfully');
    }

    /**
     * Show single client details
     */
    public function show(Request $request): Response
    {
        $id = (int)$request->param('id');
        $client = Database::fetch("SELECT * FROM clients WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);

        if (!$client) {
            return $this->error('Client record not found.', 404);
        }

        return $this->success($client, 'Client details retrieved');
    }

    /**
     * Create a new client (supports all dynamic columns)
     */
    public function store(Request $request): Response
    {
        $user = $this->user($request);
        $name = trim($request->input('name', ''));

        if (empty($name)) {
            return $this->error('Client Name is required.', 422);
        }

        // Fetch valid columns from table
        $columns = Database::fetchAll("SHOW COLUMNS FROM clients");
        $validCols = array_column($columns, 'Field');

        $inputData = $request->all();
        $insertData = [];

        foreach ($validCols as $col) {
            if (in_array($col, ['id', 'created_at', 'updated_at', 'deleted_at'])) continue;

            if (array_key_exists($col, $inputData)) {
                $insertData[$col] = $inputData[$col] !== '' ? $inputData[$col] : null;
            }
        }

        $insertData['name'] = $name;
        if (!isset($insertData['client_type'])) {
            $insertData['client_type'] = 'normal';
        }
        $insertData['created_at'] = date('Y-m-d H:i:s');
        $insertData['updated_at'] = date('Y-m-d H:i:s');

        $clientId = Database::insert('clients', $insertData);
        $client = Database::fetch("SELECT * FROM clients WHERE id = :id", ['id' => $clientId]);

        ActivityLogger::log(
            $user ? (int)$user['id'] : null,
            'created',
            'clients',
            $clientId,
            $name,
            "Created client '{$name}'" . (!empty($insertData['title']) ? " (Code: {$insertData['title']})" : ""),
            null,
            $insertData
        );

        return $this->success($client, 'Client created successfully', 201);
    }

    /**
     * Update an existing client (supports all dynamic columns)
     */
    public function update(Request $request): Response
    {
        $id = (int)$request->param('id');
        $user = $this->user($request);

        $client = Database::fetch("SELECT * FROM clients WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);
        if (!$client) {
            return $this->error('Client record not found.', 404);
        }

        // Fetch valid columns from table
        $columns = Database::fetchAll("SHOW COLUMNS FROM clients");
        $validCols = array_column($columns, 'Field');

        $inputData = $request->all();
        $updateData = [];

        foreach ($validCols as $col) {
            if (in_array($col, ['id', 'created_at', 'updated_at', 'deleted_at'])) continue;

            if (array_key_exists($col, $inputData)) {
                $updateData[$col] = $inputData[$col] !== '' ? $inputData[$col] : null;
            }
        }

        $updateData['updated_at'] = date('Y-m-d H:i:s');

        Database::update('clients', $updateData, 'id = :id', ['id' => $id]);
        $updated = Database::fetch("SELECT * FROM clients WHERE id = :id", ['id' => $id]);

        ActivityLogger::log(
            $user ? (int)$user['id'] : null,
            'updated',
            'clients',
            $id,
            $updated['name'],
            "Updated client '{$updated['name']}' details",
            $client,
            $updateData
        );

        return $this->success($updated, 'Client updated successfully');
    }

    /**
     * Soft delete a client
     */
    public function destroy(Request $request): Response
    {
        $id = (int)$request->param('id');
        $user = $this->user($request);

        $client = Database::fetch("SELECT * FROM clients WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);
        if (!$client) {
            return $this->error('Client record not found.', 404);
        }

        Database::update('clients', ['deleted_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => $id]);

        ActivityLogger::log(
            $user ? (int)$user['id'] : null,
            'deleted',
            'clients',
            $id,
            $client['name'],
            "Deleted client '{$client['name']}'",
            $client,
            ['deleted_at' => date('Y-m-d H:i:s')]
        );

        return $this->success(null, 'Client deleted successfully');
    }
}

