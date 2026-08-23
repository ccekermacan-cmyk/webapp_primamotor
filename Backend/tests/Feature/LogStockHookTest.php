<?php

namespace Tests\Feature;

use App\Models\LogStock;
use App\Models\Menu;
use App\Models\Produk;
use App\Models\Report;
use Exception;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LogStockHookTest extends TestCase
{
    use RefreshDatabase;

    public function test_log_stock_in_increases_stock_and_updates_buy_price(): void
    {
        $produk = Produk::create([
            'id' => 'prod1',
            'stok_3' => 10,
            'beli' => 5000,
            'kategori' => 'suku_cadang',
        ]);

        LogStock::create([
            'item_baru' => 'prod1',
            'qty' => 5,
            'price_1' => 7000,
            'boolean' => 'in',
        ]);

        $produk->refresh();
        $this->assertEquals(15, $produk->stok_3);
        $this->assertEquals(7000, $produk->beli);
    }

    public function test_log_stock_out_throws_exception_if_insufficient_stock(): void
    {
        Produk::create([
            'id' => 'prod1',
            'stok_3' => 5,
        ]);

        $this->expectException(Exception::class);

        LogStock::create([
            'item_baru' => 'prod1',
            'qty' => 10,
            'boolean' => 'out',
        ]);
    }

    public function test_log_stock_out_updates_daily_report_omset_and_laba(): void
    {
        $today = now()->format('Y-m-d');
        Report::create([
            'created_at' => $today . ' 08:00:00',
        ]);

        $produk = Produk::create([
            'id' => 'prod1',
            'stok_3' => 20,
            'kategori' => 'suku_cadang',
        ]);

        $menu = Menu::create([
            'id' => 'menu1',
            'jenis' => 'penjualan',
            'status' => 'lunas',
        ]);

        LogStock::create([
            'item_baru' => 'prod1',
            'qty' => 2,
            'price_1' => 10000, // total = 20000
            'price_2' => 12000, // modal = 12000 -> laba = 8000
            'boolean' => 'out',
            'ref_baru' => 'menu1',
            'created_at' => $today . ' 10:00:00',
        ]);

        $report = Report::whereDate('created_at', $today)->first();
        $this->assertEquals(20000, $report->omset_toko);
        $this->assertEquals(8000, $report->laba_penjualan);
    }
}
