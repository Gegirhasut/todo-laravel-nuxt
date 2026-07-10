<?php

namespace App\Exceptions;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/**
 * Single place that defines the JSON error contract for the whole API, so
 * every failure mode comes back in the same shape:
 *
 *   { "message": "...", "errors": { "field": ["..."] }? }
 *
 * 401 unauthenticated, 403 forbidden, 404 not found, 422 validation,
 * 500 unexpected.
 */
class ApiExceptionHandler
{
    public static function register(Exceptions $exceptions): void
    {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => static::wantsJson($request)
        );

        $exceptions->render(function (Throwable $e, Request $request) {
            if (! static::wantsJson($request)) {
                return null; // non-API requests keep Laravel's default handling
            }

            return static::toJson($e);
        });
    }

    protected static function wantsJson(Request $request): bool
    {
        return $request->is('api/*') || $request->expectsJson();
    }

    /**
     * Laravel's handler has already normalised a few exceptions by the time we
     * get here (AuthorizationException -> AccessDeniedHttpException,
     * ModelNotFoundException -> NotFoundHttpException), so both the original
     * and the mapped types are matched below.
     */
    protected static function toJson(Throwable $e): JsonResponse
    {
        return match (true) {
            $e instanceof ValidationException => response()->json([
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422),

            $e instanceof AuthenticationException => response()->json([
                'message' => 'Unauthenticated.',
            ], 401),

            $e instanceof AuthorizationException,
            $e instanceof AccessDeniedHttpException => response()->json([
                'message' => $e->getMessage() ?: 'This action is unauthorized.',
            ], 403),

            $e instanceof ModelNotFoundException,
            $e instanceof NotFoundHttpException => response()->json([
                'message' => 'Resource not found.',
            ], 404),

            $e instanceof HttpExceptionInterface => response()->json([
                'message' => $e->getMessage() ?: 'HTTP error.',
            ], $e->getStatusCode()),

            default => response()->json(array_merge(
                ['message' => 'Server error.'],
                // Never leak internals unless debugging is explicitly enabled.
                config('app.debug') ? [
                    'exception' => $e::class,
                    'detail' => $e->getMessage(),
                ] : []
            ), 500),
        };
    }
}
