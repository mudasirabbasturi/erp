<?php
namespace Core;

abstract class Controller
{
    protected function json(mixed $data, int $statusCode = 200, array $headers = []): Response
    {
        return Response::json($data, $statusCode, $headers);
    }

    protected function success(mixed $data = null, string $message = 'Success', int $statusCode = 200): Response
    {
        return Response::success($data, $message, $statusCode);
    }

    protected function error(string $message = 'An error occurred', int $statusCode = 400, mixed $errors = null): Response
    {
        return Response::error($message, $statusCode, $errors);
    }

    protected function paginate(array $items, int $total, int $page, int $perPage, string $message = 'Data retrieved successfully'): Response
    {
        return Response::paginate($items, $total, $page, $perPage, $message);
    }

    protected function validate(Request $request, array $rules): array
    {
        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            Response::error('Validation Failed', 422, $validator->errors())->send();
        }

        return $validator->validated();
    }

    protected function user(Request $request): ?array
    {
        return $request->user;
    }

    protected function isSuperAdmin(Request $request): bool
    {
        return !empty($request->user) && (int)$request->user['is_super_admin'] === 1;
    }
}
