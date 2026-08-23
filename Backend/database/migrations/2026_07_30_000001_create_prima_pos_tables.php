<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Dropdown (Akun, Supplier, Customer, Kasir)
        if (!Schema::hasTable('dropdown')) {
            Schema::create('dropdown', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->string('text_1')->nullable();
                $table->string('text_2')->nullable();
                $table->string('text_3')->nullable();
                $table->string('text_4')->nullable();
                $table->string('text_5')->nullable();
                $table->string('text_6')->nullable();
                $table->string('text_7')->nullable();
                $table->string('text_8')->nullable();
                $table->string('text_9')->nullable();
                $table->string('text_10')->nullable();
                $table->decimal('number_1', 15, 2)->default(0);
                $table->decimal('number_2', 15, 2)->default(0);
                $table->decimal('number_3', 15, 2)->default(0);
                $table->decimal('number_4', 15, 2)->default(0);
                $table->decimal('number_5', 15, 2)->default(0);
                $table->string('enum_1')->nullable();
                $table->string('enum_2')->nullable();
                $table->string('enum_3')->nullable();
                $table->string('enum_4')->nullable();
                $table->string('jenis')->nullable();
                $table->string('kategori')->nullable();
                $table->text('address')->nullable();
                $table->string('doc')->nullable();
                $table->string('image')->nullable();
                $table->string('latlong')->nullable();
                $table->string('link_image')->nullable();
                $table->string('operator')->nullable();
                $table->string('phone')->nullable();
                $table->string('visibilitas')->nullable();
                $table->json('file')->nullable();
            });
        }

        // 2. User (Karyawan / Admin)
        if (!Schema::hasTable('user')) {
            Schema::create('user', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->string('name')->nullable();
                $table->string('username')->nullable();
                $table->string('email')->nullable();
                $table->string('password')->nullable();
                $table->string('avatar')->nullable();
                $table->string('status')->nullable();
                $table->string('link_image')->nullable();
                $table->decimal('level', 10, 2)->default(0);
                $table->decimal('number', 15, 2)->default(0);
            });
        }

        // 3. Produk (Barang / Produk)
        if (!Schema::hasTable('produk')) {
            Schema::create('produk', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->string('kategori')->nullable();
                $table->string('jenis')->nullable();
                $table->string('merk')->nullable();
                $table->string('tipe')->nullable();
                $table->string('unit')->nullable();
                $table->text('keterangan')->nullable();
                $table->string('id_lama')->nullable();
                $table->string('varian')->nullable();
                $table->string('thumbnail')->nullable();
                $table->json('file')->nullable();
                $table->string('list_pic')->nullable();
                $table->decimal('stok_1', 15, 2)->default(0);
                $table->decimal('stok_2', 15, 2)->default(0);
                $table->decimal('stok_3', 15, 2)->default(0);
                $table->decimal('beli', 15, 2)->default(0);
                $table->decimal('sell_1', 15, 2)->default(0);
                $table->decimal('sell_2', 15, 2)->default(0);
                $table->decimal('sell_3', 15, 2)->default(0);
                $table->decimal('sell_4', 15, 2)->default(0);
                $table->decimal('sell_5', 15, 2)->default(0);
                $table->decimal('sell_6', 15, 2)->default(0);
                $table->decimal('min_1', 15, 2)->default(0);
                $table->decimal('min_2', 15, 2)->default(0);
                $table->decimal('min_3', 15, 2)->default(0);
                $table->string('date')->nullable();
            });
        }

        // 4. Menu (Transaksi Jual / Beli / Servis)
        if (!Schema::hasTable('menu')) {
            Schema::create('menu', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->string('jenis')->nullable();
                $table->string('status')->nullable();
                $table->decimal('total', 15, 2)->default(0);
                $table->decimal('dibayar', 15, 2)->default(0);
                $table->string('person_baru')->nullable();
                $table->string('person')->nullable();
                $table->string('operator')->nullable();
                $table->string('payment')->nullable();
                $table->string('marketplace')->nullable();
                $table->string('tempo')->nullable();
                $table->string('date_lunas')->nullable();
                $table->decimal('cashback', 15, 2)->default(0);
                $table->decimal('admin', 15, 2)->default(0);
                $table->decimal('qty', 15, 2)->default(0);
                $table->text('text')->nullable();
                $table->text('file_text')->nullable();
                $table->json('file')->nullable();
                $table->string('list_pic')->nullable();
                $table->string('id_lama')->nullable();
                $table->string('created_at')->nullable();
            });
        }

        // 5. Log Stock (Riwayat Stok In/Out)
        if (!Schema::hasTable('log_stock')) {
            Schema::create('log_stock', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->string('item_baru')->nullable();
                $table->string('item')->nullable();
                $table->integer('qty')->default(0);
                $table->decimal('price_1', 15, 2)->default(0);
                $table->decimal('price_2', 15, 2)->default(0);
                $table->string('boolean')->nullable(); // 'in' atau 'out'
                $table->string('ref_baru')->nullable(); // ref_menu
                $table->string('ref')->nullable();
                $table->string('operator')->nullable();
                $table->decimal('normal', 15, 2)->default(0);
                $table->string('created_at')->nullable();
            });
        }

        // 6. Cashflow (Mutasi Uang In/Out)
        if (!Schema::hasTable('cashflow')) {
            Schema::create('cashflow', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->string('mutasi')->nullable(); // 'in' atau 'out'
                $table->string('jenis')->nullable();
                $table->decimal('nominal', 15, 2)->default(0);
                $table->string('account_1')->nullable();
                $table->string('account_2')->nullable();
                $table->string('person')->nullable();
                $table->string('ref_baru')->nullable(); // ref_menu
                $table->string('ref')->nullable();
                $table->text('note')->nullable();
                $table->string('operator')->nullable();
                $table->string('id_lama')->nullable();
                $table->string('thumbnail')->nullable();
                $table->string('acc1')->nullable();
                $table->string('acc2')->nullable();
                $table->string('persontext')->nullable();
                $table->json('file')->nullable();
                $table->string('list_pic')->nullable();
                $table->string('created_at')->nullable();
            });
        }

        // 7. Ongkos (Biaya Servis)
        if (!Schema::hasTable('ongkos')) {
            Schema::create('ongkos', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->decimal('ongkos', 15, 2)->default(0);
                $table->string('person')->nullable();
                $table->string('operator')->nullable();
                $table->string('id_lama')->nullable();
                $table->string('ref')->nullable();
                $table->string('ref_baru')->nullable(); // ref_menu
                $table->string('date')->nullable();
                $table->string('created_at')->nullable();
            });
        }

        // 8. Bon (Catatan Hutang/Piutang/Karyawan)
        if (!Schema::hasTable('bon')) {
            Schema::create('bon', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->string('jenis')->nullable(); // 'in' atau 'out'
                $table->decimal('nominal', 15, 2)->default(0);
                $table->string('person')->nullable();
                $table->string('customer')->nullable();
                $table->string('user')->nullable();
                $table->string('akun_asal')->nullable();
                $table->string('ref_cashflow')->nullable();
                $table->string('ref_menu')->nullable();
                $table->string('ref_gaji')->nullable();
                $table->string('operator')->nullable();
                $table->text('note')->nullable();
                $table->string('status')->nullable();
                $table->string('created_date')->nullable();
                $table->string('persontext')->nullable();
                $table->json('file')->nullable();
                $table->string('created_at')->nullable();
            });
        }

        // 9. Report (Laporan Rekap Harian)
        if (!Schema::hasTable('report')) {
            Schema::create('report', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->decimal('kasir_toko', 15, 2)->default(0);
                $table->decimal('omset_toko', 15, 2)->default(0);
                $table->decimal('omset_minuman', 15, 2)->default(0);
                $table->decimal('omset_servis', 15, 2)->default(0);
                $table->decimal('laba_penjualan', 15, 2)->default(0);
                $table->decimal('laba_minuman', 15, 2)->default(0);
                $table->decimal('laba_service', 15, 2)->default(0);
                $table->decimal('pemasukan_lain', 15, 2)->default(0);
                $table->decimal('pengeluaran_lain', 15, 2)->default(0);
                $table->decimal('operasional_toko', 15, 2)->default(0);
                $table->decimal('hutang', 15, 2)->default(0);
                $table->decimal('piutang', 15, 2)->default(0);
                $table->string('created_at')->nullable();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('report');
        Schema::dropIfExists('bon');
        Schema::dropIfExists('ongkos');
        Schema::dropIfExists('cashflow');
        Schema::dropIfExists('log_stock');
        Schema::dropIfExists('menu');
        Schema::dropIfExists('produk');
        Schema::dropIfExists('user');
        Schema::dropIfExists('dropdown');
    }
};
