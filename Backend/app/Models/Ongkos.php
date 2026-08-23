<?php

namespace App\Models;

use App\Models\Traits\HasPocketbaseId;
use Illuminate\Database\Eloquent\Model;

class Ongkos extends Model
{
    use HasPocketbaseId;

    protected $table = 'ongkos';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'ongkos' => 'float',
    ];

    public function menu()
    {
        return $this->belongsTo(Menu::class, 'ref_baru');
    }
}
