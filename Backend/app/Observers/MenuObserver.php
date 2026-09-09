<?php

namespace App\Observers;

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

    private function getHutangPiutang(string $status, float $total, float $dibayar): float
    {
        if ($status === 'belum') {
            return max(0, $total - $dibayar);
        }
        return 0;
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
        $hp = $this->getHutangPiutang($status, $total, $dibayar);
        if ($hp > 0 && $tanggal && ($isPembelian || $isPenjServis)) {
            $rep = $this->getOrCreateReport($tanggal);
            if ($rep) {
                if ($isPembelian)  { DB::table('report')->where('id', $rep->id)->increment('hutang', $hp); }
                if ($isPenjServis) { DB::table('report')->where('id', $rep->id)->increment('piutang', $hp); }
            }
        }
    }

    public function updated(Menu $menu): void
    {
        $oldJenis = strtolower((string) ($menu->getOriginal('jenis') ?? ''));
        $oldStatus = strtolower((string) ($menu->getOriginal('status') ?? ''));
        $oldTotal = (float) ($menu->getOriginal('total') ?? 0);
        $oldDibayar = (float) ($menu->getOriginal('dibayar') ?? 0);
        $oldCreated = (string) ($menu->getOriginal('created_at') ?? '');

        $newJenis = strtolower((string) $menu->jenis);
        $newStatus = strtolower((string) $menu->status);
        $newTotal = (float) $menu->total;
        $newDibayar = (float) $menu->dibayar;
        $newCreated = (string) $menu->created_at;
        $newPerson = (string) $menu->person_baru;
        $menuId = (string) $menu->id;

        $oldTanggal = $oldCreated ? substr($oldCreated, 0, 10) : '';
        $newTanggal = $newCreated ? substr($newCreated, 0, 10) : '';

        $oldIsPembelian = str_contains($oldJenis, 'pembelian');
        $oldIsPenjServis = (str_contains($oldJenis, 'penjualan') || str_contains($oldJenis, 'servis') || str_contains($oldJenis, 'service'));
        $newIsPembelian = str_contains($newJenis, 'pembelian');
        $newIsPenjServis = (str_contains($newJenis, 'penjualan') || str_contains($newJenis, 'servis') || str_contains($newJenis, 'service'));

        $oldHp = $this->getHutangPiutang($oldStatus, $oldTotal, $oldDibayar);
        $newHp = $this->getHutangPiutang($newStatus, $newTotal, $newDibayar);

        // 1. Revert report lama (Atomic)
        if ($oldTanggal && $oldHp > 0 && ($oldIsPembelian || $oldIsPenjServis)) {
            $orep = $this->getOrCreateReport($oldTanggal);
            if ($orep) {
                if ($oldIsPembelian)  { DB::table('report')->where('id', $orep->id)->decrement('hutang', $oldHp); }
                if ($oldIsPenjServis) { DB::table('report')->where('id', $orep->id)->decrement('piutang', $oldHp); }
            }
        }

        // 2. Apply report baru (Atomic)
        if ($newTanggal && $newHp > 0 && ($newIsPembelian || $newIsPenjServis)) {
            $nrep = $this->getOrCreateReport($newTanggal);
            if ($nrep) {
                if ($newIsPembelian)  { DB::table('report')->where('id', $nrep->id)->increment('hutang', $newHp); }
                if ($newIsPenjServis) { DB::table('report')->where('id', $nrep->id)->increment('piutang', $newHp); }
            }
        }
    }

    public function deleting(Menu $menu): void
    {
        $menuId = (string) $menu->id;
        $jenis = strtolower((string) $menu->jenis);
        $status = strtolower((string) $menu->status);
        $total = (float) $menu->total;
        $dibayar = (float) $menu->dibayar;
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
        $hp = $this->getHutangPiutang($status, $total, $dibayar);
        if ($hp > 0 && $tanggal && ($isPembelian || $isPenjServis)) {
            $rep = $this->getOrCreateReport($tanggal);
            if ($rep) {
                if ($isPembelian)  { DB::table('report')->where('id', $rep->id)->decrement('hutang', $hp); }
                if ($isPenjServis) { DB::table('report')->where('id', $rep->id)->decrement('piutang', $hp); }
            }
        }
    }
}
