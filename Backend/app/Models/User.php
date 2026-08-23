<?php

namespace App\Models;

use App\Models\Traits\HasPocketbaseId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasPocketbaseId;

    protected $table = 'user';
    public $timestamps = false;
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'level' => 'float',
            'number' => 'float',
        ];
    }
}
