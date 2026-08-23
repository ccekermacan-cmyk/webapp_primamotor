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
    private function syncMenuDibayar(string $menuId): void
    {
        if (!$menuId) return;
        $menu = \App\Models\Menu::find($menuId);
        if (!$menu) return;

        $totalDibayar = \Illuminate\Support\Facades\DB::table('cashflow')
            ->where('ref_baru', $menuId)
            ->sum('nominal');

        $total = (float) $menu->total;
        $status = ($totalDibayar >= $total && $total > 0) ? 'lunas' : 'belum';

        if ((float) $menu->dibayar !== (float) $totalDibayar || $menu->status !== $status) {
            $menu->dibayar = $totalDibayar;
            $menu->status = $status;
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

    public function created(Cashflow $cashflow): void
    {
        $this->syncMenuDibayar((string)$cashflow->ref_baru);

        $nominal = (float) $cashflow->nominal;
        $mutasi = strtolower((string) $cashflow->mutasi);
        $jenis = strtolower((string) $cashflow->jenis);
        $acc1 = $this->getRelId($cashflow->account_1);
        $acc2 = $this->getRelId($cashflow->account_2);
        $refBaru = $this->getRelId($cashflow->ref_baru);
        $createdAt = (string) $cashflow->created_at;
        $tanggal = $createdAt ? substr($createdAt, 0, 10) : '';
        $cfPerson = $this->getRelId($cashflow->person);
        $cfNote = (string) $cashflow->note;
        $cfOperator = (string) $cashflow->operator;

        $cashkasirId = $this->getCashkasirId();

        // 1. Sinkron saldo akun (Atomic with Saldo Capture)
        if ($mutasi === 'in') {
            if ($acc1) {
                DB::transaction(function () use ($acc1, $nominal, $cashflow) {
                    DB::table('dropdown')->where('id', $acc1)->increment('number_1', $nominal);
                    $newBal = DB::table('dropdown')->where('id', $acc1)->value('number_1') ?? 0;
                    
                    $cashflow->saldo_awal = $newBal - $nominal;
                    $cashflow->saldo_akhir = $newBal;
                    $cashflow->saveQuietly();
                });
            }
        } elseif ($mutasi === 'out') {
            DB::transaction(function () use ($acc1, $acc2, $nominal, $cashflow) {
                if ($acc1) {
                    DB::table('dropdown')->where('id', $acc1)->decrement('number_1', $nominal);
                    $newBal = DB::table('dropdown')->where('id', $acc1)->value('number_1') ?? 0;
                    
                    $cashflow->saldo_awal = $newBal + $nominal;
                    $cashflow->saldo_akhir = $newBal;
                    $cashflow->saveQuietly();
                }
                if ($acc2) {
                    DB::table('dropdown')->where('id', $acc2)->increment('number_1', $nominal);
                }
            });
        }

        // 2. Bon piutang: hanya jika menu.status = "belum"
        if ($refBaru && $mutasi === 'in') {
            $menuRec = Menu::find($refBaru);
            if ($menuRec && strtolower((string) $menuRec->status) === 'belum') {
                Bon::create([
                    'created_at' => $createdAt,
                    'customer' => $cfPerson,
                    'nominal' => $nominal,
                    'akun_asal' => $acc1,
                    'operator' => $cfOperator,
                    'jenis' => 'out',
                    'note' => $cfNote,
                    'ref_cashflow' => $cashflow->id,
                    'ref_menu' => $refBaru,
                ]);
            }
        }

        // 3. Bon karyawan
        if (!$refBaru && $jenis === 'bonkaryawan' && $mutasi === 'out' && $acc1) {
            Bon::create([
                'created_at' => $createdAt,
                'akun_asal' => $acc1,
                'nominal' => $nominal,
                'jenis' => 'in',
                'user' => $acc2,
                'ref_cashflow' => $cashflow->id,
                'person' => $cfPerson,
                'note' => $cfNote,
                'operator' => $cfOperator,
            ]);

            if ($acc2) {
                DB::table('user')->where('id', $acc2)->increment('number', $nominal);
            }
        }

        // 4. Update report (Atomic)
        if ($tanggal) {
            $rep = $this->getOrCreateReport($tanggal);
            if ($rep) {
                if ($mutasi === 'in' && $jenis === 'pemasukanlain') {
                    DB::table('report')->where('id', $rep->id)->increment('pemasukan_lain', $nominal);
                }
                if ($mutasi === 'out' && $jenis === 'pengeluaranlain') {
                    DB::table('report')->where('id', $rep->id)->increment('pengeluaran_lain', $nominal);
                }
                if ($mutasi === 'out' && $jenis === 'operasional') {
                    DB::table('report')->where('id', $rep->id)->increment('operasional_toko', $nominal);
                }
                if ($refBaru) {
                    $mRep = Menu::find($refBaru);
                    if ($mRep) {
                        $mj = strtolower((string) $mRep->jenis);
                        $ms = strtolower((string) $mRep->status);
                        $isPS = (str_contains($mj, 'penjualan') || str_contains($mj, 'servis') || str_contains($mj, 'service'));
                        if ($isPS && $ms === 'belum') {
                            DB::table('report')->where('id', $rep->id)->decrement('piutang', $nominal);
                        }
                        if (str_contains($mj, 'pembelian') && $ms === 'belum') {
                            DB::table('report')->where('id', $rep->id)->decrement('hutang', $nominal);
                        }
                    }
                }
                if ($cashkasirId) {
                    $dk = 0;
                    if ($mutasi === 'in' && $acc1 === $cashkasirId)  $dk = $nominal;
                    if ($mutasi === 'out' && $acc1 === $cashkasirId) $dk = -$nominal;
                    if ($mutasi === 'out' && $acc2 === $cashkasirId) $dk = $nominal;
                    if ($dk > 0) {
                        DB::table('report')->where('id', $rep->id)->increment('kasir_toko', $dk);
                    } elseif ($dk < 0) {
                        DB::table('report')->where('id', $rep->id)->decrement('kasir_toko', abs($dk));
                    }
                }
            }
        }
    }

    public function updated(Cashflow $cashflow): void
    {
        $this->syncMenuDibayar((string)$cashflow->ref_baru);
        $this->syncMenuDibayar((string)$cashflow->getOriginal('ref_baru'));

        $oldNominal = (float) ($cashflow->getOriginal('nominal') ?? 0);
        $oldMutasi = strtolower((string) ($cashflow->getOriginal('mutasi') ?? ''));
        $oldJenis = strtolower((string) ($cashflow->getOriginal('jenis') ?? ''));
        $oldAcc1 = $this->getRelId($cashflow->getOriginal('account_1'));
        $oldAcc2 = $this->getRelId($cashflow->getOriginal('account_2'));
        $oldRef = $this->getRelId($cashflow->getOriginal('ref_baru'));
        $oldCreated = (string) ($cashflow->getOriginal('created_at') ?? '');
        $oldTanggal = $oldCreated ? substr($oldCreated, 0, 10) : '';

        $newNominal = (float) $cashflow->nominal;
        $newMutasi = strtolower((string) $cashflow->mutasi);
        $newJenis = strtolower((string) $cashflow->jenis);
        $newAcc1 = $this->getRelId($cashflow->account_1);
        $newAcc2 = $this->getRelId($cashflow->account_2);
        $newRef = $this->getRelId($cashflow->ref_baru);
        $newCreated = (string) $cashflow->created_at;
        $newTanggal = $newCreated ? substr($newCreated, 0, 10) : '';
        $newPerson = $this->getRelId($cashflow->person);
        $newNote = (string) $cashflow->note;
        $newOperator = (string) $cashflow->operator;

        $cashkasirId = $this->getCashkasirId();

        // 1. Revert old account balance (Atomic)
        if ($oldMutasi === 'in') {
            if ($oldAcc1) {
                DB::table('dropdown')->where('id', $oldAcc1)->decrement('number_1', $oldNominal);
            }
        } elseif ($oldMutasi === 'out') {
            if ($oldAcc1) {
                DB::table('dropdown')->where('id', $oldAcc1)->increment('number_1', $oldNominal);
            }
            if ($oldAcc2) {
                DB::table('dropdown')->where('id', $oldAcc2)->decrement('number_1', $oldNominal);
            }
        }

        // 2. Apply new account balance (Atomic)
        if ($newMutasi === 'in') {
            if ($newAcc1) {
                DB::table('dropdown')->where('id', $newAcc1)->increment('number_1', $newNominal);
            }
        } elseif ($newMutasi === 'out') {
            if ($newAcc1) {
                DB::table('dropdown')->where('id', $newAcc1)->decrement('number_1', $newNominal);
            }
            if ($newAcc2) {
                DB::table('dropdown')->where('id', $newAcc2)->increment('number_1', $newNominal);
            }
        }

        // 3. Delete old linked bons
        $allBon = Bon::where('ref_cashflow', $cashflow->id)->get();
        foreach ($allBon as $bon) {
            $bUser = (string) $bon->user;
            $bNom = (float) $bon->nominal;
            if (strtolower((string) $bon->jenis) === 'in' && $bUser) {
                DB::table('user')->where('id', $bUser)->decrement('number', $bNom);
            }
            $bon->delete();
        }

        // 4. Create new linked bon
        if ($newRef && $newMutasi === 'in') {
            $mNew = Menu::find($newRef);
            if ($mNew && strtolower((string) $mNew->status) === 'belum') {
                Bon::create([
                    'created_at' => $newCreated,
                    'customer' => $newPerson,
                    'nominal' => $newNominal,
                    'akun_asal' => $newAcc1,
                    'operator' => $newOperator,
                    'jenis' => 'out',
                    'note' => $newNote,
                    'ref_cashflow' => $cashflow->id,
                    'ref_menu' => $newRef,
                ]);
            }
        }

        if (!$newRef && $newJenis === 'bonkaryawan' && $newMutasi === 'out' && $newAcc1) {
            Bon::create([
                'created_at' => $newCreated,
                'akun_asal' => $newAcc1,
                'nominal' => $newNominal,
                'jenis' => 'in',
                'user' => $newAcc2,
                'ref_cashflow' => $cashflow->id,
                'person' => $newPerson,
                'note' => $newNote,
                'operator' => $newOperator,
            ]);

            if ($newAcc2) {
                DB::table('user')->where('id', $newAcc2)->increment('number', $newNominal);
            }
        }

        // 5. Revert old report (Atomic)
        if ($oldTanggal) {
            $orep = $this->getOrCreateReport($oldTanggal);
            if ($orep) {
                if ($oldMutasi === 'in' && $oldJenis === 'pemasukanlain') {
                    DB::table('report')->where('id', $orep->id)->decrement('pemasukan_lain', $oldNominal);
                }
                if ($oldMutasi === 'out' && $oldJenis === 'pengeluaranlain') {
                    DB::table('report')->where('id', $orep->id)->decrement('pengeluaran_lain', $oldNominal);
                }
                if ($oldMutasi === 'out' && $oldJenis === 'operasional') {
                    DB::table('report')->where('id', $orep->id)->decrement('operasional_toko', $oldNominal);
                }
                if ($oldRef) {
                    $om = Menu::find($oldRef);
                    if ($om) {
                        $omj = strtolower((string) $om->jenis);
                        $oms = strtolower((string) $om->status);
                        $omPS = (str_contains($omj, 'penjualan') || str_contains($omj, 'servis') || str_contains($omj, 'service'));
                        if ($omPS && $oms === 'belum') {
                            DB::table('report')->where('id', $orep->id)->increment('piutang', $oldNominal);
                        }
                        if (str_contains($omj, 'pembelian') && $oms === 'belum') {
                            DB::table('report')->where('id', $orep->id)->increment('hutang', $oldNominal);
                        }
                    }
                }
                if ($cashkasirId) {
                    $oDK = 0;
                    if ($oldMutasi === 'in' && $oldAcc1 === $cashkasirId)  $oDK = $oldNominal;
                    if ($oldMutasi === 'out' && $oldAcc1 === $cashkasirId) $oDK = -$oldNominal;
                    if ($oldMutasi === 'out' && $oldAcc2 === $cashkasirId) $oDK = $oldNominal;
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
                if ($newMutasi === 'in' && $newJenis === 'pemasukanlain') {
                    DB::table('report')->where('id', $nrep->id)->increment('pemasukan_lain', $newNominal);
                }
                if ($newMutasi === 'out' && $newJenis === 'pengeluaranlain') {
                    DB::table('report')->where('id', $nrep->id)->increment('pengeluaran_lain', $newNominal);
                }
                if ($newMutasi === 'out' && $newJenis === 'operasional') {
                    DB::table('report')->where('id', $nrep->id)->increment('operasional_toko', $newNominal);
                }
                if ($newRef) {
                    $nm = Menu::find($newRef);
                    if ($nm) {
                        $nmj = strtolower((string) $nm->jenis);
                        $nms = strtolower((string) $nm->status);
                        $nmPS = (str_contains($nmj, 'penjualan') || str_contains($nmj, 'servis') || str_contains($nmj, 'service'));
                        if ($nmPS && $nms === 'belum') {
                            DB::table('report')->where('id', $nrep->id)->decrement('piutang', $newNominal);
                        }
                        if (str_contains($nmj, 'pembelian') && $nms === 'belum') {
                            DB::table('report')->where('id', $nrep->id)->decrement('hutang', $newNominal);
                        }
                    }
                }
                if ($cashkasirId) {
                    $nDK = 0;
                    if ($newMutasi === 'in' && $newAcc1 === $cashkasirId)  $nDK = $newNominal;
                    if ($newMutasi === 'out' && $newAcc1 === $cashkasirId) $nDK = -$newNominal;
                    if ($newMutasi === 'out' && $newAcc2 === $cashkasirId) $nDK = $newNominal;
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
        $this->syncMenuDibayar((string)$cashflow->ref_baru);

        $nominal = (float) $cashflow->nominal;
        $mutasi = strtolower((string) $cashflow->mutasi);
        $jenis = strtolower((string) $cashflow->jenis);
        $acc1 = $this->getRelId($cashflow->account_1);
        $acc2 = $this->getRelId($cashflow->account_2);
        $createdAt = (string) $cashflow->created_at;
        $tanggal = $createdAt ? substr($createdAt, 0, 10) : '';

        $cashkasirId = $this->getCashkasirId();

        // 1. Revert account balance (Atomic)
        if ($mutasi === 'in') {
            if ($acc1) {
                DB::table('dropdown')->where('id', $acc1)->decrement('number_1', $nominal);
            }
        } elseif ($mutasi === 'out') {
            if ($acc1) {
                DB::table('dropdown')->where('id', $acc1)->increment('number_1', $nominal);
            }
            if ($acc2) {
                DB::table('dropdown')->where('id', $acc2)->decrement('number_1', $nominal);
            }
        }

        // 2. Delete linked bon
        $bonList = Bon::where('ref_cashflow', $cashflow->id)->get();
        foreach ($bonList as $bon) {
            $bUser = (string) $bon->user;
            $bNom = (float) $bon->nominal;
            if (strtolower((string) $bon->jenis) === 'in' && $bUser) {
                DB::table('user')->where('id', $bUser)->decrement('number', $bNom);
            }
            $bon->delete();
        }

        // 3. Revert report (Atomic)
        if ($tanggal) {
            $rep = $this->getOrCreateReport($tanggal);
            if ($rep) {
                if ($mutasi === 'in' && $jenis === 'pemasukanlain') {
                    DB::table('report')->where('id', $rep->id)->decrement('pemasukan_lain', $nominal);
                }
                if ($mutasi === 'out' && $jenis === 'pengeluaranlain') {
                    DB::table('report')->where('id', $rep->id)->decrement('pengeluaran_lain', $nominal);
                }
                if ($mutasi === 'out' && $jenis === 'operasional') {
                    DB::table('report')->where('id', $rep->id)->decrement('operasional_toko', $nominal);
                }
                if ($cashkasirId) {
                    $dDK = 0;
                    if ($mutasi === 'in' && $acc1 === $cashkasirId)  $dDK = $nominal;
                    if ($mutasi === 'out' && $acc1 === $cashkasirId) $dDK = -$nominal;
                    if ($mutasi === 'out' && $acc2 === $cashkasirId) $dDK = $nominal;
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
