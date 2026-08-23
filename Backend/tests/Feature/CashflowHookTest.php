<?php

namespace Tests\Feature;

use App\Models\Bon;
use App\Models\Cashflow;
use App\Models\Dropdown;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashflowHookTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashflow_in_out_updates_account_balances(): void
    {
        $acc1 = Dropdown::create(['id' => 'acc1', 'number_1' => 100000]);
        $acc2 = Dropdown::create(['id' => 'acc2', 'number_1' => 20000]);

        // Cashflow IN -> acc1 +50000
        Cashflow::create([
            'mutasi' => 'in',
            'account_1' => 'acc1',
            'nominal' => 50000,
        ]);

        $acc1->refresh();
        $this->assertEquals(150000, $acc1->number_1);

        // Cashflow OUT -> acc1 -30000, acc2 +30000
        Cashflow::create([
            'mutasi' => 'out',
            'account_1' => 'acc1',
            'account_2' => 'acc2',
            'nominal' => 30000,
        ]);

        $acc1->refresh();
        $acc2->refresh();

        $this->assertEquals(120000, $acc1->number_1);
        $this->assertEquals(50000, $acc2->number_1);
    }

    public function test_cashflow_bonkaryawan_creates_bon_and_updates_user_number(): void
    {
        $acc1 = Dropdown::create(['id' => 'acc1', 'number_1' => 100000]);
        $user = User::create([
            'id' => 'usr1',
            'name' => 'Karyawan 1',
            'number' => 0,
        ]);

        $cf = Cashflow::create([
            'mutasi' => 'out',
            'jenis' => 'bonkaryawan',
            'account_1' => 'acc1',
            'account_2' => 'usr1',
            'nominal' => 25000,
        ]);

        $user->refresh();
        $this->assertEquals(25000, $user->number);

        $bon = Bon::where('ref_cashflow', $cf->id)->first();
        $this->assertNotNull($bon);
        $this->assertEquals(25000, $bon->nominal);
    }
}
