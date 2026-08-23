<?php

namespace App\Models;

use App\Models\Traits\HasPocketbaseId;
use Illuminate\Database\Eloquent\Model;

class Bon extends Model
{
    use HasPocketbaseId;

    protected $table = 'bon';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'nominal' => 'float',
        'file' => 'array',
    ];

    public function dropdown()
    {
        return $this->belongsTo(Dropdown::class, 'person');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user');
    }
}
