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
        $admin = User::updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Администратор',
                'password' => Hash::make('password'),
                'role' => User::ROLE_ADMIN,
            ]
        );

        $user = User::updateOrCreate(
            ['email' => 'user@example.com'],
            [
                'name' => 'Обычный пользователь',
                'password' => Hash::make('password'),
                'role' => User::ROLE_USER,
            ]
        );

        $second = User::updateOrCreate(
            ['email' => 'second@example.com'],
            [
                'name' => 'Второй пользователь',
                'password' => Hash::make('password'),
                'role' => User::ROLE_USER,
            ]
        );

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
}
