<?php
require __DIR__.'/../../../../vendor/autoload.php';
$app = require_once __DIR__.'/../../../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$cfs = \App\Models\Cashflow::all();
echo "Total Cashflows: " . $cfs->count() . "\n";
foreach($cfs as $c) {
    echo "ID: {$c->id}, Ref: {$c->ref_baru}, Nominal: {$c->nominal}, Mutasi: {$c->mutasi}\n";
}
