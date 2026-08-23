<?php

namespace Tests\Feature;

use App\Models\Report;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportCronTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_daily_report_command_creates_report(): void
    {
        $today = Carbon::today()->format('Y-m-d');
        $this->artisan('report:create-daily')->assertSuccessful();

        $report = Report::whereDate('created_at', $today)->first();
        $this->assertNotNull($report);
    }

    public function test_cleanup_holiday_report_command_deletes_zero_omset_report(): void
    {
        $yesterday = Carbon::yesterday()->format('Y-m-d');
        $report = Report::create([
            'created_at' => $yesterday . ' 08:00:00',
            'omset_toko' => 0,
            'omset_minuman' => 0,
            'omset_servis' => 0,
        ]);

        $this->artisan('report:cleanup-holiday')->assertSuccessful();

        $this->assertDatabaseMissing('report', ['id' => $report->id]);
    }
}
