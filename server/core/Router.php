<?php
namespace Core;

class Router
{
    private array $routes = [];
    private string $groupPrefix = '';
    private array $groupMiddlewares = [];

    public function get(string $uri, mixed $handler, array $middlewares = []): self
    {
        return $this->addRoute('GET', $uri, $handler, $middlewares);
    }

    public function post(string $uri, mixed $handler, array $middlewares = []): self
    {
        return $this->addRoute('POST', $uri, $handler, $middlewares);
    }

    public function put(string $uri, mixed $handler, array $middlewares = []): self
    {
        return $this->addRoute('PUT', $uri, $handler, $middlewares);
    }

    public function patch(string $uri, mixed $handler, array $middlewares = []): self
    {
        return $this->addRoute('PATCH', $uri, $handler, $middlewares);
    }

    public function delete(string $uri, mixed $handler, array $middlewares = []): self
    {
        return $this->addRoute('DELETE', $uri, $handler, $middlewares);
    }

    public function options(string $uri, mixed $handler): self
    {
        return $this->addRoute('OPTIONS', $uri, $handler);
    }

    public function group(string $prefix, callable $callback, array $middlewares = []): void
    {
        $previousPrefix = $this->groupPrefix;
        $previousMiddlewares = $this->groupMiddlewares;

        $this->groupPrefix = rtrim($this->groupPrefix . '/' . trim($prefix, '/'), '/');
        $this->groupMiddlewares = array_merge($this->groupMiddlewares, $middlewares);

        $callback($this);

        $this->groupPrefix = $previousPrefix;
        $this->groupMiddlewares = $previousMiddlewares;
    }

    private function addRoute(string $method, string $uri, mixed $handler, array $middlewares = []): self
    {
        $fullUri = $this->groupPrefix . '/' . trim($uri, '/');
        $fullUri = '/' . trim($fullUri, '/');
        if ($fullUri === '') $fullUri = '/';

        // Convert {param} to named regex pattern
        $pattern = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '(?P<$1>[^/]+)', $fullUri);
        $pattern = '#^' . $pattern . '$#';

        $allMiddlewares = array_merge($this->groupMiddlewares, $middlewares);

        $this->routes[] = [
            'method'      => strtoupper($method),
            'pattern'     => $pattern,
            'handler'     => $handler,
            'uri'         => $fullUri,
            'middlewares' => $allMiddlewares,
        ];

        return $this;
    }

    public function dispatch(Request $request): Response
    {
        $method = $request->method();
        $uri = strtok($request->uri(), '?');
        $uri = '/' . trim($uri, '/');
        if ($uri === '') $uri = '/';

        // Preflight OPTIONS handler
        if ($method === 'OPTIONS') {
            return Response::json(['status' => 'ok'], 200, [
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With, Accept',
            ]);
        }

        foreach ($this->routes as $route) {
            if ($route['method'] === $method && preg_match($route['pattern'], $uri, $matches)) {
                $params = array_filter($matches, fn($key) => is_string($key), ARRAY_FILTER_USE_KEY);
                $request->setParams($params);

                // Run middlewares in chain
                foreach ($route['middlewares'] as $mw) {
                    $mwInstance = is_string($mw) ? new $mw() : $mw;
                    $result = $mwInstance->handle($request);
                    if ($result instanceof Response) {
                        return $result;
                    }
                }

                $handler = $route['handler'];

                if (is_callable($handler)) {
                    $response = $handler($request);
                } elseif (is_array($handler) && count($handler) === 2) {
                    [$class, $action] = $handler;
                    $controller = new $class();
                    $response = $controller->$action($request);
                } elseif (is_string($handler) && str_contains($handler, '@')) {
                    [$class, $action] = explode('@', $handler);
                    $controller = new $class();
                    $response = $controller->$action($request);
                } else {
                    return Response::error("Invalid route handler configured.", 500);
                }

                if ($response instanceof Response) {
                    return $response;
                }

                if (is_array($response) || is_object($response)) {
                    return Response::json($response);
                }

                return new Response((string)$response, 200);
            }
        }

        return Response::error("Endpoint not found: {$method} {$uri}", 404);
    }
}
