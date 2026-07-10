<?php

namespace Database\Factories;

use App\Enums\TaskStatus;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Task> */
class TaskFactory extends Factory
{
    protected $model = Task::class;

    /**
     * Faker has no Russian lorem provider — it quietly falls back to Latin —
     * so the demo data is built from these instead.
     *
     * @var list<string>
     */
    private const ACTIONS = [
        'Подготовить',
        'Обновить',
        'Проверить',
        'Согласовать',
        'Отправить',
        'Спланировать',
        'Настроить',
        'Оформить',
        'Обсудить',
        'Исправить',
    ];

    /** @var list<string> */
    private const SUBJECTS = [
        'отчёт за месяц',
        'документацию по API',
        'список задач на неделю',
        'договор с подрядчиком',
        'письмо клиенту',
        'план релиза',
        'сборку проекта',
        'заявку на отпуск',
        'резервную копию базы',
        'макет главной страницы',
        'бюджет на квартал',
        'доступы для нового сотрудника',
    ];

    /** @var list<string> */
    private const NOTES = [
        'Не забыть приложить ссылки на исходники.',
        'Сначала уточнить детали у команды.',
        'Дедлайн переносить нельзя.',
        'После завершения отписаться в общий чат.',
        'Нужен второй взгляд перед отправкой.',
    ];

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'title' => fake()->randomElement(self::ACTIONS).' '.fake()->randomElement(self::SUBJECTS),
            'description' => fake()->optional()->randomElement(self::NOTES),
            'due_date' => fake()->optional()->dateTimeBetween('-5 days', '+20 days'),
            'status' => fake()->randomElement(TaskStatus::values()),
        ];
    }

    public function status(TaskStatus $status): static
    {
        return $this->state(fn () => ['status' => $status->value]);
    }
}
