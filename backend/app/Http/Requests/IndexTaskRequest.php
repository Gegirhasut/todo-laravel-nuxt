<?php

namespace App\Http\Requests;

use App\Enums\TaskStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the query string of GET /api/tasks so that a malformed filter
 * comes back as a 422 instead of being silently ignored.
 */
class IndexTaskRequest extends FormRequest
{
    public const DEFAULT_PER_PAGE = 10;

    public const MAX_PER_PAGE = 100;

    /** Only the tasks the caller owns. */
    public const SCOPE_MINE = 'mine';

    /** Everyone's tasks; the ones the caller does not own are read-only. */
    public const SCOPE_ALL = 'all';

    public function authorize(): bool
    {
        return true; // the route already sits behind auth:sanctum
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::enum(TaskStatus::class)],
            'scope' => ['nullable', Rule::in([self::SCOPE_MINE, self::SCOPE_ALL])],
            'sort' => ['nullable', Rule::in(['due_date', 'status', 'title', 'created_at'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_PER_PAGE],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * Only the query string carries these parameters.
     *
     * @return array<string, mixed>
     */
    public function validationData(): array
    {
        return $this->query();
    }

    public function perPage(): int
    {
        return (int) ($this->query('per_page') ?: self::DEFAULT_PER_PAGE);
    }

    /**
     * Whether the caller asked to see everyone's tasks. Admins always do, so
     * for them the parameter makes no difference.
     */
    public function wantsEveryonesTasks(): bool
    {
        return $this->user()->isAdmin() || $this->query('scope') === self::SCOPE_ALL;
    }
}
