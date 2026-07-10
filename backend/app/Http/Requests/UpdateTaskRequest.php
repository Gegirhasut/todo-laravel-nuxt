<?php

namespace App\Http\Requests;

use App\Enums\TaskStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // ownership is enforced by TaskPolicy in the controller
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        // PATCH-friendly: each field is optional, but validated when present.
        return [
            'title' => ['sometimes', 'required', 'string', 'min:3', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'due_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'status' => ['sometimes', 'required', Rule::enum(TaskStatus::class)],
        ];
    }
}
