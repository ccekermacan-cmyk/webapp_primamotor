<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ReportService;
use Carbon\Carbon;

class RecalculateReport extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'report:recalculate {date? : Tanggal YYYY-MM-DD}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalculate report for a specific date (or today if omitted)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $date = $this->argument('date') ?? Carbon::now('Asia/Jakarta')->format('Y-m-d');
        
        $this->info("Memulai kalkulasi laporan untuk tanggal: {$date}");
        ReportService::recalculateDaily($date);
        $this->info("Kalkulasi selesai.");
    }
}
