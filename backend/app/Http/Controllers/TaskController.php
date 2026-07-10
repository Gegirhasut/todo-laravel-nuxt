<?php

namespace App\Http\Controllers;

use App\Http\Requests\IndexTaskRequest;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TaskController extends Controller
{
    /**
     * Paginated task list.
     *
     * A user sees only their own tasks; admins see everyone's.
     *
     * Supports ?search, ?status, ?sort, ?direction, ?per_page, ?page.
     */
    public function index(IndexTaskRequest $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $tasks = Task::query()
            ->with('user')
            ->unless($user->isAdmin(), fn ($query) => $query->where('user_id', $user->id))
            ->search($request->query('search'))
            ->status($request->query('status'))
            ->sort($request->query('sort'), $request->query('direction'))
            ->paginate($request->perPage())
            ->withQueryString();

        return TaskResource::collection($tasks);
    }

    public function store(StoreTaskRequest $request): JsonResponse
    {
        $task = $request->user()->tasks()->create($request->validated());

        return (new TaskResource($task->load('user')))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Task $task): TaskResource
    {
        $this->authorize('view', $task);

        return new TaskResource($task->load('user'));
    }

    public function update(UpdateTaskRequest $request, Task $task): TaskResource
    {
        $this->authorize('update', $task);

        $task->update($request->validated());

        return new TaskResource($task->load('user'));
    }

    public function destroy(Task $task): JsonResponse
    {
        $this->authorize('delete', $task);

        $task->delete();

        return response()->json(['message' => __('api.task_deleted')]);
    }
}
