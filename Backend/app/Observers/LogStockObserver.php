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
            if ($price > 0) {
                DB::table('produk')->where('id', $produkId)->update(['beli' => $price]);
            }
        } elseif ($boolVal === 'out') {
            if ($stok - $qty < 0) {
                throw new Exception("[CREATE] Stok produk {$produkId} tidak cukup (sisa: {$stok}, dikurangi: {$qty})");
            }
            DB::table('produk')->where('id', $produkId)->decrement('stok_3', $qty);
        }

        if ($boolVal === 'out') {
            $tanggal = substr((string) $logStock->created_at, 0, 10);
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

        if ($oldQty !== $newQty || $oldBool !== $newBool) {
            $delta = 0;
            if ($oldBool === 'in')  $delta -= $oldQty;
            if ($oldBool === 'out') $delta += $oldQty;
            if ($newBool === 'in')  $delta += $newQty;
            if ($newBool === 'out') $delta -= $newQty;

            if ($stok + $delta < 0) {
                throw new Exception("[UPDATE] Edit gagal: stok produk {$produkId} akan menjadi minus.");
            }

            if ($delta > 0) {
                DB::table('produk')->where('id', $produkId)->increment('stok_3', $delta);
            } elseif ($delta < 0) {
                DB::table('produk')->where('id', $produkId)->decrement('stok_3', abs($delta));
            }
        }

        $hargaBerubah = ($newBool === 'in' && $oldPrice1 !== $newPrice1);
        $beralihDariIn = ($oldBool === 'in' && $newBool !== 'in');
        $beralihKeIn = ($oldBool !== 'in' && $newBool === 'in');

        if ($hargaBerubah || $beralihDariIn || $beralihKeIn) {
            $latestIn = LogStock::where('item_baru', $produkId)
                ->where('boolean', 'in')
                ->orderBy('created_at', 'desc')
                ->first();
            $hargaTerbaru = $latestIn ? (float) $latestIn->price_1 : 0;
            DB::table('produk')->where('id', $produkId)->update(['beli' => $hargaTerbaru]);
        }

        // Revert report old effect
        $oldTanggal = $oldCreated ? substr($oldCreated, 0, 10) : '';
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
        $newTanggal = $newCreated ? substr($newCreated, 0, 10) : '';
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
            DB::table('produk')->where('id', $produkId)->decrement('stok_3', $qty);

            $remaining = LogStock::where('item_baru', $produkId)
                ->where('boolean', 'in')
                ->where('id', '!=', $deletedId)
                ->orderBy('created_at', 'desc')
                ->first();

            $beliPrice = $remaining && ($deletedAt > (string) $remaining->created_at) ? (float) $remaining->price_1 : 0;
            DB::table('produk')->where('id', $produkId)->update(['beli' => $beliPrice]);
        }

        if ($boolVal === 'out') {
            $tanggal = $deletedAt ? substr($deletedAt, 0, 10) : '';
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
