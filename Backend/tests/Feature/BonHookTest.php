<?php

namespace Tests\Feature;

use App\Models\Bon;
use App\Models\Dropdown;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BonHookTest extends TestCase
{
    use RefreshDatabase;

    public function test_bon_created_updates_dropdown_balance(): void
    {
        $dropdown = Dropdown::create([
            'id' => 'drop1',
            'text_1' => 'Person 1',
            'number_1' => 1000,
        ]);

        // jenis = 'out' -> increases number_1 (+500)
        Bon::create([
            'person' => 'drop1',
            'nominal' => 500,
            'jenis' => 'out',
        ]);

        $dropdown->refresh();
        $this->assertEquals(1500, $dropdown->number_1);

        // jenis = 'in' -> decreases number_1 (-200)
        Bon::create([
            'person' => 'drop1',
            'nominal' => 200,
            'jenis' => 'in',
        ]);

        $dropdown->refresh();
        $this->assertEquals(1300, $dropdown->number_1);
    }

    public function test_bon_updated_reverts_old_and_applies_new_balance(): void
    {
        $drop1 = Dropdown::create(['id' => 'drop1', 'number_1' => 1000]);
        $drop2 = Dropdown::create(['id' => 'drop2', 'number_1' => 500]);

        $bon = Bon::create([
            'person' => 'drop1',
            'nominal' => 200,
            'jenis' => 'out',
        ]);
        // drop1 balance is now 1200

        // Move bon to drop2 with nominal 300
        $bon->update([
            'person' => 'drop2',
            'nominal' => 300,
        ]);

        $drop1->refresh();
        $drop2->refresh();

        // drop1 reverted (-200) => 1000
        $this->assertEquals(1000, $drop1->number_1);
        // drop2 applied (+300) => 800
        $this->assertEquals(800, $drop2->number_1);
    }

    public function test_bon_deleted_reverts_balance(): void
    {
        $dropdown = Dropdown::create(['id' => 'drop1', 'number_1' => 1000]);

        $bon = Bon::create([
            'person' => 'drop1',
            'nominal' => 400,
            'jenis' => 'out',
        ]);

        $dropdown->refresh();
        $this->assertEquals(1400, $dropdown->number_1);

        $bon->delete();

        $dropdown->refresh();
        $this->assertEquals(1000, $dropdown->number_1);
    }
}
