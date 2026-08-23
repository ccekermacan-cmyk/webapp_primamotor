<?php

function patchCashflowObserver() {
    $file = 'app/Observers/CashflowObserver.php';
    $content = file_get_contents($file);

    $syncFunc = '
    private function syncMenuDibayar(string $menuId): void
    {
        if (!$menuId) return;
        $menu = \App\Models\Menu::find($menuId);
        if (!$menu) return;

        $totalDibayar = \Illuminate\Support\Facades\DB::table(\'cashflow\')
            ->where(\'ref_baru\', $menuId)
            ->sum(\'nominal\');

        $total = (float) $menu->total;
        $status = ($totalDibayar >= $total && $total > 0) ? \'lunas\' : \'belum\';

        if ((float) $menu->dibayar !== (float) $totalDibayar || $menu->status !== $status) {
            $menu->dibayar = $totalDibayar;
            $menu->status = $status;
            // Gunakan save() agar MenuObserver ikut menyesuaikan status Bon & Report (Hutang/Piutang)
            $menu->save();
        }
    }
';

    // Insert syncMenuDibayar inside the class
    $content = preg_replace('/class CashflowObserver\n{/', "class CashflowObserver\n{" . $syncFunc, $content);

    // Add to created
    $content = preg_replace('/public function created\(Cashflow \$cashflow\): void\n\s+{/', "public function created(Cashflow \$cashflow): void\n    {\n        \$this->syncMenuDibayar((string)\$cashflow->ref_baru);\n", $content);

    // Add to updated
    $content = preg_replace('/public function updated\(Cashflow \$cashflow\): void\n\s+{/', "public function updated(Cashflow \$cashflow): void\n    {\n        \$this->syncMenuDibayar((string)\$cashflow->ref_baru);\n        \$this->syncMenuDibayar((string)\$cashflow->getOriginal(\'ref_baru\'));\n", $content);

    // Add to deleted
    $content = preg_replace('/public function deleted\(Cashflow \$cashflow\): void\n\s+{/', "public function deleted(Cashflow \$cashflow): void\n    {\n        \$this->syncMenuDibayar((string)\$cashflow->ref_baru);\n", $content);

    file_put_contents($file, $content);
}

patchCashflowObserver();
