<?php

use App\Http\Controllers\Api\WebhookController;
use Illuminate\Support\Facades\Route;

Route::post('webhook/{collection}/{event}/{id}', [WebhookController::class, 'handle']);
