<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::get('/user', function (Request $request) {
    return $request->user();
});

// Load modular route definitions
require __DIR__ . '/api/master.php';
require __DIR__ . '/api/finance.php';
require __DIR__ . '/api/inventory.php';
require __DIR__ . '/api/reports.php';
require __DIR__ . '/api/webhooks.php';
