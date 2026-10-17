<?php

namespace Tests\Feature;

use App\Http\Middleware\AuthenticatePocketBase;
use App\Models\{Cashflow, Dropdown, LogStock, Menu, Produk};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{DB, Http};
use Tests\TestCase;

class TransactionSyncTest extends TestCase
{
    use RefreshDatabase;

    private function sync(array $events, string $requestId = 'test-request')
    {
        return $this->withoutMiddleware(AuthenticatePocketBase::class)->postJson('/api/webhooks/batch', [
            'request_id' => $requestId, 'events' => $events,
        ]);
    }

    public function test_batch_applies_stock_once_and_retry_is_safe(): void
    {
        Produk::create(['id' => 'p1', 'stok_3' => 10]);
        DB::table('log_stock')->insert(['id' => 'l1', 'item_baru' => 'p1', 'qty' => 2, 'boolean' => 'out']);
        $events = [['collection' => 'log_stock', 'event' => 'created', 'id' => 'l1']];
        $this->sync($events)->assertOk();
        $this->sync($events)->assertOk();
        $this->sync($events, 'another-request')->assertOk();
        $this->assertEquals(8, Produk::find('p1')->stok_3);
    }

    public function test_update_uses_original_snapshot_and_allows_later_edits(): void
    {
        Produk::create(['id' => 'p1', 'stok_3' => 10]);
        DB::table('log_stock')->insert(['id' => 'l1', 'item_baru' => 'p1', 'qty' => 2, 'boolean' => 'out']);
        $this->sync([['collection' => 'log_stock', 'event' => 'created', 'id' => 'l1']])->assertOk();
        $old = LogStock::find('l1')->getAttributes();
        DB::table('log_stock')->where('id', 'l1')->update(['qty' => 3]);
        $event = [['collection' => 'log_stock', 'event' => 'updated', 'id' => 'l1', 'old_data' => $old]];
        $this->sync($event, 'edit-1')->assertOk();
        $this->sync($event, 'edit-1')->assertOk();
        $this->assertEquals(7, Produk::find('p1')->stok_3);
        $old = LogStock::find('l1')->getAttributes();
        DB::table('log_stock')->where('id', 'l1')->update(['qty' => 2]);
        $this->sync([['collection' => 'log_stock', 'event' => 'updated', 'id' => 'l1', 'old_data' => $old]], 'edit-2')->assertOk();
        $this->assertEquals(8, Produk::find('p1')->stok_3);
    }

    public function test_deleted_batch_row_uses_captured_snapshot(): void
    {
        Produk::create(['id' => 'p1', 'stok_3' => 10]);
        $log = LogStock::create(['id' => 'l1', 'item_baru' => 'p1', 'qty' => 2, 'boolean' => 'out']);
        $snapshot = $log->getAttributes();
        DB::table('log_stock')->where('id', 'l1')->delete();
        $events = [['collection' => 'log_stock', 'event' => 'deleted', 'id' => 'l1', 'record' => $snapshot]];
        $this->sync($events)->assertOk();
        $this->sync($events)->assertOk();
        $this->assertEquals(10, Produk::find('p1')->stok_3);
    }

    public function test_entire_batch_rolls_back_if_one_stock_update_fails(): void
    {
        Produk::create(['id' => 'p1', 'stok_3' => 3]);
        foreach (['l1', 'l2'] as $id) DB::table('log_stock')->insert(['id' => $id, 'item_baru' => 'p1', 'qty' => 2, 'boolean' => 'out']);
        $this->sync([
            ['collection' => 'log_stock', 'event' => 'created', 'id' => 'l1'],
            ['collection' => 'log_stock', 'event' => 'created', 'id' => 'l2'],
        ])->assertStatus(500);
        $this->assertEquals(3, Produk::find('p1')->stok_3);
        $this->assertDatabaseCount('webhook_marks', 0);
    }

    public function test_multiple_cashflows_to_same_account_are_each_applied_once(): void
    {
        Dropdown::create(['id' => 'acc', 'number_1' => 100]);
        foreach (['c1', 'c2'] as $id) DB::table('cashflow')->insert([
            'id' => $id, 'account_1' => 'acc', 'nominal' => 20, 'mutasi' => 'in', 'saldo_akhir' => 120,
        ]);
        $this->sync([
            ['collection' => 'cashflow', 'event' => 'created', 'id' => 'c1'],
            ['collection' => 'cashflow', 'event' => 'created', 'id' => 'c2'],
        ])->assertOk();
        $this->assertEquals(140, Dropdown::find('acc')->number_1);
    }

