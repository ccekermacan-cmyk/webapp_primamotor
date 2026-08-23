<?php

namespace App\Models\Traits;

use Illuminate\Support\Str;

trait HasPocketbaseId
{
    public function getIncrementing()
    {
        return false;
    }

    public function getKeyType()
    {
        return 'string';
    }

    protected static function bootHasPocketbaseId(): void
    {
        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = Str::random(15);
            }
        });
    }
}
