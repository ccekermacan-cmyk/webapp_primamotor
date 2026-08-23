<?php

namespace App\Models;

use App\Models\Traits\HasPocketbaseId;
use Illuminate\Database\Eloquent\Model;

class Dropdown extends Model
{
    use HasPocketbaseId;

    protected $table = 'dropdown';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'number_1' => 'float',
        'number_2' => 'float',
        'number_3' => 'float',
        'number_4' => 'float',
        'number_5' => 'float',
        'file' => 'array',
    ];
}
