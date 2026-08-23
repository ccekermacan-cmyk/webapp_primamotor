<?php

namespace App\Services;

use App\Models\Report;
use App\Models\Menu;
use App\Models\LogStock;
use App\Models\Cashflow;
use App\Models\Ongkos;
use App\Models\Produk;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ReportService
{
    /**
     * Menghitung ulang data laporan berdasarkan tanggal (Y-m-d) di timezone lokal.
     * Logika ini mereplikasi kalkulasi `calculateReportData` di frontend.
     */
    public static function recalculateDaily(string $dateString)
    {
        try {
            // Karena PocketBase menyimpan data sebagai string UTC "YYYY-MM-DD HH:mm:ss.SSSZ"
            // Dan kita menyimpan tanggal lokal, maka kita akan menggunakan filter rentang tanggal.
            $start = Carbon::parse($dateString, 'Asia/Jakarta')->startOfDay()->timezone('UTC')->format('Y-m-d H:i:s.v\Z');
            $end = Carbon::parse($dateString, 'Asia/Jakarta')->endOfDay()->timezone('UTC')->format('Y-m-d H:i:s.v\Z');

            // --- 1. Ambil Data Menu (untuk referensi piutang/hutang dan mapping jenis nota) ---
            $menus = Menu::whereBetween('created_at', [$start, $end])->get();
            $menuMap = [];
            $totalPiutang = 0;
            $totalHutang = 0;

            foreach ($menus as $m) {
                $jenis = strtolower($m->jenis ?? '');
                $menuMap[$m->id] = $jenis;

                if (strtolower($m->status ?? '') === 'belum') {
                    $s = ($m->total ?? 0) - ($m->dibayar ?? 0);
                    if ($s > 0) {
                        if (str_contains($jenis, 'penjualan') || str_contains($jenis, 'service') || str_contains($jenis, 'servis')) {
                            $totalPiutang += $s;
                        } elseif (str_contains($jenis, 'pembelian')) {
                            $totalHutang += $s;
                        }
                    }
                }
            }

            // --- 2. Ambil Data LogStock (untuk omset penjualan/minuman dan laba) ---
            // Kita pakai "with('produk')" tetapi karena struktur PocketBase itu `expand`,
            // kita mungkin harus melakukan JOIN manual jika relasi eloquent tidak ada.
            // Wait, LogStock has 'item_baru' which points to Produk.
            // Let's assume Produk map can be loaded if LogStock relations are not set correctly.
            $allProduk = Produk::all()->keyBy('id');
            
            $logStocks = LogStock::whereBetween('created_at', [$start, $end])->get();
            
            $totalOmsetPenjualan = 0;
            $totalOmsetMinuman = 0;
            $totalLabaPenjualan = 0;
            $totalLabaServis = 0;
            $totalLabaMinuman = 0;

            foreach ($logStocks as $item) {
                if (strtolower($item->boolean ?? '') !== 'out') continue;
                
                $refBaru = $item->ref_baru;
                // Skip jika punya referensi nota tapi nota tidak ada (orphaned)
                if ($refBaru && !isset($menuMap[$refBaru])) continue;

                $menuJenis = $refBaru ? ($menuMap[$refBaru] ?? '') : '';
                
                // Pengecualian
                if (str_contains($menuJenis, 'pembelian') || str_contains($menuJenis, 'rusak') || str_contains($menuJenis, 'opname')) {
                    continue;
                }

                $kategori = strtolower(optional($allProduk->get($item->item_baru))->kategori ?? '');
                $qty = $item->qty ?? 0;
                $nilaiJual = ($item->price_1 ?? 0) * $qty;
                $nilaiModal = $item->price_2 ?? 0;
                $laba = $nilaiJual - $nilaiModal;

                $isMinuman = ($kategori === 'minuman' || str_contains($menuJenis, 'minuman'));
                $isService = (str_contains($menuJenis, 'service') || str_contains($menuJenis, 'servis'));

                if ($isMinuman) {
                    $totalOmsetMinuman += $nilaiJual;
                    $totalLabaMinuman += $laba;
                } elseif ($isService) {
                    $totalOmsetPenjualan += $nilaiJual;
                    $totalLabaServis += $laba;
                } else {
                    $totalOmsetPenjualan += $nilaiJual;
                    $totalLabaPenjualan += $laba;
                }
            }

            // --- 3. Ambil Data Ongkos (untuk omset servis) ---
            $ongkosList = Ongkos::whereBetween('date', [$start, $end])->get();
            $omsetServis = 0;
            foreach ($ongkosList as $item) {
                if ($item->ref_baru && !isset($menuMap[$item->ref_baru])) continue;
                $omsetServis += ($item->ongkos ?? 0);
            }

            // --- 4. Ambil Data Cashflow (untuk kasir, operasional, pemasukan/pengeluaran lain) ---
            $cashflows = Cashflow::whereBetween('created_at', [$start, $end])->get();
            
            $pemasukanLain = 0;
            $cashKasir = 0;
            $totalCashflowKeluarNonPembelian = 0;

            foreach ($cashflows as $cf) {
                if ($cf->ref_baru && !isset($menuMap[$cf->ref_baru])) continue;

                $jenis = strtolower($cf->jenis ?? '');
                $nominal = $cf->nominal ?? 0;
                $mutasi = strtolower($cf->mutasi ?? '');

                if ($mutasi === 'out' && !str_contains($jenis, 'pembelian') && !str_contains($jenis, 'transfer')) {
                    $totalCashflowKeluarNonPembelian += $nominal;
                }

                if (str_contains($jenis, 'pemasukan')) {
                    $pemasukanLain += $nominal;
                }

                $acc1 = strtolower($cf->acc1 ?? '');
                $acc2 = strtolower($cf->acc2 ?? '');

                if (str_contains($acc1, 'kasir') || str_contains($acc1, 'cash')) {
                    if ($mutasi === 'in' || $mutasi === 'masuk') $cashKasir += $nominal;
                    elseif ($mutasi === 'out' || $mutasi === 'keluar') $cashKasir -= $nominal;
                } elseif (str_contains($acc2, 'kasir') || str_contains($acc2, 'cash')) {
                    if ($mutasi === 'out' || $mutasi === 'keluar') $cashKasir += $nominal;
                }
            }

            $operasionalToko = $totalCashflowKeluarNonPembelian;
            $pengeluaranLain = 0;

            // --- 5. Simpan / Perbarui Record Report ---
            
            $report = Report::where('created_at', 'like', $dateString . '%')->first();

            $data = [
                'omset_toko' => $totalOmsetPenjualan,
                'omset_servis' => $omsetServis,
                'omset_minuman' => $totalOmsetMinuman,
                'laba_penjualan' => $totalLabaPenjualan,
                'laba_service' => $totalLabaServis,
                'laba_minuman' => $totalLabaMinuman,
                'operasional_toko' => $operasionalToko,
                'pengeluaran_lain' => $pengeluaranLain,
                'pemasukan_lain' => $pemasukanLain,
                'hutang' => $totalHutang,
                'piutang' => $totalPiutang,
                'kasir_toko' => $cashKasir,
            ];

            if ($report) {
                $report->update($data);
            } else {
                $data['created_at'] = $dateString . ' 00:00:00.000Z';
                Report::create($data);
            }
            
            Log::info("ReportService: Berhasil re-kalkulasi laporan {$dateString}");
        } catch (\Exception $e) {
            Log::error("ReportService Error: " . $e->getMessage());
        }
    }
}
