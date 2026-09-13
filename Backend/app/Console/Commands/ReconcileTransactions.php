<?php

namespace App\Console\Commands;

use App\Jobs\RecalculateReportJob;
use App\Models\Bon;
use App\Models\Cashflow;
use App\Models\LogStock;
use App\Models\Menu;
use App\Models\Ongkos;
use App\Observers\BonObserver;
use App\Observers\CashflowObserver;
use App\Observers\LogStockObserver;
use App\Observers\MenuObserver;
use App\Observers\OngkosObserver;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ReconcileTransactions extends Command
{
    protected $signature = 'reconcile:transactions {--dry-run : Tampilkan aksi tanpa mengubah data}';

    protected $description = 'Repair drift stok/saldo/report: apply efek observer yang belum pernah diterapkan, backfill webhook marks, sinkron menu.dibayar, dan recalc report';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        DB::statement('CREATE TABLE IF NOT EXISTS webhook_marks (key TEXT PRIMARY KEY, created_at TEXT)');

        $pairs = [
            ['menu', Menu::class, MenuObserver::class],
            ['log_stock', LogStock::class, LogStockObserver::class],
            ['cashflow', Cashflow::class, CashflowObserver::class],
            ['ongkos', Ongkos::class, OngkosObserver::class],
            ['bon', Bon::class, BonObserver::class],
        ];

        $applied = 0;
        $skipped = 0;
        $failed = 0;
        $dates = [];

        foreach ($pairs as [$collection, $modelClass, $observerClass]) {
            $rows = $modelClass::all();
            $this->line("[{$collection}] total rows: " . $rows->count());

            foreach ($rows as $row) {
                $markKey = strtolower($collection) . ':created:' . (string) $row->id;
                $has = DB::table('webhook_marks')->where('key', $markKey)->exists();
                if ($has) {
                    $skipped++;
                    continue;
                }

                if ($dryRun) {
                    $this->line("  [dry-run] would apply created: {$collection}/{$row->id}");
                    $applied++;
                    continue;
                }

                try {
                    DB::transaction(function () use ($observerClass, $row, $markKey) {
                        app($observerClass)->created($row);
                        DB::table('webhook_marks')->insertOrIgnore([
                            'key' => $markKey,
                            'created_at' => now('UTC')->format('Y-m-d H:i:s.u\Z'),
                        ]);
                    });
                    $applied++;
                    $rawDate = $row->getAttribute('created_at') ?: $row->getAttribute('date');
                    if ($rawDate) {
                        $dates[] = substr((string) $rawDate, 0, 10);
                    }
                } catch (\Throwable $e) {
                    $failed++;
                    $this->error("  gagal apply {$collection}/{$row->id}: " . $e->getMessage());
                }
            }
        }

        if (!$dryRun) {
            // Sinkron menu.dibayar dari total cashflow (status sengaja tidak diubah,
            // karena pembelian tanpa media harus tetap 'belum' meski sudah dibayar)
            $fixedDibayar = 0;
            $menus = Menu::all();
            foreach ($menus as $m) {
                $sum = (float) DB::table('cashflow')->where('ref_baru', (string) $m->id)->sum('nominal');
                if ((float) $m->dibayar !== $sum) {
                    DB::table('menu')->where('id', (string) $m->id)->update(['dibayar' => $sum]);
                    $fixedDibayar++;
                }
            }
            $this->info("menu.dibayar diperbaiki: {$fixedDibayar}");

            // Recalc report untuk tanggal yang tersentuh (plus hari ini)
            $dates[] = now('Asia/Jakarta')->format('Y-m-d');
            foreach (array_unique(array_filter($dates)) as $d) {
                try {
                    RecalculateReportJob::dispatchSync($d);
                    $this->info("report recalc: {$d}");
                } catch (\Throwable $e) {
                    $this->error("report recalc gagal {$d}: " . $e->getMessage());
                }
            }
        }

        $this->info("Selesai. applied={$applied}, skipped={$skipped}, failed={$failed}");
        return $failed > 0 ? Command::FAILURE : Command::SUCCESS;
    }
}
