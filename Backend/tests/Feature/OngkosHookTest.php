<?php

namespace Tests\Feature;

use App\Models\Ongkos;
use App\Models\Report;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OngkosHookTest extends TestCase
{
    use RefreshDatabase;

    public function test_ongkos_lifecycle_updates_omset_servis(): void
    {
        $today = now()->format('Y-m-d');
        $report = Report::create([
            'created_at' => $today . ' 08:00:00',
        ]);

        $ongkos = Ongkos::create([
            'ongkos' => 50000,
            'created_at' => $today . ' 10:00:00',
        ]);

        $report->refresh();
        $this->assertEquals(50000, $report->omset_servis);

        $ongkos->update([
            'ongkos' => 75000,
        ]);

        $report->refresh();
        $this->assertEquals(75000, $report->omset_servis);

        $ongkos->delete();

        $report->refresh();
        $this->assertEquals(0, $report->omset_servis);
    }
}
