<?php
namespace App\Middleware;

use Core\Request;
use Core\Response;

class SuperAdminGuard
{
    public function handle(Request $request): ?Response
    {
        if (empty($request->user)) {
            return Response::error('Unauthenticated.', 401);
        }

        if ((int)$request->user['is_super_admin'] !== 1) {
            return Response::error('Forbidden: Super Admin privileges required.', 403);
        }

        return null;
    }
}
