<?php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Compatibility for old tabs and durable webhook queues after switching to native transactions. */
class NativeAtomicLedger
{
    public function enabled(): bool { return Schema::hasTable('_pm_atomic_changes'); }

    public function alreadyApplied(array $entry): bool
    {
        if (!$this->enabled()) return false;
        $query = DB::table('_pm_atomic_changes')->where('collection_name', $entry['collection'])
            ->where('record_id', $entry['id'])->where('event', $entry['event']);
        if ($entry['event'] !== 'updated') return $query->exists();
        $old = $entry['old_data'] ?? [];
        if (!$old) return false;
        // Compare server-captured business values; ignore expansion and API-only metadata.
        $fields = match ($entry['collection']) {
            'cashflow' => ['nominal','mutasi','jenis','account_1','account_2','acc1','acc2','ref_baru','ref','person','created_at'],
            'log_stock' => ['item_baru','qty','boolean','price_1','price_2','ref_baru','ref','created_at'],
            'bon' => ['nominal','jenis','person','user','ref_cashflow','ref_gaji','ref_menu','created_at'],
            'menu' => ['jenis','total','dibayar','status','person_baru','created_at'],
            'ongkos' => ['ongkos','ref_baru','ref','person','created_at'],
            default => [],
        };
        foreach ($query->get(['old_data']) as $row) {
            $snapshot = json_decode($row->old_data, true);
            $matches = true;
            foreach ($fields as $field) {
                if (!array_key_exists($field, $old)) continue;
                if (($old[$field] ?? '') != ($snapshot[$field] ?? '')) { $matches = false; break; }
            }
            if ($matches) return true;
        }
        return false;
    }
}
