<?php

return [

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    // Comma-separated list of SPA origins allowed to call the API.
    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', (string) env(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000'
    ))))),

    // Any private-network host running the SPA on :3000 (a LAN demo, Docker
    // on another machine) is allowed out of the box; public origins still
    // have to be listed explicitly in CORS_ALLOWED_ORIGINS.
    'allowed_origins_patterns' => [
        '#^http://(10(\.\d{1,3}){3}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|192\.168(\.\d{1,3}){2}):3000$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    // Let browsers cache the preflight response for a day.
    'max_age' => 86400,

    // Bearer tokens are sent in a header, so no credentialed cookies needed.
    'supports_credentials' => false,

];
