<?php
namespace App\Observers;

use App\Models\Produk;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProdukObserver
{
    public function saving(Produk $product): void
    {
        foreach (['beli','sell_1','sell_2','sell_3','sell_4','sell_5','sell_6','min_1','min_2','min_3','stok_1','stok_2','stok_3'] as $field) {
            $value = $product->getAttributes()[$field] ?? 0;
            if (!is_numeric($value) || !is_finite((float) $value) || (float) $value < 0 || floor((float) $value) !== (float) $value) {
                throw ValidationException::withMessages([$field => 'Nilai harus bilangan bulat nol atau lebih.']);
            }
        }
    }

    /**
     * Setelah stok_3 ditimpa langsung, hitung ulang batas stok_awal/stok_akhir
     * pada seluruh log_stock produk ini supaya riwayat tetap konsisten.
     */
    public function saved(Produk $product): void
    {
        if (! $product->wasChanged('stok_3')) {
            return;
        }

        $balance = (float) $product->stok_3;
        if ($balance < 0) {
            throw ValidationException::withMessages(['stok_3' => 'Stok tidak boleh negatif.']);
        }

        DB::statement(
            "WITH movement AS (
                SELECT id, created_at,
                    CASE WHEN LOWER(boolean) = 'in' THEN qty ELSE -qty END AS delta
                FROM log_stock WHERE item_baru = ?
            ), ledger AS (
                SELECT id, delta, SUM(delta) OVER () AS total,
                    SUM(delta) OVER (ORDER BY datetime(created_at), id ROWS UNBOUNDED PRECEDING) AS running
                FROM movement
            )
            UPDATE log_stock SET
                stok_awal = ? - (l.total - l.running + l.delta),
                stok_akhir = ? - (l.total - l.running)
            FROM ledger l WHERE l.id = log_stock.id",
            [$product->id, $balance, $balance]
        );
    }

    public function deleting(Produk $product): void
    {
        $linked = DB::table('log_stock')->where('item_baru', $product->id)
            ->when($product->id_lama, fn ($q) => $q->orWhere('item', $product->id_lama))->exists();
        if ((float) $product->stok_3 !== 0 || $linked) {
            throw ValidationException::withMessages(['produk' => 'Produk masih memiliki stok atau histori transaksi dan tidak dapat dihapus.']);
        }
    }
}
