<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$model = \App\Models\Cashflow::first();
echo "Model account_1: " . $model->account_1 . "\n";

$oldData = ['account_1' => 'old_acc', 'mutasi' => 'out', 'nominal' => 50000];
$setOriginal = function ($old) {
    $this->original = array_merge($this->original, $old);
};
$setOriginal->call($model, $oldData);

echo "Original account_1: " . $model->getOriginal('account_1') . "\n";
