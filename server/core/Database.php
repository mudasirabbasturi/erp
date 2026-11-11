<?php
namespace Core;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $instance = null;

    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $host = DotEnv::get('DB_HOST', '127.0.0.1');
            $port = DotEnv::get('DB_PORT', '3306');
            $database = DotEnv::get('DB_DATABASE', 'imp');
            $username = DotEnv::get('DB_USERNAME', 'root');
            $password = DotEnv::get('DB_PASSWORD', '');
            $charset = DotEnv::get('DB_CHARSET', 'utf8mb4');

            $dsn = "mysql:host={$host};port={$port};dbname={$database};charset={$charset}";

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            try {
                self::$instance = new PDO($dsn, $username, $password, $options);
            } catch (PDOException $e) {
                throw new \Exception("Database Connection Error: " . $e->getMessage(), (int)$e->getCode());
            }
        }

        return self::$instance;
    }

    public static function query(string $sql, array $params = []): \PDOStatement
    {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public static function execute(string $sql, array $params = []): int
    {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public static function fetch(string $sql, array $params = []): ?array
    {
        $stmt = self::query($sql, $params);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    public static function fetchOne(string $sql, array $params = []): ?array
    {
        return self::fetch($sql, $params);
    }

    public static function fetchAll(string $sql, array $params = []): array
    {
        $stmt = self::query($sql, $params);
        return $stmt->fetchAll();
    }

    public static function fetchColumn(string $sql, array $params = []): mixed
    {
        $stmt = self::query($sql, $params);
        return $stmt->fetchColumn();
    }

    public static function insert(string $table, array $data): int|string
    {
        $columns = implode(', ', array_keys($data));
        $placeholders = implode(', ', array_map(fn($col) => ":{$col}", array_keys($data)));

        $sql = "INSERT INTO {$table} ({$columns}) VALUES ({$placeholders})";
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($data);

        return self::getConnection()->lastInsertId();
    }

    public static function update(string $table, array $data, string $where, array $whereParams = []): int
    {
        $setClauses = [];
        $params = [];

        foreach ($data as $column => $value) {
            $setClauses[] = "`{$column}` = :set_{$column}";
            $params["set_{$column}"] = $value;
        }

        $setString = implode(', ', $setClauses);
        $sql = "UPDATE {$table} SET {$setString} WHERE {$where}";

        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute(array_merge($params, $whereParams));

        return $stmt->rowCount();
    }

    public static function delete(string $table, string $where, array $whereParams = []): int
    {
        $sql = "DELETE FROM {$table} WHERE {$where}";
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($whereParams);
        return $stmt->rowCount();
    }

    public static function beginTransaction(): bool
    {
        return self::getConnection()->beginTransaction();
    }

    public static function commit(): bool
    {
        return self::getConnection()->commit();
    }

    public static function rollBack(): bool
    {
        if (self::getConnection()->inTransaction()) {
            return self::getConnection()->rollBack();
        }
        return false;
    }

    public static function inTransaction(): bool
    {
        return self::getConnection()->inTransaction();
    }
}
