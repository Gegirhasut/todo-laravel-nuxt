<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;

class TaskPolicy
{
    /**
     * Reading a single task is open to any authenticated user — the list can be
     * browsed with ?scope=all, so a task the caller does not own may well be on
     * their screen already.
     */
    public function view(User $user, Task $task): bool
    {
        return true;
    }

    /**
     * Changing a task is limited to its owner. Admins may act on any task.
     */
    public function update(User $user, Task $task): bool
    {
        return $this->owns($user, $task);
    }

    public function delete(User $user, Task $task): bool
    {
        return $this->owns($user, $task);
    }

    private function owns(User $user, Task $task): bool
    {
        return $user->isAdmin() || $task->user_id === $user->id;
    }
}
