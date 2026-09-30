<?php

use App\Http\Controllers\Api\ReportController;
use Illuminate\Support\Facades\Route;

Route::get('reports/today', [ReportController::class, 'today']);
Route::post('reports/recalculate', [ReportController::class, 'recalculate']);
Route::apiResource('reports', ReportController::class)->only(['index', 'show']);
