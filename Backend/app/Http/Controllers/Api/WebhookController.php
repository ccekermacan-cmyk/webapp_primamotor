<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bon;
use App\Models\Cashflow;
use App\Models\LogStock;
use App\Models\Menu;
use App\Models\Ongkos;
use App\Observers\BonObserver;
use App\Observers\CashflowObserver;
use App\Observers\LogStockObserver;
use App\Observers\MenuObserver;
use App\Observers\OngkosObserver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        // Trigger auto-recalculate report untuk tanggal terkait transaksi ini
        $dateString = \Carbon\Carbon::parse($model->created_at)->timezone('Asia/Jakarta')->format('Y-m-d');
        \App\Jobs\RecalculateReportJob::dispatchAfterResponse($dateString);

        return response()->json(['status' => 'success', 'collection' => $collection, 'event' => $event]);
    }
}
