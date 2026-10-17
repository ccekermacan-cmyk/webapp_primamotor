<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        foreach (['cashflow' => ['saldo_awal', 'saldo_akhir'], 'log_stock' => ['stok_awal', 'stok_akhir']] as $table => $columns) {
            foreach ($columns as $column) {
                if (!Schema::hasColumn($table, $column)) {
                    Schema::table($table, fn (Blueprint $blueprint) => $blueprint->decimal($column, 18, 2)->nullable());
                }
            }
        }
    }

    public function down(): void
    {
        // PocketBase owns these columns in deployed databases; never remove its fields on rollback.
    }
};
