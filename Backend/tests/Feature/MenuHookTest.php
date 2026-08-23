<?php

namespace Tests\Feature;

use App\Models\Bon;
use App\Models\Cashflow;
use App\Models\Dropdown;
use App\Models\LogStock;
use App\Models\Menu;
use App\Models\Ongkos;
use App\Models\Produk;
use App\Models\Report;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MenuHookTest extends TestCase
{
    use RefreshDatabase;

    public function test_menu_unpaid_creates_bon_and_updates_piutang(): void
    {
        $today = now()->format('Y-m-d');
        Report::create([
            'created_at' => $today . ' 08:00:00',
        ]);

        $menu = Menu::create([
            'jenis' => 'penjualan',
            'status' => 'belum',
            'total' => 100000,
            'dibayar' => 30000,
            'person_baru' => 'cust1',
            'created_at' => $today . ' 09:00:00',
        ]);

        $report = Report::whereDate('created_at', $today)->first();
        $this->assertEquals(100000, $report->piutang);

        $bon = Bon::where('ref_menu', $menu->id)->first();
        $this->assertNotNull($bon);
        $this->assertEquals(70000, $bon->nominal); // sisa 70000
    }

    public function test_menu_cascade_delete_removes_children_and_reverts_state(): void
    {
        $today = now()->format('Y-m-d');
        Report::create([
            'created_at' => $today . ' 08:00:00',
        ]);

        $acc = Dropdown::create(['id' => 'acc1', 'number_1' => 100000]);
        $prod = Produk::create(['id' => 'prod1', 'stok_3' => 50]);

        $menu = Menu::create([
            'id' => 'menu1',
            'jenis' => 'penjualan',
            'status' => 'belum',
            'total' => 50000,
            'dibayar' => 0,
            'created_at' => $today . ' 09:00:00',
        ]);

        // Child LogStock (out 5)
        LogStock::create([
            'item_baru' => 'prod1',
            'qty' => 5,
            'boolean' => 'out',
            'ref_baru' => 'menu1',
            'created_at' => $today . ' 09:05:00',
        ]);

        // Child Cashflow (in 20000)
        Cashflow::create([
            'mutasi' => 'in',
            'account_1' => 'acc1',
            'nominal' => 20000,
            'ref_baru' => 'menu1',
            'created_at' => $today . ' 09:10:00',
        ]);

        // Child Ongkos
        Ongkos::create([
            'ongkos' => 15000,
            'ref_baru' => 'menu1',
            'created_at' => $today . ' 09:15:00',
        ]);

        $prod->refresh();
        $acc->refresh();
        $this->assertEquals(45, $prod->stok_3);
        $this->assertEquals(120000, $acc->number_1);

        // DELETE MENU
        $menu->delete();

        // Check cascade deletion & state reversion
        $this->assertDatabaseMissing('log_stock', ['ref_baru' => 'menu1']);
        $this->assertDatabaseMissing('cashflow', ['ref_baru' => 'menu1']);
        $this->assertDatabaseMissing('ongkos', ['ref_baru' => 'menu1']);

        $prod->refresh();
        $acc->refresh();

        // Stock reverted (+5) => 50
        $this->assertEquals(50, $prod->stok_3);
        // Account balance reverted (-20000) => 100000
        $this->assertEquals(100000, $acc->number_1);
    }
}
