<?php

namespace App\Console\Commands;

use App\Models\Report;
use Carbon\Carbon;
use Illuminate\Console\Command;

class CleanupHolidayReportCommand extends Command
{
    protected $signature = 'report:cleanup-holiday';
    protected $description = 'Menghapus laporan harian kemarin jika toko libur (omset = 0)';

    public function handle(): int
    {
        $kemarin = Carbon::yesterday()->format('Y-m-d');
        $this->info("[report_cron] Cek report kemarin: {$kemarin}");

        $reports = Report::whereDate('created_at', $kemarin)->get();
        if ($reports->isEmpty()) {
            $this->info("[report_cron] Tidak ada report kemarin, tidak ada yang dihapus.");
            return Command::SUCCESS;
        }

        foreach ($reports as $rep) {
            $totalOmset = (float) $rep->omset_toko + (float) $rep->omset_minuman + (float) $rep->omset_servis;
            if ($totalOmset == 0) {
                $rep->delete();
                $this->info("[report_cron] Report libur dihapus — ID: {$rep->id} | Tanggal: {$kemarin}");
            } else {
                $this->info("[report_cron] Report kemarin ada omset ({$totalOmset}), tidak dihapus.");
            }
        }

        return Command::SUCCESS;
    }
}
