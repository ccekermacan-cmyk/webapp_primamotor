<?php

namespace App\Observers;

use App\Models\Bon;
use App\Models\Dropdown;
use Illuminate\Support\Facades\DB;

class BonObserver
{
    private function firstId($raw): string
    {
        if (!$raw) return '';
        $s = trim((string) $raw);
        if (str_starts_with($s, '[')) {
            try {
                $arr = json_decode($s, true);
                return (!empty($arr) && is_array($arr)) ? (string) $arr[0] : '';
            } catch (\Throwable $e) {
                return '';
            }
        }
        return $s;
    }

    private function getDelta(string $jenis, float $nominal): float
    {
        return strtolower($jenis) === 'out' ? abs($nominal) : -abs($nominal);
    }

    public function created(Bon $bon): void
    {
        $personId = $this->firstId($bon->person);
        $nominal = (float) $bon->nominal;
        $jenis = strtolower((string) $bon->jenis);

        if (!$personId || $nominal == 0) return;

        $delta = $this->getDelta($jenis, $nominal);
        if ($delta > 0) {
            DB::table('dropdown')->where('id', $personId)->increment('number_1', $delta);
        } elseif ($delta < 0) {
            DB::table('dropdown')->where('id', $personId)->decrement('number_1', abs($delta));
        }
    }

    public function updated(Bon $bon): void
    {
        $oldNominal = (float) ($bon->getOriginal('nominal') ?? 0);
        $oldPersonId = $this->firstId($bon->getOriginal('person'));
        $oldJenis = strtolower((string) ($bon->getOriginal('jenis') ?? 'in'));

        $newNominal = (float) $bon->nominal;
        $newPersonId = $this->firstId($bon->person);
        $newJenis = strtolower((string) $bon->jenis);

        // Revert old effect
        if ($oldPersonId && $oldNominal != 0) {
            $oldDelta = $this->getDelta($oldJenis, $oldNominal);
            if ($oldDelta > 0) {
                DB::table('dropdown')->where('id', $oldPersonId)->decrement('number_1', $oldDelta);
            } elseif ($oldDelta < 0) {
                DB::table('dropdown')->where('id', $oldPersonId)->increment('number_1', abs($oldDelta));
            }
        }

        // Apply new effect
        if ($newPersonId && $newNominal != 0) {
            $newDelta = $this->getDelta($newJenis, $newNominal);
            if ($newDelta > 0) {
                DB::table('dropdown')->where('id', $newPersonId)->increment('number_1', $newDelta);
            } elseif ($newDelta < 0) {
                DB::table('dropdown')->where('id', $newPersonId)->decrement('number_1', abs($newDelta));
            }
        }
    }

    public function deleted(Bon $bon): void
    {
        $personId = $this->firstId($bon->person);
        $nominal = (float) $bon->nominal;
        $jenis = strtolower((string) $bon->jenis);

        if (!$personId || $nominal == 0) return;

        $delta = $this->getDelta($jenis, $nominal);
        if ($delta > 0) {
            DB::table('dropdown')->where('id', $personId)->decrement('number_1', $delta);
        } elseif ($delta < 0) {
            DB::table('dropdown')->where('id', $personId)->increment('number_1', abs($delta));
        }
    }
}
