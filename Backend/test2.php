<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$c = \App\Models\Cashflow::first();

// simulate what WebhookController does
$old = [
  'id' => $c->id,
  'account_1' => 'random_old_id',
  'mutasi' => 'in',
  'nominal' => 50000
];

$setOriginal = function ($old) {
    $this->original = array_merge($this->original, $old);
};
$setOriginal->call($c, $old);

echo "newAcc1: " . $c->account_1 . "\n";
echo "oldAcc1: " . $c->getOriginal('account_1') . "\n";

