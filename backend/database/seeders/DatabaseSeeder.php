<?php

namespace Database\Seeders;

use App\Enums\TaskStatus;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Deterministic accounts, documented in the README. updateOrCreate keeps
        // re-seeding an existing database idempotent.
        $admin = $this->upsertUser('admin@example.com', 'Администратор', User::ROLE_ADMIN);
        $user = $this->upsertUser('user@example.com', 'Обычный пользователь', User::ROLE_USER);
        $second = $this->upsertUser('second@example.com', 'Второй пользователь', User::ROLE_USER);

        // Only seed tasks on a fresh database, otherwise every re-seed piles up
        // duplicates.
        if (Task::count() > 0) {
            return;
        }

        // Enough tasks for the regular user to span more than one page.
        Task::factory()->count(12)->for($user)->create();
        Task::factory()->count(6)->for($admin)->create();

        // A couple of tasks for a second user so the "admin sees everything"
        // behaviour is actually visible in the UI.
        Task::factory()->count(5)->for($second)->create();

        // A few fixed rows so search, filtering and the overdue badge have
        // something predictable to show on first login.
        Task::factory()->for($user)->status(TaskStatus::Pending)->create([
            'title' => 'Купить молоко',
            'description' => 'Цельное молоко, два литра.',
            'due_date' => now()->subDays(2),
        ]);

        Task::factory()->for($user)->status(TaskStatus::InProgress)->create([
            'title' => 'Написать README проекта',
            'description' => 'Установка, миграции, сиды и тестовые аккаунты.',
            'due_date' => now()->addDays(3),
        ]);

        Task::factory()->for($user)->status(TaskStatus::Completed)->create([
            'title' => 'Настроить базу данных',
            'description' => null,
            'due_date' => null,
        ]);
    }

    /**
     * role is not mass-assignable (see User::$fillable), so it is set
     * explicitly after the upsert.
     */
    private function upsertUser(string $email, string $name, string $role): User
    {
        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => Hash::make('password'),
            ]
        );

        $user->role = $role;
        $user->save();

        return $user;
    }
}
