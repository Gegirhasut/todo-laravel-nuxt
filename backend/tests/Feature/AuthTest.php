<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_with_valid_credentials(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/auth/login', [
            'email' => 'jane@example.com',
            'password' => 'password',
        ])
            ->assertOk()
            // A nested resource is not "data"-wrapped; only a top-level one is.
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'role']])
            ->assertJsonPath('user.email', 'jane@example.com')
            ->assertJsonMissingPath('user.password');
    }

    public function test_login_fails_with_a_wrong_password(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/auth/login', [
            'email' => 'jane@example.com',
            'password' => 'wrong-password',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_login_with_an_unknown_email_does_not_leak_that_the_user_is_missing(): void
    {
        $this->postJson('/api/auth/login', [
            'email' => 'nobody@example.com',
            'password' => 'password',
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Неверный email или пароль.');
    }

    public function test_unknown_email_and_wrong_password_return_an_identical_response(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $wrongPassword = $this->postJson('/api/auth/login', [
            'email' => 'jane@example.com',
            'password' => 'wrong-password',
        ])->assertStatus(422);

        $unknownEmail = $this->postJson('/api/auth/login', [
            'email' => 'nobody@example.com',
            'password' => 'wrong-password',
        ])->assertStatus(422);

        // Byte-for-byte identical bodies: nothing in the response says
        // whether the account exists.
        $this->assertSame($wrongPassword->json(), $unknownEmail->json());
    }

    public function test_login_is_rate_limited_after_too_many_attempts(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        // Six attempts per minute are allowed; the seventh must be rejected.
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => 'jane@example.com',
                'password' => 'wrong-password',
            ])->assertStatus(422);
        }

        $this->postJson('/api/auth/login', [
            'email' => 'jane@example.com',
            'password' => 'password',
        ])->assertStatus(429);
    }

    public function test_the_login_rate_limit_is_scoped_to_the_email(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);
        User::factory()->create(['email' => 'john@example.com']);

        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => 'jane@example.com',
                'password' => 'wrong-password',
            ])->assertStatus(422);
        }

        // A different account from the same address is not locked out.
        $this->postJson('/api/auth/login', [
            'email' => 'john@example.com',
            'password' => 'password',
        ])->assertOk();
    }

    public function test_login_validation_errors_return_422(): void
    {
        $this->postJson('/api/auth/login', [])
            ->assertStatus(422)
            ->assertJsonStructure(['message', 'errors'])
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_unauthenticated_request_returns_401_json(): void
    {
        $this->getJson('/api/user')
            ->assertStatus(401)
            ->assertExactJson(['message' => 'Требуется авторизация.']);
    }

    public function test_an_invalid_token_returns_401(): void
    {
        $this->withHeader('Authorization', 'Bearer not-a-real-token')
            ->getJson('/api/user')
            ->assertStatus(401);
    }

    public function test_authenticated_user_can_fetch_their_profile(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('data.email', $user->email)
            ->assertJsonPath('data.role', 'user')
            ->assertJsonMissingPath('data.password');
    }

    public function test_logout_revokes_only_the_current_token(): void
    {
        $user = User::factory()->create();
        $keep = $user->createToken('other-device')->plainTextToken;
        $revoke = $user->createToken('spa')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$revoke}")
            ->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJson(['message' => 'Вы вышли из системы.']);

        $this->assertDatabaseCount('personal_access_tokens', 1);

        // The token belonging to the other device still works.
        $this->withHeader('Authorization', "Bearer {$keep}")
            ->getJson('/api/user')
            ->assertOk();
    }

    public function test_a_login_token_can_be_used_to_reach_a_protected_route(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);

        $token = $this->postJson('/api/auth/login', [
            'email' => 'jane@example.com',
            'password' => 'password',
        ])->json('token');

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);
    }
}
