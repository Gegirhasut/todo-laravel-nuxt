<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CorsTest extends TestCase
{
    use RefreshDatabase;

    public function test_configured_localhost_origin_is_allowed(): void
    {
        $this->withHeaders(['Origin' => 'http://localhost:3000'])
            ->options('/api/auth/login', [], ['Access-Control-Request-Method' => 'POST'])
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    }

    public function test_private_network_origin_is_allowed_for_the_spa_port(): void
    {
        $this->withHeaders(['Origin' => 'http://192.168.2.72:3000'])
            ->options('/api/auth/login', [], ['Access-Control-Request-Method' => 'POST'])
            ->assertHeader('Access-Control-Allow-Origin', 'http://192.168.2.72:3000');
    }

    public function test_unknown_public_origin_is_not_allowed(): void
    {
        $response = $this->withHeaders(['Origin' => 'http://evil.example.com'])
            ->options('/api/auth/login', [], ['Access-Control-Request-Method' => 'POST']);

        $this->assertNull($response->headers->get('Access-Control-Allow-Origin'));
    }
}
