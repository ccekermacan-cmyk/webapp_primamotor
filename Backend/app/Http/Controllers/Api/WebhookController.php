<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Menu;
use App\Services\Webhooks\WebhookDispatcher;
use App\Services\Webhooks\WebhookIdempotencyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WebhookController extends Controller
{
    public function __construct(
        protected WebhookDispatcher $dispatcher,
        protected WebhookIdempotencyService $idempotency
    ) {}

    public function handle(Request $request, string $collection, string $event, string $id): JsonResponse
    {
        $model = $this->dispatcher->getModel($collection, $id);
        if (!$model) {
            return response()->json(['status' => 'skipped', 'message' => 'Collection unmonitored or model not found']);
        }

        $this->idempotency->ensureMarksTable();
        $createdKey = $this->idempotency->createdMarkKey($collection, $id);

        if ($request->has('old_data')) {
            $setOriginal = function ($old) {
                $this->original = array_merge($this->original, $old);
            };
            $setOriginal->call($model, $request->input('old_data'));
        }

        $oldData = $request->input('old_data', []);

        if ($event === 'created') {
            if ($this->idempotency->hasMark($createdKey)) {
                return response()->json(['status' => 'skipped', 'reason' => 'already processed']);
            }
            DB::transaction(function () use ($model, $createdKey) {
                $this->dispatcher->dispatchObserver($model, 'created');
                $this->idempotency->addMark($createdKey);
            });
        } elseif ($event === 'updated') {
            $key = $this->idempotency->markKey($collection, 'updated', $id, is_array($oldData) ? $oldData : [$oldData]);
            if ($this->idempotency->hasMark($key)) {
                return response()->json(['status' => 'skipped', 'reason' => 'already processed']);
            }
            DB::transaction(function () use ($model, $key) {
                $this->dispatcher->dispatchObserver($model, 'updated');
                $this->idempotency->addMark($key);
            });
        } elseif ($event === 'deleted') {
            $deletedKey = $this->idempotency->markKey($collection, 'deleted', $id);
            if ($this->idempotency->hasMark($deletedKey)) {
                return response()->json(['status' => 'skipped', 'reason' => 'already deleted']);
            }
            DB::transaction(function () use ($model, $deletedKey) {
                $this->dispatcher->dispatchObserver($model, 'deleted');
                $this->idempotency->addMark($deletedKey);
            });
        }

        // Recalculate report secara sinkron agar nilai laporan selalu konsisten
        $rawCreated = $model->getAttribute('created_at') ?: $model->getAttribute('date');
        $dateString = $rawCreated
            ? \Carbon\Carbon::parse($rawCreated)->timezone('Asia/Jakarta')->format('Y-m-d')
            : now('Asia/Jakarta')->format('Y-m-d');
        $this->dispatcher->recalcForDate($dateString);

        // Anak transaksi (cashflow/log_stock/ongkos) diatribusikan ke tanggal menu induknya
        $refMenuId = $this->dispatcher->firstRelId($model->getAttribute('ref_baru'));
        if ($refMenuId) {
            $refMenu = Menu::find($refMenuId);
            if ($refMenu && $refMenu->created_at) {
                $menuDate = \Carbon\Carbon::parse($refMenu->created_at)->timezone('Asia/Jakarta')->format('Y-m-d');
                if ($menuDate !== $dateString) {
                    $this->dispatcher->recalcForDate($menuDate);
                }
            }
        }

        return response()->json(['status' => 'success', 'collection' => $collection, 'event' => $event]);
    }
}
