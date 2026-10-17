<?php

namespace App\Observers;

use App\Models\LogStock;
use App\Models\Menu;
use App\Models\Produk;
use App\Models\Report;
use Exception;
use Illuminate\Support\Facades\DB;

class LogStockObserver
{
    private function validate(LogStock $log): void
    {
        $qty = $log->getAttributes()['qty'] ?? 0;
        if (!is_numeric($qty) || !is_finite((float) $qty) || (float) $qty <= 0 || floor((float) $qty) !== (float) $qty) {
            throw \Illuminate\Validation\ValidationException::withMessages(['qty' => 'Kuantitas harus bilangan bulat lebih dari nol.']);
        }
        if (!in_array((string) $log->boolean, ['in', 'out'], true)) {
            throw \Illuminate\Validation\ValidationException::withMessages(['boolean' => 'Arah stok tidak valid.']);
        }
        foreach (['price_1', 'price_2', 'normal'] as $field) {
            $value = $log->getAttributes()[$field] ?? 0;
            if (!is_numeric($value) || !is_finite((float) $value) || (float) $value < 0) {
                throw \Illuminate\Validation\ValidationException::withMessages([$field => 'Harga tidak boleh negatif.']);
            }
        }
        if (!Produk::where('id', (string) $log->item_baru)->exists()) {
            throw \Illuminate\Validation\ValidationException::withMessages(['item_baru' => 'Produk tidak ditemukan.']);
        }
    }

    public function creating(LogStock $log): void { $this->validate($log); }
    public function updating(LogStock $log): void { $this->validate($log); }

    private function syncBuyPrice(string $productId, ?string $excludeId = null): void
    {
        $latest = LogStock::where('item_baru', $productId)->where('boolean', 'in')->where('price_1', '>', 0)
            ->when($excludeId, fn ($q) => $q->where('id', '!=', $excludeId))
            ->orderByRaw('datetime(created_at) desc')->orderBy('id', 'desc')->first();
        DB::table('produk')->where('id', $productId)->update(['beli' => $latest ? (float) $latest->price_1 : 0]);
    }

    private function getOrCreateReport(string $tanggal): ?Report
    {
        if (!$tanggal) return null;
        $rep = Report::whereDate('created_at', $tanggal)->first();
        if (!$rep) {
            try {
                $rep = Report::create(['created_at' => $tanggal . ' 08:00:00']);
            } catch (\Exception $e) {
                $rep = Report::whereDate('created_at', $tanggal)->first();
            }
        }
        return $rep;
    }

    // Report diatribusikan ke tanggal menu induk (ref_baru), bukan tanggal entry record
    private function getReportDate(string $refBaru, string $fallbackCreated): string
    {
        if ($refBaru) {
            $menu = Menu::find($refBaru);
            if ($menu && $menu->created_at) {
                return \App\Services\ReportService::dateOf((string) $menu->created_at);
            }
        }
        return $fallbackCreated ? \App\Services\ReportService::dateOf($fallbackCreated) : '';
    }

