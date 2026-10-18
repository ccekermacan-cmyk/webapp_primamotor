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
            foreach ($this->orderEffects($data['events']) as $entry) {
                if (app(\App\Services\NativeAtomicLedger::class)->alreadyApplied($entry)) continue;
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

    /** Apply cash credits before cash reversals/debits within the same SQL transaction.
     * Replacing an equivalent payment must not fail on a temporary negative balance.
     */
    private function orderEffects(array $events): array
    {
        $ledger = app(\App\Services\CashflowLedger::class);
        $ranked = [];
        foreach ($events as $index => $entry) {
            $priority = 0;
            if ($entry['collection'] === 'cashflow') {
                $current = Cashflow::find($entry['id'])?->getAttributes() ?? ($entry['record'] ?? []);
                $deltas = $entry['event'] === 'deleted' ? [] : $ledger->deltas($current);
                if ($entry['event'] !== 'created') {
                    $old = $entry['event'] === 'deleted' ? $current : ($entry['old_data'] ?? []);
                    foreach ($ledger->deltas($old, true) as $id => $amount) $deltas[$id] = ($deltas[$id] ?? 0) - $amount;
                }
                $positive = count(array_filter($deltas, fn ($amount) => $amount > 0));
                $negative = count(array_filter($deltas, fn ($amount) => $amount < 0));
                if ($positive && !$negative) $priority = -1;
                elseif ($negative && !$positive) $priority = 1;
            }
            $ranked[] = ['entry' => $entry, 'priority' => $priority, 'index' => $index];
        }
        usort($ranked, fn ($a, $b) => [$a['priority'], $a['index']] <=> [$b['priority'], $b['index']]);
        return array_column($ranked, 'entry');
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
