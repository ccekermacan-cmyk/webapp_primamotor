<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{Bon, Cashflow, LogStock, Menu, Ongkos};
use App\Services\Webhooks\{WebhookDispatcher, WebhookIdempotencyService};
use Carbon\Carbon;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WebhookController extends Controller
{
    private const MODELS = ['menu' => Menu::class, 'cashflow' => Cashflow::class, 'log_stock' => LogStock::class, 'ongkos' => Ongkos::class, 'bon' => Bon::class];

    public function __construct(protected WebhookDispatcher $dispatcher, protected WebhookIdempotencyService $idempotency) {}

    public function handle(Request $request, string $collection, string $event, string $id): JsonResponse
    {
        // Explicitly allow known collections with no side effects.
        if (in_array($collection, ['produk', 'dropdown', 'user', 'gaji'], true)) {
            return response()->json(['status' => 'skipped', 'reason' => 'no observer']);
        }
        $request->merge(['events' => [[
            'collection' => $collection, 'event' => $event, 'id' => $id,
            'old_data' => $request->input('old_data'), 'record' => $request->input('record'),
        ]]]);
        return $this->batch($request);
    }

    public function batch(Request $request): JsonResponse
    {
        $data = $request->validate([
            'request_id' => 'required|string|max:100',
            'events' => 'required|array|min:1|max:500',
            'events.*.collection' => 'required|in:menu,cashflow,log_stock,ongkos,bon',
            'events.*.event' => 'required|in:created,updated,deleted',
            'events.*.id' => 'required|string|max:100',
            'events.*.old_data' => 'nullable|array',
            'events.*.record' => 'nullable|array',
        ]);
        $this->idempotency->ensureMarksTable();
        DB::transaction(function () use ($data) {
            if (!$this->idempotency->addMark('batch:' . $data['request_id'])) return;
            $dates = [];
            foreach ($data['events'] as $entry) {
                $class = self::MODELS[$entry['collection']];
                $model = $class::find($entry['id']);
                if (!$model && $entry['event'] === 'deleted' && !empty($entry['record'])) {
                    // A PocketBase batch may already have removed the row. Use its captured snapshot.
                    $snapshot = $entry['record'];
                    $snapshot['id'] = $entry['id'];
                    foreach ($snapshot as $field => $value) if (is_array($value)) $snapshot[$field] = json_encode($value);
                    $model = (new $class)->newFromBuilder($snapshot);
                }
                if (!$model) {
                    throw ValidationException::withMessages(['events' => "Record {$entry['collection']}/{$entry['id']} tidak ditemukan."]);
                }
                $this->collectDates($model->getAttributes(), $dates);
                $old = $entry['old_data'] ?? [];
                foreach ($old as $field => $value) if (is_array($value)) $old[$field] = json_encode($value);
                $this->collectDates($old, $dates);
                if ($entry['event'] === 'updated') {
                    if (!$old) throw ValidationException::withMessages(['old_data' => 'Snapshot sebelum perubahan wajib disertakan.']);
                    $model->setRawAttributes(array_replace($model->getAttributes(), $old), true);
                    $current = $class::findOrFail($entry['id']);
                    $model->setRawAttributes($current->getAttributes());
                }
                $key = $entry['collection'] . ':' . $entry['event'] . ':' . $entry['id'];
                if ($entry['event'] === 'updated') $key .= ':' . $data['request_id'];
                if (!$this->idempotency->addMark($key)) continue;
                $this->dispatcher->dispatchObserver($model, $entry['event']);
            }
            foreach (array_keys($dates) as $date) $this->dispatcher->recalcForDate($date);
        }, 3);
        return response()->json(['status' => 'success']);
    }

    private function collectDates(array $record, array &$dates): void
    {
        $raw = $record['created_at'] ?? $record['date'] ?? null;
        if ($raw) $dates[Carbon::parse($raw, 'UTC')->timezone('Asia/Jakarta')->format('Y-m-d')] = true;
        $parent = $this->dispatcher->firstRelId($record['ref_baru'] ?? $record['ref'] ?? null);
        if ($parent && ($menu = Menu::find($parent)) && $menu->created_at) {
            $dates[Carbon::parse($menu->created_at, 'UTC')->timezone('Asia/Jakarta')->format('Y-m-d')] = true;
        }
    }
}
