<?php
namespace App\Middleware;

use Core\Request;
use Core\Response;

class RbacMiddleware
{
    private ?string $requiredPermission;

    public function __construct(?string $requiredPermission = null)
    {
        $this->requiredPermission = $requiredPermission;
    }

    public function handle(Request $request): ?Response
    {
        if (empty($request->user)) {
            return Response::error('Unauthenticated.', 401);
        }

        // Super Admin bypass: possesses total unrestricted access to all endpoints
        if ((int)$request->user['is_super_admin'] === 1) {
            return null;
        }

        if ($this->requiredPermission !== null) {
            $userPerms = $request->user['permissions'] ?? [];
            if (!in_array($this->requiredPermission, $userPerms)) {
                return Response::error("Forbidden: You lack the required permission [{$this->requiredPermission}].", 403);
            }
        }

        return null;
    }
}
