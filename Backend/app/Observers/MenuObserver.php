<?php

namespace App\Observers;

use App\Models\Bon;
use App\Models\Cashflow;
use App\Models\LogStock;
use App\Models\Menu;
use App\Models\Ongkos;
use App\Models\Report;
use Illuminate\Support\Facades\DB;

class MenuObserver
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

    public function created(Menu $menu): void
    {
        $jenis = strtolower((string) $menu->jenis);
        $status = strtolower((string) $menu->status);
        $total = (float) $menu->total;
        $dibayar = (float) $menu->dibayar;
        $createdAt = (string) $menu->created_at;
        $tanggal = $createdAt ? substr($createdAt, 0, 10) : '';
        $personId = (string) $menu->person_baru;
        $menuId = (string) $menu->id;

        $isPembelian = str_contains($jenis, 'pembelian');
        $isPenjServis = (str_contains($jenis, 'penjualan') || str_contains($jenis, 'servis') || str_contains($jenis, 'service'));

        // Report hutang/piutang (Atomic)
        if ($status === 'belum' && $tanggal && $total != 0 && ($isPembelian || $isPenjServis)) {
            $rep = $this->getOrCreateReport($tanggal);
            if ($rep) {
                if ($isPembelian)  { DB::table('report')->where('id', $rep->id)->increment('hutang', $total); }
                if ($isPenjServis) { DB::table('report')->where('id', $rep->id)->increment('piutang', $total); }
            }
        }

        // Bon hanya untuk penjualan/servis dengan sisa > 0
        if ($isPenjServis && $status === 'belum') {
            $sisa = $total - $dibayar;
            if ($sisa > 0) {
                Bon::create([
                    'ref_menu' => $menuId,
                    'created_date' => $tanggal,
                    'customer' => $personId,
                    'nominal' => $sisa,
                    'jenis' => 'in',
                    'status' => 'belum',
                ]);
            }
        }
    }

    public function updated(Menu $menu): void
    {
        $oldJenis = strtolower((string) ($menu->getOriginal('jenis') ?? ''));
        $oldStatus = strtolower((string) ($menu->getOriginal('status') ?? ''));
        $oldTotal = (float) ($menu->getOriginal('total') ?? 0);
        $oldCreated = (string) ($menu->getOriginal('created_at') ?? '');

        $newJenis = strtolower((string) $menu->jenis);
        $newStatus = strtolower((string) $menu->status);
        $newTotal = (float) $menu->total;
        $newCreated = (string) $menu->created_at;
        $newDibayar = (float) $menu->dibayar;
        $newPerson = (string) $menu->person_baru;
        $menuId = (string) $menu->id;

        $oldTanggal = $oldCreated ? substr($oldCreated, 0, 10) : '';
        $newTanggal = $newCreated ? substr($newCreated, 0, 10) : '';

        $oldIsPembelian = str_contains($oldJenis, 'pembelian');
        $oldIsPenjServis = (str_contains($oldJenis, 'penjualan') || str_contains($oldJenis, 'servis') || str_contains($oldJenis, 'service'));
        $newIsPembelian = str_contains($newJenis, 'pembelian');
        $newIsPenjServis = (str_contains($newJenis, 'penjualan') || str_contains($newJenis, 'servis') || str_contains($newJenis, 'service'));

        // 1. Revert report lama (Atomic)
        if ($oldTanggal && $oldStatus === 'belum' && $oldTotal != 0 && ($oldIsPembelian || $oldIsPenjServis)) {
            $orep = $this->getOrCreateReport($oldTanggal);
            if ($orep) {
                if ($oldIsPembelian)  { DB::table('report')->where('id', $orep->id)->decrement('hutang', $oldTotal); }
                if ($oldIsPenjServis) { DB::table('report')->where('id', $orep->id)->decrement('piutang', $oldTotal); }
            }
        }

        // 2. Apply report baru (Atomic)
        if ($newTanggal && $newStatus === 'belum' && $newTotal != 0 && ($newIsPembelian || $newIsPenjServis)) {
            $nrep = $this->getOrCreateReport($newTanggal);
            if ($nrep) {
                if ($newIsPembelian)  { DB::table('report')->where('id', $nrep->id)->increment('hutang', $newTotal); }
                if ($newIsPenjServis) { DB::table('report')->where('id', $nrep->id)->increment('piutang', $newTotal); }
            }
        }

        // 3. Update bon
        $bonList = Bon::where('ref_menu', $menuId)->get();
        $newSisa = $newTotal - $newDibayar;

        if ($newIsPenjServis) {
            if ($newStatus !== 'belum' || $newSisa <= 0) {
                foreach ($bonList as $bItem) {
                    $bItem->delete();
                }
            } elseif ($bonList->count() > 0) {
                $bonUp = $bonList->first();
                $needSave = false;
                if ((float) $bonUp->nominal !== $newSisa) { $bonUp->nominal = $newSisa; $needSave = true; }
                if ((string) $bonUp->customer !== $newPerson) { $bonUp->customer = $newPerson; $needSave = true; }
                if ((string) $bonUp->jenis !== 'in') { $bonUp->jenis = 'in'; $needSave = true; }
                if ((string) $bonUp->created_date !== $newTanggal) { $bonUp->created_date = $newTanggal; $needSave = true; }
                if ($needSave) { $bonUp->save(); }
            } else {
                Bon::create([
                    'ref_menu' => $menuId,
                    'created_date' => $newTanggal,
                    'customer' => $newPerson,
                    'nominal' => $newSisa,
                    'jenis' => 'in',
                    'status' => 'belum',
                ]);
            }
        }
    }

    public function deleting(Menu $menu): void
    {
        $menuId = (string) $menu->id;
        $jenis = strtolower((string) $menu->jenis);
        $status = strtolower((string) $menu->status);
        $total = (float) $menu->total;
        $createdAt = (string) $menu->created_at;
        $tanggal = $createdAt ? substr($createdAt, 0, 10) : '';

        $isPembelian = str_contains($jenis, 'pembelian');
        $isPenjServis = (str_contains($jenis, 'penjualan') || str_contains($jenis, 'servis') || str_contains($jenis, 'service'));

        // 1. Cascade delete child collections (memeriksa ref_baru dan ref)
        // LogStock delete triggers LogStockObserver@deleted
        LogStock::where('ref_baru', $menuId)->orWhere('ref', $menuId)->get()->each->delete();

        // Ongkos delete triggers OngkosObserver@deleted
        Ongkos::where('ref_baru', $menuId)->orWhere('ref', $menuId)->get()->each->delete();

        // Cashflow delete triggers CashflowObserver@deleted (reverting account balances & report entries)
        Cashflow::where('ref_baru', $menuId)->orWhere('ref', $menuId)->get()->each->delete();

        // 2. Revert report hutang/piutang (Atomic)
        if ($status === 'belum' && $tanggal && $total != 0 && ($isPembelian || $isPenjServis)) {
            $rep = $this->getOrCreateReport($tanggal);
            if ($rep) {
                if ($isPembelian)  { DB::table('report')->where('id', $rep->id)->decrement('hutang', $total); }
                if ($isPenjServis) { DB::table('report')->where('id', $rep->id)->decrement('piutang', $total); }
            }
        }

        // 3. Hapus bon terkait menu
        Bon::where('ref_menu', $menuId)->get()->each->delete();
    }
}
