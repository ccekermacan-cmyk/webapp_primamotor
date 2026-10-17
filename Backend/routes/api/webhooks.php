<?php

use App\Http\Controllers\Api\WebhookController;
use Illuminate\Support\Facades\Route;

Route::post('webhook/{collection}/{event}/{id}', [WebhookController::class, 'handle']);

Route::post('webhooks/batch', [WebhookController::class, 'batch']);

Route::delete('transactions/{collection}/{id}', [\App\Http\Controllers\Api\TransactionDeleteController::class, 'destroy']);
