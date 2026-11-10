<?php
namespace Core;

class App
{
    private static string $basePath;

    public static function bootstrap(string $basePath): void
    {
        self::$basePath = $basePath;

        // Register custom PSR-4 autoloader
        spl_autoload_register(function ($class) {
            $prefixCore = 'Core\\';
            $prefixApp  = 'App\\';

            if (str_starts_with($class, $prefixCore)) {
                $relativeClass = substr($class, strlen($prefixCore));
                $file = self::$basePath . '/core/' . str_replace('\\', '/', $relativeClass) . '.php';
                if (file_exists($file)) {
                    require_once $file;
                    return;
                }
            }

            if (str_starts_with($class, $prefixApp)) {
                $relativeClass = substr($class, strlen($prefixApp));
                $file = self::$basePath . '/app/' . str_replace('\\', '/', $relativeClass) . '.php';
                if (file_exists($file)) {
                    require_once $file;
                    return;
                }
            }
        });

        // Load environment
        DotEnv::load(self::$basePath . '/.env');

        // Configure error handling
        $debug = DotEnv::get('APP_DEBUG', 'true') === 'true';
        error_reporting($debug ? E_ALL : 0);
        ini_set('display_errors', $debug ? '1' : '0');

        set_exception_handler(function (\Throwable $e) {
            $response = [
                'success' => false,
                'message' => $e->getMessage(),
            ];

            if (DotEnv::get('APP_DEBUG', 'false') === 'true') {
                $response['file'] = $e->getFile();
                $response['line'] = $e->getLine();
                $response['trace'] = explode("\n", $e->getTraceAsString());
            }

            Response::json($response, 500)->send();
        });
    }

    public static function run(Router $router): void
    {
        $request = new Request();
        $response = $router->dispatch($request);
        $response->send();
    }

    public static function getBasePath(): string
    {
        return self::$basePath;
    }
}
