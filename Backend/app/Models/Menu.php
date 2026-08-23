<?php

namespace App\Models;

use App\Models\Traits\HasPocketbaseId;
use Illuminate\Database\Eloquent\Model;

class Menu extends Model
{
    use HasPocketbaseId;

    protected $table = 'menu';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'total' => 'float',
        'dibayar' => 'float',
        'cashback' => 'float',
        'admin' => 'float',
        'qty' => 'float',
        'file' => 'array',
    ];

    public function logStocks()
    {
        return $this->hasMany(LogStock::class, 'ref_baru');
    }

    public function cashflows()
    {
        return $this->hasMany(Cashflow::class, 'ref_baru');
    }

    public function ongkos()
    {
        return $this->hasMany(Ongkos::class, 'ref_baru');
    }

    public function bons()
    {
        return $this->hasMany(Bon::class, 'ref_menu');
    }
}
