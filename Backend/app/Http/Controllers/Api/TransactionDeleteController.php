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
        if (app(\App\Services\NativeAtomicLedger::class)->enabled()) {
            // PocketBase owns the entire cascade/ledger transaction, including API permissions.
            try {
                $response = \Illuminate\Support\Facades\Http::timeout(30)->withToken(request()->bearerToken())
                    ->acceptJson()->delete(rtrim(config('services.pocketbase.url'), '/') . '/api/collections/' . rawurlencode($collection) . '/records/' . rawurlencode($id));
            } catch (\Throwable $error) {
                return response()->json(['message' => 'Status penghapusan belum dapat dipastikan. Muat ulang data sebelum mencoba lagi.'], 503);
            }
            if (!$response->successful()) return response()->json(['message' => $response->json('message') ?: 'Penghapusan ditolak.'], $response->status());
            return response()->json(['status' => 'success']);
        }
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
