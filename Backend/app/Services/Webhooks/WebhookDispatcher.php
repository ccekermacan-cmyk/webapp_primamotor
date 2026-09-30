<?php

namespace App\Services\Webhooks;

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
use App\Jobs\RecalculateReportJob;
use Illuminate\Support\Facades\Log;

class WebhookDispatcher
{
    public function getModel(string $collection, string $id)
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

    public function dispatchObserver($model, string $event): void
    {
        match (get_class($model)) {
            Bon::class => match ($event) {
                'created' => app(BonObserver::class)->created($model),
                'updated' => app(BonObserver::class)->updated($model),
                'deleted' => app(BonObserver::class)->deleted($model),
            },
            Cashflow::class => match ($event) {
                'created' => app(CashflowObserver::class)->created($model),
                'updated' => app(CashflowObserver::class)->updated($model),
                'deleted' => app(CashflowObserver::class)->deleted($model),
            },
            LogStock::class => match ($event) {
                'created' => app(LogStockObserver::class)->created($model),
                'updated' => app(LogStockObserver::class)->updated($model),
                'deleted' => app(LogStockObserver::class)->deleted($model),
            },
            Menu::class => match ($event) {
                'created' => app(MenuObserver::class)->created($model),
                'updated' => app(MenuObserver::class)->updated($model),
                'deleted' => app(MenuObserver::class)->deleting($model),
            },
            Ongkos::class => match ($event) {
                'created' => app(OngkosObserver::class)->created($model),
                'updated' => app(OngkosObserver::class)->updated($model),
                'deleted' => app(OngkosObserver::class)->deleted($model),
            },
        };
    }

    public function firstRelId($val): string
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

    public function recalcForDate(string $dateString): void
    {
        try {
            RecalculateReportJob::dispatchSync($dateString);
        } catch (\Throwable $e) {
            Log::error('Report recalc failed: ' . $e->getMessage());
        }
    }
}
