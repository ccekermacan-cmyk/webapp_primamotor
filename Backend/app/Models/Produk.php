<?php

namespace App\Models;

use App\Models\Traits\HasPocketbaseId;
use Illuminate\Database\Eloquent\Model;

class Produk extends Model
{
    use HasPocketbaseId;

    protected $table = 'produk';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'stok_1' => 'float',
        'stok_2' => 'float',
        'stok_3' => 'float',
        'beli' => 'float',
        'sell_1' => 'float',
        'sell_2' => 'float',
        'sell_3' => 'float',
        'sell_4' => 'float',
        'sell_5' => 'float',
        'sell_6' => 'float',
        'min_1' => 'float',
        'min_2' => 'float',
        'min_3' => 'float',
        'file' => 'array',
    ];
}
