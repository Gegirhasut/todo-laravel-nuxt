<?php

namespace App\Enums;

enum TaskStatus: string
{
    case Pending = 'pending';
    case InProgress = 'in_progress';
    case Completed = 'completed';

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Where the status sits in the task lifecycle, for sorting: active work
     * first, the backlog next, finished last. This is the single place the
     * order is defined — queries derive their CASE expression from it.
     */
    public function sortOrder(): int
    {
        return match ($this) {
            self::InProgress => 0,
            self::Pending => 1,
            self::Completed => 2,
        };
    }
}
