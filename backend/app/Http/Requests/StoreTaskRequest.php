<?php

namespace App\Http\Requests;

use App\Enums\TaskStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // the route already sits behind auth:sanctum
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:3', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date' => ['nullable', 'date'],
            'status' => ['required', Rule::enum(TaskStatus::class)],
        ];
    }

    /**
     * Status is optional for the client; new tasks start as pending.
     */
    protected function prepareForValidation(): void
    {
        if (! $this->filled('status')) {
            $this->merge(['status' => TaskStatus::Pending->value]);
        }
    }
}
