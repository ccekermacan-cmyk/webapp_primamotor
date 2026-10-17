<?php

namespace App\Observers;

use App\Models\Bon;
use App\Models\Cashflow;
use App\Models\Dropdown;
use App\Models\Menu;
use App\Models\Report;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CashflowObserver
{
    public function creating(Cashflow $cashflow): void { app(\App\Services\CashflowLedger::class)->validate($cashflow); }
    public function updating(Cashflow $cashflow): void { app(\App\Services\CashflowLedger::class)->validate($cashflow); }

    private function syncMenuDibayar(string $menuId, ?string $excludeCashflowId = null): void
    {
        if (!$menuId) return;
        $menu = \App\Models\Menu::find($menuId);
        if (!$menu) return;

        $query = \Illuminate\Support\Facades\DB::table('cashflow')
            ->where(fn ($q) => $q->where('ref_baru', $menuId)->orWhere('ref', $menuId));

        if ($excludeCashflowId) {
            $query->where('id', '!=', $excludeCashflowId);
        }

        $totalDibayar = $query->sum('nominal');

        $total = (float) $menu->total;
        $requiresProof = str_contains(strtolower((string) $menu->jenis), 'pembelian') && empty($menu->file);
        $status = ($totalDibayar >= $total && $total > 0 && !$requiresProof) ? 'lunas' : 'belum';

        if ((float) $menu->dibayar !== (float) $totalDibayar || $menu->status !== $status) {
            $menu->dibayar = $totalDibayar;
            $menu->status = $status;
            $menu->date_lunas = $status === 'lunas' ? ($menu->date_lunas ?: now('UTC')->format('Y-m-d H:i:s.v\Z')) : '';
            // Gunakan save() agar MenuObserver ikut menyesuaikan status Bon & Report (Hutang/Piutang)
            $menu->save();
        }
    }

    private function getRelId($val): string
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

    private function resolveDropdownId($val): string
    {
        $id = $this->getRelId($val);
        if (!$id) return '';
        $dp = DB::table('dropdown')->where('id', $id)->orWhere('id_lama', $id)->first();
        return $dp ? (string) $dp->id : '';
    }

    private function getCashkasirId(): string
    {
        $ck = Dropdown::where('text_1', 'cashkasir')->first();
        return $ck ? (string) $ck->id : '';
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

    public function created(Cashflow $cashflow): void
    {
        $this->syncMenuDibayar($this->getMenuIdForSync($cashflow));

        $nominal = (float) $cashflow->nominal;
        $mutasiRaw = strtolower((string) $cashflow->mutasi);
        $isMasuk = ($mutasiRaw === 'in' || $mutasiRaw === 'masuk');
        $isKeluar = ($mutasiRaw === 'out' || $mutasiRaw === 'keluar');
        $jenis = strtolower((string) $cashflow->jenis);
        $acc1 = $this->resolveDropdownId($cashflow->account_1 ?: $cashflow->acc1);
        $acc2 = str_contains($jenis, 'transfer') ? $this->resolveDropdownId($cashflow->account_2 ?: $cashflow->acc2) : '';
        $refBaru = $this->getRelId($cashflow->ref_baru);
        $createdAt = (string) $cashflow->created_at;
        $tanggal = $this->getReportDate($refBaru, $createdAt);
        $cfPerson = $this->getRelId($cashflow->person);
        $cfNote = (string) $cashflow->note;
        $cfOperator = (string) $cashflow->operator;

        $cashkasirId = $this->getCashkasirId();

        app(\App\Services\CashflowLedger::class)->apply($cashflow, 'created');

        // 2. Bon karyawan
        if (!Bon::where('ref_cashflow', $cashflow->id)->exists() && !$refBaru && $jenis === 'bonkaryawan' && $mutasiRaw === 'out' && $acc1) {
            $userId = User::find($this->getRelId($cashflow->account_2))?->id ?: User::where('username', (string) $cashflow->persontext)->value('id');
            if ($cfPerson) {
                $dp = Dropdown::find($cfPerson);
                if ($dp) {
                    $uName = strtolower(trim((string) $dp->text_1));
                    $userRec = User::whereRaw('LOWER(TRIM(name)) = ?', [$uName])
                                   ->orWhereRaw('LOWER(TRIM(username)) = ?', [$uName])
                                   ->first();
                    if ($userRec) $userId = $userRec->id;
                }
            }

            Bon::create([
                'created_at' => $createdAt,
                'akun_asal' => $acc1,
                'nominal' => $nominal,
                'jenis' => 'out',
                'ref_cashflow' => $cashflow->id,
                'person' => $cfPerson,
                'user' => $userId ?: '',
                'note' => $cfNote,
                'operator' => $cfOperator,
            ]);

        }

        // 3. Update report (Atomic)
        if ($tanggal) {
            $rep = $this->getOrCreateReport($tanggal);
            if ($rep) {
                if ($mutasiRaw === 'in' && $jenis === 'pemasukanlain') {
                    DB::table('report')->where('id', $rep->id)->increment('pemasukan_lain', $nominal);
                }
                if ($mutasiRaw === 'out' && $jenis === 'pengeluaranlain') {
                    DB::table('report')->where('id', $rep->id)->increment('pengeluaran_lain', $nominal);
                }
                if ($mutasiRaw === 'out' && $jenis === 'operasional') {
                    DB::table('report')->where('id', $rep->id)->increment('operasional_toko', $nominal);
                }
                if ($cashkasirId) {
                    $dk = 0;
                    if ($mutasiRaw === 'in' && $acc1 === $cashkasirId)  $dk = $nominal;
                    if ($mutasiRaw === 'out' && $acc1 === $cashkasirId) $dk = -$nominal;
                    if ($mutasiRaw === 'out' && $acc2 === $cashkasirId) $dk = $nominal;
                    if ($dk > 0) {
                        DB::table('report')->where('id', $rep->id)->increment('kasir_toko', $dk);
                    } elseif ($dk < 0) {
                        DB::table('report')->where('id', $rep->id)->decrement('kasir_toko', abs($dk));
                    }
                }
            }
        }
    }

    private function getMenuIdForSync(Cashflow $cashflow, bool $original = false): string
    {
        $refBaru = $original ? $cashflow->getOriginal('ref_baru') : $cashflow->ref_baru;
        $refBaru = $this->getRelId($refBaru);
        if ($refBaru) return $refBaru;
        
        $ref = $original ? $cashflow->getOriginal('ref') : $cashflow->ref;
        return $this->getRelId($ref);
    }

    public function updated(Cashflow $cashflow): void
    {
        $this->syncMenuDibayar($this->getMenuIdForSync($cashflow));
        
        $origId = $this->getMenuIdForSync($cashflow, true);
        if ($origId && $origId !== $this->getMenuIdForSync($cashflow)) {
            $this->syncMenuDibayar($origId);
        }

        $oldNominal = (float) ($cashflow->getOriginal('nominal') ?? 0);
        $oldMutasiRaw = strtolower((string) ($cashflow->getOriginal('mutasi') ?? ''));
        $isOldMasuk = ($oldMutasiRaw === 'in' || $oldMutasiRaw === 'masuk');
        $isOldKeluar = ($oldMutasiRaw === 'out' || $oldMutasiRaw === 'keluar');
        $oldJenis = strtolower((string) ($cashflow->getOriginal('jenis') ?? ''));
        $oldAcc1 = $this->resolveDropdownId($cashflow->getOriginal('account_1') ?: $cashflow->getOriginal('acc1'));
        $oldAcc2 = $this->resolveDropdownId($cashflow->getOriginal('account_2') ?: $cashflow->getOriginal('acc2'));
        $oldRef = $this->getRelId($cashflow->getOriginal('ref_baru'));
        $oldCreated = (string) ($cashflow->getOriginal('created_at') ?? '');
        $oldTanggal = $this->getReportDate($oldRef, $oldCreated);

        $newNominal = (float) $cashflow->nominal;
        $newMutasiRaw = strtolower((string) $cashflow->mutasi);
        $isNewMasuk = ($newMutasiRaw === 'in' || $newMutasiRaw === 'masuk');
        $isNewKeluar = ($newMutasiRaw === 'out' || $newMutasiRaw === 'keluar');
        $newJenis = strtolower((string) $cashflow->jenis);
        $newAcc1 = $this->resolveDropdownId($cashflow->account_1 ?: $cashflow->acc1);
        $newAcc2 = str_contains($newJenis, 'transfer') ? $this->resolveDropdownId($cashflow->account_2 ?: $cashflow->acc2) : '';
        $newRef = $this->getRelId($cashflow->ref_baru);
        $newCreated = (string) $cashflow->created_at;
        $newTanggal = $this->getReportDate($newRef, $newCreated);
        $newPerson = $this->getRelId($cashflow->person);
        $newNote = (string) $cashflow->note;
        $newOperator = (string) $cashflow->operator;

        $cashkasirId = $this->getCashkasirId();

        app(\App\Services\CashflowLedger::class)->apply($cashflow, 'updated');

        // Manual bon keeps its identity and employee relation when its cashflow is edited.
        $manualBon = $newJenis === 'bon' && $newMutasiRaw === 'out';
        foreach (Bon::where('ref_cashflow', $cashflow->id)->get() as $linkedBon) {
            if ($manualBon) {
                $linkedBon->update(['created_at' => $newCreated, 'akun_asal' => $newAcc1,
                    'nominal' => $newNominal, 'note' => $newNote, 'operator' => $newOperator]);
            } else {
                $linkedBon->delete();
            }
        }

        // 4. Create new linked bon
        if (!$newRef && $newJenis === 'bonkaryawan' && $newMutasiRaw === 'out' && $newAcc1) {
            $newUserId = User::find($this->getRelId($cashflow->account_2))?->id ?: User::where('username', (string) $cashflow->persontext)->value('id');
            if ($newPerson) {
                $dp = Dropdown::find($newPerson);
                if ($dp) {
                    $uName = strtolower(trim((string) $dp->text_1));
                    $userRec = User::whereRaw('LOWER(TRIM(name)) = ?', [$uName])
                                   ->orWhereRaw('LOWER(TRIM(username)) = ?', [$uName])
                                   ->first();
                    if ($userRec) $newUserId = $userRec->id;
                }
            }

            Bon::create([
                'created_at' => $newCreated,
                'akun_asal' => $newAcc1,
                'nominal' => $newNominal,
                'jenis' => 'out',
                'ref_cashflow' => $cashflow->id,
                'person' => $newPerson,
                'user' => $newUserId ?: '',
                'note' => $newNote,
                'operator' => $newOperator,
            ]);

        }

        // 5. Revert old report (Atomic)
        if ($oldTanggal) {
            $orep = $this->getOrCreateReport($oldTanggal);
            if ($orep) {
                if ($oldMutasiRaw === 'in' && $oldJenis === 'pemasukanlain') {
                    DB::table('report')->where('id', $orep->id)->decrement('pemasukan_lain', $oldNominal);
                }
                if ($oldMutasiRaw === 'out' && $oldJenis === 'pengeluaranlain') {
                    DB::table('report')->where('id', $orep->id)->decrement('pengeluaran_lain', $oldNominal);
                }
                if ($oldMutasiRaw === 'out' && $oldJenis === 'operasional') {
                    DB::table('report')->where('id', $orep->id)->decrement('operasional_toko', $oldNominal);
                }
                if ($cashkasirId) {
                    $oDK = 0;
                    if ($oldMutasiRaw === 'in' && $oldAcc1 === $cashkasirId)  $oDK = $oldNominal;
                    if ($oldMutasiRaw === 'out' && $oldAcc1 === $cashkasirId) $oDK = -$oldNominal;
                    if ($oldMutasiRaw === 'out' && $oldAcc2 === $cashkasirId) $oDK = $oldNominal;
                    if ($oDK > 0) {
                        DB::table('report')->where('id', $orep->id)->decrement('kasir_toko', $oDK);
                    } elseif ($oDK < 0) {
                        DB::table('report')->where('id', $orep->id)->increment('kasir_toko', abs($oDK));
                    }
                }
            }
        }

        // 6. Apply new report (Atomic)
        if ($newTanggal) {
            $nrep = $this->getOrCreateReport($newTanggal);
            if ($nrep) {
                if ($newMutasiRaw === 'in' && $newJenis === 'pemasukanlain') {
                    DB::table('report')->where('id', $nrep->id)->increment('pemasukan_lain', $newNominal);
                }
                if ($newMutasiRaw === 'out' && $newJenis === 'pengeluaranlain') {
                    DB::table('report')->where('id', $nrep->id)->increment('pengeluaran_lain', $newNominal);
                }
                if ($newMutasiRaw === 'out' && $newJenis === 'operasional') {
                    DB::table('report')->where('id', $nrep->id)->increment('operasional_toko', $newNominal);
                }
                if ($cashkasirId) {
                    $nDK = 0;
                    if ($newMutasiRaw === 'in' && $newAcc1 === $cashkasirId)  $nDK = $newNominal;
                    if ($newMutasiRaw === 'out' && $newAcc1 === $cashkasirId) $nDK = -$newNominal;
                    if ($newMutasiRaw === 'out' && $newAcc2 === $cashkasirId) $nDK = $newNominal;
                    if ($nDK > 0) {
                        DB::table('report')->where('id', $nrep->id)->increment('kasir_toko', $nDK);
                    } elseif ($nDK < 0) {
                        DB::table('report')->where('id', $nrep->id)->decrement('kasir_toko', abs($nDK));
                    }
                }
            }
        }
    }

    public function deleted(Cashflow $cashflow): void
    {
        $this->syncMenuDibayar($this->getMenuIdForSync($cashflow), (string)$cashflow->id);

        $nominal = (float) $cashflow->nominal;
        $mutasiRaw = strtolower((string) $cashflow->mutasi);
        $isMasuk = ($mutasiRaw === 'in' || $mutasiRaw === 'masuk');
        $isKeluar = ($mutasiRaw === 'out' || $mutasiRaw === 'keluar');
        $jenis = strtolower((string) $cashflow->jenis);
        $acc1 = $this->resolveDropdownId($cashflow->account_1 ?: $cashflow->acc1);
        $acc2 = str_contains($jenis, 'transfer') ? $this->resolveDropdownId($cashflow->account_2 ?: $cashflow->acc2) : '';
        $createdAt = (string) $cashflow->created_at;
        $tanggal = $this->getReportDate($this->getRelId($cashflow->ref_baru), $createdAt);

        $cashkasirId = $this->getCashkasirId();

        app(\App\Services\CashflowLedger::class)->apply($cashflow, 'deleted');

        Bon::where('ref_cashflow', $cashflow->id)->get()->each->delete();

        // 3. Revert report (Atomic)
        if ($tanggal) {
            $rep = $this->getOrCreateReport($tanggal);
            if ($rep) {
                if ($mutasiRaw === 'in' && $jenis === 'pemasukanlain') {
                    DB::table('report')->where('id', $rep->id)->decrement('pemasukan_lain', $nominal);
                }
                if ($mutasiRaw === 'out' && $jenis === 'pengeluaranlain') {
                    DB::table('report')->where('id', $rep->id)->decrement('pengeluaran_lain', $nominal);
                }
                if ($mutasiRaw === 'out' && $jenis === 'operasional') {
                    DB::table('report')->where('id', $rep->id)->decrement('operasional_toko', $nominal);
                }
                if ($cashkasirId) {
                    $dDK = 0;
                    if ($mutasiRaw === 'in' && $acc1 === $cashkasirId)  $dDK = $nominal;
                    if ($mutasiRaw === 'out' && $acc1 === $cashkasirId) $dDK = -$nominal;
                    if ($mutasiRaw === 'out' && $acc2 === $cashkasirId) $dDK = $nominal;
                    if ($dDK > 0) {
                        DB::table('report')->where('id', $rep->id)->decrement('kasir_toko', $dDK);
                    } elseif ($dDK < 0) {
                        DB::table('report')->where('id', $rep->id)->increment('kasir_toko', abs($dDK));
                    }
                }
            }
        }
    }
}

