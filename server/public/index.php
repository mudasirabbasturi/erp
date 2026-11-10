<?php
// Prevent output buffering issues
ob_start();

$basePath = dirname(__DIR__);

require_once $basePath . '/core/App.php';

// Bootstrap environment, autoloader, and error handling
\Core\App::bootstrap($basePath);

// Instantiate router
$router = new \Core\Router();

// Load route declarations
require_once $basePath . '/routes/api.php';

// Dispatch request
\Core\App::run($router);
