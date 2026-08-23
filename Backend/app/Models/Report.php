<?php

namespace App\Models;

use App\Models\Traits\HasPocketbaseId;
use Illuminate\Database\Eloquent\Model;

class Report extends Model
{
    use HasPocketbaseId;

    protected $table = 'report';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'kasir_toko' => 'float',
        'omset_toko' => 'float',
        'omset_minuman' => 'float',
        'omset_servis' => 'float',
        'laba_penjualan' => 'float',
        'laba_minuman' => 'float',
        'laba_service' => 'float',
        'pemasukan_lain' => 'float',
        'pengeluaran_lain' => 'float',
        'operasional_toko' => 'float',
        'hutang' => 'float',
        'piutang' => 'float',
    ];

    public static function findByDate(string $date): ?self
    {
        return static::where('created_at', 'like', $date . '%')->first();
    }
}
