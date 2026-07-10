<?php

use Illuminate\Support\Facades\Route;

// This app is API-only, so the browser entry point is the API documentation.
Route::redirect('/', '/docs');

// Swagger UI. The spec it renders is the static file public/openapi.yaml.
Route::view('/docs', 'docs')->name('docs');
