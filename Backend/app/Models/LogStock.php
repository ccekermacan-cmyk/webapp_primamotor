<?php

namespace App\Models;

use App\Models\Traits\HasPocketbaseId;
use Illuminate\Database\Eloquent\Model;

class LogStock extends Model
{
    use HasPocketbaseId;

    protected $table = 'log_stock';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'qty' => 'integer',
        'price_1' => 'float',
        'price_2' => 'float',
        'normal' => 'float',
    ];

    public function produk()
    {
        return $this->belongsTo(Produk::class, 'item_baru');
    }

    public function menu()
    {
        return $this->belongsTo(Menu::class, 'ref_baru');
    }
}
