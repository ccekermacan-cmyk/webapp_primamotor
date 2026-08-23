<?php
require __DIR__.'/../../../../vendor/autoload.php';
$app = require_once __DIR__.'/../../../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$model = \App\Models\Cashflow::first();
echo "Current nominal: " . $model->nominal . "\n";
echo "Original nominal before: " . $model->getOriginal('nominal') . "\n";

$old_data = ['nominal' => 999999];
$setOriginal = function ($old) {
    $this->original = array_merge($this->original, $old);
};
$setOriginal->call($model, $old_data);

echo "Original nominal after: " . $model->getOriginal('nominal') . "\n";
