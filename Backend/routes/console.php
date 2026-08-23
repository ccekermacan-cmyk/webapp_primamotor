<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('report:create-daily')->dailyAt('00:01');
Schedule::command('report:cleanup-holiday')->dailyAt('00:00');
