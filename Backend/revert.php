<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$c = \App\Models\Cashflow::find('52yvs12jzoho21p');
$otherAcc = DB::table('dropdown')->where('id', '!=', $c->account_1)->where('jenis', 'like', '%cashflow%')->first();

DB::table('dropdown')->where('id', $c->account_1)->decrement('number_1', 447000);
DB::table('dropdown')->where('id', $otherAcc->id)->increment('number_1', 447000);

echo "Reverted.\n";
