<?php

namespace Tests\Unit;

use App\Enums\TaskStatus;
use PHPUnit\Framework\TestCase;

class TaskStatusTest extends TestCase
{
    public function test_values_returns_the_backing_strings(): void
    {
        $this->assertSame(['pending', 'in_progress', 'completed'], TaskStatus::values());
    }

    public function test_a_known_string_maps_back_to_a_case(): void
    {
        $this->assertSame(TaskStatus::InProgress, TaskStatus::from('in_progress'));
    }

    public function test_an_unknown_string_does_not_map_to_a_case(): void
    {
        $this->assertNull(TaskStatus::tryFrom('archived'));
    }
}
