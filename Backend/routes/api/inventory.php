<?php

use App\Http\Controllers\Api\LogStockController;
use Illuminate\Support\Facades\Route;

Route::apiResource('log-stocks', LogStockController::class);