    private function updateReportForStockOut(string $tanggal, string $refBaruId, string $produkId, float $price1, float $price2, int $qty, bool $isRevert = false): void
    {
        if (!$tanggal) return;

        $jenis = '';
        if ($refBaruId) {
            $menu = Menu::find($refBaruId);
            if ($menu) {
                $jenis = strtolower((string) $menu->jenis);
            }
        }

        $kategori = '';
        if ($produkId) {
            $produk = Produk::find($produkId);
            if ($produk) {
                $kategori = strtolower((string) $produk->kategori);
            }
        }

        $total = $price1 * $qty;
        $laba = $total - $price2;

        $isTransaksi = (str_contains($jenis, 'penjualan') || str_contains($jenis, 'servis') || str_contains($jenis, 'service'));
        $isMinuman = ($kategori === 'minuman');

        $dOmsetToko = 0;
        $dOmsetMinuman = 0;
        $dLaba = 0;

        if ($isTransaksi && !$isMinuman) $dOmsetToko = $total;
        if ($isTransaksi && $isMinuman)  $dOmsetMinuman = $total;
        if ($isTransaksi)               $dLaba = $laba;

        if ($isRevert) {
            $dOmsetToko = -$dOmsetToko;
            $dOmsetMinuman = -$dOmsetMinuman;
            $dLaba = -$dLaba;
        }

        if ($dOmsetToko != 0 || $dOmsetMinuman != 0 || $dLaba != 0) {
            $report = $this->getOrCreateReport($tanggal);
            if ($report) {
                if ($dOmsetToko > 0) {
                    DB::table('report')->where('id', $report->id)->increment('omset_toko', $dOmsetToko);
                } elseif ($dOmsetToko < 0) {
                    DB::table('report')->where('id', $report->id)->decrement('omset_toko', abs($dOmsetToko));
                }

                if ($dOmsetMinuman > 0) {
                    DB::table('report')->where('id', $report->id)->increment('omset_minuman', $dOmsetMinuman);
                } elseif ($dOmsetMinuman < 0) {
                    DB::table('report')->where('id', $report->id)->decrement('omset_minuman', abs($dOmsetMinuman));
                }

                if ($dLaba > 0) {
                    DB::table('report')->where('id', $report->id)->increment('laba_penjualan', $dLaba);
                } elseif ($dLaba < 0) {
                    DB::table('report')->where('id', $report->id)->decrement('laba_penjualan', abs($dLaba));
                }
            }
        }
    }

    public function created(LogStock $logStock): void
    {
        $this->validate($logStock);
        $produkId = (string) $logStock->item_baru;
        if (!$produkId) return;

        $qty = (int) $logStock->qty;
        $boolVal = (string) $logStock->boolean;
        $price = (float) $logStock->price_1;

        $produk = Produk::find($produkId);
        if (!$produk) return;

        $stok = (float) $produk->stok_3;

        if ($boolVal === 'in') {
            DB::table('produk')->where('id', $produkId)->increment('stok_3', $qty);
            $newStok = (float) DB::table('produk')->where('id', $produkId)->value('stok_3') ?? 0;
            $logStock->stok_awal = $newStok - $qty;
            $logStock->stok_akhir = $newStok;
            $logStock->saveQuietly();
            if ($price > 0) {
                $this->syncBuyPrice($produkId);
            }
        } elseif ($boolVal === 'out') {
            if (DB::table('produk')->where('id', $produkId)->where('stok_3', '>=', $qty)->decrement('stok_3', $qty) !== 1) {
                throw new Exception("[CREATE] Stok produk {$produkId} tidak cukup.");
            }
            $newStok = (float) DB::table('produk')->where('id', $produkId)->value('stok_3') ?? 0;
            $logStock->stok_awal = $newStok + $qty;
            $logStock->stok_akhir = $newStok;
            $logStock->saveQuietly();
        }

        if ($boolVal === 'out') {
            $tanggal = $this->getReportDate((string) $logStock->ref_baru, (string) $logStock->created_at);
            $this->updateReportForStockOut(
                $tanggal,
                (string) $logStock->ref_baru,
                $produkId,
                (float) $logStock->price_1,
                (float) $logStock->price_2,
                $qty,
                false
            );
        }
    }

