<?php

use App\Http\Controllers\Api\BonController;
use App\Http\Controllers\Api\CashflowController;
use App\Http\Controllers\Api\DropdownController;
use App\Http\Controllers\Api\LogStockController;
use App\Http\Controllers\Api\MenuController;
use App\Http\Controllers\Api\OngkosController;
use App\Http\Controllers\Api\ProdukController;
use App\Http\Controllers\Api\ReportController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
});

Route::apiResource('bons', BonController::class);
Route::apiResource('cashflows', CashflowController::class);
Route::apiResource('log-stocks', LogStockController::class);
Route::apiResource('menus', MenuController::class);
Route::apiResource('ongkos', OngkosController::class);
Route::apiResource('produks', ProdukController::class);
Route::apiResource('dropdowns', DropdownController::class);

Route::post('webhook/{collection}/{event}/{id}', [App\Http\Controllers\Api\WebhookController::class, 'handle']);

Route::get('reports/today', [ReportController::class, 'today']);
Route::post('reports/recalculate', [ReportController::class, 'recalculate']);
Route::apiResource('reports', ReportController::class)->only(['index', 'show']);
