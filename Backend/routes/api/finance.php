<?php

use App\Http\Controllers\Api\BonController;
use App\Http\Controllers\Api\CashflowController;
use App\Http\Controllers\Api\OngkosController;
use Illuminate\Support\Facades\Route;

Route::apiResource('bons', BonController::class);
Route::apiResource('cashflows', CashflowController::class);
Route::apiResource('ongkos', OngkosController::class);
