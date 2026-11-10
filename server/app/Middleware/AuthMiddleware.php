<?php
namespace App\Middleware;

use Core\Auth;
use Core\Request;
use Core\Response;

class AuthMiddleware
{
    public function handle(Request $request): ?Response
    {
        $token = $request->bearerToken() ?: $request->query('token');

        if (!$token) {
            return Response::error('Unauthenticated: Bearer token is missing.', 401);
        }

        $user = Auth::validateToken($token);

        if (!$user) {
            return Response::error('Unauthenticated: Invalid or expired token.', 401);
        }

        $request->user = $user;
        return null;
    }
}
