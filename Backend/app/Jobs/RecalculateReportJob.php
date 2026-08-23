<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Services\ReportService;
use Carbon\Carbon;

class RecalculateReportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $dateString;

    /**
     * Create a new job instance.
     */
    public function __construct(string $dateString = null)
    {
        $this->dateString = $dateString ?? Carbon::now('Asia/Jakarta')->format('Y-m-d');
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        ReportService::recalculateDaily($this->dateString);
    }
}
