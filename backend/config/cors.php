<?php

return [

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    // Comma-separated list of SPA origins allowed to call the API.
    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', (string) env(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000'
    ))))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    // Let browsers cache the preflight response for a day.
    'max_age' => 86400,

    // Bearer tokens are sent in a header, so no credentialed cookies needed.
    'supports_credentials' => false,

];
