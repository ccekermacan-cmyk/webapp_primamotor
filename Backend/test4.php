<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$c = \App\Models\Cashflow::find('52yvs12jzoho21p');
echo "Current Account: " . $c->account_1 . "\n";
echo "Current Nominal: " . $c->nominal . "\n";

// Get another account
$otherAcc = DB::table('dropdown')->where('id', '!=', $c->account_1)->where('jenis', 'like', '%cashflow%')->first();
echo "Other Account: " . $otherAcc->id . "\n";

$oldBalCurrent = DB::table('dropdown')->where('id', $c->account_1)->value('number_1');
$oldBalOther = $otherAcc->number_1;
echo "Old Bal Current (should revert): " . $oldBalCurrent . "\n";
echo "Old Bal Other (should stay same): " . $oldBalOther . "\n";

$req = \Illuminate\Http\Request::create('/api/webhook/cashflow/updated/52yvs12jzoho21p', 'POST', [
    'old_data' => [
        'id' => '52yvs12jzoho21p',
        'mutasi' => $c->mutasi,
        'jenis' => $c->jenis,
        'account_1' => $otherAcc->id, // old_data had the OTHER account
        'nominal' => $c->nominal
    ]
]);
$response = $app->handle($req);
echo $response->getContent() . "\n";

$newBalCurrent = DB::table('dropdown')->where('id', $c->account_1)->value('number_1');
$newBalOther = DB::table('dropdown')->where('id', $otherAcc->id)->value('number_1');

echo "New Bal Current (new account applied): " . $newBalCurrent . "\n";
echo "New Bal Other (old account reverted): " . $newBalOther . "\n";

