<?php

namespace App\Models;

use App\Models\Traits\HasPocketbaseId;
use Illuminate\Database\Eloquent\Model;

class Cashflow extends Model
{
    use HasPocketbaseId;

    protected $table = 'cashflow';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'nominal' => 'float',
        'file' => 'array',
    ];

    public function account1()
    {
        return $this->belongsTo(Dropdown::class, 'account_1');
    }

    public function account2()
    {
        return $this->belongsTo(Dropdown::class, 'account_2');
    }

    public function menu()
    {
        return $this->belongsTo(Menu::class, 'ref_baru');
    }

    public function bons()
    {
        return $this->hasMany(Bon::class, 'ref_cashflow');
    }
}
