<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bon;
use App\Models\Cashflow;
use App\Models\LogStock;
use App\Models\Menu;
use App\Models\Ongkos;
use App\Jobs\RecalculateReportJob;
use App\Observers\BonObserver;
use App\Observers\CashflowObserver;
use App\Observers\LogStockObserver;
use App\Observers\MenuObserver;
use App\Observers\OngkosObserver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WebhookController extends Controller
{
    private function getModel(string $collection, string $id)
    {
        return match (strtolower($collection)) {
            'bon' => Bon::find($id),
            'cashflow' => Cashflow::find($id),
            'log_stock' => LogStock::find($id),
            'menu' => Menu::find($id),
            'ongkos' => Ongkos::find($id),
            default => null,
        };
    }

    private function firstRelId($val): string
    {
        if (!$val) return '';
        if (is_array($val)) {
            return count($val) > 0 ? (string) $val[0] : '';
        }
        $s = trim((string) $val);
        if (!$s || $s === 'null' || $s === 'undefined') return '';
        if (str_starts_with($s, '[')) {
            try {
                $a = json_decode($s, true);
                return (!empty($a) && is_array($a)) ? (string) $a[0] : '';
            } catch (\Throwable $e) {
                return '';
            }
        }
        return $s;
    }

    private function recalcForDate(string $dateString): void
    {
        try {
            RecalculateReportJob::dispatchSync($dateString);
        } catch (\Throwable $e) {
            Log::error('Report recalc failed: ' . $e->getMessage());
        }
    }

    public function handle(Request $request, string $collection, string $event, string $id): JsonResponse
    {
        $model = $this->getModel($collection, $id);
        if (!$model) {
            return response()->json(['message' => 'Model not found or collection unmonitored'], 404);
        }

        if ($request->has('old_data')) {
            $setOriginal = function ($old) {
                $this->original = array_merge($this->original, $old);
            };
            $setOriginal->call($model, $request->input('old_data'));
        }

        DB::transaction(function () use ($model, $event) {
            if ($event === 'created') {
                match (get_class($model)) {
                    Bon::class => app(BonObserver::class)->created($model),
                    Cashflow::class => app(CashflowObserver::class)->created($model),
                    LogStock::class => app(LogStockObserver::class)->created($model),
                    Menu::class => app(MenuObserver::class)->created($model),
                    Ongkos::class => app(OngkosObserver::class)->created($model),
                };
            } elseif ($event === 'updated') {
                match (get_class($model)) {
                    Bon::class => app(BonObserver::class)->updated($model),
                    Cashflow::class => app(CashflowObserver::class)->updated($model),
                    LogStock::class => app(LogStockObserver::class)->updated($model),
                    Menu::class => app(MenuObserver::class)->updated($model),
                    Ongkos::class => app(OngkosObserver::class)->updated($model),
                };
            } elseif ($event === 'deleted') {
                match (get_class($model)) {
                    Bon::class => app(BonObserver::class)->deleted($model),
                    Cashflow::class => app(CashflowObserver::class)->deleted($model),
                    LogStock::class => app(LogStockObserver::class)->deleted($model),
                    Menu::class => app(MenuObserver::class)->deleting($model),
                    Ongkos::class => app(OngkosObserver::class)->deleted($model),
                };
            }
        });

        // Recalculate report secara sinkron agar nilai laporan selalu konsisten
        $rawCreated = $model->getAttribute('created_at') ?: $model->getAttribute('date');
        $dateString = $rawCreated
            ? \Carbon\Carbon::parse($rawCreated)->timezone('Asia/Jakarta')->format('Y-m-d')
            : now('Asia/Jakarta')->format('Y-m-d');
        $this->recalcForDate($dateString);

        // Anak transaksi (cashflow/log_stock/ongkos) diatribusikan ke tanggal menu induknya
        $refMenuId = $this->firstRelId($model->getAttribute('ref_baru'));
        if ($refMenuId) {
            $refMenu = Menu::find($refMenuId);
            if ($refMenu && $refMenu->created_at) {
                $menuDate = \Carbon\Carbon::parse($refMenu->created_at)->timezone('Asia/Jakarta')->format('Y-m-d');
                if ($menuDate !== $dateString) {
                    $this->recalcForDate($menuDate);
                }
            }
        }

        return response()->json(['status' => 'success', 'collection' => $collection, 'event' => $event]);
    }
}
