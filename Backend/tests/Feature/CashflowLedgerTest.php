<?php
namespace Tests\Feature;

use App\Models\Cashflow;
use App\Models\Dropdown;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class CashflowLedgerTest extends TestCase
{
    use RefreshDatabase;

    private function account(string $id, float $balance): Dropdown
    {
        return Dropdown::create(['id' => $id, 'number_1' => $balance]);
    }

    public function test_expense_does_not_credit_hidden_destination(): void
    {
        $source = $this->account('source', 1000);
        $target = $this->account('target', 20);
        $row = Cashflow::create(['account_1' => 'source', 'account_2' => 'target', 'jenis' => 'operasional', 'mutasi' => 'out', 'nominal' => 300]);
        $this->assertEquals(700, $source->fresh()->number_1);
        $this->assertEquals(20, $target->fresh()->number_1);
        $this->assertSame('', $row->fresh()->account_2);
    }

    public function test_edit_expense_restores_original_amount_before_validating(): void
    {
        $source = $this->account('source', 1000);
        $row = Cashflow::create(['account_1' => 'source', 'mutasi' => 'out', 'nominal' => 900]);
        $row->update(['nominal' => 800]);
        $this->assertEquals(200, $source->fresh()->number_1);
    }

    public function test_insufficient_funds_roll_back_record_and_balance(): void
    {
        $source = $this->account('source', 500);
        try {
            DB::transaction(fn () => Cashflow::create(['account_1' => 'source', 'mutasi' => 'out', 'nominal' => 600]));
            $this->fail('Overdraft was accepted');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('nominal', $e->errors());
        }
        $this->assertEquals(500, $source->fresh()->number_1);
        $this->assertDatabaseCount('cashflow', 0);
    }

    public function test_transfer_to_same_account_is_rejected(): void
    {
        $this->account('source', 500);
        $this->expectException(ValidationException::class);
        Cashflow::create(['account_1' => 'source', 'account_2' => 'source', 'jenis' => 'transfer', 'mutasi' => 'out', 'nominal' => 100]);
    }

    public function test_linked_manual_bon_follows_cashflow_edit_and_delete(): void
    {
        $this->account('source', 1000);
        $user = \App\Models\User::create(['id' => 'employee', 'name' => 'Employee', 'number' => 0]);
        $row = Cashflow::create(['account_1' => 'source', 'jenis' => 'bon', 'mutasi' => 'out', 'nominal' => 100]);
        $bon = \App\Models\Bon::create(['user' => $user->id, 'ref_cashflow' => $row->id, 'jenis' => 'out', 'nominal' => 100]);
        $row->update(['nominal' => 150]);
        $this->assertEquals(150, $user->fresh()->number);
        $this->assertEquals(150, $bon->fresh()->nominal);
        $row->delete();
        $this->assertEquals(0, $user->fresh()->number);
        $this->assertNull($bon->fresh());
    }

    public function test_historical_edit_rebuilds_following_balance_snapshots(): void
    {
        $source = $this->account('source', 0);
        $first = Cashflow::create(['account_1' => 'source', 'mutasi' => 'in', 'nominal' => 100, 'created_at' => '2026-10-01 08:00:00']);
        $second = Cashflow::create(['account_1' => 'source', 'mutasi' => 'in', 'nominal' => 50, 'created_at' => '2026-10-02 08:00:00']);
        $first->update(['nominal' => 200]);
        $this->assertEquals(250, $source->fresh()->number_1);
        $this->assertEquals(200, $second->fresh()->saldo_awal);
        $this->assertEquals(250, $second->fresh()->saldo_akhir);
        $first->delete();
        $this->assertEquals(0, $second->fresh()->saldo_awal);
        $this->assertEquals(50, $second->fresh()->saldo_akhir);
    }
}