    public function updated(LogStock $logStock): void
    {
        $this->validate($logStock);
        $produkId = (string) $logStock->item_baru;
        if (!$produkId) return;

        $oldQty = (int) ($logStock->getOriginal('qty') ?? 0);
        $oldBool = (string) ($logStock->getOriginal('boolean') ?? '');
        $oldPrice1 = (float) ($logStock->getOriginal('price_1') ?? 0);
        $oldPrice2 = (float) ($logStock->getOriginal('price_2') ?? 0);
        $oldRef = (string) ($logStock->getOriginal('ref_baru') ?? '');
        $oldItem = (string) ($logStock->getOriginal('item_baru') ?? '');
        $oldCreated = (string) ($logStock->getOriginal('created_at') ?? '');

        $newQty = (int) $logStock->qty;
        $newBool = (string) $logStock->boolean;
        $newPrice1 = (float) $logStock->price_1;
        $newCreated = (string) $logStock->created_at;

        $produk = Produk::find($produkId);
        if (!$produk) return;

        $stok = (float) $produk->stok_3;

        // Revert against the old product, then apply against the new product. A changed
        // product relation must not leave the old item's stock reduced.
        $deltas = [];
        if ($oldItem) $deltas[$oldItem] = ($oldBool === 'in' ? -$oldQty : $oldQty);
        $deltas[$produkId] = ($deltas[$produkId] ?? 0) + ($newBool === 'in' ? $newQty : -$newQty);
        foreach ($deltas as $itemId => $delta) {
            if ($delta === 0) continue;
            if ($delta > 0) {
                DB::table('produk')->where('id', $itemId)->increment('stok_3', $delta);
            } elseif (DB::table('produk')->where('id', $itemId)->where('stok_3', '>=', -$delta)->decrement('stok_3', -$delta) !== 1) {
                throw new Exception("[UPDATE] Stok produk {$itemId} tidak cukup.");
            }
        }

        // Re-sync log_stock boundaries safely from server-side calculated stok_3
        $newStok = (float) DB::table('produk')->where('id', $produkId)->value('stok_3') ?? 0;
        if ($newBool === 'in') {
            $logStock->stok_awal = $newStok - $newQty;
        } else {
            $logStock->stok_awal = $newStok + $newQty;
        }
        $logStock->stok_akhir = $newStok;
        $logStock->saveQuietly();

        // Recalculate both products when a purchase log is moved or backdated.
        if ($oldBool === 'in' && $oldPrice1 > 0) $this->syncBuyPrice($oldItem ?: $produkId);
        if ($newBool === 'in' && $newPrice1 > 0) $this->syncBuyPrice($produkId);

        // Revert report old effect
        $oldTanggal = $this->getReportDate($oldRef ?: '', $oldCreated);
        if ($oldTanggal && $oldBool === 'out') {
            $this->updateReportForStockOut(
                $oldTanggal,
                $oldRef,
                $oldItem ?: $produkId,
                $oldPrice1,
                $oldPrice2,
                $oldQty,
                true // revert
            );
        }

        // Apply report new effect
        $newTanggal = $this->getReportDate((string) $logStock->ref_baru, $newCreated);
        if ($newTanggal && $newBool === 'out') {
            $this->updateReportForStockOut(
                $newTanggal,
                (string) $logStock->ref_baru,
                $produkId,
                $newPrice1,
                (float) $logStock->price_2,
                $newQty,
                false // apply
            );
        }
    }

    public function deleted(LogStock $logStock): void
    {
        $produkId = (string) $logStock->item_baru;
        if (!$produkId) return;

        $qty = (int) $logStock->qty;
        $boolVal = (string) $logStock->boolean;
        $deletedId = (string) $logStock->id;
        $deletedAt = (string) $logStock->created_at;

        $produk = Produk::find($produkId);
        if (!$produk) return;

        $stok = (float) $produk->stok_3;

        if ($boolVal === 'out') {
            DB::table('produk')->where('id', $produkId)->increment('stok_3', $qty);
        } elseif ($boolVal === 'in') {
            if ($stok - $qty < 0) {
                throw new Exception("[DELETE] Rollback stok produk {$produkId} gagal, stok akan minus.");
            }
            if (DB::table('produk')->where('id', $produkId)->where('stok_3', '>=', $qty)->decrement('stok_3', $qty) !== 1) {
                throw new Exception('Stok berubah; penghapusan dibatalkan.');
            }

            if ((float) $logStock->price_1 > 0) $this->syncBuyPrice($produkId, $deletedId);
        }

        if ($boolVal === 'out') {
            $tanggal = $this->getReportDate((string) $logStock->ref_baru, $deletedAt);
            if ($tanggal) {
                $this->updateReportForStockOut(
                    $tanggal,
                    (string) $logStock->ref_baru,
                    $produkId,
                    (float) $logStock->price_1,
                    (float) $logStock->price_2,
                    $qty,
                    true // revert
                );
            }
        }
    }
}
