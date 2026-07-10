<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;

/**
 * Admins may act on any task; a regular user only on the ones they own.
 */
class TaskPolicy
{
    public function view(User $user, Task $task): bool
    {
        return $this->owns($user, $task);
    }

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
