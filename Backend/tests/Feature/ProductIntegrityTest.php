<?php
namespace Tests\Feature;

use App\Models\{Produk, LogStock};
use App\Http\Middleware\AuthenticatePocketBase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ProductIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_list_uses_existing_sort_column(): void
    {
        $this->withoutMiddleware(AuthenticatePocketBase::class);
        Produk::create(['id'=>'product','id_lama'=>'SKU-A']);
        $this->getJson('/api/produks')->assertOk()->assertJsonPath('0.id','product');
    }

    public function test_direct_stock_overwrite_is_rejected(): void
    {
        $this->withoutMiddleware(AuthenticatePocketBase::class);
        Produk::create(['id'=>'product','stok_3'=>5]);
        $this->putJson('/api/produks/product',['stok_3'=>99])->assertUnprocessable();
        $this->assertEquals(5,Produk::find('product')->stok_3);
    }

    public function test_product_with_zero_stock_but_history_cannot_be_deleted(): void
    {
        $product=Produk::create(['id'=>'product','stok_3'=>0]);
        LogStock::create(['item_baru'=>'product','qty'=>1,'boolean'=>'in']);
        LogStock::create(['item_baru'=>'product','qty'=>1,'boolean'=>'out']);
        $this->expectException(ValidationException::class);
        $product->refresh()->delete();
    }

    public function test_negative_and_fractional_stock_movements_are_rejected_before_insert(): void
    {
        $product=Produk::create(['id'=>'product','stok_3'=>5]);
        foreach ([-2,0,0.5] as $qty) {
            try {
                LogStock::create(['item_baru'=>'product','qty'=>$qty,'boolean'=>'out']);
                $this->fail('Invalid quantity accepted');
            } catch (ValidationException $error) {
                $this->assertArrayHasKey('qty',$error->errors());
            }
        }
        $this->assertEquals(5,$product->fresh()->stok_3);
        $this->assertDatabaseCount('log_stock',0);
    }

    public function test_backdated_purchase_does_not_replace_newer_buy_price(): void
    {
        $product=Produk::create(['id'=>'product','stok_3'=>0]);
        LogStock::create(['item_baru'=>'product','qty'=>1,'boolean'=>'in','price_1'=>200,'created_at'=>'2026-10-18 08:00:00']);
        LogStock::create(['item_baru'=>'product','qty'=>1,'boolean'=>'in','price_1'=>100,'created_at'=>'2026-10-17 08:00:00']);
        $this->assertEquals(200,$product->fresh()->beli);
    }

    public function test_moving_purchase_recalculates_prices_for_both_products(): void
    {
        $first=Produk::create(['id'=>'first','stok_3'=>0]);
        $second=Produk::create(['id'=>'second','stok_3'=>0]);
        LogStock::create(['item_baru'=>'first','qty'=>1,'boolean'=>'in','price_1'=>100,'created_at'=>'2026-10-17 08:00:00']);
        $moved=LogStock::create(['item_baru'=>'first','qty'=>1,'boolean'=>'in','price_1'=>200,'created_at'=>'2026-10-18 08:00:00']);
        LogStock::create(['item_baru'=>'second','qty'=>1,'boolean'=>'in','price_1'=>300,'created_at'=>'2026-10-19 08:00:00']);
        $moved->update(['item_baru'=>'second']);
        $this->assertEquals(100,$first->fresh()->beli);
        $this->assertEquals(300,$second->fresh()->beli);
        $this->assertEquals(1,$first->fresh()->stok_3);
        $this->assertEquals(2,$second->fresh()->stok_3);
    }

    public function test_zero_price_adjustment_does_not_reset_manual_buy_price(): void
    {
        $product=Produk::create(['id'=>'product','stok_3'=>0,'beli'=>777]);
        $log=LogStock::create(['item_baru'=>'product','qty'=>2,'boolean'=>'in','price_1'=>0]);
        $log->update(['qty'=>1]);
        $log->delete();
        $this->assertEquals(777,$product->fresh()->beli);
    }
}
