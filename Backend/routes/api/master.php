<?php

use App\Http\Controllers\Api\DropdownController;
use App\Http\Controllers\Api\MenuController;
use App\Http\Controllers\Api\ProdukController;
use Illuminate\Support\Facades\Route;

Route::apiResource('produks', ProdukController::class);
Route::apiResource('menus', MenuController::class);
Route::apiResource('dropdowns', DropdownController::class);
