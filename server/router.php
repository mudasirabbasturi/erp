<?php
// router.php for PHP built-in web server
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Serve static assets directly if they exist
$publicFile = __DIR__ . '/public' . $uri;

if ($uri !== '/' && file_exists($publicFile) && !is_dir($publicFile)) {
    // Serve mime type properly
    $mime = mime_content_type($publicFile);
    if ($mime) {
        header("Content-Type: {$mime}");
    }
    header("Access-Control-Allow-Origin: *");
    header("Content-Length: " . filesize($publicFile));
    readfile($publicFile);
    exit;
}

// Route all requests to public/index.php
require_once __DIR__ . '/public/index.php';