    public function test_product_relation_change_restores_old_stock(): void
    {
        Produk::create(['id' => 'p1', 'stok_3' => 10]);
        Produk::create(['id' => 'p2', 'stok_3' => 20]);
        $log = LogStock::create(['item_baru' => 'p1', 'qty' => 2, 'boolean' => 'out']);
        DB::transaction(fn () => $log->update(['item_baru' => 'p2']));
        $this->assertEquals(10, Produk::find('p1')->stok_3);
        $this->assertEquals(18, Produk::find('p2')->stok_3);
    }

    public function test_delete_endpoint_reverts_all_children_and_is_retry_safe(): void
    {
        $this->withoutMiddleware(AuthenticatePocketBase::class);
        Produk::create(['id' => 'p1', 'stok_3' => 10]);
        Dropdown::create(['id' => 'acc', 'number_1' => 100]);
        Menu::create(['id' => 'm1', 'total' => 50]);
        LogStock::create(['item_baru' => 'p1', 'qty' => 2, 'boolean' => 'out', 'ref_baru' => 'm1']);
        Cashflow::create(['account_1' => 'acc', 'nominal' => 20, 'mutasi' => 'in', 'ref_baru' => 'm1']);
        $this->deleteJson('/api/transactions/menu/m1')->assertOk();
        $this->deleteJson('/api/transactions/menu/m1')->assertOk();
        $this->assertEquals(10, Produk::find('p1')->stok_3);
        $this->assertEquals(100, Dropdown::find('acc')->number_1);
        $this->assertDatabaseMissing('menu', ['id' => 'm1']);
    }

    public function test_api_rejects_missing_auth_and_inactive_user(): void
    {
        $this->postJson('/api/webhooks/batch', [])->assertUnauthorized();
        Http::fake(['*' => Http::response(['record' => ['id' => 'u', 'status' => 'inactive', 'level' => 1]])]);
        $this->withToken('token')->postJson('/api/webhooks/batch', [])->assertForbidden();
    }

    public function test_update_without_original_data_is_rejected(): void
    {
        DB::table('log_stock')->insert(['id' => 'l1']);
        $this->sync([['collection' => 'log_stock', 'event' => 'updated', 'id' => 'l1']])->assertUnprocessable();
        $this->assertDatabaseCount('webhook_marks', 0);
    }

    public function test_report_uses_jakarta_day_and_does_not_count_stock_adjustments_as_sales(): void
    {
        Produk::create(['id' => 'p1', 'stok_3' => 10, 'kategori' => 'sparepart']);
        DB::table('menu')->insert(['id' => 'm1', 'jenis' => 'penjualan', 'total' => 100, 'dibayar' => 40, 'status' => 'belum', 'created_at' => '2026-10-17T18:00:00.000Z']);
        DB::table('log_stock')->insert(['id' => 'l1', 'item_baru' => 'p1', 'qty' => 1, 'price_1' => 100, 'price_2' => 60, 'boolean' => 'out', 'ref_baru' => 'm1', 'created_at' => '2026-10-17T18:00:00.000Z']);
        DB::table('log_stock')->insert(['id' => 'adjust', 'item_baru' => 'p1', 'qty' => 1, 'price_1' => 500, 'price_2' => 60, 'boolean' => 'out', 'created_at' => '2026-10-18 03:00:00.000Z']);
        DB::table('cashflow')->insert(['id' => 'operating', 'jenis' => 'operasional', 'nominal' => 10, 'mutasi' => 'out', 'created_at' => '2026-10-18 03:00:00.000Z']);
        DB::table('cashflow')->insert(['id' => 'other', 'jenis' => 'pengeluaranlain', 'nominal' => 5, 'mutasi' => 'out', 'created_at' => '2026-10-18 03:00:00.000Z']);
        \App\Services\ReportService::recalculateDaily('2026-10-18');
        $report = \App\Models\Report::whereDate('created_at', '2026-10-18')->first();
        $this->assertEquals(100, $report->omset_toko);
        $this->assertEquals(40, $report->laba_penjualan);
        $this->assertEquals(60, $report->piutang);
        $this->assertEquals(10, $report->operasional_toko);
        $this->assertEquals(5, $report->pengeluaran_lain);
    }

