<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$c = \App\Models\Cashflow::find('52yvs12jzoho21p');
echo "Current Account: " . $c->account_1 . "\n";
$oldAcc = DB::table('dropdown')->where('id', $c->account_1)->value('number_1');
echo "Old Account Balance: " . $oldAcc . "\n";

$req = \Illuminate\Http\Request::create('/api/webhook/cashflow/updated/52yvs12jzoho21p', 'POST', [
    'old_data' => [
        'id' => '52yvs12jzoho21p',
        'mutasi' => $c->mutasi,
        'jenis' => $c->jenis,
        'account_1' => $c->account_1, // We simulate old account = current account
        'nominal' => $c->nominal
    ]
]);
$response = $app->handle($req);
echo $response->getContent() . "\n";

$newAcc = DB::table('dropdown')->where('id', $c->account_1)->value('number_1');
echo "New Account Balance: " . $newAcc . "\n";
