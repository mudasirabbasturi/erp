<?php
require_once __DIR__ . '/../core/DotEnv.php';
require_once __DIR__ . '/../core/Database.php';

Core\DotEnv::load(__DIR__ . '/../.env');
$pdo = Core\Database::getConnection();

$pdo->exec("ALTER TABLE `user_tokens` ADD COLUMN IF NOT EXISTS `name` VARCHAR(100) NULL AFTER `token`;");
echo "TOKEN SCHEMA FIXED!\n";