    public function test_deleting_zero_price_stock_adjustment_keeps_purchase_price(): void
    {
        $product = Produk::create(['id' => 'p1', 'stok_3' => 10, 'beli' => 100]);
        $log = LogStock::create(['item_baru' => 'p1', 'qty' => 2, 'boolean' => 'in', 'price_1' => 0]);
        DB::transaction(fn () => $log->delete());
        $product->refresh();
        $this->assertEquals(10, $product->stok_3);
        $this->assertEquals(100, $product->beli);
    }

    public function test_auth_refresh_sends_json_object_and_report_access_checks_level(): void
    {
        Http::fake(['*' => Http::response(['record' => ['id' => 'u', 'status' => 'Active', 'level' => 10]])]);
        $this->withToken('token')->getJson('/api/reports')->assertForbidden();
        Http::assertSent(fn ($request) => $request->body() === '{}');
    }
    public function test_pocketbase_connection_failure_returns_actionable_503(): void
    {
        Http::fake(fn () => throw new \Illuminate\Http\Client\ConnectionException('Connection refused'));
        $this->withToken('diagnostic-token')->getJson('/api/user')->assertStatus(503)
            ->assertJsonFragment(['message' => 'Layanan autentikasi tidak tersedia. Periksa POCKETBASE_URL dan koneksi Laravel ke PocketBase.']);
    }

    public function test_upstream_auth_outage_is_not_reported_as_an_expired_session(): void
    {
        Http::fake(['*' => Http::response(['message' => 'unavailable'], 503)]);
        $this->withToken('diagnostic-token')->getJson('/api/user')->assertStatus(503);
    }

    public function test_missing_auth_endpoint_and_malformed_success_are_configuration_errors(): void
    {
        Http::fake(['*' => Http::response([], 404)]);
        $this->withToken('diagnostic-token')->getJson('/api/user')->assertStatus(503);
        Http::fake(['*' => Http::response(['status' => 'ok'], 200)]);
        $this->withToken('diagnostic-token')->getJson('/api/user')->assertStatus(503);
    }

    public function test_delete_that_would_overdraw_cash_rolls_back_all_children(): void
    {
        $this->withoutMiddleware(AuthenticatePocketBase::class);
        Produk::create(['id' => 'p1', 'stok_3' => 10]);
        Dropdown::create(['id' => 'acc', 'number_1' => 0]);
        $menu = Menu::create(['id' => 'm1', 'jenis' => 'penjualan', 'total' => 50]);
        LogStock::create(['item_baru' => 'p1', 'qty' => 2, 'boolean' => 'out', 'ref_baru' => 'm1']);
        Cashflow::create(['account_1' => 'acc', 'nominal' => 50, 'mutasi' => 'in', 'ref_baru' => 'm1']);
        \Illuminate\Support\Facades\DB::table('dropdown')->where('id', 'acc')->update(['number_1' => 10]);
        $this->deleteJson('/api/transactions/menu/m1')->assertUnprocessable()->assertJsonValidationErrors('nominal');
        $this->assertNotNull($menu->fresh());
        $this->assertEquals(8, Produk::find('p1')->stok_3);
        $this->assertEquals(10, Dropdown::find('acc')->number_1);
        $this->assertDatabaseCount('log_stock', 1);
        $this->assertDatabaseCount('cashflow', 1);
    }

    public function test_replacing_equivalent_payment_does_not_fail_on_a_temporary_overdraft(): void
    {
        Dropdown::create(['id' => 'acc', 'number_1' => 10]);
        Menu::create(['id' => 'm1', 'jenis' => 'penjualan', 'total' => 100]);
        $old = ['id' => 'oldcf', 'account_1' => 'acc', 'nominal' => 100, 'mutasi' => 'in', 'ref_baru' => 'm1'];
        DB::table('cashflow')->insert(['id' => 'newcf', 'account_1' => 'acc', 'nominal' => 100, 'mutasi' => 'in', 'ref_baru' => 'm1']);
        $events = [
            ['collection' => 'cashflow', 'event' => 'deleted', 'id' => 'oldcf', 'record' => $old],
            ['collection' => 'cashflow', 'event' => 'created', 'id' => 'newcf'],
        ];
        $this->sync($events, 'replace-payment')->assertOk();
        $this->sync($events, 'replace-payment')->assertOk();
        $this->assertEquals(10, Dropdown::find('acc')->number_1);
        $this->assertEquals(100, Menu::find('m1')->dibayar);
    }

}
