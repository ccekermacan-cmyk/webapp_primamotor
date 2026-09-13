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

    // ===== Idempotensi webhook =====
    // Tabel marks memastikan event yang sama (retry/response hilang) tidak di-apply dua kali.
    // 'deleted' hanya di-proses jika 'created' record tsb pernah ter-apply (mark ada),
    // sehingga rollback tidak me-revert efek yang tidak pernah diterapkan.
    private function ensureMarksTable(): void
    {
        DB::statement('CREATE TABLE IF NOT EXISTS webhook_marks (key TEXT PRIMARY KEY, created_at TEXT)');
    }

    private function createdMarkKey(string $collection, string $id): string
    {
        return strtolower($collection) . ':created:' . $id;
    }

    private function markKey(string $collection, string $event, string $id, array $payload = []): string
    {
        $key = strtolower($collection) . ':' . $event . ':' . $id;
        if ($event === 'updated') {
            $key .= ':' . md5(json_encode($payload));
        }
        return $key;
    }

    private function hasMark(string $key): bool
    {
        return DB::table('webhook_marks')->where('key', $key)->exists();
    }

    private function addMark(string $key): void
    {
        try {
            DB::table('webhook_marks')->insertOrIgnore([
                'key' => $key,
                'created_at' => now('UTC')->format('Y-m-d H:i:s.u\Z'),
            ]);
        } catch (\Throwable $e) {
            Log::error('webhook mark insert failed: ' . $e->getMessage());
        }
    }

    private function removeMark(string $key): void
    {
        DB::table('webhook_marks')->where('key', $key)->delete();
    }

    private function dispatchObserver($model, string $event): void
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

    public function handle(Request $request, string $collection, string $event, string $id): JsonResponse
    {
        $model = $this->getModel($collection, $id);
        if (!$model) {
            return response()->json(['message' => 'Model not found or collection unmonitored'], 404);
        }

        $this->ensureMarksTable();
        $createdKey = $this->createdMarkKey($collection, $id);

        if ($request->has('old_data')) {
            $setOriginal = function ($old) {
                $this->original = array_merge($this->original, $old);
            };
            $setOriginal->call($model, $request->input('old_data'));
        }

        $oldData = $request->input('old_data', []);

        if ($event === 'created') {
            if ($this->hasMark($createdKey)) {
                return response()->json(['status' => 'skipped', 'reason' => 'already processed']);
            }
            DB::transaction(function () use ($model, $createdKey) {
                $this->dispatchObserver($model, 'created');
                $this->addMark($createdKey);
            });
        } elseif ($event === 'updated') {
            $key = $this->markKey($collection, 'updated', $id, is_array($oldData) ? $oldData : [$oldData]);
            if ($this->hasMark($key)) {
                return response()->json(['status' => 'skipped', 'reason' => 'already processed']);
            }
            DB::transaction(function () use ($model, $key) {
                $this->dispatchObserver($model, 'updated');
                $this->addMark($key);
            });
        } elseif ($event === 'deleted') {
            $deletedKey = $this->markKey($collection, 'deleted', $id);
            if ($this->hasMark($deletedKey)) {
                return response()->json(['status' => 'skipped', 'reason' => 'already deleted']);
            }
            DB::transaction(function () use ($model, $deletedKey) {
                $this->dispatchObserver($model, 'deleted');
                $this->addMark($deletedKey);
            });
        }

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
