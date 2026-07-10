<?php

namespace Tests\Unit;

use App\Models\Task;
use App\Models\User;
use App\Policies\TaskPolicy;
use PHPUnit\Framework\TestCase;

/**
 * The policy is pure logic over two models, so it is exercised here with
 * in-memory instances rather than through the database.
 */
class TaskPolicyTest extends TestCase
{
    private TaskPolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();
        $this->policy = new TaskPolicy;
    }

    private function user(int $id, string $role = User::ROLE_USER): User
    {
        return (new User)->forceFill(['id' => $id, 'role' => $role]);
    }

    private function taskOwnedBy(int $userId): Task
    {
        return (new Task)->forceFill(['id' => 99, 'user_id' => $userId]);
    }

    public function test_owner_may_view_update_and_delete_their_task(): void
    {
        $owner = $this->user(1);
        $task = $this->taskOwnedBy(1);

        $this->assertTrue($this->policy->view($owner, $task));
        $this->assertTrue($this->policy->update($owner, $task));
        $this->assertTrue($this->policy->delete($owner, $task));
    }

    public function test_a_stranger_may_not_touch_someone_elses_task(): void
    {
        $stranger = $this->user(2);
        $task = $this->taskOwnedBy(1);

        $this->assertFalse($this->policy->view($stranger, $task));
        $this->assertFalse($this->policy->update($stranger, $task));
        $this->assertFalse($this->policy->delete($stranger, $task));
    }

    public function test_admin_may_touch_any_task(): void
    {
        $admin = $this->user(2, User::ROLE_ADMIN);
        $task = $this->taskOwnedBy(1);

        $this->assertTrue($this->policy->view($admin, $task));
        $this->assertTrue($this->policy->update($admin, $task));
        $this->assertTrue($this->policy->delete($admin, $task));
    }

    public function test_is_admin_only_matches_the_admin_role(): void
    {
        $this->assertTrue($this->user(1, User::ROLE_ADMIN)->isAdmin());
        $this->assertFalse($this->user(1)->isAdmin());
        $this->assertFalse($this->user(1, 'superuser')->isAdmin());
    }
}
