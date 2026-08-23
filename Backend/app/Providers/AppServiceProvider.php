<?php

namespace App\Providers;

use App\Models\Bon;
use App\Models\Cashflow;
use App\Models\LogStock;
use App\Models\Menu;
use App\Models\Ongkos;
use App\Observers\BonObserver;
use App\Observers\CashflowObserver;
use App\Observers\LogStockObserver;
use App\Observers\MenuObserver;
use App\Observers\OngkosObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Bon::observe(BonObserver::class);
        Ongkos::observe(OngkosObserver::class);
        LogStock::observe(LogStockObserver::class);
        Cashflow::observe(CashflowObserver::class);
        Menu::observe(MenuObserver::class);
    }
}
