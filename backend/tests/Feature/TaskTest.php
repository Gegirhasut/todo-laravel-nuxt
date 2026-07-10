<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_tasks(): void
    {
        $this->getJson('/api/tasks')->assertStatus(401);
    }

    public function test_user_only_sees_their_own_tasks(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        Task::factory()->count(3)->for($user)->create();
        Task::factory()->count(2)->for($other)->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_admin_sees_tasks_from_every_user(): void
    {
        $admin = User::factory()->admin()->create();
        Task::factory()->count(4)->create(); // each gets its own random owner

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/tasks')
            ->assertOk()
            ->assertJsonCount(4, 'data');
    }

    public function test_user_can_create_a_task(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tasks', [
                'title' => 'Write the README',
                'description' => 'Cover setup and seeding',
                'due_date' => '2026-08-01',
                'status' => 'in_progress',
            ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Write the README')
            ->assertJsonPath('data.status', 'in_progress')
            ->assertJsonPath('data.due_date', '2026-08-01');

        $this->assertDatabaseHas('tasks', [
            'title' => 'Write the README',
            'user_id' => $user->id,
        ]);
    }

    public function test_a_new_task_defaults_to_pending(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tasks', ['title' => 'No status given'])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending');
    }

    public function test_a_task_is_always_owned_by_the_authenticated_user(): void
    {
        $user = User::factory()->create();
        $victim = User::factory()->create();

        // Trying to smuggle a foreign user_id through the request body.
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tasks', [
                'title' => 'Planted task',
                'user_id' => $victim->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.user_id', $user->id);

        $this->assertDatabaseMissing('tasks', ['user_id' => $victim->id]);
    }

    public function test_title_is_required_and_has_a_minimum_length(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tasks', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('title');

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tasks', ['title' => 'ab'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('title');
    }

    public function test_validation_messages_are_returned_in_russian(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tasks', [])
            ->assertStatus(422)
            ->assertJsonPath('errors.title.0', 'Поле название обязательно для заполнения.');

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tasks', ['title' => 'Годное название', 'status' => 'nope'])
            ->assertStatus(422)
            ->assertJsonPath('errors.status.0', 'Выбранное значение поля статус недопустимо.');
    }

    public function test_invalid_status_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tasks', ['title' => 'Valid title', 'status' => 'nope'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_invalid_due_date_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tasks', ['title' => 'Valid title', 'due_date' => 'yesterday-ish'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('due_date');
    }

    public function test_user_can_view_their_own_task(): void
    {
        $user = User::factory()->create();
        $task = Task::factory()->for($user)->create();

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/tasks/{$task->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $task->id);
    }

    public function test_user_can_view_another_users_task_but_not_change_it(): void
    {
        $user = User::factory()->create();
        $task = Task::factory()->create(['title' => 'Чужая задача']);

        // Reading is open to any authenticated user (the shared "all tasks" view)...
        $this->actingAs($user, 'sanctum')
            ->getJson("/api/tasks/{$task->id}")
            ->assertOk()
            ->assertJsonPath('data.title', 'Чужая задача');

        // ...but writing is not.
        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/tasks/{$task->id}", ['title' => 'Перехвачено'])
            ->assertStatus(403);
    }

    public function test_scope_all_lets_a_user_see_everyones_tasks(): void
    {
        $user = User::factory()->create();
        Task::factory()->count(3)->for($user)->create();
        Task::factory()->count(2)->create(); // other owners

        // Default: only their own.
        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks')
            ->assertOk()
            ->assertJsonCount(3, 'data');

        // scope=all: everyone's.
        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks?scope=all')
            ->assertOk()
            ->assertJsonCount(5, 'data');
    }

    public function test_scope_mine_is_the_default(): void
    {
        $user = User::factory()->create();
        Task::factory()->count(2)->for($user)->create();
        Task::factory()->count(4)->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks?scope=mine')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_admin_sees_everything_regardless_of_scope(): void
    {
        $admin = User::factory()->admin()->create();
        Task::factory()->count(4)->create();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/tasks?scope=mine')
            ->assertOk()
            ->assertJsonCount(4, 'data');
    }

    public function test_an_unknown_scope_returns_422(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks?scope=everything')
            ->assertStatus(422)
            ->assertJsonValidationErrors('scope');
    }

    public function test_scope_all_exposes_the_owner_of_each_task(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create(['name' => 'Второй пользователь']);
        Task::factory()->for($other)->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks?scope=all')
            ->assertOk()
            ->assertJsonPath('data.0.owner.name', 'Второй пользователь')
            ->assertJsonPath('data.0.user_id', $other->id);
    }

    public function test_user_can_update_their_own_task(): void
    {
        $user = User::factory()->create();
        $task = Task::factory()->for($user)->create(['status' => 'pending']);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/tasks/{$task->id}", ['status' => 'completed'])
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => 'completed']);
    }

    public function test_user_cannot_update_another_users_task(): void
    {
        $user = User::factory()->create();
        $task = Task::factory()->create(['title' => 'Untouched']);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/tasks/{$task->id}", ['title' => 'Hijacked title'])
            ->assertStatus(403);

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'title' => 'Untouched']);
    }

    public function test_admin_can_update_any_task(): void
    {
        $admin = User::factory()->admin()->create();
        $task = Task::factory()->create(['status' => 'pending']);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/tasks/{$task->id}", ['status' => 'completed'])
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');
    }

    public function test_user_can_delete_their_own_task(): void
    {
        $user = User::factory()->create();
        $task = Task::factory()->for($user)->create();

        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/tasks/{$task->id}")
            ->assertOk();

        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
    }

    public function test_user_cannot_delete_another_users_task(): void
    {
        $user = User::factory()->create();
        $task = Task::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/tasks/{$task->id}")
            ->assertStatus(403);

        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }

    public function test_admin_can_delete_any_task(): void
    {
        $admin = User::factory()->admin()->create();
        $task = Task::factory()->create();

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/tasks/{$task->id}")
            ->assertOk();

        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
    }

    public function test_a_missing_task_returns_404(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks/999999')
            ->assertStatus(404)
            ->assertExactJson(['message' => 'Ресурс не найден.']);
    }

    public function test_status_filter_works(): void
    {
        $user = User::factory()->create();
        Task::factory()->for($user)->count(2)->create(['status' => 'completed']);
        Task::factory()->for($user)->count(3)->create(['status' => 'pending']);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks?status=completed')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_an_unknown_status_filter_returns_422(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks?status=archived')
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_search_matches_title_and_description(): void
    {
        $user = User::factory()->create();
        Task::factory()->for($user)->create(['title' => 'Buy milk', 'description' => null]);
        Task::factory()->for($user)->create(['title' => 'Call plumber', 'description' => 'About the milk float']);
        Task::factory()->for($user)->create(['title' => 'Unrelated', 'description' => 'Nothing here']);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks?search=milk')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_search_does_not_leak_other_users_tasks(): void
    {
        $user = User::factory()->create();
        Task::factory()->create(['title' => 'Secret milk plans']); // someone else's

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks?search=milk')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_sorting_by_due_date_puts_tasks_without_a_deadline_last(): void
    {
        $user = User::factory()->create();
        Task::factory()->for($user)->create(['title' => 'No deadline', 'due_date' => null]);
        Task::factory()->for($user)->create(['title' => 'Later', 'due_date' => '2026-12-01']);
        Task::factory()->for($user)->create(['title' => 'Sooner', 'due_date' => '2026-01-01']);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks?sort=due_date&direction=asc')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Sooner')
            ->assertJsonPath('data.1.title', 'Later')
            ->assertJsonPath('data.2.title', 'No deadline');
    }

    public function test_an_unknown_sort_column_returns_422(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks?sort=user_id')
            ->assertStatus(422)
            ->assertJsonValidationErrors('sort');
    }

    public function test_list_is_paginated(): void
    {
        $user = User::factory()->create();
        Task::factory()->for($user)->count(25)->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks?per_page=10')
            ->assertOk()
            ->assertJsonCount(10, 'data')
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.last_page', 3)
            ->assertJsonPath('meta.total', 25);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks?per_page=10&page=3')
            ->assertOk()
            ->assertJsonCount(5, 'data')
            ->assertJsonPath('meta.current_page', 3);
    }

    public function test_per_page_is_capped(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tasks?per_page=500')
            ->assertStatus(422)
            ->assertJsonValidationErrors('per_page');
    }
}
