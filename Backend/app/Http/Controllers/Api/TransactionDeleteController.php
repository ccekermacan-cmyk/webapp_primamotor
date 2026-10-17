<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{Menu, Cashflow, LogStock, Ongkos, Bon};
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class TransactionDeleteController extends Controller
{
    public function destroy(string $collection, string $id): JsonResponse
    {
        $class = match ($collection) {
            'menu' => Menu::class, 'cashflow' => Cashflow::class,
            'log_stock' => LogStock::class, 'ongkos' => Ongkos::class, 'bon' => Bon::class,
            default => abort(404),
        };
        DB::transaction(function () use ($class, $id) {
            $model = $class::find($id);
            if (!$model) return; // Safe retry after a lost response.
            $raw = $model->created_at ?: $model->getAttribute('date');
            $dates = $raw ? [Carbon::parse($raw, 'UTC')->timezone('Asia/Jakarta')->format('Y-m-d')] : [];
            $parent = Menu::find($model->getAttribute('ref_baru') ?: $model->getAttribute('ref'));
            if ($parent?->created_at) $dates[] = Carbon::parse($parent->created_at, 'UTC')->timezone('Asia/Jakarta')->format('Y-m-d');
            $model->delete();
            foreach (array_unique($dates) as $date) ReportService::recalculateDaily($date);
        }, 3);
        return response()->json(['status' => 'success']);
    }
}
