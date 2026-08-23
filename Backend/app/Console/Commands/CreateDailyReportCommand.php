<?php

namespace App\Console\Commands;

use App\Models\Report;
use Carbon\Carbon;
use Illuminate\Console\Command;

class CreateDailyReportCommand extends Command
{
    protected $signature = 'report:create-daily {date?}';
    protected $description = 'Membuat baris laporan harian baru jika belum ada';

    public function handle(): int
    {
        $dateStr = $this->argument('date') ?: Carbon::today()->format('Y-m-d');
        $createdAt = $dateStr . ' 08:00:00';

        $existing = Report::whereDate('created_at', $dateStr)->first();
        if ($existing) {
            $this->info("[report_cron] Report {$dateStr} sudah ada, dilewati.");
            return Command::SUCCESS;
        }

        $report = Report::create([
            'created_at' => $createdAt,
        ]);

        $this->info("[report_cron] Report berhasil dibuat — Tanggal: {$dateStr} | ID: {$report->id}");
        return Command::SUCCESS;
    }
}
